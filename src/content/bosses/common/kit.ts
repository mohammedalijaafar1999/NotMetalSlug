// Shared toolkit for all bosses (boss_m1..boss_m6). Import from '../common/kit' (or './common/kit').
// Extend it only additively and backward compatibly; boss-specific helpers belong in src/content/bosses/mN/.
//
//  - BigBoss: Boss base with world-space hurt ZONES (damage multipliers = weak points), intro
//    invulnerability, arena bounds from the camera lock, phase tracking by hpFrac, hit feedback
//    (sparks, per-zone flash, throttled metal_hit / boss_hit) and contact damage with a per-target
//    cooldown. BossPiece: a BossPart (own hurtbox / hp) that routes damage through BigBoss.
//  - Projectiles: Lobbed (arcing shell / falling bomb + landing shadow marker), LockMissile
//    (drops, ignites, steers onto a locked ground point, then accelerates straight; can be shot down).
//  - FX entities: GroundMarker (landing shadow + blinking brackets), FlyingPart (debris that tumbles,
//    bounces and smokes), Wreck (burning remains left after the boss is destroyed).
//  - Art: palette BC, a rotating Pen for crisp baked frames, plate / rivet / band / cog helpers.
//  - Sound: bsfx() with names typed against BOSS_SFX (canonical names from docs/DESIGN.md only).

import { sprites } from '../../../engine/sprites';
import { PixelArt } from '../../../engine/pixelart';
import { fxRng } from '../../../engine/rng';
import { angleTo, distToRect, rectsOverlap, rotateTowards, type Rect } from '../../../engine/math';
import { VIEW_W } from '../../../engine/renderer';
import type { PlayOpts } from '../../../engine/audio';
import { Entity } from '../../../game/entity';
import { Boss, BossPart } from '../../../game/boss';
import { Projectile } from '../../../game/projectile';
import { Z, type Damage, type DamageKind } from '../../../game/constants';
import type { ExplosionSize } from '../../../game/effects';
import type { World } from '../../../game/world';

// ------------------------------------------------------------------ palette

/** Boss palette: Legion olive drab hulls, rust, gunmetal, black iron, brass trim. */
export const BC = {
  olive: '#7d7343',
  oliveL: '#a39a62',
  oliveLL: '#c6be86',
  oliveD: '#5a522e',
  oliveDD: '#3e3820',
  rust: '#a8502a',
  rustL: '#d4783c',
  rustD: '#6e3218',
  steel: '#4c4e5a',
  steelL: '#7c808e',
  steelLL: '#aeb2be',
  steelD: '#30303a',
  steelDD: '#222228',
  chrome: '#d8dce4',
  iron: '#3c3834',
  ironL: '#5c564e',
  ironLL: '#7e766a',
  ironD: '#28241f',
  ironDD: '#1c1916',
  tread: '#2e2c30',
  treadD: '#1e1c22',
  treadL: '#4c494e',
  treadLL: '#6a666c',
  brass: '#d4a23a',
  brassL: '#f4d878',
  brassD: '#8e6620',
  glass: '#6ab4d8',
  glassL: '#d2f0ff',
  glassD: '#2e6a8c',
  amber: '#e08a2a',
  amberL: '#ffd27a',
  amberD: '#8a3a12',
  red: '#d8402a',
  redL: '#ff7a4a',
  redD: '#8a2418',
  hazard: '#e8c02a',
  hazardL: '#ffe46a',
  hazardD: '#9a7a14',
  soot: '#2a2622',
  char: '#3a3430',
  charL: '#5a4e44',
  charD: '#221e1c',
  hot: '#ff8a2a',
  hotL: '#ffd060',
  glow: '#ffe070',
  white: '#f6f2e6',
  black: '#140c1c',
} as const;

// ------------------------------------------------------------------ sound

/** Canonical SFX names (docs/DESIGN.md audio contract) used by the bosses. */
export const BOSS_SFX = [
  'boss_roar',
  'boss_die',
  'warning',
  'boss_charge',
  'boss_laser',
  'boss_hit',
  'metal_hit',
  'ricochet',
  'engine',
  'tank_cannon',
  'tank_tread',
  'heli_rotor',
  'heli_gun',
  'enemy_rocket',
  'enemy_flame',
  'fire_burst',
  'mortar_whistle',
  'enemy_alert',
  'explosion_small',
  'explosion',
  'explosion_big',
  'alarm',
  'sniper_charge',
  'land',
  'shell_casing',
  'glass_break',
] as const;
export type BossSfx = (typeof BOSS_SFX)[number];

