// FROST BASTION (boss_m3) hazards and projectiles. Everything the bastion throws at the player is
// telegraphed and dodgeable on foot:
//  - FallingIcicle: shakes under the battlement gallery over a growing floor shadow, then drops.
//  - FlakShell / IceFrag: an airburst over a blinking floor mark, three slow ice fragments fall
//    onto shadows.
//  - FrostLance: blinking aim line at HEAD height for ~1 s, then a beam across the arena - crouch.
//  - SpikeWave: a frost crack races along the floor, ice spikes erupt behind it - jump.
//  - Boulder: an avalanche boulder rolls along the battlement (visible), drops on a marked spot,
//    then rolls across the floor - jump it or shoot it apart.
// Every hazard carries `m3hazard = true` so the boss can clear them all when it dies.

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { rectsOverlap, segmentRect, type Rect } from '../../../engine/math';
import { Entity } from '../../../game/entity';
import { Projectile } from '../../../game/projectile';
import { ExplosionEffect } from '../../../game/effects';
import { Z, type Damage, type DamageKind } from '../../../game/constants';
import type { World } from '../../../game/world';
import type { SfxName } from '../../sfx/canonical';
import { GroundMarker, dottedLine, pixelEllipse, puffSnow, type MarkerStyle } from '../common/fx';
import { CORE, ICE, ICICLE_LEN } from './art';

/** Spike wave: speed (px/s), delay of the spikes behind the frost crack, time each spike stays up. */
export const SPIKE_SPEED = 180;
export const SPIKE_LEAD = 0.22;
export const SPIKE_ACTIVE = 0.18;

/** Gravity used by falling ice (icicles). */
export const ICE_G = 700;

/** Canonical sound at x (names are type-checked against the audio contract). */
export function snd(w: World, name: SfxName, x?: number, vol = 1, pitch = 1): void {
  w.sfx(name, x, { vol, pitch });
}

export interface HurtOnceOpts {
  kind?: DamageKind;
  owner?: Entity | null;
  /** Damage to a player vehicle (players on foot always take 1 = death). */
  vehicle?: number;
}

function hurtTarget(t: Entity, o: HurtOnceOpts, fromX: number): boolean {
  const isVeh = !!(t as { isVehicle?: boolean }).isVehicle;
  return t.damage({ amount: isVeh ? (o.vehicle ?? 10) : 1, kind: o.kind ?? 'crush', owner: o.owner ?? null, x: t.cx, y: t.cy, dir: Math.sign(t.cx - fromX) || -1 });
}

/** Damage each player-side target overlapping `r` at most once (ids collected in `hit`). */
export function hurtOnce(w: World, r: Rect, hit: Set<number>, o: HurtOnceOpts = {}): number {
  let n = 0;
  for (const t of w.targets('enemy').slice()) {
    if (t.dead || !t.hittable || hit.has(t.id)) continue;
    for (const hb of t.hurtboxes()) {
      if (!rectsOverlap(r, hb)) continue;
      hit.add(t.id);
      if (hurtTarget(t, o, r.x + r.w / 2)) n++;
      break;
    }
  }
  return n;
}

/** Same for a thick horizontal/oblique segment (beams). `half` = half thickness. */
export function hurtSegmentOnce(w: World, x0: number, y0: number, x1: number, y1: number, half: number, hit: Set<number>, o: HurtOnceOpts = {}): number {
  let n = 0;
  for (const t of w.targets('enemy').slice()) {
    if (t.dead || !t.hittable || hit.has(t.id)) continue;
    for (const hb of t.hurtboxes()) {
      const r = { x: hb.x - half, y: hb.y - half, w: hb.w + half * 2, h: hb.h + half * 2 };
      if (segmentRect(x0, y0, x1, y1, r) < 0) continue;
      hit.add(t.id);
      if (hurtTarget(t, o, x0)) n++;
      break;
    }
  }
  return n;
}

/**
 * Floor marker for anything about to land ('cross' = blinking brackets, 'shadow' = growing shadow).
 * Optionally vanishes early when the projectile it announces (`watch`) is gone.
 */
export class FloorMark extends GroundMarker {
  readonly m3hazard = true;
  watch: Entity | null = null;

  constructor(x: number, y: number, life: number, style: MarkerStyle = 'cross', radius = 8, watch: Entity | null = null) {
    super(x, y, life, style, radius);
    this.watch = watch;
  }

