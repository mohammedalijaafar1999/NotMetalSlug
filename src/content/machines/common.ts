// Shared foundation for the Rustcoat Legion's MACHINES (tanks, helicopters, turrets, trucks...).
//
//  - Machine: an Enemy with armor-hit feedback (sparks + metal_hit + jolt), damage states
//    (smoke + sparks below 50% hp, fire below 25%), a big destruction sequence (chained
//    explosions, debris in the machine's own colors, crew flung out, flying parts, score popup)
//    and a burning wreck that lingers, then blinks out. Flying machines override onDeath() to
//    crash first and call explodeNow() on impact.
//  - Helpers: contact/crush damage, ballistic aiming, ground target markers, screen-edge
//    warnings, enemy projectiles (bombs, flak, missiles, zap bolts), cosmetic ragdolls/parts.
//  - Art helpers (pure PixelArt): a rotate/translate Pen for baking crisp rotated frames,
//    riveted plates, treads, wheels, the Legion's brass cog emblem, hazard stripes, and a
//    charred-wreck recolor.
//
// Sound: machines only use canonical SFX names from docs/DESIGN.md, through msfx() whose name
// parameter is typed against MACHINE_SFX (tests/machines.test.ts checks that list against the doc).

import { sprites } from '../../engine/sprites';
import { PixelArt, parseColor, shade } from '../../engine/pixelart';
import { fxRng } from '../../engine/rng';
import { rectsOverlap, type Rect } from '../../engine/math';
import { VIEW_H, VIEW_W } from '../../engine/renderer';
import type { PlayOpts } from '../../engine/audio';
import { Enemy } from '../../game/enemy';
import { Entity } from '../../game/entity';
import { Projectile, Rocket } from '../../game/projectile';
import { Z, type Damage, type DamageKind } from '../../game/constants';
import type { ExplosionSize } from '../../game/effects';
import { dropPickup } from '../../game/pickup';
import { getEntityType } from '../../game/registry';
import { defineSoldier, RUSTCOAT, SF, styleVariant } from '../../art/soldier';
import { drawHuman, type HumanoidStyle, type HumanPose } from '../../art/humanoid';

// ------------------------------------------------------------------ palette

/** Legion machine palette: olive drab hulls, rust accents, gunmetal, brass emblems. */
export const MC = {
  olive: '#7d7343',
  oliveL: '#a39a62',
  oliveLL: '#c6be86',
  oliveD: '#5a522e',
  oliveDD: '#3e3820',
  camo: '#5f6a36',
  camoD: '#48522a',
  rust: '#a8502a',
  rustL: '#d4783c',
  rustD: '#6e3218',
  steel: '#4c4e5a',
  steelL: '#7c808e',
  steelLL: '#aeb2be',
  steelD: '#30303a',
  steelDD: '#222228',
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
  canvas: '#8c8558',
  canvasL: '#aea878',
  canvasD: '#64603c',
  canvasDD: '#4a4630',
  conc: '#a69e8a',
  concL: '#cac2ac',
  concD: '#766e5e',
  concDD: '#545046',
  sand: '#c4aa78',
  sandL: '#decaa0',
  sandD: '#8e7650',
  navy: '#4a5a6e',
  navyL: '#71849a',
  navyD: '#33404f',
  red: '#d8402a',
  redL: '#ff7a4a',
  redD: '#8a2418',
  cream: '#e8dcb4',
  glow: '#ffe070',
  white: '#f6f2e6',
  black: '#140c1c',
} as const;

/** Default debris palette (olive machines). */
export const OLIVE_DEBRIS = [MC.olive, MC.oliveD, MC.oliveL, MC.steel, MC.steelD, MC.rust];

// ------------------------------------------------------------------ sound

/** Canonical SFX names (docs/DESIGN.md audio contract) used by machines. */
export const MACHINE_SFX = [
  'tank_cannon',
  'tank_tread',
  'heli_rotor',
  'heli_gun',
  'turret_fire',
  'drone_buzz',
  'jet_flyby',
  'metal_hit',
  'ricochet',
  'engine',
  'glass_break',
  'crate_break',
  'mortar_fire',
  'mortar_whistle',
  'enemy_rocket',
  'enemy_rifle',
  'enemy_alert',
  'enemy_die',
  'enemy_die2',
  'robot_shot',
  'splash',
  'explosion_small',
  'explosion',
  'explosion_big',
  'fire_burst',
  'alarm',
  'warning',
  'whistle',
  'mine_beep',
] as const;
export type MachineSfx = (typeof MACHINE_SFX)[number];

/** Positional sound from an entity (canonical names only). */
export function msfx(e: Entity, name: MachineSfx, opts: PlayOpts = {}): void {
  e.world.sfx(name, e.x, opts);
}

// ------------------------------------------------------------------ art helpers

/**
 * Drawing pen with translation + rotation around a pivot. All coordinates are "local";
 * t() maps them to the canvas. With angle 0 every primitive maps 1:1 to PixelArt.
 */
export class Pen {
  readonly p: PixelArt;
  ox: number;
  oy: number;
  readonly a: number;
  private cs: number;
  private sn: number;
  private pvx: number;
  private pvy: number;

  constructor(p: PixelArt, ox = 0, oy = 0, angle = 0, pivot: [number, number] = [0, 0]) {
    this.p = p;
    this.ox = ox;
    this.oy = oy;
    this.a = angle;
    this.cs = Math.cos(angle);
    this.sn = Math.sin(angle);
    this.pvx = pivot[0];
    this.pvy = pivot[1];
  }

  get rotated(): boolean {
    return Math.abs(this.a) > 1e-6;
  }

