// Player vehicles base class (tank, mech, gyrocopter...). A vehicle stands empty until a player
// enters it (press DOWN while overlapping, or drop onto its hatch). While driven it is the target
// enemies shoot at; it has an HP gauge. Press JUMP while holding DOWN to eject. When destroyed the
// pilot is thrown clear, the hull blinks and smokes, then the wreck explodes, damaging nearby enemies.
//
// Shared behaviour lives here so every vehicle feels the same:
//  - armor: hits are converted to HP damage by kind (rifle rounds chip, explosions hurt)
//  - hit flash, sparks, damage smoke (grey below 60% HP, black + flames below 30%)
//  - warning blink + alarm, then a big wreck explosion credited to the last driver
//  - pilot rendering (head + shoulders of the driver's character, in their palette)
//  - camera clamping, a wide "footprint" so treads/feet can bridge small gaps, landing detection
//  - secondary ammo refills (bomb crates) and repairs (fuel cans)
//  - an "enter" hint arrow over empty vehicles when a player on foot is near

import type { ActionState } from '../engine/input';
import type { PlayOpts } from '../engine/audio';
import { type Rect } from '../engine/math';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { fxRng } from '../engine/rng';
import { sprites } from '../engine/sprites';
import { drawHuman, type HumanoidStyle } from '../art/humanoid';
import { Actor } from './entity';
import { Z, type Damage, type DamageKind } from './constants';
import { getCharacter } from './characters';
import type { Player } from './player';
import type { World } from './world';

/**
 * Canonical SFX names (docs/DESIGN.md) used by vehicles. Playing them through vsfx() keeps the
 * names type-checked; tests/vehicles.test.ts checks this list against the design document.
 */
export const VEHICLE_SFX = [
  'vehicle_enter',
  'vehicle_exit',
  'vehicle_hit',
  'vehicle_cannon',
  'vehicle_vulcan',
  'mech_step',
  'mech_missile',
  'gyro_rotor',
  'alarm',
  'tank_tread',
  'engine',
  'metal_hit',
  'land',
  'out_of_ammo',
  'explosion_small',
  'explosion',
  'explosion_big',
  'shell_casing',
] as const;
export type VehicleSfx = (typeof VEHICLE_SFX)[number];

/** Play a canonical vehicle sound (positional). */
export function vsfx(world: World, name: VehicleSfx, x?: number, opts: PlayOpts = {}): void {
  world.sfx(name, x, opts);
}

/** HP lost per hit by damage kind (multiplied by the hit's amount, capped at MAX_HIT). */
export const VEHICLE_ARMOR: Record<DamageKind, number> = {
  bullet: 5,
  explosion: 14,
  fire: 4,
  melee: 8,
  laser: 7,
  crush: 22,
  electric: 7,
};
const MAX_HIT = 45;

// ------------------------------------------------------------------ pilot sprites

/** Pilot sprite frames (head + shoulders of the driver poking out of a hatch/cockpit). */
export const PILOT = { NORMAL: 0, SHOUT: 1, HURT: 2, HAPPY: 3, LOOK_UP: 4, COUNT: 5 } as const;
export const PILOT_W = 26;
export const PILOT_H = 26;
/** Origin = middle of the shoulder line. */
export const PILOT_OX = 12;
export const PILOT_OY = 16;

export function pilotSpriteName(charId: string, p2: boolean): string {
  return `pilot_${charId}${p2 ? '_p2' : ''}`;
}

/** Define (once) and return the pilot sprite for a character / palette. */
export function ensurePilotSprite(charId: string, p2: boolean): string {
  const name = pilotSpriteName(charId, p2);
  if (sprites.has(name)) return name;
  const c = getCharacter(charId);
  const style: HumanoidStyle = p2 ? { ...c.style, ...c.p2 } : c.style;
  sprites.define({
    name,
    w: PILOT_W,
    h: PILOT_H,
    ox: PILOT_OX,
    oy: PILOT_OY,
    frames: PILOT.COUNT,
    draw: (p, f) => {
      // drawHuman's origin is the feet; a standing shoulder is 23px above them.
      const OX = PILOT_OX;
      const OY = PILOT_OY + 23;
      const base = { hip: [0, -13] as [number, number], footB: [-2, 0] as [number, number], footF: [2, 0] as [number, number], part: 'upper' as const, gun: 'none' as const };
      switch (f) {
        case PILOT.SHOUT:
          drawHuman(p, OX, OY, { ...base, handF: [7, 4], handB: [5, 5], lean: 0.6, expr: 'shout' }, style);
          break;
        case PILOT.HURT:
          drawHuman(p, OX, OY, { ...base, handF: [5, 6], handB: [3, 7], lean: -0.6, headDx: -0.6, headDy: 0.6, expr: 'hurt' }, style);
          break;
        case PILOT.HAPPY:
          drawHuman(p, OX, OY, { ...base, handF: [3, -9], handB: [4, 6], expr: 'happy' }, style);
          break;
        case PILOT.LOOK_UP:
          drawHuman(p, OX, OY, { ...base, handF: [6, 5], handB: [4, 6], headDx: -0.4, headDy: -0.6, expr: 'normal' }, style);
          break;
        default:
          drawHuman(p, OX, OY, { ...base, handF: [6, 5], handB: [4, 6], expr: 'normal' }, style);
      }
    },
  });
  return name;
}

