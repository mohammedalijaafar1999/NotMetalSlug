// Shared base for Rustcoat Legion foot soldiers.
//
//  - Awareness: calm states (idle / patrol / sleep / chat) -> surprised "!" hop ('alert') -> combat.
//    Officers' whistles call alert() on nearby troops (wake up + rally buff).
//  - Personality: panic-running (or cowering) when a player gets very close with a heavy weapon
//    or a vehicle, "zzz" / "..." bubbles for sleeping / chatting soldiers, sweat drops.
//  - Standard death handling for SF soldier sprites: flung + spinning on explosions, charred and
//    crumbling to ash on fire, knocked down otherwise.
//
// Subclasses implement combat(dt) (everything that is not calm/alert/panic) and may override
// aliveFrame() for their own states.
//
// Common props (all infantry): facing: 1|-1, drop: pickup spec,
//   behavior: 'patrol' (default) | 'guard' | 'idle' | 'sleep' | 'chat' | 'charge'

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import type { PlayOpts } from '../../engine/audio';
import { SF } from '../../art/soldier';
import { Enemy } from '../../game/enemy';
import { Entity } from '../../game/entity';
import { Z, type Damage } from '../../game/constants';
import type { World } from '../../game/world';

// ------------------------------------------------------------------ speech bubbles & small fx

/** fx_bubble frames. */
export const BUBBLE = { ALERT: 0, QUESTION: 1, CHAT: 2, NOTE: 3, ZZZ: 4, SWEAT: 5, ANGRY: 6, COUNT: 7 } as const;

sprites.define({
  name: 'fx_bubble',
  w: 11,
  h: 12,
  ox: 5,
  oy: 11,
  frames: BUBBLE.COUNT,
  draw: (p, f) => {
    const paper = '#f8f2e0';
    const ink = '#c8281e';
    const bubble = (fill = paper) => {
      p.rect(1, 0, 9, 9, fill);
      p.rect(0, 1, 11, 7, fill);
      p.tri(2, 8, 5.5, 8, 2, 11.5, fill);
      p.rect(1, 7, 9, 1, '#d8ccb0');
      p.px(1, 8, '#d8ccb0');
    };
    switch (f) {
      case BUBBLE.ALERT:
        bubble();
        p.rect(4.5, 1.5, 2, 4, ink);
        p.rect(4.5, 6, 2, 1.5, ink);
        break;
      case BUBBLE.QUESTION:
        bubble();
        p.rect(4, 1.5, 3, 1, '#2a4aa0');
        p.px(7, 2, '#2a4aa0');
        p.px(7, 3, '#2a4aa0');
        p.px(6, 4, '#2a4aa0');
        p.px(5, 5, '#2a4aa0');
        p.px(5, 6.5, '#2a4aa0');
        p.px(3, 2, '#2a4aa0');
        break;
      case BUBBLE.CHAT:
        bubble();
        p.rect(2, 4, 1.5, 1.5, '#3a3040');
        p.rect(5, 4, 1.5, 1.5, '#3a3040');
        p.rect(8, 4, 1.5, 1.5, '#3a3040');
        break;
      case BUBBLE.NOTE:
        bubble('#fff6c0');
        p.rect(6, 1.5, 1, 5, '#2a2030');
        p.circle(5, 6.5, 1.4, '#2a2030');
        p.rect(7, 1.5, 2, 1, '#2a2030');
        p.px(8, 2.5, '#2a2030');
        break;
      case BUBBLE.ZZZ:
        // Letter only: a fat "Z".
        p.rect(2, 2, 6, 1.5, '#d8f0ff');
        p.line(7, 3.5, 3, 7, '#d8f0ff', 2);
        p.rect(2, 7.5, 6, 1.5, '#d8f0ff');
        break;
      case BUBBLE.SWEAT:
        p.circle(5.5, 7.5, 2, '#9ad8ff');
        p.tri(3.6, 7, 7.4, 7, 5.5, 3, '#9ad8ff');
        p.px(5, 7, '#ffffff');
        break;
      case BUBBLE.ANGRY:
        bubble('#ffd0c0');
        p.rect(2.5, 1.5, 2, 4, ink);
        p.rect(2.5, 6, 2, 1.5, ink);
        p.rect(6.5, 1.5, 2, 4, ink);
        p.rect(6.5, 6, 2, 1.5, ink);
        break;
    }
  },
});