  t(x: number, y: number): [number, number] {
    const dx = x - this.pvx;
    const dy = y - this.pvy;
    return [this.ox + this.pvx + dx * this.cs - dy * this.sn, this.oy + this.pvy + dx * this.sn + dy * this.cs];
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

  circle(x: number, y: number, r: number, c: string): this {
    const [X, Y] = this.t(x, y);
    this.p.circle(X, Y, r, c);
    return this;
  }

  ellipse(x: number, y: number, rx: number, ry: number, c: string): this {
    if (!this.rotated) {
      this.p.ellipse(x + this.ox, y + this.oy, rx, ry, c);
      return this;
    }
    const pts: number[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
    }
    return this.poly(pts, c);
  }

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

/** Beveled metal plate: highlight on the top/left edge, shade on the bottom/right edge. */
export function plate(d: Pen, x: number, y: number, w: number, h: number, base: string, o: { rivets?: number; hi?: number; lo?: number } = {}): void {
  const hi = shade(base, o.hi ?? 0.22);
  const lo = shade(base, -(o.lo ?? 0.3));
  d.rect(x, y, w, h, base);
  d.rect(x, y, w, 1, hi);
  d.rect(x, y, 1, h, hi);
  d.rect(x, y + h - 1, w, 1, lo);
  d.rect(x + w - 1, y + 1, 1, h - 1, lo);
  if (o.rivets) {
    for (let rx = x + 2; rx <= x + w - 3; rx += o.rivets) {
      rivet(d, rx, y + 2, base);
      if (h >= 7) rivet(d, rx, y + h - 3, base);
    }
  }
}

/** A single rivet: light dot with a dark shadow pixel below-right. */
export function rivet(d: Pen, x: number, y: number, base: string): void {
  d.px(x, y, shade(base, 0.45));
  d.px(x + 1, y + 1, shade(base, -0.4));
}

/** Row of rivets. */
export function rivetRow(d: Pen, x0: number, x1: number, y: number, step: number, base: string): void {
  for (let x = x0; x <= x1; x += step) rivet(d, x, y, base);
}

/** Hand-made gear bitmaps ('#' metal, 'o' hole) - procedural gears smear at these sizes. */
const COG_BITMAPS: string[][] = [
  ['.#.#.', '#####', '##o##', '#####', '.#.#.'],
  ['..#.#..', '.#####.', '##ooo##', '.#ooo#.', '##ooo##', '.#####.', '..#.#..'],
  ['...#.#...', '..#####..', '.#######.', '###ooo###', '.##ooo##.', '###ooo###', '.#######.', '..#####..', '...#.#...'],
];

/** The Rustcoat Legion's emblem: a brass cog (r ~ radius: <2.2 -> 5px, <3.5 -> 7px, else 9px). */
export function cog(d: Pen, cx: number, cy: number, r: number, c: string = MC.brass): void {
  const bm = COG_BITMAPS[r < 2.2 ? 0 : r < 3.5 ? 1 : 2];
  const n = bm.length;
  const hi = shade(c, 0.4);
  const lo = shade(c, -0.3);
  const dk = shade(c, -0.6);
  const x0 = Math.round(cx - n / 2);
  const y0 = Math.round(cy - n / 2);
  const at = (x: number, y: number) => (y >= 0 && y < n && x >= 0 && x < n ? bm[y][x] : '.');
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ch = bm[y][x];
      if (ch === '.') continue;
      let col = c;
      if (ch === 'o') col = dk;
      else if (at(x, y - 1) !== '#' || at(x - 1, y) !== '#') col = hi;
      else if (at(x, y + 1) !== '#' || at(x + 1, y) !== '#') col = lo;
      d.px(x0 + x, y0 + y, col);
    }
  }
}

/** Diagonal hazard stripes inside a rect. */
export function stripes(d: Pen, x: number, y: number, w: number, h: number, c1: string, c2: string, period = 4): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) d.px(x + xx, y + yy, (xx + yy) % period < period / 2 ? c1 : c2);
  }
}

/** One sandbag (lit from the top-left, tied at the ends). */
export function sandbag(d: Pen, x: number, y: number, w: number, h: number, base: string = MC.sand): void {
  const r = h / 2;
  d.cap(x + r, y + r, x + w - r, y + r, r, shade(base, -0.28));
  d.cap(x + r, y + r - 0.6, x + w - r - 0.5, y + r - 0.6, r - 0.7, base);
  d.rect(x + r, y + 1, Math.max(1, w - 2 * r - 1), 1, shade(base, 0.25));
  d.px(x + 1, y + r, shade(base, -0.4));
  d.px(x + w - 2, y + r, shade(base, -0.4));
}

/** Spoked wheel with a tire and a hub whose bolts rotate with `phase` (radians). */
export function wheel(d: Pen, cx: number, cy: number, r: number, phase: number, o: { tire?: string; rim?: string; hub?: string; bolts?: number } = {}): void {
  const tire = o.tire ?? MC.tread;
  const rim = o.rim ?? MC.steelL;
  const hub = o.hub ?? MC.oliveL;
  d.circle(cx, cy, r, tire);
  // Tread blocks rotate with the wheel.
  const n = Math.max(6, Math.round(r * 2));
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    d.px(Math.round(cx + Math.cos(a) * (r - 0.8) - 0.5), Math.round(cy + Math.sin(a) * (r - 0.8) - 0.5), i % 2 ? MC.treadL : MC.treadD);
  }
  d.circle(cx, cy, r * 0.62, rim);
  d.circle(cx + 0.3, cy + 0.3, r * 0.45, shade(rim, -0.3));
  d.circle(cx, cy, r * 0.42, hub);
  const bolts = o.bolts ?? 4;
  if (r >= 3.5) {
    for (let i = 0; i < bolts; i++) {
      const a = phase + (i / bolts) * Math.PI * 2;
      d.px(Math.round(cx + Math.cos(a) * r * 0.3 - 0.5), Math.round(cy + Math.sin(a) * r * 0.3 - 0.5), shade(hub, -0.45));
    }
  }
  d.px(Math.round(cx - r * 0.35 - 0.5), Math.round(cy - r * 0.35 - 0.5), shade(rim, 0.4));
}

/**
 * Tank tread belt from x..x+w, y..y+h with road wheels. `cycle` in [0, 1) is one animation
 * period: links advance by one link (3 px) and wheel bolts by one bolt spacing, so N frames
 * with cycle = f / N loop seamlessly.
 */
export function treads(d: Pen, x: number, y: number, w: number, h: number, cycle: number, o: { wheels?: number; hub?: string; rim?: string } = {}): void {
  const r = h / 2;
  const cy = y + r;
  // Belt body.
  d.cap(x + r, cy, x + w - r, cy, r, MC.tread);
  // Link marks (shift along the belt; top run moves backward, bottom run forward when driving right).
  const step = 3;
  const off = Math.round(cycle * step) % step;
  for (let i = 0; ; i++) {
    const lx = x + r - 1 + i * step + off;
    if (lx > x + w - r) break;
    if (lx >= x + r - 1) d.rect(lx, y, 2, 1, MC.treadLL);
    const bx = x + r - 1 + i * step - off;
    if (bx <= x + w - r) d.rect(bx, y + h - 1, 2, 1, MC.treadL);
  }
  // Inner face.
  d.cap(x + r, cy, x + w - r, cy, r - 1.5, MC.treadD);
  // Road wheels (3 bolts -> one bolt spacing per cycle).
  const n = o.wheels ?? 5;
  const wr = r - 1.6;
  const a = cycle * ((Math.PI * 2) / 3);
  for (let i = 0; i < n; i++) {
    const wx = x + r + ((w - 2 * r) * i) / Math.max(1, n - 1);
    const big = i === 0 || i === n - 1;
    wheel(d, wx, cy + (big ? 0 : 0.6), big ? wr : wr - 0.4, a + i * 0.7, { tire: MC.steelD, rim: o.rim ?? MC.oliveL, hub: o.hub ?? MC.olive, bolts: 3 });
  }
  // Sprocket teeth on the front wheel.
  for (let i = 0; i < 6; i++) {
    const ang = cycle * ((Math.PI * 2) / 6) + (i / 6) * Math.PI * 2;
    d.px(Math.round(x + w - r + Math.cos(ang) * (r - 0.7) - 0.5), Math.round(cy + Math.sin(ang) * (r - 0.7) - 0.5), MC.treadLL);
  }
}