  override update(dt: number): void {
    if (this.watch && this.watch.dead) {
      this.remove();
      return;
    }
    super.update(dt);
  }
}

/** Ice splinters flying out of an impact. */
export function iceBurst(w: World, x: number, y: number, n = 8, speed = 80, front = true): void {
  for (let i = 0; i < n; i++) {
    w.particles.add({
      kind: 'px',
      x: x + fxRng.range(-3, 3),
      y: y + fxRng.range(-2, 1),
      vx: fxRng.range(-speed, speed),
      vy: -fxRng.range(speed * 0.5, speed * 1.6),
      gravity: 520,
      bounce: 0.3,
      life: fxRng.range(0.35, 0.8),
      color: fxRng.pick([ICE.white, ICE.light, ICE.light, ICE.mid]),
      size: fxRng.pick([1, 1, 2]),
      front,
    });
  }
}

// ------------------------------------------------------------------ icicle

/** An icicle that breaks off the battlement gallery: shakes over a floor shadow, then drops. */
export class FallingIcicle extends Entity {
  readonly m3hazard = true;
  private shakeT: number;
  private falling = false;
  private hit = new Set<number>();
  private groundY: number;
  private mark: FloorMark | null = null;
  readonly frame: number;

  /** (x, topY) = the point it hangs from. */
  constructor(owner: Entity, x: number, topY: number, groundY: number, shake: number, frame = 3) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.anchor = 'center';
    this.x = x;
    this.y = topY;
    this.w = 6;
    this.h = 20;
    this.groundY = groundY;
    this.shakeT = shake;
    this.frame = Math.max(0, Math.min(3, frame));
    this.z = Z.PROJECTILE - 1;
    this.persistent = true;
  }

  get len(): number {
    return ICICLE_LEN[this.frame];
  }

  /** Seconds until it hits the floor (shake + free fall). */
  get eta(): number {
    const h = Math.max(4, this.groundY - this.y - this.len);
    return Math.max(0, this.shakeT) + Math.sqrt((2 * h) / ICE_G);
  }

  override spawned(): void {
    this.mark = this.world.add(new FloorMark(this.x, this.groundY, this.eta, 'shadow', 7));
  }

  override update(dt: number): void {
    if (!this.falling) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) {
        this.falling = true;
        snd(this.world, 'glass_break', this.x, 0.28, 1.9);
        this.world.particles.add({ kind: 'px', x: this.x, y: this.y, vx: fxRng.range(-20, 20), vy: -20, gravity: 300, life: 0.4, color: ICE.white, size: 1 });
      }
      return;
    }
    this.vy += ICE_G * dt;
    this.y += this.vy * dt;
    const len = this.len;
    hurtOnce(this.world, { x: this.x - 3, y: this.y + len * 0.35, w: 6, h: len * 0.65 }, this.hit, { kind: 'crush', owner: this.owner, vehicle: 6 });
    if (this.y + len >= this.groundY) this.shatter();
  }

  shatter(): void {
    if (this.dead) return;
    const w = this.world;
    const gy = this.groundY;
    hurtOnce(w, { x: this.x - 7, y: gy - 9, w: 14, h: 9 }, this.hit, { kind: 'crush', owner: this.owner, vehicle: 6 });
    snd(w, 'glass_break', this.x, 0.6, fxRng.range(1.05, 1.35));
    iceBurst(w, this.x, gy - 2, 10, 75);
    puffSnow(w, this.x, gy - 1, 3, 40);
    this.mark?.remove();
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const wob = this.falling ? 0 : Math.round(Math.sin(this.age * 70) * (this.shakeT < 0.25 ? 1.2 : 0.7));
    sprites.get('bm3_icicle').draw(g, this.x + wob, this.y, this.frame);
  }
}

// ------------------------------------------------------------------ ice flak

/** Ice fragment from a flak airburst: falls slowly, shatters on anything. */
export class IceFrag extends Projectile {
  readonly m3hazard = true;

  constructor(owner: Entity | null, x: number, y: number, vx: number, vy: number, gravity: number) {
    super({ team: 'enemy', owner, x, y, vx, vy, gravity, w: 5, h: 5, sprite: 'bm3_shard', fps: 10, life: 3 });
    this.kind = 'crush';
    this.offscreenMargin = 80;
  }

  protected override impactFx(): void {
    iceBurst(this.world, this.x, this.y - 1, 5, 55);
    snd(this.world, 'glass_break', this.x, 0.25, fxRng.range(1.4, 1.8));
  }
}