/** A little floating speech bubble / glyph that pops in above an entity and fades away. */
export class Bubble extends Entity {
  frame: number;
  follow: Entity | null;
  dx: number;
  dy: number;
  life: number;
  rise: number;
  wobble: number;

  constructor(frame: number, follow: Entity | null, x: number, y: number, opts: { life?: number; rise?: number; wobble?: number } = {}) {
    super();
    this.frame = frame;
    this.follow = follow;
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.dx = follow ? x - follow.x : 0;
    this.dy = follow ? y - follow.y : 0;
    this.life = opts.life ?? 0.8;
    this.rise = opts.rise ?? 6;
    this.wobble = opts.wobble ?? 0;
    this.z = Z.FX;
    this.persistent = true;
  }

  override update(dt: number): void {
    const f = this.follow;
    if (f && !f.dead) {
      this.x = f.x + this.dx;
      this.y = f.y + this.dy;
    } else {
      this.y -= this.rise * dt;
    }
    this.dy -= this.rise * dt;
    if (this.age >= this.life) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.age > this.life - 0.2 && Math.floor(this.age * 20) % 2 === 0) return;
    const pop = this.age < 0.06 ? -2 : this.age < 0.12 ? -1 : 0;
    const wx = this.wobble ? Math.round(Math.sin(this.age * 6) * this.wobble) : 0;
    sprites.get('fx_bubble').draw(g, this.x + wx, this.y + pop, this.frame);
  }
}

// ------------------------------------------------------------------ helpers

const sfxClock = new WeakMap<World, Map<string, number>>();

/** Is a player with a heavy weapon (or a vehicle) within `range` px horizontally? Returns it. */
export function heavyThreat(e: Enemy, range: number, vrange = 36): Entity | null {
  for (const p of e.world.players) {
    if (!p.isTargetable) continue;
    if (!p.vehicle && !p.weapon.heavy) continue;
    const t = e.world.targetOf(p);
    if (Math.abs(t.x - e.x) < range + t.w / 2 && Math.abs(t.cy - e.cy) < vrange) return t;
  }
  return null;
}

/** Snap an angle to 45-degree steps (chunky pixel-art rotation). */
export function snapAngle(a: number, steps = 8): number {
  const s = (Math.PI * 2) / steps;
  return Math.round(a / s) * s;
}

// ------------------------------------------------------------------ base class

export abstract class Infantry extends Enemy {
  /** SF sprite set used by the default rendering. */
  sprite: string;
  behavior: string;
  homeX = 0;
  walkPhase = 0;
  /** Countdown to the next attack (subclasses decide what an attack is). */
  attackTimer = 0;
  /** First attack delay after engaging (seconds, before difficulty scaling). */
  firstAttack = 0.9;
  /** Range (px) at which a calm soldier notices players. */
  sightRange = 220;
  /** Seconds of surprised "!" before engaging. */
  alertDelay = 0.35;
  /** Panic tendency (0 = never panics). */
  panicProne = 1;
  /** Patrol half-width around the spawn point and speed. */
  patrolRange = 48;
  patrolSpeed = 22;
  /** Set while panicking with nowhere to run (cowering). */
  cowering = false;
  protected panicCd = 1.5;
  protected panicDur = 1.2;
  protected panicDir: 1 | -1 = 1;
  private panicRoll = 0;
  private bubbleTimer = 0;
  private spinDir: 1 | -1 = 1;
  private ashed = false;

  constructor(sprite: string, props: Record<string, any> = {}) {
    super();
    this.sprite = sprite;
    this.w = 12;
    this.h = 26;
    this.hp = this.maxHp = 1;
    this.meleeable = true;
    this.behavior = props.behavior ?? 'patrol';
    if (fxRng.chance(0.45)) this.deathSfx = 'enemy_die2';
  }