/** Positional boss sound (canonical names only). */
export function bsfx(e: Entity, name: BossSfx, opts: PlayOpts = {}): void {
  e.world.sfx(name, e.x, opts);
}

/** Sound at an arbitrary x. */
export function bsfxAt(w: World, name: BossSfx, x: number, opts: PlayOpts = {}): void {
  w.sfx(name, x, opts);
}

// ------------------------------------------------------------------ art helpers

/**
 * Drawing pen: local coordinates are rotated by `angle` around the local origin, then translated by
 * (ox, oy) onto the canvas. Lets one draw function bake crisp frames at several tilt angles.
 */
export class Pen {
  readonly p: PixelArt;
  ox: number;
  oy: number;
  readonly a: number;
  private cs: number;
  private sn: number;

  constructor(p: PixelArt, ox = 0, oy = 0, angle = 0) {
    this.p = p;
    this.ox = ox;
    this.oy = oy;
    this.a = angle;
    this.cs = Math.cos(angle);
    this.sn = Math.sin(angle);
  }

  get rotated(): boolean {
    return Math.abs(this.a) > 1e-6;
  }

  t(x: number, y: number): [number, number] {
    return [this.ox + x * this.cs - y * this.sn, this.oy + x * this.sn + y * this.cs];
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    if (!this.rotated) {
      this.p.rect(x + this.ox, y + this.oy, w, h, c);
      return this;
    }
    return this.poly([x, y, x + w, y, x + w, y + h, x, y + h], c);
  }

  poly(pts: number[], c: string): this {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [X, Y] = this.t(pts[i], pts[i + 1]);
      out.push(X, Y);
    }
    this.p.poly(out, c);
    return this;
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: string): this {
    return this.poly([x0, y0, x1, y1, x2, y2], c);
  }

  circle(x: number, y: number, r: number, c: string): this {
    const [X, Y] = this.t(x, y);
    this.p.circle(X, Y, r, c);
    return this;
  }

  ring(x: number, y: number, r: number, c: string, th = 1): this {
    const [X, Y] = this.t(x, y);
    this.p.ring(X, Y, r, c, th);
    return this;
  }

  ellipse(x: number, y: number, rx: number, ry: number, c: string): this {
    if (!this.rotated) {
      this.p.ellipse(x + this.ox, y + this.oy, rx, ry, c);
      return this;
    }
    const pts: number[] = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
    }
    return this.poly(pts, c);
  }

  /** Thick segment with round caps (radius r). */
  cap(x0: number, y0: number, x1: number, y1: number, r: number, c: string): this {
    const [X0, Y0] = this.t(x0, y0);
    const [X1, Y1] = this.t(x1, y1);
    this.p.capsule(X0, Y0, X1, Y1, r, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const [X0, Y0] = this.t(x0 + 0.5, y0 + 0.5);
    const [X1, Y1] = this.t(x1 + 0.5, y1 + 0.5);
    this.p.line(X0, Y0, X1, Y1, c);
    return this;
  }

  px(x: number, y: number, c: string): this {
    const [X, Y] = this.t(x + 0.5, y + 0.5);
    this.p.px(Math.floor(X), Math.floor(Y), c);
    return this;
  }
}

/** Plate with a light top/left bevel and a dark bottom/right edge. */
export function plate(d: Pen, x: number, y: number, w: number, h: number, base: string, light: string, dark: string): void {
  d.rect(x, y, w, h, base);
  d.rect(x, y, w, 1, light);
  d.rect(x, y, 1, h, light);
  d.rect(x, y + h - 1, w, 1, dark);
  d.rect(x + w - 1, y + 1, 1, h - 1, dark);
}

/** A rivet: bright pixel with a dark shadow below-right. */
export function rivet(d: Pen, x: number, y: number, light: string = BC.oliveLL, dark: string = BC.oliveDD): void {
  d.px(x, y, light);
  d.px(x + 1, y + 1, dark);
}

/** Row of rivets from x0 to x1 (inclusive) every `step` px. */
export function rivetRow(d: Pen, x0: number, x1: number, y: number, step: number, light?: string, dark?: string): void {
  for (let x = x0; x <= x1 + 0.01; x += step) rivet(d, Math.round(x), y, light, dark);
}