/**
 * drawHuman() clipped to canvas-local rows [y0, y1): for crew sitting inside vehicles
 * (only the part above the hatch / door / cockpit rim shows).
 */
export function drawHumanClip(p: PixelArt, ox: number, oy: number, pose: HumanPose, st: HumanoidStyle, y0: number, y1: number, x0 = -Infinity, x1 = Infinity): void {
  const tmp = new PixelArt(p.w, p.h);
  tmp.ox = p.ox;
  tmp.oy = p.oy;
  drawHuman(tmp, ox, oy, pose, st);
  const ya = Math.max(0, Math.floor(y0 + p.oy));
  const yb = Math.min(p.h, Math.ceil(y1 + p.oy));
  const xa = Math.max(0, Math.floor(x0 + p.ox));
  const xb = Math.min(p.w, Math.ceil(x1 + p.ox));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const v = tmp.data[y * p.w + x];
      if (v >>> 24) p.data[y * p.w + x] = v;
    }
  }
}

/**
 * drawHuman() masked to pixels currently painted in one of `mask` colors (e.g. a cockpit's
 * glass): the crew appears behind the glass and nowhere else.
 */
export function drawHumanMask(p: PixelArt, ox: number, oy: number, pose: HumanPose, st: HumanoidStyle, mask: string[]): void {
  const tmp = new PixelArt(p.w, p.h);
  tmp.ox = p.ox;
  tmp.oy = p.oy;
  drawHuman(tmp, ox, oy, pose, st);
  const m = new Set(mask.map((c) => parseColor(c)));
  for (let i = 0; i < p.data.length; i++) {
    const v = tmp.data[i];
    if (v >>> 24 && m.has(p.data[i])) p.data[i] = v;
  }
}

/** Positive modulo (animation frame from a signed cycle counter). */
export function cycleFrame(cycle: number, n: number): number {
  return ((Math.floor(cycle) % n) + n) % n;
}

/** Small deterministic hash 0..1 for dithering/speckles in art code. */
export function hash01(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Recolor a drawn frame into a charred, burnt-out wreck (soot speckles, a few embers). */
export function charr(p: PixelArt, seed = 1, embers = 0.012): void {
  p.mapPixels((v, x, y) => {
    const r = v & 255;
    const g = (v >>> 8) & 255;
    const b = (v >>> 16) & 255;
    const l = r * 0.32 + g * 0.5 + b * 0.18;
    const n = hash01(x, y, seed);
    let k = 18 + l * 0.38;
    if (n < 0.1) k *= 0.62;
    else if (n > 0.9) k *= 1.18;
    let R = k * 1.1;
    let G = k * 0.96;
    let B = k * 0.9;
    if (n > 1 - embers) {
      R = 255;
      G = n > 1 - embers / 2 ? 210 : 120;
      B = 40;
    }
    const cl = (q: number) => Math.max(0, Math.min(255, Math.round(q)));
    return ((255 << 24) | (cl(B) << 16) | (cl(G) << 8) | cl(R)) >>> 0;
  });
}

/** Render-time crisp translucent pixel line (rotor/propeller motion blur). */
export function blurLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, alpha: number, skip = 0): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const prev = g.globalAlpha;
  g.globalAlpha = prev * alpha;
  g.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    if (skip && (i + skip) % 3 === 0) continue;
    const t = i / n;
    g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
  g.globalAlpha = prev;
}

/** Render-time translucent disc outline (tail rotors, propellers seen face-on). */
export function blurRing(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number): void {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * alpha;
  g.fillStyle = color;
  const n = Math.max(8, Math.round(r * 6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  g.globalAlpha = prev;
}

// ------------------------------------------------------------------ crew styles + shared sprites

export const CREW_DRIVER: HumanoidStyle = styleVariant(RUSTCOAT, { headgear: 'goggles', headgearColor: '#6a4a2c', vest: undefined, strap: '#4a3420', gloves: '#3a2c1e' });
export const CREW_GUNNER: HumanoidStyle = styleVariant(RUSTCOAT, { gloves: '#3a2c1e' });
export const CREW_PILOT: HumanoidStyle = styleVariant(RUSTCOAT, { headgear: 'goggles', headgearColor: '#4a4a3a', shirt: '#6a6a48', vest: undefined, scarf: '#c04a2a' });
export const CREW_ARCTIC: HumanoidStyle = styleVariant(RUSTCOAT, {
  shirt: '#6e7a8c',
  pants: '#4e5866',
  vest: '#a0502a',
  headgear: 'goggles',
  headgearColor: '#e8e2d2',
  scarf: '#c04a2a',
  gloves: '#3a2c1e',
  boots: '#2e2a2e',
});
export const CREW_SAILOR: HumanoidStyle = styleVariant(RUSTCOAT, { shirt: '#5a6a7e', pants: '#3e4a5a', vest: '#a0502a', headgear: 'beanie', headgearColor: '#2e3440', headgearAccent: '#c04a2a' });

defineSoldier('mach_crew', CREW_DRIVER, 'none');
defineSoldier('mach_crew_arctic', CREW_ARCTIC, 'none');
defineSoldier('mach_crew_sailor', CREW_SAILOR, 'none');

/** Telegraph glow drawn at a muzzle while a gun winds up (3 growing frames). */
sprites.define({
  name: 'mach_glow',
  w: 11,
  h: 11,
  ox: 5,
  oy: 5,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const r = [2, 3, 4][f];
    p.circle(5.5, 5.5, r + 0.6, '#ff8a20');
    p.circle(5.5, 5.5, r - 0.4, '#ffe070');
    p.circle(5.5, 5.5, Math.max(0.8, r - 1.6), '#ffffff');
    if (f === 2) {
      p.line(0, 5, 10, 5, '#ffe070');
      p.line(5, 0, 5, 10, '#ffe070');
    }
  },
});

/** Big cannon muzzle flash (points right). */
sprites.define({
  name: 'mach_flash',
  w: 18,
  h: 14,
  ox: 1,
  oy: 7,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    if (f === 0) {
      p.poly([0, 7, 6, 1, 9, 4, 17, 7, 9, 10, 6, 13], '#ffb030');
      p.poly([1, 7, 7, 3, 13, 7, 7, 11], '#ffe070');
      p.circle(5, 7, 2.6, '#ffffff');
    } else if (f === 1) {
      p.poly([0, 7, 5, 2, 14, 7, 5, 12], '#ff8a20');
      p.circle(5, 7, 3, '#ffd040');
      p.circle(4, 7, 1.6, '#fff6c0');
    } else {
      p.circle(4, 7, 3.2, '#c8c0b8');
      p.circle(8, 6, 2.4, '#a8a098');
      p.circle(3, 6, 1.4, '#e8e0d8');
    }
  },
});

sprites.define({
  name: 'mach_shell',
  w: 7,
  h: 5,
  ox: 3,
  oy: 2,
  draw: (p) => {
    p.ellipse(3.5, 2.5, 3.5, 2, '#3c3a40');
    p.rect(0, 1, 2, 3, MC.brassD);
    p.px(4, 1, '#9a98a4');
    p.px(5, 1, '#6a6872');
  },
});