  override spawned(): void {
    super.spawned();
    this.homeX = this.x;
    this.attackTimer = this.fireDelay(this.firstAttack);
    this.bubbleTimer = fxRng.range(0.3, 2);
    this.setState(this.startState());
    if (this.state === 'chat') {
      // Face the nearest buddy to chat with.
      let best: Enemy | null = null;
      let bd = 60;
      for (const a of this.alliesNear(60)) {
        const d = Math.abs(a.x - this.x);
        if (d > 2 && d < bd) {
          bd = d;
          best = a;
        }
      }
      if (best && this.props.facing === undefined) this.facing = best.x < this.x ? -1 : 1;
    }
  }

  /** State to start in, from props.behavior. */
  startState(): string {
    switch (this.behavior) {
      case 'charge':
        return 'engage';
      case 'idle':
      case 'guard':
        return 'idle';
      case 'sleep':
        return 'sleep';
      case 'chat':
        return 'chat';
      default:
        return 'patrol';
    }
  }

  /** Not yet aware of the players. */
  get calm(): boolean {
    return this.state === 'idle' || this.state === 'patrol' || this.state === 'sleep' || this.state === 'chat';
  }

  /** world.sfx with a per-world cooldown per sound (avoids choirs of identical yells). */
  sfx(name: string, opts: PlayOpts & { gap?: number } = {}): void {
    let m = sfxClock.get(this.world);
    if (!m) {
      m = new Map();
      sfxClock.set(this.world, m);
    }
    const gap = opts.gap ?? 0.12;
    const last = m.get(name);
    if (last !== undefined && this.world.time - last < gap && this.world.time >= last) return;
    m.set(name, this.world.time);
    this.world.sfx(name, this.x, opts);
  }

  /** Pop a speech bubble above the head. */
  say(frame: number, opts: { life?: number; rise?: number; dy?: number; dx?: number } = {}): Bubble {
    const b = new Bubble(frame, this, this.x + (opts.dx ?? this.facing * 4), this.y - this.h - 8 + (opts.dy ?? 0), { life: opts.life, rise: opts.rise });
    this.world.add(b);
    return b;
  }

  /** Can this soldier see a player (within range, on screen)? */
  sees(range = this.sightRange, vrange = 90): boolean {
    const t = this.target(range + 80);
    if (!t) return false;
    return Math.abs(t.x - this.x) < range && Math.abs(t.y - this.y) < vrange && this.onScreen(-10);
  }

  /** Noticed a player: surprised hop + "!", then 'alert' -> engage. */
  notice(big = false): void {
    this.setState('alert');
    this.faceTarget();
    this.vx = 0;
    const standing = this.onGround || (this.vy >= 0 && !!this.world.terrain.floorAt(this.x, this.y - 2, this.y + 2));
    if (standing) this.jump(big ? 150 : 95);
    this.sfx('enemy_alert', { gap: big ? 0.2 : 0.5, vol: big ? 0.6 : 0.4, pitch: fxRng.range(0.95, 1.2) });
  }

  /** Officer whistle / alarm: wake up and engage at once. */
  override alert(_by?: Entity | null): void {
    if (this.dying) return;
    if (this.calm) this.notice(this.state === 'sleep');
    this.attackTimer = Math.min(this.attackTimer, this.world.rng.range(0.35, 0.8));
  }

  // ---------------------------------------------------------------- panic

  /** Call from interruptible combat states. Starts a panic run and returns true sometimes. */
  checkPanic(dt: number): boolean {
    if (this.panicProne <= 0) return false;
    if (this.panicCd > 0) {
      this.panicCd -= dt;
      return false;
    }
    this.panicRoll -= dt;
    if (this.panicRoll > 0) return false;
    this.panicRoll = 0.25;
    const t = heavyThreat(this, 58);
    if (!t || !this.world.rng.chance(0.2 * this.panicProne * this.world.difficulty.aggression)) return false;
    this.panic(t);
    return true;
  }

  /** Run away from `from` (screaming) for a moment, then turn around and fight. */
  panic(from: Entity | null, duration?: number): void {
    this.panicDir = from ? (from.x < this.x ? 1 : -1) : ((-this.facing) as 1 | -1);
    this.panicDur = duration ?? this.world.rng.range(0.9, 1.5);
    this.panicCd = this.world.rng.range(3.5, 6);
    this.setState('panic');
    this.sfx('enemy_alert', { gap: 0.5, vol: 0.45, pitch: 1.4 });
    this.say(BUBBLE.SWEAT, { life: 0.5, rise: 14, dx: -this.panicDir * 6, dy: 4 });
  }