/** Where an IceFrag launched with (vx, vy, g) from y lands on a floor at groundY (x, seconds). */
export function fragLanding(x: number, y: number, vx: number, vy: number, g: number, groundY: number): { x: number; t: number } {
  const dy = groundY - y;
  const t = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
  return { x: x + vx * t, t };
}

/** Flak shell: arcs to a burst point above the target, pops (harmless flash) into ice fragments. */
export class FlakShell extends Projectile {
  readonly m3hazard = true;
  private groundY: number;
  /** Fragment launch velocities (x, y) and their gravity. */
  static readonly FRAGS: ReadonlyArray<[number, number]> = [
    [-34, 30],
    [0, 40],
    [34, 30],
  ];
  static readonly FRAG_G = 190;
  /**
   * Radius of each fragment's landing shadow. The side fragments still drift ~5 px outward while
   * they fall through head height, so a shadow covers the whole band where a fragment can clip a
   * standing player: no "safe-looking" gap between two shadows kills (tests/boss_m3).
   */
  static readonly FRAG_SHADOW = 9;
  /** Shell gravity. */
  static readonly GRAV = 150;

  constructor(owner: Entity | null, x: number, y: number, bx: number, by: number, time: number, groundY: number) {
    const g = FlakShell.GRAV;
    const vx = (bx - x) / time;
    const vy = (by - y - 0.5 * g * time * time) / time;
    super({ team: 'enemy', owner, x, y, vx, vy, gravity: g, w: 5, h: 5, sprite: 'bm3_flakshell', fps: 12, life: time });
    this.groundY = groundY;
    this.offscreenMargin = 240;
  }

  protected override expire(): void {
    this.burst();
  }

  protected override onHitTerrain(): void {
    this.burst();
  }

  protected override onHitTarget(): void {
    this.burst();
  }

  burst(): void {
    if (this.dead) return;
    const w = this.world;
    const x = this.x;
    const y = this.y;
    w.add(new ExplosionEffect(x, y, 'small'));
    w.particles.sparks(x, y, 6, '#d8f4ff', 90);
    snd(w, 'explosion_small', x, 0.6, 1.25);
    for (const [vx, vy] of FlakShell.FRAGS) {
      w.add(new IceFrag(this.owner, x, y, vx, vy, FlakShell.FRAG_G));
      const l = fragLanding(x, y, vx, vy, FlakShell.FRAG_G, this.groundY);
      if (isFinite(l.t)) w.add(new FloorMark(l.x, this.groundY, l.t, 'shadow', FlakShell.FRAG_SHADOW));
    }
    this.remove();
  }

  override update(dt: number): void {
    super.update(dt);
    if (!this.dead && fxRng.chance(0.5)) {
      this.world.particles.add({ kind: 'smoke', x: this.x - this.vx * 0.02, y: this.y - this.vy * 0.02, vx: fxRng.range(-5, 5), vy: fxRng.range(-8, 0), life: 0.3, color: '#dce8f8', color2: '#8aa0c8', size: 1, size2: 3, drag: 2 });
    }
  }
}

// ------------------------------------------------------------------ frost lance

/**
 * The core's frost lance: a blinking aim line at head height (`charge` s), then a beam across the
 * arena (`fire` s), then a short fade. Standing players are hit; crouching players are safe
 * (the beam band stays above the crouched hitbox).
 */
export class FrostLance extends Entity {
  readonly m3hazard = true;
  tipX: number;
  beamY: number;
  endX: number;
  readonly charge: number;
  readonly fire: number;
  readonly fade = 0.28;
  /** Half thickness of the damaging band. */
  static readonly HALF = 3.5;
  t = 0;
  private hit = new Set<number>();
  private fxT = 0;
  /** Boss hooks. */
  onFire: (() => void) | null = null;