// Small bobbing arrow shown over empty vehicles when a player on foot is close.
sprites.fallback({
  name: 'vehicle_arrow',
  w: 9,
  h: 9,
  ox: 4,
  oy: 9,
  frames: 2,
  draw: (p, f) => {
    const c = f ? '#ffe070' : '#ffc040';
    p.rect(3, 0, 3, 4, c);
    p.poly([0, 4, 9, 4, 4.5, 9], c);
    p.vline(3, 0, 4, f ? '#fff6c0' : '#ffe070');
    p.poly([1.6, 4.6, 4.2, 4.6, 4.5, 7.4], f ? '#fff6c0' : '#ffe070');
  },
});

// ------------------------------------------------------------------ base class

export abstract class Vehicle extends Actor {
  readonly isVehicle = true;
  driver: Player | null = null;
  /** Last player who drove it (the wreck explosion scores for them). */
  lastDriver: Player | null = null;
  vehicleName = 'VEHICLE';
  /** Can a player get in right now? */
  canBeEntered = true;
  destroyed = false;
  destroyTimer = 0;
  /** Seconds between destruction and the wreck explosion. */
  wreckDelay = 1.0;
  /** Secondary ammo (cannon shells / missiles) shown on the HUD; -1 hides it. */
  secondaryAmmo = -1;
  /** Starting secondary ammo (bomb crates refill on top of it, up to 99). */
  maxSecondaryAmmo = -1;
  /** Free-flying vehicle (up/down steer instead of aim/crouch). The autopilot reads this. */
  flying = false;
  /** HP lost per hit by damage kind. */
  armor: Record<DamageKind, number> = { ...VEHICLE_ARMOR };
  /** Seconds since the last hit (pilot winces). */
  hurtTime = 9;
  /** Seconds since a player got in (pilot pop-up, hatch). */
  enterTime = 9;
  /** Seconds since the pilot last fired the main weapon (pilot shouts). */
  shoutTime = 9;
  /** Damage smoke source (local, facing right, relative to the feet). */
  smokeAt: [number, number] = [-8, -18];
  /** Colors for wreck debris. */
  debrisColors = ['#3a7664', '#56a084', '#5c6372', '#2c282e', '#8a92a0'];
  /** Half-width of the support footprint (treads/feet) used to bridge small gaps. */
  footprint = 0;
  /** Landed this step (after a jump/fall), and the speed it landed with. */
  touchdown = false;
  touchdownVy = 0;
  /** Seconds the vehicle has been airborne. */
  airTime = 0;
  /** Seconds after an eject before the same vehicle can be entered again. */
  private reenter = 0;
  private smokeT = 0;
  private popT = 0;
  private wasGrounded = true;
  private fallPeakVy = 0;

  constructor() {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.VEHICLE;
    this.hp = this.maxHp = 60;
    this.stepUp = 8;
    this.stepDown = 10;
  }

  /** Area a player must overlap to get in. */
  entryBox(): Rect {
    const b = this.box;
    return { x: b.x + 2, y: b.y - 6, w: b.w - 4, h: b.h + 4 };
  }

  enter(p: Player): void {
    if (this.driver || this.destroyed || this.reenter > 0 || !this.canBeEntered) return;
    this.driver = p;
    this.lastDriver = p;
    p.enterVehicle(this);
    this.team = 'player';
    this.hittable = true;
    this.facing = p.facing;
    this.enterTime = 0;
    this.hurtTime = 9;
    // Respawned straight into a vehicle: share the drop-in invulnerability.
    if (p.invuln > 0.3) this.invuln = Math.max(this.invuln, p.invuln);
    this.world.invalidateTargets();
    vsfx(this.world, 'vehicle_enter', this.x);
    this.world.particles.dust(this.x, this.y, 5);
    this.onEnter(p);
  }