  protected panicThink(_dt: number): void {
    const dir = this.panicDir;
    this.facing = dir;
    const cam = this.world.camera;
    const nx = this.x + dir * 14;
    const inView = nx > cam.x + 10 && nx < cam.x + VIEW_W - 10;
    this.cowering = !(this.onGround && inView && this.floorAhead(dir) && this.hitWall !== dir);
    this.vx = this.cowering ? 0 : dir * 66;
    if (this.stateTime > this.panicDur) {
      this.cowering = false;
      this.faceTarget();
      this.setState('engage');
      this.attackTimer = Math.min(this.attackTimer, 0.5);
    }
  }

  // ---------------------------------------------------------------- behaviour

  /** Patrol back and forth around the spawn point (ledge-aware). */
  protected patrol(): void {
    const dir = Math.sin(this.age * 0.9 + this.id) > 0 ? 1 : -1;
    this.facing = dir;
    this.vx = this.floorAhead(dir) && Math.abs(this.x + dir * 2 - this.homeX) < this.patrolRange ? dir * this.patrolSpeed : 0;
  }

  /** Shared handling of calm / alert / panic states. Returns true if the state was handled. */
  protected calmThink(dt: number): boolean {
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        if (this.sees()) this.notice();
        return true;
      case 'patrol':
        this.patrol();
        if (this.sees()) this.notice();
        return true;
      case 'sleep':
        this.vx = 0;
        this.bubbleTimer -= dt;
        if (this.bubbleTimer <= 0 && this.onScreen(0)) {
          this.bubbleTimer = 1.1;
          this.say(BUBBLE.ZZZ, { life: 1.3, rise: 9, dx: this.facing * 6 + fxRng.range(-1, 1), dy: 10 }).wobble = 1.5;
        }
        if (this.sees(78, 40)) this.notice(true);
        return true;
      case 'chat':
        this.vx = 0;
        this.bubbleTimer -= dt;
        if (this.bubbleTimer <= 0 && this.onScreen(0)) {
          this.bubbleTimer = fxRng.range(1.6, 3.2);
          this.say(BUBBLE.CHAT, { life: 1.1, rise: 2 });
        }
        if (this.sees(150)) this.notice();
        return true;
      case 'alert':
        this.vx = 0;
        this.faceTarget();
        if (this.stateTime > this.alertDelay && this.onGround) this.setState('engage');
        return true;
      case 'panic':
        this.panicThink(dt);
        return true;
    }
    return false;
  }

  /** Everything except calm / alert / panic. */
  abstract combat(dt: number): void;

  think(dt: number): void {
    if (!this.calmThink(dt)) this.combat(dt);
    this.moveAndCollide(dt);
    this.advanceWalk(dt);
  }

  protected advanceWalk(dt: number): void {
    if (this.vx !== 0 && this.onGround) this.walkPhase += dt * Math.max(7, Math.min(14, Math.abs(this.vx) * 0.24));
  }

  // ---------------------------------------------------------------- death

  override onDeath(d?: Damage): void {
    this.spinDir = this.vx >= 0 ? 1 : -1;
    if (this.deathKind === 'explosion') {
      this.vx = Math.sign(this.vx || -this.facing) * 105;
      this.vy = -265;
      this.onGround = false;
    } else if (this.deathKind === 'fire') {
      this.world.particles.smokePuffs(this.x, this.y - 14, 3, 5, '#4a4a52', '#2a2a30');
    } else if (this.deathKind === 'melee') {
      this.world.particles.sparks(this.x, this.y - 14, 4, '#ffffff', 90);
    }
    void d;
  }

  override updateDeath(dt: number): void {
    const wasAir = !this.onGround;
    super.updateDeath(dt);
    if (wasAir && this.landed && this.deathTime > 0.1) {
      this.world.particles.dust(this.x, this.y, this.deathKind === 'explosion' ? 6 : 3);
      if (this.deathKind === 'explosion' && this.landVy > 160) {
        // Cartoon bounce.
        this.vy = -this.landVy * 0.3;
        this.onGround = false;
      }
    }
    if (this.deathKind === 'fire') {
      if (fxRng.chance(dt * 8)) this.world.particles.add({ kind: 'smoke', x: this.x + fxRng.range(-4, 4), y: this.y - fxRng.range(8, 24), vx: fxRng.range(-6, 6), vy: -20, life: 0.6, color: '#3a3a40', color2: '#5a5a60', size: 1, size2: 3 });
      if (!this.ashed && this.deathTime > 1.05) {
        this.ashed = true;
        this.world.particles.debris(this.x, this.y - 8, 10, ['#2a2a30', '#1c1c24', '#3a3a46'], 70);
        this.world.particles.smokePuffs(this.x, this.y - 10, 3, 6, '#3a3a40', '#2a2a30');
      }
    }
  }

  /** Standard SF death frame from the death kind / time / airborne state. */
  deathFrame(): number {
    if (this.deathKind === 'fire') return SF.BURNT;
    if (this.deathTime < 0.12) return SF.DIE;
    if (!this.onGround) return this.vy < 0 ? SF.DIE + 1 : SF.DIE + 2;
    return this.deathTime < 0.7 ? SF.DIE + 3 : SF.DIE + 4;
  }

  /** Frame for the shared calm/alert/panic states (null = not one of them). */
  calmFrame(): number | null {
    switch (this.state) {
      case 'alert':
        return SF.ALERT;
      case 'sleep':
        return SF.SLEEP + (Math.floor(this.age * 0.9) % 2);
      case 'chat': {
        const k = Math.floor(this.age * 1.7 + this.id * 0.37) % 4;
        return k === 0 ? SF.CHAT : k === 1 ? SF.IDLE : k === 2 ? SF.CHAT + 1 : SF.FIDGET;
      }
      case 'idle':
        return this.behavior === 'idle' ? SF.FIDGET + (Math.floor(this.age * 1.5) % 2) : SF.IDLE + (Math.floor(this.age * 2) % 2);
      case 'panic':
        return this.cowering ? SF.COWER + (Math.floor(this.age * 9) % 2) : SF.PANIC + (Math.floor(this.age * 10) % 2);
      case 'patrol':
        return this.walkFrame();
    }
    return null;
  }

  walkFrame(): number {
    return this.vx !== 0 ? SF.WALK + (Math.floor(this.walkPhase) % SF.WALK_N) : SF.IDLE + (Math.floor(this.age * 2) % 2);
  }

  /** Frame while alive (override for type-specific states). */
  aliveFrame(): number {
    return this.calmFrame() ?? this.walkFrame();
  }

  /** Ash has blown away (fire deaths). */
  get gone(): boolean {
    return this.ashed;
  }

  /**
   * Draw a soldier sprite at the feet, flipped to facing, with hit flash. Explosion deaths spin
   * the body around its middle in 45-degree steps while airborne.
   */
  drawBody(g: CanvasRenderingContext2D, name: string, frame: number, dy = 0): void {
    const s = sprites.get(name);
    const flip = this.facing < 0;
    if (this.dying && this.deathKind === 'explosion' && !this.onGround && this.deathTime > 0.06) {
      const a = snapAngle(this.deathTime * 13 * this.spinDir);
      s.draw(g, this.x - 12 * Math.sin(a), this.y + dy - 12 + 12 * Math.cos(a), SF.DIE + 1, { flip, rot: a });
      return;
    }
    s.draw(g, this.x, this.y + dy, frame, { flip, flash: this.flash > 0 });
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden || this.ashed) return;
    this.drawBody(g, this.sprite, this.dying ? this.deathFrame() : this.aliveFrame());
  }
}

/** Damage helper: was this hit dealt from the front of an entity facing `facing`? */
export function hitFromFront(e: Entity, d: Damage): boolean {
  const ox = d.x ?? d.owner?.x;
  if (ox !== undefined) return (ox - e.x) * e.facing > 0;
  return d.dir !== undefined ? d.dir === -e.facing : true;
}