/** Diagonal hazard stripes inside an axis-aligned rect (unrotated pens). */
export function hazardStripes(d: Pen, x: number, y: number, w: number, h: number, c1: string = BC.hazard, c2: string = BC.black, period = 6): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const k = (((xx + yy + x + y) % period) + period) % period;
      d.px(x + xx, y + yy, k < period / 2 ? c1 : c2);
    }
  }
}

/** The Legion's brass cog emblem. */
export function cog(d: Pen, cx: number, cy: number, r: number): void {
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    d.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(0.9, r * 0.34), BC.brassD);
  }
  d.circle(cx, cy, r, BC.brass);
  d.circle(cx - r * 0.2, cy - r * 0.25, r * 0.55, BC.brassL);
  d.circle(cx, cy, r * 0.5, BC.brass);
  d.circle(cx, cy, Math.max(0.8, r * 0.3), BC.brassD);
}

/** Small deterministic hash noise in [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Recolor a baked frame to a charred wreck palette (keeps light structure, sparse embers). */
export function charr(p: PixelArt, seed = 1): void {
  p.mapPixels((v, x, y) => {
    const r = v & 255;
    const g = (v >>> 8) & 255;
    const b = (v >>> 16) & 255;
    const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    const n = hash2(x >> 1, y >> 1, seed);
    if (n < 0.025 && lum > 0.22) return n < 0.012 ? 0xff3aa0ff : 0xff1a4ad8; // embers (ABGR)
    const k = Math.round(22 + lum * 62 + (n - 0.5) * 10);
    const rr = Math.max(0, Math.min(255, k + 9));
    const gg = Math.max(0, Math.min(255, k + 2));
    const bb = Math.max(0, Math.min(255, k - 5));
    return ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0;
  });
}

// ------------------------------------------------------------------ particles helpers

export interface PuffOpts {
  n?: number;
  vx?: number;
  vy?: number;
  spread?: number;
  size?: number;
  size2?: number;
  life?: number;
  color?: string;
  color2?: string;
  front?: boolean;
  drag?: number;
}

/** Smoke puffs (dark by default). */
export function smoke(w: World, x: number, y: number, o: PuffOpts = {}): void {
  const n = o.n ?? 1;
  const sp = o.spread ?? 3;
  for (let i = 0; i < n; i++) {
    w.particles.add({
      kind: 'smoke',
      x: x + fxRng.range(-sp, sp),
      y: y + fxRng.range(-sp, sp) * 0.6,
      vx: (o.vx ?? 0) + fxRng.range(-8, 8),
      vy: (o.vy ?? -22) + fxRng.range(-8, 4),
      life: (o.life ?? 0.9) * fxRng.range(0.75, 1.25),
      color: o.color ?? '#4a4448',
      color2: o.color2 ?? '#2c2830',
      size: o.size ?? 2,
      size2: o.size2 ?? 6,
      drag: o.drag ?? 1.2,
      front: o.front ?? false,
    });
  }
}

/** Licking flames (bright, short-lived). */
export function flames(w: World, x: number, y: number, o: PuffOpts = {}): void {
  const n = o.n ?? 1;
  const sp = o.spread ?? 3;
  for (let i = 0; i < n; i++) {
    w.particles.add({
      kind: 'smoke',
      x: x + fxRng.range(-sp, sp),
      y: y + fxRng.range(-sp, sp) * 0.5,
      vx: (o.vx ?? 0) + fxRng.range(-6, 6),
      vy: (o.vy ?? -40) + fxRng.range(-12, 6),
      life: (o.life ?? 0.35) * fxRng.range(0.7, 1.3),
      color: o.color ?? '#ffd040',
      color2: o.color2 ?? '#e8501a',
      size: o.size ?? 2,
      size2: o.size2 ?? 1,
      drag: o.drag ?? 0.5,
      front: o.front ?? true,
    });
  }
}

/** Bright sparks. */
export function sparkBurst(w: World, x: number, y: number, n = 5, color = '#ffe080', speed = 120): void {
  w.particles.sparks(x, y, n, color, speed);
}

// ------------------------------------------------------------------ shared fx sprites