  /** Called by Player.exitVehicle. */
  onDriverExit(_p: Player): void {
    this.driver = null;
    this.team = 'neutral';
    this.hittable = false;
    this.reenter = 0.6;
    this.world.invalidateTargets();
    if (!this.destroyed) vsfx(this.world, 'vehicle_exit', this.x, { vol: 0.8 });
    this.onExit();
  }

  onEnter(_p: Player): void {}

  onExit(): void {}

  /** May the driver bail out right now (DOWN + JUMP)? */
  canEject(): boolean {
    return true;
  }

  /** Driven update: read input, move, fire. Call moveAndCollide yourself (see groundPhysics). */
  abstract drive(inp: ActionState, dt: number): void;

  /** Empty update (default: settle under gravity). */
  idle(dt: number): void {
    this.vx *= Math.pow(0.001, dt);
    if (Math.abs(this.vx) < 2) this.vx = 0;
    this.groundPhysics(dt);
  }

  override update(dt: number): void {
    if (this.reenter > 0) this.reenter -= dt;
    this.hurtTime += dt;
    this.enterTime += dt;
    this.shoutTime += dt;
    if (this.destroyed) {
      this.updateDestroyed(dt);
      return;
    }
    const d = this.driver;
    if (d && (d.dead || d.vehicle !== this)) {
      // Driver vanished (removed by script): free the seat.
      this.driver = null;
      this.team = 'neutral';
      this.hittable = false;
      this.world.invalidateTargets();
    }
    if (this.driver) {
      const inp = this.driver.inp;
      if (inp.held('down') && inp.pressed('jump') && this.canEject()) {
        this.driver.exitVehicle(true);
        this.idle(dt);
      } else {
        this.drive(inp, dt);
        this.clampToView();
      }
    } else {
      this.idle(dt);
      // Abandoned far behind the camera: tidy up.
      if (this.right < this.world.camera.x - 420) this.remove();
    }
    this.damageFx(dt);
  }

  // ------------------------------------------------------------------ physics helpers

  /**
   * moveAndCollide + footprint support (treads/feet bridge gaps narrower than the vehicle) +
   * touchdown detection. Ground vehicles call this from drive()/idle().
   */
  protected groundPhysics(dt: number): void {
    this.moveAndCollide(dt);
    if (this.dead) return;
    if (!this.onGround) this.supportFootprint();
    this.touchdown = false;
    if (this.onGround) {
      if (!this.wasGrounded) {
        this.touchdown = true;
        this.touchdownVy = this.fallPeakVy;
      }
      this.airTime = 0;
      this.fallPeakVy = 0;
    } else {
      this.airTime += dt;
      this.fallPeakVy = Math.max(this.fallPeakVy, this.vy);
    }
    this.wasGrounded = this.onGround;
  }

  /** Stay up (or land) when either end of the footprint is over a floor. */
  private supportFootprint(): void {
    if (this.footprint <= 0 || this.vy < 0) return;
    const T = this.world.terrain;
    let best: { y: number; surface: any; solid: any } | null = null;
    for (const dx of [-this.footprint, this.footprint]) {
      const hit = T.floorAt(this.x + dx, this.y - this.stepUp, this.y + 2, { solidTolerance: 0 });
      if (hit && (!best || hit.y < best.y)) best = hit;
    }
    if (!best) return;
    if (!this.wasGrounded) this.landVy = this.vy;
    this.y = best.y;
    this.vy = 0;
    this.onGround = true;
    this.groundSurface = best.surface;
    this.groundSolid = best.solid;
  }

  /** Keep a driven vehicle inside the camera view (forward-only scrolling). */
  protected clampToView(): void {
    const cam = this.world.camera;
    const lo = cam.x + this.w / 2 + 2;
    const hi = cam.x + VIEW_W - this.w / 2 - 2;
    if (this.x < lo) {
      const from = this.x;
      this.x = lo;
      if (this.vx < 0) this.vx = 0;
      this.shovedByScreen(1, from);
    }
    if (this.x > hi) {
      const from = this.x;
      this.x = hi;
      if (this.vx > 0) this.vx = 0;
      this.shovedByScreen(-1, from);
    }
    if (this.flying) {
      const top = cam.y + this.h + 14;
      const bottom = cam.y + VIEW_H - 6;
      const from = this.y;
      if (this.y < top) {
        this.y = top;
        if (this.vy < 0) this.vy = 0;
      }
      if (this.y > bottom) {
        this.y = bottom;
        if (this.vy > 0) this.vy = 0;
      }
      // The top or bottom edge (the view rising or diving past a hull) pushed us into terrain:
      // slide clear over or under it, as for a sideways shove (see shovedByScreen).
      if (this.y !== from && this.bodyBlocked()) this.slideClear();
    }
  }