sprites.define({
  name: 'mach_bomb',
  w: 11,
  h: 6,
  ox: 5,
  oy: 3,
  draw: (p) => {
    p.ellipse(6, 3, 4.5, 2.6, MC.oliveD);
    p.ellipse(6, 2.5, 3.5, 1.4, MC.olive);
    p.px(7, 1, MC.oliveLL);
    p.rect(0, 0, 2, 6, MC.steelD);
    p.rect(2, 2, 2, 2, MC.steelD);
    p.rect(9, 2, 1, 2, MC.rust);
  },
});

sprites.define({
  name: 'mach_missile',
  w: 13,
  h: 5,
  ox: 6,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.rect(2, 1, 9, 3, '#c8c4b4');
    p.rect(3, 1, 7, 1, '#ece8d8');
    p.rect(10, 1, 2, 3, MC.red);
    p.px(12, 2, MC.red);
    p.rect(2, 0, 2, 5, MC.steel);
    p.rect(0, 1, 2, 3, f ? '#ffe070' : '#ff8a20');
  },
});

sprites.define({
  name: 'mach_flak',
  w: 5,
  h: 5,
  ox: 2,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.circle(2.5, 2.5, 2.4, f ? '#5a4a3a' : '#4a3c30');
    p.px(1, 1, '#c8a878');
    p.px(3, 3, f ? '#ff5030' : '#c03020');
  },
});

sprites.define({
  name: 'mach_frag',
  w: 4,
  h: 4,
  ox: 2,
  oy: 2,
  frames: 2,
  outline: '#3a0a0a',
  draw: (p, f) => {
    p.rect(0.5, 0.5, 3, 3, f ? '#ff6a2a' : '#ffb040');
    p.px(1, 1, '#fff0a0');
  },
});

sprites.define({
  name: 'mach_zap',
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: 3,
  outline: '#1a1440',
  draw: (p, f) => {
    p.circle(4.5, 4.5, 3.2, '#5a7aff');
    p.circle(4.5, 4.5, 2, '#b8d0ff');
    p.circle(4.5, 4.5, 1, '#ffffff');
    const a = f * 1.1;
    for (let i = 0; i < 3; i++) {
      const t = a + (i / 3) * Math.PI * 2;
      p.px(Math.round(4.5 + Math.cos(t) * 4 - 0.5), Math.round(4.5 + Math.sin(t) * 4 - 0.5), '#d8e8ff');
    }
  },
});

/** Ground target marker for falling bombs (blinks faster as impact nears). */
sprites.define({
  name: 'mach_target',
  w: 15,
  h: 7,
  ox: 7,
  oy: 6,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const c = f ? '#ffe040' : '#ff3a2a';
    p.ellipse(7.5, 4.5, 7, 2.4, c);
    p.ellipse(7.5, 4.5, 5, 1.2, '#00000000');
    p.ellipse(7.5, 4.5, 1.6, 0.9, c);
    p.tri(5, 0, 10, 0, 7.5, 2.5, c);
  },
});

/** Screen-edge incoming warning (points right; flipped for the left edge). */
sprites.define({
  name: 'mach_warn',
  w: 15,
  h: 13,
  ox: 14,
  oy: 6,
  frames: 2,
  draw: (p, f) => {
    const c = f ? '#ffe040' : '#ff3a2a';
    p.poly([0, 1, 7, 1, 14, 6.5, 7, 12, 0, 12], c);
    p.rect(4, 3, 2, 5, f ? '#c02010' : '#fff4c0');
    p.rect(4, 9, 2, 2, f ? '#c02010' : '#fff4c0');
  },
});

// ------------------------------------------------------------------ cosmetic entities

/** A crew member flung out of a destroyed machine (cartoon, no gore). Purely cosmetic. */
export class Ragdoll extends Entity {
  sprite: string;
  landedT = -1;
  spin: number;

  constructor(sprite: string, x: number, y: number, vx: number, vy: number) {
    super();
    this.sprite = sprite;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.facing = vx > 0 ? -1 : 1;
    this.z = Z.ENEMY + 1;
    this.persistent = true;
    this.spin = fxRng.range(-1, 1);
  }

  override update(dt: number): void {
    if (this.landedT < 0) {
      this.vy += 640 * dt;
      this.x += this.vx * dt;
      const ny = this.y + this.vy * dt;
      const T = this.world.terrain;
      // Splash down into water: sink out of sight.
      const wt = this.vy > 0 ? T.waterAt(this.x, ny) : null;
      if (wt && !T.waterAt(this.x, this.y)) {
        this.world.particles.splash(this.x, wt.y, 10);
        msfx(this, 'splash', { vol: 0.5 });
        this.vx *= 0.3;
        this.vy = 30;
      }
      if (wt) {
        this.y = ny;
        this.vy = Math.min(this.vy, 40);
        if (this.y > wt.y + 20) this.remove();
        return;
      }
      if (this.vy > 0) {
        const hit = T.floorAt(this.x, this.y - 2, ny, { solidTolerance: 6 });
        if (hit) {
          this.y = hit.y;
          if (this.vy > 260) {
            this.vy = -this.vy * 0.3;
            this.vx *= 0.5;
            this.world.particles.dust(this.x, this.y, 3);
          } else {
            this.landedT = 0;
            this.vx = 0;
            this.vy = 0;
            this.world.particles.dust(this.x, this.y, 4);
          }
          return;
        }
      }
      this.y = ny;
      if (this.y > this.world.camera.y + VIEW_H + 80) this.remove();
    } else {
      this.landedT += dt;
      if (this.landedT > 1.4) this.remove();
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.landedT > 0.9 && Math.floor(this.landedT * 20) % 2 === 0) return;
    let f: number = SF.DIE + 1;
    if (this.landedT >= 0) f = this.landedT < 0.25 ? SF.DIE + 3 : SF.DIE + 4;
    else if (this.vy > 0) f = SF.DIE + 2;
    sprites.get(this.sprite).draw(g, this.x, this.y, f, { flip: this.facing < 0 });
  }
}

/** A chunk of machine (turret, rotor, wheel...) blown off: tumbles, bounces, smokes, blinks out. */
export class FlyingPart extends Entity {
  sprite: string;
  frame: number;
  rot: number;
  vr: number;
  bounces = 0;
  restT = -1;
  smokeT = 0;
  life: number;
  burning: boolean;

  constructor(sprite: string, frame: number, x: number, y: number, vx: number, vy: number, vr: number, o: { life?: number; burning?: boolean; flip?: boolean } = {}) {
    super();
    this.sprite = sprite;
    this.frame = frame;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = vr;
    this.rot = 0;
    this.anchor = 'center';
    this.facing = o.flip ? -1 : 1;
    this.z = Z.ENEMY + 2;
    this.persistent = true;
    this.life = o.life ?? 2.4;
    this.burning = o.burning ?? true;
  }