sprites.define({
  name: 'boss_debris',
  w: 12,
  h: 8,
  ox: 6,
  oy: 4,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p);
    if (f === 0) {
      // Bent armour scrap.
      d.poly([0, 2, 9, 0, 12, 3, 10, 7, 2, 8], BC.oliveD);
      d.poly([1, 2, 9, 1, 10, 3, 2, 4], BC.olive);
      d.px(4, 3, BC.oliveLL);
    } else if (f === 1) {
      // Bolt-studded steel chunk.
      d.poly([1, 1, 8, 0, 10, 5, 6, 8, 0, 6], BC.steelD);
      d.poly([2, 1, 8, 1, 8, 4, 3, 4], BC.steel);
      rivet(d, 4, 2, BC.steelLL, BC.steelDD);
    } else if (f === 2) {
      // Gear.
      d.circle(5, 4, 3.6, BC.brassD);
      d.circle(5, 4, 2.6, BC.brass);
      d.circle(5, 4, 1, BC.brassD);
      for (let i = 0; i < 6; i++) d.circle(5 + Math.cos(i) * 3.8, 4 + Math.sin(i) * 3.8, 0.8, BC.brassD);
    } else {
      // Charred beam.
      d.rect(0, 2, 12, 4, BC.char);
      d.rect(0, 2, 12, 1, BC.charL);
      d.px(8, 4, BC.hot);
    }
  },
});

// ------------------------------------------------------------------ ground marker

/**
 * Landing shadow for something falling/arcing onto the ground: an ellipse that darkens and grows as
 * impact nears, plus red corner brackets that blink faster and faster. Removed by its projectile.
 */
export class GroundMarker extends Entity {
  total: number;
  remaining: number;
  radius: number;
  /** Optional projectile that owns this marker (marker vanishes if it dies early). */
  watch: Entity | null = null;

  constructor(x: number, groundY: number, time: number, radius: number) {
    super();
    this.anchor = 'center';
    this.x = x;
    this.y = groundY;
    this.total = Math.max(0.2, time);
    this.remaining = this.total;
    this.radius = radius;
    this.z = Z.BACK_PROP;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.remaining -= dt;
    if (this.watch && this.watch.dead) this.remove();
    if (this.remaining < -1.5) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const k = Math.max(0, Math.min(1, 1 - this.remaining / this.total));
    const cx = Math.round(this.x);
    const cy = Math.round(this.y) - 1;
    const rx = Math.max(2, Math.round(this.radius * (0.35 + 0.65 * k)));
    const ry = Math.max(1, Math.round(rx * 0.3));
    g.globalAlpha = 0.16 + 0.34 * k;
    g.fillStyle = '#140c1c';
    for (let j = -ry; j <= ry; j++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2)));
      g.fillRect(cx - hw, cy + j, hw * 2 + 1, 1);
    }
    g.globalAlpha = 1;
    const rate = 5 + 16 * k;
    if (Math.floor(this.age * rate) % 2 === 0) {
      const R = Math.round(this.radius * 0.9);
      g.fillStyle = k > 0.7 ? '#ff4030' : '#ff8a30';
      for (const s of [-1, 1]) {
        const x = cx + s * R;
        g.fillRect(s < 0 ? x : x - 2, cy - 3, 3, 1);
        g.fillRect(x, cy - 3, 1, 3);
      }
    }
  }
}

// ------------------------------------------------------------------ projectiles

export interface LobOpts {
  owner: Entity;
  x: number;
  y: number;
  /** Target point (usually on the ground). */
  tx: number;
  ty: number;
  /** Flight time in seconds. */
  time: number;
  gravity?: number;
  radius?: number;
  size?: ExplosionSize;
  sprite: string;
  /** Draw a landing shadow/marker at (tx, ty). */
  marker?: boolean;
  /** Rotate sprite to velocity (shells) or keep upright with fin wobble (bombs). */
  rotate?: boolean;
  shake?: number;
  /** Smoke trail colour (null = none). */
  trail?: string | null;
}

/** Arcing shell / falling bomb that lands exactly on (tx, ty) after `time` seconds. */
export class Lobbed extends Projectile {
  marker: GroundMarker | null = null;
  readonly tx: number;
  readonly ty: number;
  readonly flight: number;
  readonly radius: number;
  private wantMarker: boolean;
  private trail: string | null;
  private trailT = 0;

  constructor(o: LobOpts) {
    const g = o.gravity ?? 420;
    const T = Math.max(0.2, o.time);
    const vx = (o.tx - o.x) / T;
    const vy = (o.ty - o.y - 0.5 * g * T * T) / T;
    super({
      team: 'enemy',
      owner: o.owner,
      x: o.x,
      y: o.y,
      vx,
      vy,
      gravity: g,
      w: 6,
      h: 6,
      sprite: o.sprite,
      rotate: o.rotate ?? true,
      fps: 14,
      life: T + 2,
      explode: { radius: o.radius ?? 18, damage: 1, size: o.size ?? 'medium', shake: o.shake ?? 2 },
    });
    this.tx = o.tx;
    this.ty = o.ty;
    this.flight = T;
    this.radius = o.radius ?? 18;
    this.wantMarker = o.marker ?? true;
    this.trail = o.trail === undefined ? '#8a8078' : o.trail;
    this.offscreenMargin = 420;
  }