  /**
   * The screen edge (auto-scroll, a co-op partner, an arena camera) pushed us into terrain: flyers
   * slide over or under it, ground vehicles climb low obstacles; otherwise stay pinned against the
   * wall rather than being dragged through it.
   */
  private shovedByScreen(dir: 1 | -1, from: number): void {
    if (!this.bodyBlocked()) return;
    if (this.flying ? this.slideClear() : this.climbOnto(dir, 36)) return;
    if (!this.bodyBlocked(from, this.y)) this.x = from;
  }

  /** Flyers: move to the nearest y (inside the view) where the hull is clear of terrain. */
  slideClear(range = 96): boolean {
    if (!this.bodyBlocked()) return true;
    const cam = this.world.camera;
    const top = cam.y + this.h + 14;
    const bottom = cam.y + VIEW_H - 6;
    for (let d = 1; d <= range; d++) {
      for (const y of [this.y - d, this.y + d]) {
        if (y < top || y > bottom || this.bodyBlocked(this.x, y)) continue;
        if (this.vy * (y - this.y) < 0) this.vy = 0;
        this.y = y;
        return true;
      }
    }
    return false;
  }

  override onFallOut(): void {
    const d = this.driver;
    if (d) d.exitVehicle(false);
    this.remove();
  }

  // ------------------------------------------------------------------ damage

  override damage(d: Damage): boolean {
    if (!this.driver || this.destroyed) return false;
    if (d.amount <= 0) return true;
    if (this.invuln > 0) return true;
    const per = this.armor[d.kind] ?? 5;
    const amt = Math.min(MAX_HIT, per * Math.max(1, d.amount));
    this.hp -= amt;
    this.flash = 0.08;
    this.hurtTime = 0;
    vsfx(this.world, 'vehicle_hit', this.x, { vol: 0.6 });
    const hx = d.x ?? this.cx;
    const hy = d.y ?? this.cy;
    this.world.particles.sparks(hx, hy, d.kind === 'explosion' ? 8 : 4, '#ffe080', 120);
    if (d.kind === 'explosion') this.world.shake(2, 0.15);
    if (this.hp <= 0) {
      this.hp = 0;
      this.startDestruction();
    }
    return true;
  }