  override update(dt: number): void {
    const P = this.world.particles;
    if (this.restT < 0) {
      this.vy += 560 * dt;
      this.x += this.vx * dt;
      const ny = this.y + this.vy * dt;
      this.rot += this.vr * dt;
      const fy = this.world.terrain.groundTopAt(this.x);
      if (this.vy > 0 && ny + 3 >= fy) {
        this.y = fy - 3;
        P.dust(this.x, fy, 4);
        if (this.bounces < 1 && this.vy > 120) {
          this.bounces++;
          this.vy = -this.vy * 0.35;
          this.vx *= 0.5;
          this.vr *= 0.5;
        } else {
          this.restT = 0;
          this.vx = 0;
          this.vy = 0;
          // Settle flat (upright or upside down, whichever is closer).
          const k = Math.round(this.rot / Math.PI);
          this.rot = k * Math.PI;
        }
      } else this.y = ny;
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.05;
        P.add({ kind: 'smoke', x: this.x, y: this.y, vx: fxRng.range(-6, 6), vy: fxRng.range(-14, -4), life: fxRng.range(0.35, 0.6), color: '#5a5258', color2: '#2e2a30', size: 1.5, size2: 3.5, drag: 1 });
      }
      if (this.y > this.world.camera.y + VIEW_H + 100) this.remove();
    } else {
      this.restT += dt;
      if (this.burning && this.restT < this.life - 0.8) {
        this.smokeT -= dt;
        if (this.smokeT <= 0) {
          this.smokeT = 0.12;
          P.add({ kind: 'smoke', x: this.x + fxRng.range(-3, 3), y: this.y - 2, vx: fxRng.range(-4, 4), vy: fxRng.range(-26, -14), life: fxRng.range(0.2, 0.35), color: '#ffe070', color2: '#f0601c', size: 1, size2: 2.4, front: true });
          P.add({ kind: 'smoke', x: this.x + fxRng.range(-3, 3), y: this.y - 5, vx: fxRng.range(-5, 5), vy: fxRng.range(-22, -12), life: fxRng.range(0.6, 0.9), color: '#4a4448', color2: '#2a262c', size: 1.5, size2: 4, drag: 1 });
        }
      }
      if (this.restT > this.life) this.remove();
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.restT > this.life - 0.5 && Math.floor(this.restT * 20) % 2 === 0) return;
    sprites.get(this.sprite).draw(g, this.x, this.y, this.frame, { rot: this.rot, flip: this.facing < 0 });
  }
}

/** Blinking ground marker where a bomb will land. */
export class TargetMarker extends Entity {
  life: number;

  constructor(x: number, y: number, life: number) {
    super();
    this.x = x;
    this.y = y;
    this.life = life;
    this.z = Z.PROP;
    this.persistent = true;
  }

  override update(): void {
    if (this.age >= this.life) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const rate = this.age > this.life * 0.6 ? 16 : 8;
    sprites.get('mach_target').draw(g, this.x, this.y, Math.floor(this.age * rate) % 2);
  }
}

/** Blinking arrow at the screen edge warning about something about to enter at world y. */
export class EdgeWarning extends Entity {
  side: 1 | -1;
  life: number;

  constructor(side: 1 | -1, y: number, life = 0.9) {
    super();
    this.side = side;
    this.y = y;
    this.life = life;
    this.z = Z.FRONT;
    this.persistent = true;
  }

  override update(): void {
    if (this.age >= this.life) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (Math.floor(this.age * 10) % 2 === 1) return;
    const c = this.world.camera;
    const x = this.side > 0 ? c.x + VIEW_W - 3 : c.x + 3;
    const y = Math.max(c.y + 42, Math.min(c.y + VIEW_H - 12, this.y));
    sprites.get('mach_warn').draw(g, x, y, Math.floor(this.age * 20) % 2, { flip: this.side < 0 });
  }
}

/** Seconds a ground machine waits behind the left screen edge, announced, before it drives in. */
export const REAR_ENTRY_HOLD = 1.0;

/**
 * Rear-entry telegraph for ground machines (the look of the levels' m2_incoming sign): a blinking
 * "!" plate with an arrow on the left screen edge at the machine's floor, an engine rumble and dust
 * there while it waits (Machine.entryHold), shown until it has rolled into view.
 */
export class RearEntryWarning extends Entity {
  private rumble = 0;

  constructor(readonly machine: Machine) {
    super();
    this.z = Z.FRONT;
    this.persistent = true;
    this.w = 1;
    this.h = 1;
  }

  /** World x of the sign (just inside the left edge) and the floor y it stands on. */
  private spot(): [number, number] {
    const c = this.world.camera;
    return [c.x + 10, Math.max(c.y + 70, Math.min(c.y + VIEW_H - 6, this.machine.y))];
  }

  override update(dt: number): void {
    const m = this.machine;
    if (m.dead || m.dying || (m.entryHold <= 0 && m.onScreen(-12)) || this.age > 8) {
      this.remove();
      return;
    }
    this.rumble -= dt;
    if (this.rumble <= 0 && m.entryHold > 0) {
      this.rumble = 0.4;
      const [ex, fy] = this.spot();
      this.world.sfx('engine', ex, { vol: 0.5, pitch: 0.8 });
      this.world.particles.dust(ex - 6, fy, 3);
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const hot = Math.floor(this.age * 6) % 2 === 1;
    const [ex, fy] = this.spot();
    const x = Math.round(ex);
    const y = Math.round(fy - 40);
    // Sign: 11x13 plate with a "!", flashing yellow / red.
    const bx = x + 2;
    g.fillStyle = MC.black;
    g.fillRect(bx - 1, y - 1, 13, 15);
    g.fillStyle = hot ? '#e8402c' : '#ffd040';
    g.fillRect(bx, y, 11, 13);
    g.fillStyle = hot ? '#ff8a6a' : '#fff4b0';
    g.fillRect(bx, y, 11, 1);
    g.fillStyle = hot ? '#9c2018' : '#c87818';
    g.fillRect(bx, y + 12, 11, 1);
    g.fillStyle = hot ? '#ffffff' : MC.black;
    g.fillRect(bx + 4, y + 2, 3, 6);
    g.fillRect(bx + 4, y + 9, 3, 2);
    // Arrow pointing at the left edge the threat comes from.
    const ax = x - 7;
    const ay = y + 6;
    for (let i = 0; i < 6; i++) {
      const xx = ax + i;
      g.fillStyle = MC.black;
      g.fillRect(xx, ay - i - 1, 1, i * 2 + 3);
      if (i > 0) {
        g.fillStyle = hot ? '#ffd040' : '#ff5a3a';
        g.fillRect(xx, ay - i + 1, 1, Math.max(1, i * 2 - 1));
      }
    }
  }
}

// ------------------------------------------------------------------ enemy projectiles

/** Falling bomb (helicopters): explodes on terrain or on contact. */
export class Bomb extends Projectile {
  private wasInWater = false;