  override spawned(): void {
    if (this.wantMarker) {
      this.marker = this.world.add(new GroundMarker(this.tx, this.ty, this.flight, this.radius));
      this.marker.watch = this;
    }
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.dead || !this.trail) return;
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.045;
      this.world.particles.add({ kind: 'smoke', x: this.x - this.vx * 0.02, y: this.y - this.vy * 0.02, vx: fxRng.range(-6, 6), vy: fxRng.range(-10, 0), life: 0.35, color: this.trail, color2: '#5a5250', size: 1, size2: 3, drag: 2 });
    }
  }

  protected override onHitTerrain(): void {
    // Detonate on the surface, not inside it.
    const gy = this.world.terrain.groundTopAt(this.x);
    if (isFinite(gy) && this.y > gy) this.y = gy - 2;
    this.detonate();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.rotateSprite) {
      super.render(g);
      return;
    }
    const s = sprites.get(this.spriteName!);
    s.draw(g, this.x, this.y, Math.floor(this.age * this.fps), { flip: this.vx < 0 });
  }

  override remove(): void {
    this.marker?.remove();
    super.remove();
  }
}

export interface MissileOpts {
  owner: Entity;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Locked target point. */
  tx: number;
  ty: number;
  sprite: string;
  /** Seconds of unpowered drop before the motor ignites. */
  drop?: number;
  /** Speed right after ignition. */
  speed?: number;
  /** Max speed and acceleration once lit. */
  topSpeed?: number;
  accel?: number;
  /** Turn rate (rad/s) while steering, and how long it steers before flying straight. */
  turn?: number;
  steer?: number;
  radius?: number;
}

/** Missile: drops, ignites slowly, steers onto a locked point, then accelerates straight. Shootable. */
export class LockMissile extends Projectile {
  readonly tx: number;
  readonly ty: number;
  private t = 0;
  private lit = false;
  private dropT: number;
  private speed0: number;
  private topSpeed: number;
  private acc: number;
  private turn: number;
  private steer: number;
  private smokeT = 0;

  constructor(o: MissileOpts) {
    super({
      team: 'enemy',
      owner: o.owner,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      w: 7,
      h: 6,
      sprite: o.sprite,
      rotate: true,
      fps: 16,
      life: 6,
      explode: { radius: o.radius ?? 15, damage: 1, size: 'small', shake: 1 },
    });
    this.tx = o.tx;
    this.ty = o.ty;
    this.dropT = o.drop ?? 0.25;
    this.speed0 = o.speed ?? 45;
    this.topSpeed = o.topSpeed ?? 210;
    this.acc = o.accel ?? 260;
    this.turn = o.turn ?? 3.6;
    this.steer = o.steer ?? 0.55;
    this.hittable = true;
    this.hp = this.maxHp = 1;
    this.scoreValue = 100;
    this.offscreenMargin = 140;
  }

  get ignited(): boolean {
    return this.lit;
  }