  constructor(owner: Entity, tipX: number, beamY: number, endX: number, charge: number, fire: number) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.anchor = 'center';
    this.tipX = tipX;
    this.beamY = beamY;
    this.endX = endX;
    this.x = (tipX + endX) / 2;
    this.y = beamY;
    this.w = Math.abs(tipX - endX);
    this.h = 8;
    this.charge = charge;
    this.fire = fire;
    this.z = Z.FX - 1;
    this.persistent = true;
  }

  get firing(): boolean {
    return this.t >= this.charge && this.t < this.charge + this.fire;
  }

  get charging(): boolean {
    return this.t < this.charge;
  }

  get total(): number {
    return this.charge + this.fire + this.fade;
  }

  override update(dt: number): void {
    const prev = this.t;
    this.t += dt;
    if (prev < this.charge && this.t >= this.charge) {
      snd(this.world, 'boss_laser', this.tipX, 0.9, 1.15);
      this.world.shake(2, 0.5);
      this.world.flash('#bfe8ff', 0.22);
      this.onFire?.();
    }
    if (this.firing) {
      hurtSegmentOnce(this.world, this.endX, this.beamY, this.tipX, this.beamY, FrostLance.HALF, this.hit, { kind: 'laser', owner: this.owner, vehicle: 16 });
      this.fxT -= dt;
      if (this.fxT <= 0) {
        this.fxT = 0.03;
        const x = this.endX + fxRng.next() * (this.tipX - this.endX);
        this.world.particles.add({ kind: 'px', x, y: this.beamY + fxRng.range(-4, 4), vx: fxRng.range(-30, -5), vy: fxRng.range(-14, 14), life: fxRng.range(0.25, 0.5), color: fxRng.pick([CORE.white, CORE.light, ICE.white]), size: fxRng.pick([1, 1, 2]), front: true });
        this.world.particles.add({ kind: 'smoke', x, y: this.beamY, vx: fxRng.range(-10, 10), vy: fxRng.range(-12, -2), life: 0.5, color: '#eaf6ff', color2: '#9ab8d8', size: 2, size2: 5, drag: 2, alpha: 0.6 });
      }
    }
    if (this.t >= this.total) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const y = Math.round(this.beamY);
    const x0 = Math.round(this.endX);
    const x1 = Math.round(this.tipX);
    if (this.charging) {
      const k = this.t / this.charge;
      const rate = 6 + k * 16;
      const on = Math.floor(this.t * rate) % 2 === 0;
      dottedLine(g, x1, y, x0, y, on ? '#ff4a3a' : '#ffffff', 6, 3, -this.t * 60, 1);
      if (k > 0.55) dottedLine(g, x1, y - 3, x0, y - 3, on ? '#ffd0c8' : '#ff8070', 9, 2, this.t * 40, 1);
      if (k > 0.55) dottedLine(g, x1, y + 3, x0, y + 3, on ? '#ffd0c8' : '#ff8070', 9, 2, this.t * 40, 1);
      // Gathering glow at the tip.
      pixelEllipse(g, x1, y, 3 + k * 5, 2 + k * 4, CORE.light, 0.35 + 0.4 * k);
      return;
    }
    let half: number;
    let alpha = 1;
    if (this.firing) {
      const ft = this.t - this.charge;
      half = ft < 0.06 ? 5 : 3.5 + Math.sin(ft * 60) * 0.6;
    } else {
      const k = 1 - (this.t - this.charge - this.fire) / this.fade;
      half = 1 + 2.5 * k;
      alpha = Math.max(0, k);
    }
    const prev = g.globalAlpha;
    g.globalAlpha = prev * alpha;
    const len = x1 - x0;
    // Outer glow with a ragged edge.
    g.fillStyle = CORE.mid;
    for (let x = x0; x < x1; x += 3) {
      const j = (Math.floor(x * 0.7 + this.t * 50) % 3) - 1;
      g.fillRect(x, Math.round(y - half - 1 + j * 0.5), 3, Math.round(half * 2 + 2));
    }
    g.fillStyle = CORE.light;
    g.fillRect(x0, Math.round(y - half + 1), len, Math.max(1, Math.round(half * 2 - 2)));
    g.fillStyle = '#ffffff';
    g.fillRect(x0, y - 1, len, 2);
    // Tip flare and frost sparkles along the beam.
    pixelEllipse(g, x1, y, half + 4, half + 3, CORE.white, 0.9);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const sx = x0 + ((i * 37 + Math.floor(this.t * 200)) % Math.max(1, len));
      g.fillRect(sx, y + ((i * 5) % 7) - 3, 1, 1);
    }
    g.globalAlpha = prev;
  }
}

// ------------------------------------------------------------------ spike wave

/**
 * Ground spike wave: a frost crack races from x0 toward xEnd along the floor; ice spikes erupt
 * `lead` seconds behind the crack and stay up for `active` seconds. Jump over it.
 */
export class SpikeWave extends Entity {
  readonly m3hazard = true;
  readonly x0: number;
  readonly xEnd: number;
  readonly groundY: number;
  readonly speed: number;
  readonly lead: number;
  readonly active: number;
  /** Spike height (damage band above the floor). */
  static readonly HEIGHT = 14;
  t = 0;
  private hit = new Set<number>();
  private sndT = 0;