  constructor(owner: Entity | null, x: number, y: number, vx: number, vy: number) {
    super({ team: 'enemy', owner, x, y, vx, vy, gravity: 300, w: 7, h: 7, sprite: 'mach_bomb', rotate: true, life: 5, explode: { radius: 22, damage: 6, size: 'medium', shake: 2 } });
    this.offscreenMargin = 140;
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.dead) return;
    const inWater = !!this.world.terrain.waterAt(this.x, this.y);
    if (inWater && !this.wasInWater) {
      this.world.particles.splash(this.x, this.y, 8);
      msfx(this, 'splash', { vol: 0.6 });
      this.vx *= 0.3;
      this.vy *= 0.35;
    }
    this.wasInWater = inWater;
  }
}

/** Anti-air shell: bursts after `fuse` seconds into slow falling fragments. */
export class FlakShell extends Projectile {
  constructor(owner: Entity | null, x: number, y: number, vx: number, vy: number, fuse: number) {
    super({ team: 'enemy', owner, x, y, vx, vy, gravity: 90, w: 5, h: 5, sprite: 'mach_flak', fps: 10, life: fuse, explode: { radius: 13, damage: 2, size: 'small', shake: 0, sfx: 'explosion_small' } });
    this.offscreenMargin = 60;
  }

  protected override expire(): void {
    this.burst();
  }

  burst(): void {
    if (this.dead) return;
    const x = this.x;
    const y = this.y;
    this.detonate();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i - 1.5) * 0.42;
      const sp = 92 + (i % 2) * 14;
      this.world.add(new Projectile({ team: 'enemy', owner: this.owner, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 140, w: 4, h: 4, sprite: 'mach_frag', fps: 12, life: 2.2 }));
    }
  }
}

/** Air-to-ground missile: drops briefly, ignites, then accelerates with weak homing. */
export class Missile extends Rocket {
  dropT: number;

  constructor(owner: Entity | null, x: number, y: number, vx: number, o: { maxSpeed?: number; homing?: number; drop?: number } = {}) {
    super({ team: 'enemy', owner, x, y, angle: vx < 0 ? Math.PI : 0, speed: Math.abs(vx), accel: 0, maxSpeed: o.maxSpeed ?? 170, homing: 0, radius: 18, damage: 5, sprite: 'mach_missile' });
    this.vx = vx;
    this.vy = 25;
    this.dropT = o.drop ?? 0.35;
    this.homingAfter = o.homing ?? 0.85;
    this.life = 4;
    this.offscreenMargin = 80;
  }

  private homingAfter: number;

  protected override move(dt: number): void {
    if (this.dropT > 0) {
      this.dropT -= dt;
      this.vy += 160 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.dropT <= 0) {
        this.accel = 240;
        this.homing = this.homingAfter;
        msfx(this, 'enemy_rocket', { vol: 0.6 });
        this.world.particles.smokePuffs(this.x, this.y, 2, 2, '#c8c8c8', '#808080');
      }
      return;
    }
    super.move(dt);
  }
}

/** Slow electric bolt (zapper drones). */
export class ZapBolt extends Projectile {
  constructor(owner: Entity | null, x: number, y: number, angle: number, speed: number) {
    super({ team: 'enemy', owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, kind: 'electric', w: 5, h: 5, sprite: 'mach_zap', fps: 16, life: 3.2 });
  }

  protected override impactFx(): void {
    this.world.particles.sparks(this.x, this.y, 5, '#b8d0ff', 90);
  }
}

// ------------------------------------------------------------------ math helpers

/** Launch velocity to travel from (x0, y0) to (x1, y1) in time T under gravity g. */
export function ballistic(x0: number, y0: number, x1: number, y1: number, g: number, T: number): { vx: number; vy: number } {
  return { vx: (x1 - x0) / T, vy: (y1 - y0 - 0.5 * g * T * T) / T };
}

/** Snap an angle to the nearest of n baked frames covering [a0, a1]. Returns the frame index. */
export function angleFrame(a: number, a0: number, a1: number, n: number): number {
  const t = (a - a0) / (a1 - a0);
  return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
}

/** Entity type to spawn as troops, falling back to rifleman when unknown. */
export function troopType(t: unknown): string {
  return typeof t === 'string' && getEntityType(t) ? t : 'rifleman';
}

// ------------------------------------------------------------------ Machine base class

interface PendingBoom {
  t: number;
  dx: number;
  dy: number;
  size: ExplosionSize;
}

export abstract class Machine extends Enemy {
  readonly isMachine = true;
  /** Debris colors for the destruction (machine's own palette). */
  debris: string[] = OLIVE_DEBRIS;
  /** Explosion size when destroyed. */
  boom: 'small' | 'medium' | 'large' | 'huge' = 'large';
  /** Crew thrown out on destruction (sprite names with SF death frames). */
  crewOut: string[] = [];
  /** Seconds the wreck lingers (burning) before blinking out. */
  wreckTime = 2.4;
  /** Local points (facing right, relative to feet) where damage smoke/fire comes from. */
  smokeAt: [number, number][] = [[0, -12]];
  /** Chain blast on destruction: damages other enemies (never players). */
  blast = { radius: 30, damage: 4 };
  /** Flies (no gravity): set by flying machines. */
  flying = false;
  /** Has exploded into a wreck. */
  wrecked = false;
  /** Seconds since exploding. */
  wreckAge = 0;
  /** Whoever destroyed us (for chain-blast scoring). */
  killer: Entity | null = null;
  /** Brief render jitter after heavy hits. */
  jolt = 0;
  /**
   * Drives in along the ground and rams / crushes (jeep, truck, snowmobile, light tank): spawned
   * behind the left screen edge heading in, it first waits REAR_ENTRY_HOLD s behind a
   * RearEntryWarning (no unannounced rams from behind). Not when a level's m2_incoming already
   * announced it.
   */
  rearWarn = false;
  /** Seconds left waiting behind the left edge while the rear-entry warning blinks. */
  entryHold = 0;
  protected touchCd = new Map<number, number>();
  private fxT = 0;
  private sparkT = 0.5;
  private hitSfxT = 0;
  private booms: PendingBoom[] = [];
  private burnT = 0;

  constructor() {
    super();
    this.deathSfx = null;
    this.meleeable = false;
    this.z = Z.ENEMY - 2;
  }

  /**
   * Visual hit size. Wide ground vehicles keep a narrow physics width (w) so the platformer
   * physics lets them climb slopes, and use this body box as their hurtbox. 0 = same as w/h.
   */
  bodyW = 0;
  bodyH = 0;
  private hbox: Rect = { x: 0, y: 0, w: 0, h: 0 };