  protected override move(dt: number): void {
    this.t += dt;
    if (this.t < this.dropT) {
      this.vy += 320 * dt;
      this.vx *= Math.max(0, 1 - 2.5 * dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    let ang = Math.atan2(this.vy, this.vx);
    let sp = Math.hypot(this.vx, this.vy);
    if (!this.lit) {
      this.lit = true;
      sp = this.speed0;
      ang = rotateTowards(ang, angleTo(this.x, this.y, this.tx, this.ty), 0.9);
      bsfx(this, 'enemy_rocket', { vol: 0.45 });
      this.world.particles.add({ kind: 'smoke', x: this.x, y: this.y, vx: 0, vy: -6, life: 0.4, color: '#e8e0d0', color2: '#8a8480', size: 2, size2: 6, drag: 2 });
    }
    if (this.t < this.dropT + this.steer) ang = rotateTowards(ang, angleTo(this.x, this.y, this.tx, this.ty), this.turn * dt);
    sp = Math.min(this.topSpeed, sp + this.acc * dt);
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.025;
      const bx = this.x - Math.cos(ang) * 6;
      const by = this.y - Math.sin(ang) * 6;
      this.world.particles.add({ kind: 'smoke', x: bx, y: by, vx: fxRng.range(-6, 6), vy: fxRng.range(-10, 2), life: 0.45, color: '#d8d0c8', color2: '#7a7470', size: 1, size2: 3, drag: 2 });
      this.world.particles.add({ kind: 'px', x: bx, y: by, vx: -Math.cos(ang) * 30, vy: -Math.sin(ang) * 30, life: 0.08, color: fxRng.chance(0.5) ? '#ffe070' : '#ff8a30', size: 2 });
    }
  }

  protected override onHitTerrain(): void {
    const gy = this.world.terrain.groundTopAt(this.x);
    if (isFinite(gy) && this.y > gy) this.y = gy - 2;
    this.detonate();
  }

  override die(): void {
    // Shot down: harmless pop.
    this.world.explode(this.x, this.y, { radius: 10, damage: 0, team: 'enemy', size: 'small', shake: 0, sfx: 'explosion_small' });
    this.remove();
  }
}

// ------------------------------------------------------------------ debris & wrecks

export interface PartOpts {
  vr?: number;
  life?: number;
  burn?: boolean;
  smoke?: boolean;
  flip?: boolean;
  gravity?: number;
  bounce?: number;
  /** Ground height to bounce on (default: terrain at x). */
  groundY?: number;
  z?: number;
}

/** A piece that breaks off: tumbles, bounces on the ground, smokes/burns, then blinks away. */
export class FlyingPart extends Entity {
  sprite: string;
  frame: number;
  rot = 0;
  vr: number;
  gravity: number;
  bounce: number;
  life: number;
  burn: boolean;
  smoky: boolean;
  groundY: number | null;
  resting = false;
  private fxT = 0;

  constructor(sprite: string, frame: number, x: number, y: number, vx: number, vy: number, o: PartOpts = {}) {
    super();
    this.sprite = sprite;
    this.frame = frame;
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = o.vr ?? fxRng.range(-8, 8);
    this.life = o.life ?? 3;
    this.burn = !!o.burn;
    this.smoky = o.smoke ?? true;
    this.gravity = o.gravity ?? 560;
    this.bounce = o.bounce ?? 0.32;
    this.groundY = o.groundY ?? null;
    this.facing = o.flip ? -1 : 1;
    this.z = o.z ?? Z.FX - 2;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.life -= dt;
    if (this.life <= 0) {
      this.remove();
      return;
    }
    if (!this.resting) {
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vr * dt;
      let gy = this.world.terrain.groundTopAt(this.x);
      if (!isFinite(gy)) gy = this.groundY ?? Infinity;
      if (this.vy > 0 && this.y > gy - 3) {
        this.y = gy - 3;
        if (this.vy > 90) {
          this.world.particles.dust(this.x, gy, 3);
          if (this.vy > 200) bsfx(this, 'land', { vol: 0.35, pitch: 0.6 });
        }
        this.vy = -this.vy * this.bounce;
        this.vx *= 0.55;
        this.vr *= 0.5;
        if (Math.abs(this.vy) < 40) {
          this.vy = 0;
          this.vx = 0;
          this.vr = 0;
          this.resting = true;
          this.rot = Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2);
        }
      }
    }
    this.fxT -= dt;
    if (this.fxT <= 0 && this.life > 0.6) {
      this.fxT = this.resting ? 0.16 : 0.05;
      if (this.burn) flames(this.world, this.x, this.y - 2, { n: 1, size: 2, life: 0.3 });
      if (this.smoky) smoke(this.world, this.x, this.y - 2, { n: 1, size: 1.5, size2: 5, life: 0.8 });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.life < 0.6 && Math.floor(this.life * 16) % 2 === 0) return;
    const step = Math.PI / 4;
    const r = Math.round(this.rot / step) * step;
    sprites.get(this.sprite).draw(g, this.x, this.y, this.frame, { rot: r || undefined, flip: this.facing < 0 && !r });
  }
}

export interface WreckLayer {
  sprite: string;
  frame: number;
  dx: number;
  dy: number;
}

/** Burning remains of a boss (pure decoration, lingers until the mission ends). */
export class Wreck extends Entity {
  layers: WreckLayer[];
  emitters: { dx: number; dy: number; fire: boolean }[];
  private fxT = 0;