  /** Repair (fuel can pickup). */
  repair(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Refill secondary ammo (bomb crate while driving). Returns false if this vehicle has none. */
  refillAmmo(n: number): boolean {
    if (this.secondaryAmmo < 0) return false;
    this.secondaryAmmo = Math.min(99, this.secondaryAmmo + n);
    return true;
  }

  startDestruction(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyTimer = 0;
    this.hittable = false;
    const d = this.driver;
    if (d) {
      d.exitVehicle(true);
      d.invuln = Math.max(d.invuln, 1.6);
    }
    this.driver = null;
    this.team = 'neutral';
    this.world.invalidateTargets();
    vsfx(this.world, 'alarm', this.x);
    this.world.shake(3, 0.3);
    this.world.particles.sparks(this.cx, this.cy, 12, '#ffd060', 180);
    this.onDestroyed();
  }

  /** Hook: just started blowing up (before the wreck explosion). */
  onDestroyed(): void {}

  /** Blinking, smoking countdown to the wreck explosion. */
  protected updateDestroyed(dt: number): void {
    this.destroyTimer += dt;
    this.vx *= Math.pow(0.05, dt);
    this.gravityScale = 1;
    this.moveAndCollide(dt);
    if (this.dead) return;
    this.popT -= dt;
    if (this.popT <= 0) {
      this.popT = 0.16;
      const px = this.x + fxRng.range(-this.w / 2, this.w / 2);
      const py = this.y - fxRng.range(4, this.h);
      this.world.particles.smokePuffs(px, py, 2, 4, '#3a3a40', '#1c1c22');
      this.world.particles.sparks(px, py, 4, '#ffd060', 140);
      if (fxRng.chance(0.35)) this.world.effect('explosion_tiny', px, py);
    }
    const crashed = this.flying && this.onGround && this.destroyTimer > 0.15;
    if (this.destroyTimer > this.wreckDelay || crashed) this.explodeWreck();
  }

  protected explodeWreck(): void {
    const w = this.world;
    w.explode(this.cx, this.cy, { radius: 48, damage: 20, team: 'player', owner: this.lastDriver, size: 'huge', shake: 6 });
    w.particles.debris(this.cx, this.cy, 22, this.debrisColors, 280);
    w.particles.smokePuffs(this.cx, this.cy - 6, 8, 14, '#3a3a40', '#1c1c22');
    for (let i = 0; i < 3; i++) {
      const ex = this.cx + fxRng.range(-this.w / 2, this.w / 2);
      const ey = this.cy + fxRng.range(-8, 6);
      w.effect('explosion_medium', ex, ey, { fps: 18 + i * 3 });
    }
    w.flash('#ffffff', 0.25);
    this.onWrecked();
    this.remove();
  }

  /** Hook after the wreck explodes. */
  onWrecked(): void {}

  /** Blink while about to explode. */
  protected get warningBlink(): boolean {
    return this.destroyed && Math.floor(this.destroyTimer * (this.destroyTimer > this.wreckDelay * 0.6 ? 22 : 12)) % 2 === 0;
  }

  /** Draw layers white this frame (hit flash or warning blink). */
  protected get flashOn(): boolean {
    return this.flash > 0 || this.warningBlink;
  }

  /** Skip drawing this frame (respawn invulnerability blink). */
  protected get blinkHidden(): boolean {
    return !this.destroyed && this.invuln > 0 && this.driver !== null && Math.floor(this.invuln * 16) % 2 === 0;
  }

  /** Smoke from damaged engines. */
  private damageFx(dt: number): void {
    const frac = this.hp / this.maxHp;
    if (frac >= 0.6 || !this.driver) return;
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    const bad = frac < 0.3;
    this.smokeT = bad ? 0.07 : 0.16;
    const sx = this.x + this.smokeAt[0] * this.facing + fxRng.range(-2, 2);
    const sy = this.y + this.smokeAt[1];
    const P = this.world.particles;
    P.add({
      kind: 'smoke',
      x: sx,
      y: sy,
      vx: -this.vx * 0.3 + fxRng.range(-8, 8),
      vy: fxRng.range(-38, -22),
      life: fxRng.range(0.5, 0.9),
      color: bad ? '#3a3640' : '#8a8a92',
      color2: bad ? '#1e1c24' : '#5a5a62',
      size: 1.5,
      size2: bad ? 5 : 4,
      drag: 1.2,
    });
    if (bad && fxRng.chance(0.35)) {
      P.add({ kind: 'px', x: sx + fxRng.range(-2, 2), y: sy + 2, vx: fxRng.range(-10, 10), vy: fxRng.range(-50, -25), life: 0.25, color: '#ffd040', color2: '#ff6a20' });
    }
    if (bad && fxRng.chance(0.08)) P.sparks(sx, sy, 3, '#ffe080', 90);
  }

  // ------------------------------------------------------------------ render helpers

  /** Pilot frame for the current situation. */
  protected pilotFrame(): number {
    if (this.hurtTime < 0.3) return PILOT.HURT;
    if (this.shoutTime < 0.25) return PILOT.SHOUT;
    if (this.world.state === 'complete') return PILOT.HAPPY;
    return PILOT.NORMAL;
  }

  /**
   * Draw the driver's head + shoulders with the middle of the shoulder line at (x, y).
   * Draw this BEFORE the hull so the hatch rim covers the pilot's lower body.
   */
  protected drawPilot(g: CanvasRenderingContext2D, x: number, y: number, frame = this.pilotFrame()): void {
    const d = this.driver;
    if (!d) return;
    const name = ensurePilotSprite(d.char.id, d.index === 1);
    // Pop up out of the hatch when getting in.
    const pop = this.enterTime < 0.22 ? Math.round((1 - this.enterTime / 0.22) * 8) : 0;
    sprites.get(name).draw(g, x, y + pop, frame, { flip: this.facing < 0, flash: this.flashOn });
  }

  /** Bobbing arrow over an empty vehicle when a player on foot is close. */
  protected renderEnterHint(g: CanvasRenderingContext2D): void {
    if (this.driver || this.destroyed || !this.canBeEntered || this.reenter > 0) return;
    let near = false;
    for (const p of this.world.players) {
      if (p.state === 'play' && Math.abs(p.x - this.x) < 110 && Math.abs(p.y - this.y) < 90) near = true;
    }
    if (!near) return;
    const t = this.world.time;
    const bob = Math.round(Math.sin(t * 6) * 2);
    sprites.get('vehicle_arrow').draw(g, this.x, this.top - 6 + bob, Math.floor(t * 4) % 2);
  }

  /** World position of a local offset (facing right, relative to the feet). */
  protected local(lx: number, ly: number): { x: number; y: number } {
    return { x: this.x + lx * this.facing, y: this.y + ly };
  }
}

/** Type guard: is this entity a vehicle? */
export function isVehicle(e: unknown): e is Vehicle {
  return !!e && (e as any).isVehicle === true;
}