  constructor(owner: Entity, x0: number, xEnd: number, groundY: number, speed = SPIKE_SPEED, lead = SPIKE_LEAD, active = SPIKE_ACTIVE) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.x0 = x0;
    this.xEnd = xEnd;
    this.groundY = groundY;
    this.speed = speed;
    this.lead = lead;
    this.active = active;
    this.x = (x0 + xEnd) / 2;
    this.y = groundY;
    this.w = Math.abs(x0 - xEnd);
    this.h = SpikeWave.HEIGHT;
    this.z = Z.PROJECTILE - 2;
    this.persistent = true;
  }

  /** x where spikes are erupting right now. */
  get front(): number {
    return this.x0 - this.speed * (this.t - this.lead);
  }

  /** Seconds the whole wave lasts. */
  get total(): number {
    return this.lead + (this.x0 - this.xEnd) / this.speed + this.active + 0.2;
  }

  override update(dt: number): void {
    this.t += dt;
    const G = this.groundY;
    if (this.t >= this.lead) {
      const f = Math.max(this.xEnd, this.front);
      const b = Math.min(this.x0, this.front + this.speed * this.active);
      if (b > f) hurtOnce(this.world, { x: f, y: G - SpikeWave.HEIGHT + 1, w: b - f, h: SpikeWave.HEIGHT - 1 }, this.hit, { kind: 'crush', owner: this.owner, vehicle: 12 });
      if (this.front > this.xEnd) {
        this.sndT -= dt;
        if (this.sndT <= 0) {
          this.sndT = 0.11;
          snd(this.world, 'glass_break', this.front, 0.32, fxRng.range(0.75, 1.0));
          iceBurst(this.world, this.front, G - 3, 3, 60);
          puffSnow(this.world, this.front, G - 1, 2, 30);
        }
      }
    }
    if (this.t >= this.total) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const G = Math.round(this.groundY);
    // Frost crack racing ahead of the spikes: a bright blinking seam with frost sparkles above it.
    const crack = Math.max(this.xEnd, this.x0 - this.speed * this.t);
    const blink = Math.floor(this.t * 24) % 2 === 0;
    for (let x = Math.round(this.x0); x >= crack; x--) {
      const age = this.t - (this.x0 - x) / this.speed;
      if (age > this.lead + this.active + 0.3) continue;
      const fresh = age < this.lead;
      const j = (x * 7) % 5;
      g.fillStyle = fresh ? (blink ? '#ffffff' : ICE.light) : ICE.mid;
      g.fillRect(x, G - 1 - (j === 4 ? 1 : 0), 1, 1);
      if (fresh) {
        g.fillStyle = ICE.light;
        if (j === 1) g.fillRect(x, G - 2, 1, 1);
        if ((x * 13 + Math.floor(this.t * 30)) % 11 === 0) {
          g.fillStyle = '#ffffff';
          g.fillRect(x, G - 3 - ((x * 3) % 4), 1, 1);
        }
      }
    }
    // Leading glint (a little star running along the floor).
    if (crack > this.xEnd) {
      const cx = Math.round(crack);
      g.fillStyle = '#ffffff';
      g.fillRect(cx - 3, G - 2, 7, 1);
      g.fillRect(cx, G - 5, 1, 5);
      g.fillStyle = ICE.light;
      g.fillRect(cx - 1, G - 3, 3, 2);
    }
    // Spikes.
    const spr = sprites.get('bm3_spike');
    let i = 0;
    for (let x = this.x0 - 4; x >= this.xEnd; x -= 8, i++) {
      const a = this.t - (this.lead + (this.x0 - x) / this.speed);
      if (a < 0) continue;
      let f: number;
      if (a < this.active) f = a < 0.04 ? 0 : a < 0.08 ? 1 : 2;
      else if (a < this.active + 0.16) f = 3;
      else continue;
      spr.draw(g, x + ((i * 3) % 3) - 1, G, f, { flip: i % 2 === 1 });
    }
  }
}

// ------------------------------------------------------------------ avalanche boulder

/**
 * Avalanche boulder: comes arcing over the wall from the mountain behind (a blinking cross marks
 * where it lands), then rolls across the floor and shatters at the arena's left edge.
 * Contact hurts (jump it); it can also be shot apart (4 hp).
 */