  constructor(x: number, y: number, facing: 1 | -1, layers: WreckLayer[], emitters: { dx: number; dy: number; fire: boolean }[]) {
    super();
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.layers = layers;
    this.emitters = emitters;
    this.z = Z.BOSS - 2;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.fxT -= dt;
    if (this.fxT <= 0 && this.emitters.length) {
      this.fxT = 0.06;
      const e = this.emitters[Math.floor(fxRng.next() * this.emitters.length)];
      const x = this.x + e.dx * this.facing;
      const y = this.y + e.dy;
      smoke(this.world, x, y, { n: 1, size: 2.5, size2: 9, life: 1.6, vy: -26, color: '#3a3436', color2: '#242026' });
      if (e.fire && fxRng.chance(0.7)) flames(this.world, x, y + 2, { n: 2, size: 2.5, life: 0.4, spread: 4 });
      if (fxRng.chance(0.05)) sparkBurst(this.world, x, y, 3, '#ffc060', 70);
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    for (const L of this.layers) sprites.get(L.sprite).draw(g, this.x + L.dx * this.facing, this.y + L.dy, L.frame, { flip: this.facing < 0 });
  }
}

// ------------------------------------------------------------------ boss base

/** A world-space hurt region with a damage multiplier (weak points > 1). */
export interface Zone extends Rect {
  id: string;
  mul: number;
}

/**
 * Base for big multi-part bosses. Subclasses rebuild `zones` every frame (layoutZones) from their
 * current pose, implement think() and render(), and call finishIntro() when the entrance is over.
 */
export abstract class BigBoss extends Boss {
  arenaL = 0;
  arenaR = 0;
  groundY = 0;
  zones: Zone[] = [];
  introDone = false;
  /** Seconds of actual fighting (after the intro). */
  fightTime = 0;
  /** Multiplier for every hit (e.g. armour stripped in a late phase). */
  armorMul = 1;
  /** hpFrac thresholds for phase 1, 2... */
  phaseAt: number[] = [0.5, 0.25];
  /** Damage dealt per zone id (after multipliers) - tuning / tests. */
  dmgLog: Record<string, number> = {};
  /** Per-zone flash timers (draw that part flashing while > 0). */
  zoneFlash: Record<string, number> = {};
  private sndCd = 0;
  private contactCd = new Map<number, number>();

  constructor(name: string, hp: number) {
    super(name, hp);
    this.hittable = false;
    this.scoreValue = 30000;
  }

  override spawned(): void {
    super.spawned();
    const cam = this.world.camera;
    const maxX = Math.max(0, cam.levelW - VIEW_W);
    this.arenaL = Math.max(0, Math.min(maxX, cam.lockX ?? cam.x));
    this.arenaR = this.arenaL + VIEW_W;
    const gy = this.world.terrain.groundTopAt(this.x);
    this.groundY = isFinite(gy) ? gy : this.y;
    this.layoutZones();
  }

  /** Rebuild `zones` (world space) from the current pose. */
  abstract layoutZones(): void;

  /** Called when the phase increases (may skip phases on huge hits). */
  abstract onPhase(phase: number, prev: number): void;

  /** End of the entrance: becomes hittable. */
  finishIntro(): void {
    if (this.introDone) return;
    this.introDone = true;
    this.hittable = true;
    this.world.invalidateTargets();
  }

  override hurtboxes(): Rect[] {
    return this.zones;
  }

  override update(dt: number): void {
    this.sndCd -= dt;
    for (const k in this.zoneFlash) this.zoneFlash[k] -= dt;
    if (this.introDone && !this.dying) this.fightTime += dt;
    super.update(dt);
    if (!this.dead) this.layoutZones();
    if (!this.dying && !this.dead) {
      const f = this.hpFrac;
      let ph = 0;
      for (let i = 0; i < this.phaseAt.length; i++) if (f <= this.phaseAt[i]) ph = i + 1;
      if (ph > this.phase) {
        const prev = this.phase;
        this.phase = ph;
        this.onPhase(ph, prev);
      }
    }
  }

  /** Zone a hit lands in: nearest zone to the impact point; blasts prefer weak points within reach. */
  pickZone(d: Damage): Zone | null {
    if (!this.zones.length) return null;
    if (d.x === undefined || d.y === undefined) return this.zones[0];
    let best: Zone | null = null;
    let bd = Infinity;
    for (const z of this.zones) {
      const dist = distToRect(d.x, d.y, z);
      if (dist < bd - 0.01 || (Math.abs(dist - bd) <= 0.01 && best && z.mul > best.mul)) {
        best = z;
        bd = dist;
      }
    }
    if (d.kind === 'explosion' || d.kind === 'fire') {
      for (const z of this.zones) if (z.mul > (best?.mul ?? 1) && distToRect(d.x, d.y, z) <= 16) best = z;
    }
    return best;
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable || this.dying) return false;
    const z = this.pickZone(d);
    return this.applyHit(d, z?.mul ?? 1, z?.id ?? 'body');
  }