  /** Fraction of health remaining. */
  get hpFrac(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  /** Visual body width/height. */
  get bw(): number {
    return this.bodyW || this.w;
  }
  get bh(): number {
    return this.bodyH || this.h;
  }

  override hurtboxes(): Rect[] {
    if (!this.bodyW && !this.bodyH) return [this.box];
    const r = this.hbox;
    r.w = this.bw;
    r.h = this.bh;
    r.x = this.x - r.w / 2;
    r.y = this.anchor === 'bottom' ? this.y - r.h : this.y - r.h / 2;
    return [r];
  }

  /** No floor within reach ahead of the visual front (pit / cliff drop / platform edge)? */
  protected ledgeAhead(dir: number, ahead = 6, maxDrop = 28): boolean {
    const x = this.x + dir * (this.bw / 2 + ahead);
    return !this.world.terrain.floorAt(x, this.y - 40, this.y + maxDrop);
  }

  /** A cliff face or solid block between our center and just past the visual front? */
  protected wallAhead(dir: number, ahead = 3): boolean {
    const T = this.world.terrain;
    const reach = this.bw / 2 + ahead;
    let prev = T.groundTopAt(this.x);
    for (let d = 4; d <= reach + 0.01; d += 4) {
      const g = T.groundTopAt(this.x + dir * Math.min(d, reach));
      if (isFinite(g) && isFinite(prev) && prev - g > 5 && g < this.y - this.stepUp) return true;
      prev = g;
    }
    const fx = this.x + dir * reach;
    return !!T.solidOverlap({ x: fx - 1, y: this.y - this.bh + 2, w: 2, h: this.bh - 8 }, this);
  }

  override spawned(): void {
    super.spawned();
    if (this.props.facing === undefined && !this.target()) {
      // Nobody to face yet: face the middle of the screen.
      this.facing = this.x > this.world.camera.x + VIEW_W / 2 ? -1 : 1;
    }
    if (this.rearWarn && this.entersFromBehind()) {
      // Like a level's m2_incoming: not in play (nor a target) until the warning has run.
      this.entryHold = REAR_ENTRY_HOLD;
      this.hittable = false;
      this.world.invalidateTargets();
      this.world.add(new RearEntryWarning(this));
      this.world.sfx('enemy_alert', this.world.camera.x + 10, { vol: 0.8 });
    }
  }

  /** Spawned at / behind the left view edge heading in during play, with no level warning of its own? */
  private entersFromBehind(): boolean {
    const w = this.world;
    if (this.flying || this.facing < 0 || this.x > w.camera.x + 8 || !w.activePlayers().length) return false;
    return w.query((e) => e.type === 'm2_incoming' && (e as any).child === this).length === 0;
  }

  override update(dt: number): void {
    if (this.entryHold > 0 && !this.dying) {
      // Announced rear entry: wait behind the edge (RearEntryWarning blinks), then drive in.
      this.entryHold -= dt;
      if (this.entryHold > 0) return;
      this.entryHold = 0;
      this.hittable = true;
      this.world.invalidateTargets();
    }
    if (this.hitSfxT > 0) this.hitSfxT -= dt;
    if (this.jolt > 0) this.jolt -= dt;
    super.update(dt);
    if (!this.dying && !this.dead) this.damageFx(dt);
  }

  /** Render offset for the hit jolt (pixels). */
  get joltX(): number {
    return this.jolt > 0 ? (Math.floor(this.jolt * 60) % 2 === 0 ? 1 : -1) : 0;
  }

  override onDamaged(d: Damage): void {
    const x = d.x ?? this.cx;
    const y = d.y ?? this.cy;
    const P = this.world.particles;
    if (d.kind === 'bullet' || d.kind === 'laser' || d.kind === 'melee') {
      P.sparks(x, y, 3, '#ffe8a0', 110);
      P.add({ kind: 'px', x, y, vx: fxRng.range(-30, 30), vy: fxRng.range(-60, -20), life: 0.2, color: '#fff6c0', gravity: 300 });
    }
    if (this.hitSfxT <= 0) {
      this.hitSfxT = 0.085;
      msfx(this, 'metal_hit', { vol: 0.32, pitch: fxRng.range(0.9, 1.15) });
      if (d.kind === 'bullet' && fxRng.chance(0.1)) msfx(this, 'ricochet', { vol: 0.3 });
    }
    if (d.amount >= 4 && this.hp > 0) {
      this.jolt = 0.12;
      if (d.amount >= 8) this.world.shake(1.5, 0.12);
    }
  }

  /** Smoke/sparks/fire while damaged (alive). */
  protected damageFx(dt: number): void {
    const f = this.hpFrac;
    if (f >= 0.5 || !this.onScreen(30)) return;
    const P = this.world.particles;
    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = f < 0.25 ? 0.06 : 0.13;
      const [lx, ly] = this.smokeAt[Math.floor(fxRng.next() * this.smokeAt.length)];
      const px = this.x + lx * this.facing;
      const py = this.y + ly;
      P.add({
        kind: 'smoke',
        x: px + fxRng.range(-2, 2),
        y: py,
        vx: fxRng.range(-6, 6) - this.vx * 0.4,
        vy: fxRng.range(-32, -16),
        life: fxRng.range(0.6, 1.05),
        color: f < 0.25 ? '#38343a' : '#5c585e',
        color2: '#26242a',
        size: 1.5,
        size2: f < 0.25 ? 5.5 : 4.2,
        drag: 1,
        front: true,
      });
      if (f < 0.25) {
        P.add({ kind: 'smoke', x: px + fxRng.range(-2.5, 2.5), y: py + 1, vx: fxRng.range(-8, 8) - this.vx * 0.3, vy: fxRng.range(-40, -22), life: fxRng.range(0.16, 0.3), color: '#ffe070', color2: '#f0601c', size: 1.3, size2: 2.8, front: true });
        if (fxRng.chance(0.3)) P.add({ kind: 'px', x: px, y: py, vx: fxRng.range(-20, 20), vy: fxRng.range(-70, -30), life: 0.5, color: '#ffd040', color2: '#ff6a20', gravity: 60, front: true });
      }
    }
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = fxRng.range(0.35, 0.9);
      const [lx, ly] = this.smokeAt[Math.floor(fxRng.next() * this.smokeAt.length)];
      P.sparks(this.x + lx * this.facing + fxRng.range(-4, 4), this.y + ly + fxRng.range(0, 4), 4, '#ffd080', 95);
    }
  }

  /**
   * Contact damage to player-side targets overlapping `r` (crush, ram, kamikaze).
   * Each target is hurt at most once per `cd` seconds. Returns true if anything was hit.
   */
  protected touch(r: Rect, amount: number, kind: DamageKind = 'crush', cd = 0.6): boolean {
    let hit = false;
    for (const t of this.world.targets('enemy')) {
      if (t.dead || !t.hittable) continue;
      let over = false;
      for (const hb of t.hurtboxes()) {
        if (rectsOverlap(r, hb)) {
          over = true;
          break;
        }
      }
      if (!over) continue;
      const until = this.touchCd.get(t.id) ?? -1;
      if (this.age < until) continue;
      this.touchCd.set(t.id, this.age + cd);
      // Treads and rams flatten soldiers; on a player vehicle's armour a contact is one crush unit
      // (22 HP), not a capped 45 HP hit (a point-blank brawl with a light tank cost half a BULLDOG).
      const amt = kind === 'crush' && (t as any).isVehicle === true ? Math.min(amount, 1) : amount;
      if (t.damage({ amount: amt, kind, owner: this, x: t.cx, y: t.cy, dir: Math.sign(t.cx - this.x) || this.facing })) hit = true;
    }
    return hit;
  }

  /** Is any player-side target overlapping `r`? (no damage dealt) */
  protected touchingTarget(r: Rect): boolean {
    for (const t of this.world.targets('enemy')) {
      if (t.dead || !t.hittable) continue;
      for (const hb of t.hurtboxes()) if (rectsOverlap(r, hb)) return true;
    }
    return false;
  }

  /** Camera-relative x clamp so machines that should stay in the arena don't wander off. */
  protected viewClamp(margin: number): [number, number] {
    const c = this.world.camera;
    return [c.x + margin, c.x + VIEW_W - margin];
  }

  // ---------------------------------------------------------------- death

  override die(d?: Damage): void {
    if (this.dying) return;
    this.dying = true;
    this.deathTime = 0;
    this.hittable = false;
    this.blocksProgress = false;
    this.deathKind = d?.kind ?? 'explosion';
    this.killer = d?.owner ?? null;
    this.deathDuration = 30; // finalized by explodeNow()
    if (this.props.drop) dropPickup(this.world, this.x, this.cy, this.props.drop);
    this.world.invalidateTargets();
    const p = this.world.ownerPlayer(d?.owner);
    if (p && this.scoreValue > 0) {
      const pts = Math.round((this.scoreValue * this.world.difficulty.score) / 10) * 10;
      this.world.floatText(String(pts), this.x, this.top - 4, '#ffe060', 1.3);
    }
    this.onDeath(d);
  }

  /** Default: blow up immediately (ground machines). Flyers override to crash first. */
  override onDeath(_d?: Damage): void {
    this.explodeNow();
  }

  /** Big destruction: explosion + chain blast + debris + crew + flying parts, then a burning wreck. */
  explodeNow(): void {
    if (this.wrecked) return;
    this.wrecked = true;
    this.wreckAge = 0;
    const W = this.world;
    const cx = this.cx;
    const cy = this.cy;
    const big = this.boom === 'large' || this.boom === 'huge';
    W.explode(cx, cy, {
      radius: this.blast.radius,
      damage: this.blast.damage,
      team: 'player',
      owner: this.killer,
      size: this.boom,
      shake: this.boom === 'huge' ? 7 : big ? 5 : 3,
      sfx: big ? 'explosion_big' : 'explosion',
      debris: this.debris,
    });
    W.particles.debris(cx, cy - 2, big ? 22 : 10, this.debris, big ? 260 : 190);
    W.particles.smokePuffs(cx, cy, big ? 10 : 5, Math.max(6, this.bw * 0.3), '#3e3a40', '#242228');
    if (big) {
      W.flash('#fff0c0', 0.28);
      W.hitstop(0.05);
    }
    // Follow-up pops spread over the hull.
    const n = this.boom === 'huge' ? 4 : big ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.booms.push({
        t: 0.12 + i * 0.13 + fxRng.range(0, 0.06),
        dx: fxRng.range(-0.45, 0.45) * this.bw,
        dy: fxRng.range(-0.4, 0.4) * this.bh,
        size: fxRng.chance(0.35) && big ? 'medium' : 'small',
      });
    }
    // Crew flung out, cartoon style.
    this.crewOut.forEach((spr, i) => {
      const dir = i % 2 === 0 ? -this.facing : this.facing;
      W.add(new Ragdoll(spr, this.x + fxRng.range(-6, 6), this.cy - this.bh * 0.1, dir * fxRng.range(40, 90), -fxRng.range(200, 280)));
    });
    if (this.crewOut.length) msfx(this, fxRng.chance(0.5) ? 'enemy_die' : 'enemy_die2', { vol: 0.8 });
    this.onExplode();
    this.deathDuration = this.deathTime + this.wreckTime + 0.5;
  }

  /** Hook: spawn flying parts etc. when the machine blows up. */
  onExplode(): void {}

  override updateDeath(dt: number): void {
    if (this.wrecked) {
      this.wreckAge += dt;
      for (const b of this.booms) {
        if (b.t > 0) {
          b.t -= dt;
          if (b.t <= 0) {
            this.world.explode(this.cx + b.dx, this.cy + b.dy, { radius: 12, damage: 0, team: 'player', size: b.size, shake: 1, sfx: 'explosion_small', debris: this.debris });
          }
        }
      }
      this.burnFx(dt);
    }
    this.updateWreck(dt);
  }

  /** Wreck physics (default: settle on the ground with friction). Flyers override. */
  updateWreck(dt: number): void {
    if (this.flying) return;
    if (this.onGround) this.vx *= Math.pow(0.02, dt);
    this.moveAndCollide(dt);
  }

  /** Fire + smoke on the burning wreck. */
  protected burnFx(dt: number): void {
    if (this.wreckAge > this.wreckTime || !this.onScreen(30)) return;
    this.burnT -= dt;
    if (this.burnT > 0) return;
    this.burnT = 0.05;
    const P = this.world.particles;
    const fade = 1 - this.wreckAge / this.wreckTime;
    const x = this.x + fxRng.range(-0.38, 0.38) * this.bw;
    const y = this.cy + fxRng.range(-0.25, 0.2) * this.bh;
    if (fxRng.chance(0.4 + fade * 0.5)) {
      P.add({ kind: 'smoke', x, y, vx: fxRng.range(-8, 8), vy: fxRng.range(-42, -24), life: fxRng.range(0.2, 0.38), color: '#ffe070', color2: '#f05a1a', size: 1.4, size2: 3.2, front: true });
    }
    if (fxRng.chance(0.5)) {
      P.add({ kind: 'smoke', x, y: y - 4, vx: fxRng.range(-6, 6), vy: fxRng.range(-30, -16), life: fxRng.range(0.8, 1.3), color: '#3a363c', color2: '#222026', size: 2, size2: 6 + fade * 2, drag: 1 });
    }
  }

  /** Draw-time helpers for subclasses. */
  protected get hidden(): boolean {
    return this.deathBlinkHidden;
  }
}

/** Base for flying machines: no gravity, no terrain collision; holds a screen-relative altitude. */
export abstract class FlyingMachine extends Machine {
  /** Spawned without an explicit y (placed on the floor): take the altitude band instead. */
  autoAlt: boolean;
  /** Target screen-space y for the machine's feet while cruising. */
  alt: number;

  constructor(autoAlt: boolean, defaultAlt: number, props: Record<string, any>) {
    super();
    this.flying = true;
    this.collideTerrain = false;
    this.gravityScale = 0;
    this.autoAlt = autoAlt;
    this.alt = typeof props.alt === 'number' ? props.alt : defaultAlt;
  }

  /** World y the machine cruises at (feet). */
  get cruiseY(): number {
    return this.world.camera.y + this.alt;
  }

  /** Ground (or water surface) under x, or null over a pit. */
  floorUnder(x: number): number | null {
    const T = this.world.terrain;
    const g = T.groundTopAt(x);
    const f = T.floorAt(x, this.y, Infinity);
    let y = f ? f.y : isFinite(g) ? g : null;
    for (const w of T.water) if (x >= w.x && x < w.x + w.w && (y === null || w.y < y) && w.y >= this.y) y = w.y;
    return y;
  }
}