export class Boulder extends Entity {
  readonly m3hazard = true;
  stage: 'air' | 'ground' = 'air';
  readonly r = 10;
  static readonly GRAV = 420;
  private landX: number;
  private groundY: number;
  private endX: number;
  private flight: number;
  private rollSpeed: number;
  private rot = 0;
  private hit = new Set<number>();
  private mark: FloorMark | null = null;
  private dustT = 0;

  constructor(owner: Entity, x0: number, y0: number, landX: number, groundY: number, endX: number, flight: number, rollSpeed = 104) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.anchor = 'center';
    this.x = x0;
    this.y = y0;
    this.w = 18;
    this.h = 18;
    this.landX = landX;
    this.groundY = groundY;
    this.endX = endX;
    this.flight = flight;
    this.rollSpeed = rollSpeed;
    const ty = groundY - this.r;
    this.vx = (landX - x0) / flight;
    this.vy = (ty - y0 - 0.5 * Boulder.GRAV * flight * flight) / flight;
    this.hp = this.maxHp = 4;
    this.scoreValue = 200;
    this.hittable = true;
    this.z = Z.PROJECTILE - 3;
    this.persistent = true;
  }

  override spawned(): void {
    this.mark = this.world.add(new FloorMark(this.landX, this.groundY, this.flight, 'cross', 10));
  }

  override update(dt: number): void {
    const w = this.world;
    this.rot += (this.vx * dt) / this.r;
    if (this.stage === 'air') {
      this.vy += Boulder.GRAV * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > this.groundY - 40) this.hurtContact();
      if (fxRng.chance(0.5)) w.particles.add({ kind: 'px', x: this.x + fxRng.range(-6, 6), y: this.y + fxRng.range(-6, 6), vx: -this.vx * 0.2, vy: -this.vy * 0.2, life: 0.35, color: fxRng.pick(['#ffffff', '#dce8f8']), size: 1 });
      if (this.y + this.r >= this.groundY) {
        this.y = this.groundY - this.r;
        this.stage = 'ground';
        this.vx = -this.rollSpeed;
        this.vy = 0;
        this.mark?.remove();
        w.shake(3, 0.3);
        snd(w, 'land', this.x, 0.9, 0.55);
        snd(w, 'explosion_small', this.x, 0.5, 0.6);
        puffSnow(w, this.x, this.groundY - 1, 10, 70, true);
        hurtOnce(w, { x: this.x - 14, y: this.groundY - 12, w: 28, h: 12 }, this.hit, { kind: 'crush', owner: this.owner, vehicle: 14 });
      }
      return;
    }
    this.x += this.vx * dt;
    this.y = this.groundY - this.r;
    this.hurtContact();
    this.dustT -= dt;
    if (this.dustT <= 0) {
      this.dustT = 0.05;
      w.particles.add({ kind: 'px', x: this.x + 8, y: this.groundY - 2, vx: fxRng.range(10, 50), vy: -fxRng.range(20, 70), gravity: 350, life: 0.45, color: fxRng.pick(['#ffffff', '#dce8f8', '#b0c4e2']), size: fxRng.pick([1, 2]) });
    }
    if (this.x - this.r <= this.endX) this.shatter(false);
  }

  private hurtContact(): void {
    hurtOnce(this.world, { x: this.x - this.r + 2, y: this.y - this.r + 2, w: this.r * 2 - 4, h: this.r * 2 - 3 }, this.hit, { kind: 'crush', owner: this.owner, vehicle: 14 });
  }

  override die(_d?: Damage): void {
    this.shatter(true);
  }

  shatter(shot: boolean): void {
    if (this.dead) return;
    const w = this.world;
    snd(w, 'glass_break', this.x, 0.75, 0.8);
    if (shot) snd(w, 'explosion_small', this.x, 0.5, 0.9);
    iceBurst(w, this.x, this.y, 14, 100);
    puffSnow(w, this.x, this.y + 4, 8, 60, true);
    w.particles.debris(this.x, this.y, 6, ['#5c6680', '#7e8aa6', '#3e4660'], 140);
    this.mark?.remove();
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const f = ((Math.floor(-this.rot / (Math.PI / 8)) % 4) + 4) % 4;
    if (this.stage === 'ground') pixelEllipse(g, this.x, this.groundY - 1, 9, 2, '#0a0c18', 0.35);
    sprites.get('bm3_boulder').draw(g, this.x, this.y, f, { flash: this.flash > 0 });
  }
}