  /** Apply a hit with an explicit multiplier (used by zones and BossPieces). */
  applyHit(d: Damage, mul: number, id: string): boolean {
    if (this.dead || !this.hittable || this.dying) return false;
    const amount = d.amount * mul * this.armorMul;
    this.zoneFlash[id] = 0.08;
    this.dmgLog[id] = (this.dmgLog[id] ?? 0) + amount;
    this.hitFeedback(d, mul > 1.01);
    return super.damage({ ...d, amount });
  }

  protected hitFeedback(d: Damage, weak: boolean): void {
    if (d.x !== undefined && d.y !== undefined && d.kind !== 'explosion' && d.kind !== 'fire') {
      if (weak) sparkBurst(this.world, d.x, d.y, 4, fxRng.chance(0.5) ? '#ffb040' : '#ffe080', 110);
      else sparkBurst(this.world, d.x, d.y, 2, '#fff0c0', 90);
    }
    if (this.sndCd <= 0) {
      this.sndCd = weak ? 0.11 : 0.085;
      bsfx(this, weak ? 'boss_hit' : 'metal_hit', { vol: weak ? 0.55 : 0.3, pitch: fxRng.range(0.85, 1.15) });
    }
  }

  /** Damage player-side targets overlapping r (one hit per target per 0.5 s). */
  hurtPlayers(r: Rect, kind: DamageKind, vehicleDamage = 12): number {
    let n = 0;
    for (const t of this.world.targets('enemy')) {
      if (t.dead) continue;
      const until = this.contactCd.get(t.id) ?? -1;
      if (this.age < until) continue;
      let hit = false;
      for (const hb of t.hurtboxes())
        if (rectsOverlap(r, hb)) {
          hit = true;
          break;
        }
      if (!hit) continue;
      this.contactCd.set(t.id, this.age + 0.5);
      const isPlayer = !!(t as any).isPlayer;
      t.damage({ amount: isPlayer ? 1 : vehicleDamage, kind, owner: this, x: t.cx, y: t.cy, dir: t.cx < r.x + r.w / 2 ? -1 : 1 });
      n++;
    }
    return n;
  }

  /** Nearest player-side target. */
  target(): Entity | null {
    return this.world.nearestPlayer(this.x, this.y - 20);
  }

  /** X of the nearest player (or the arena centre). */
  targetX(): number {
    const t = this.target();
    return t ? t.x : (this.arenaL + this.arenaR) / 2;
  }

  /** Clamp an x into the arena with a margin. */
  inArena(x: number, margin = 10): number {
    return Math.max(this.arenaL + margin, Math.min(this.arenaR - margin, x));
  }

  /** Flash amount for a zone id (0 when not flashing). */
  flashing(id: string): boolean {
    return (this.zoneFlash[id] ?? 0) > 0;
  }
}

/**
 * A separately-hittable boss piece (own hurtbox and optional hp) whose damage is routed through
 * BigBoss.applyHit with its own multiplier. Rendered by the boss itself.
 */
export class BossPiece extends BossPart {
  readonly key: string;
  mul: number;
  /** Is the piece currently exposed (hittable while the boss is)? */
  exposed = true;

  constructor(parent: BigBoss, id: string, w: number, h: number, opts: { hp?: number; mul?: number; destructible?: boolean } = {}) {
    super(parent, w, h, { hp: opts.hp, forward: 0, destructible: opts.destructible });
    this.key = id;
    this.mul = opts.mul ?? 1;
    this.hittable = false;
  }

  get boss(): BigBoss {
    return this.parent as BigBoss;
  }

  /** Place at a world position and refresh hittability from the parent. */
  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    const want = this.exposed && this.boss.introDone && this.boss.hittable && !this.boss.dying && this.hp > 0;
    if (want !== this.hittable) {
      this.hittable = want;
      this.world.invalidateTargets();
    }
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable || this.boss.dying) return false;
    this.flash = 0.08;
    this.boss.applyHit(d, this.mul, this.key);
    if (this.destructible) {
      this.hp -= d.amount;
      if (this.hp <= 0) {
        this.hp = 0;
        this.hittable = false;
        this.world.invalidateTargets();
        this.onDestroyed?.(this);
        this.remove();
      }
    }
    return true;
  }
}
