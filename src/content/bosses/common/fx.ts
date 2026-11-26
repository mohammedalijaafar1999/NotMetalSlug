// Shared boss helpers (all bosses; complements common/kit.ts). Import from '../common/fx'.
//  - hurtRect / hurtSegment: damage player-side targets touched by slams and beams
//  - crisp pixel beams, dotted aim lines and ground shadows (no anti-aliased canvas strokes)
//  - GroundMarker: blinking "incoming!" crosshair or a growing shadow on the floor
//  - Debris: tumbling armor plates that bounce on the ground and blink out
//  - small particle presets (smoke, fire, steam, snow, foam)
// Everything here is pure gameplay code: no DOM access at import time.

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { rectsOverlap, segmentRect, type Rect } from '../../../engine/math';
import { Entity } from '../../../game/entity';
import { Z, type DamageKind } from '../../../game/constants';
import type { World } from '../../../game/world';

// ------------------------------------------------------------------ damage helpers

export interface HurtOpts {
  /** Damage to a player on foot (any amount kills). Default 1. */
  amount?: number;
  /** Damage to a player vehicle. Default 8. */
  vehicle?: number;
  kind?: DamageKind;
  owner?: Entity | null;
}

function hurtOne(t: Entity, o: HurtOpts, x: number, y: number): boolean {
  const amount = (t as { isVehicle?: boolean }).isVehicle ? (o.vehicle ?? 8) : (o.amount ?? 1);
  return t.damage({ amount, kind: o.kind ?? 'explosion', owner: o.owner ?? null, x, y, dir: Math.sign(t.cx - x) || -1 });
}

/** Damage every player-side target (players on foot, driven vehicles) overlapping `r`. Returns hits. */
export function hurtRect(world: World, r: Rect, o: HurtOpts = {}): number {
  let n = 0;
  for (const t of world.targets('enemy').slice()) {
    if (t.dead || !t.hittable) continue;
    for (const hb of t.hurtboxes()) {
      if (rectsOverlap(r, hb)) {
        if (hurtOne(t, o, r.x + r.w / 2, r.y + r.h / 2)) n++;
        break;
      }
    }
  }
  return n;
}

/** Damage player-side targets touched by a thick segment (beams). `half` = half thickness. */
export function hurtSegment(world: World, x0: number, y0: number, x1: number, y1: number, half: number, o: HurtOpts = {}): number {
  let n = 0;
  for (const t of world.targets('enemy').slice()) {
    if (t.dead || !t.hittable) continue;
    for (const hb of t.hurtboxes()) {
      const r = { x: hb.x - half, y: hb.y - half, w: hb.w + half * 2, h: hb.h + half * 2 };
      if (segmentRect(x0, y0, x1, y1, r) >= 0) {
        if (hurtOne(t, o, t.cx, t.cy)) n++;
        break;
      }
    }
  }
  return n;
}

/** Does a thick segment touch any player-side target? (no damage) */
export function segmentTouchesPlayers(world: World, x0: number, y0: number, x1: number, y1: number, half: number): boolean {
  for (const t of world.targets('enemy')) {
    if (t.dead || !t.hittable) continue;
    for (const hb of t.hurtboxes()) {
      const r = { x: hb.x - half, y: hb.y - half, w: hb.w + half * 2, h: hb.h + half * 2 };
      if (segmentRect(x0, y0, x1, y1, r) >= 0) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ pixel drawing

/** Crisp line made of size x size squares (pixel-art beams; canvas strokes would anti-alias). */
export function pixelLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const o = Math.floor(size / 2);
  g.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    g.fillRect(Math.round(x0 + (dx * i) / n) - o, Math.round(y0 + (dy * i) / n) - o, size, size);
  }
}

/** Dotted line (aim previews): `on` pixels drawn every `period` pixels, scrolling with `phase`. */
export function dottedLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, period = 6, on = 3, phase = 0, size = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const o = Math.floor(size / 2);
  const ph = Math.floor(phase) % period;
  g.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    if ((((i + ph) % period) + period) % period >= on) continue;
    g.fillRect(Math.round(x0 + (dx * i) / n) - o, Math.round(y0 + (dy * i) / n) - o, size, size);
  }
}

/** Filled pixel ellipse (shadows, glows). */
export function pixelEllipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): void {
  if (rx <= 0 || ry <= 0 || alpha <= 0) return;
  const prev = g.globalAlpha;
  g.globalAlpha = prev * Math.min(1, alpha);
  g.fillStyle = color;
  const R = Math.max(1, Math.round(ry));
  for (let yy = -R; yy <= R; yy++) {
    const k = 1 - (yy / (R + 0.5)) ** 2;
    const w = Math.round(rx * Math.sqrt(Math.max(0, k)));
    if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2, 1);
  }
  g.globalAlpha = prev;
}

// ------------------------------------------------------------------ ground markers & shadows

sprites.define({
  name: 'bm3_marker',
  w: 19,
  h: 11,
  frames: 2,
  outline: '#140c1c',
  draw: (p, f) => {
    const c = f ? '#ffe040' : '#ff3a20';
    const c2 = f ? '#fff6b0' : '#ff9a70';
    // Brackets [ ] lying on the ground plus a down chevron above.
    p.rect(0, 8, 5, 2, c);
    p.rect(0, 5, 2, 5, c);
    p.rect(14, 8, 5, 2, c);
    p.rect(17, 5, 2, 5, c);
    p.poly([5, 0, 14, 0, 9.5, 5], c);
    p.poly([7, 1, 12, 1, 9.5, 3.5], c2);
    p.rect(8, 8, 3, 2, c2);
  },
});

export type MarkerStyle = 'cross' | 'shadow';

/**
 * Something is about to hit this spot. 'cross' = blinking red/yellow bracket marker,
 * 'shadow' = dark ellipse that grows and darkens until impact (falling objects).
 * `life` = seconds until impact (the marker removes itself then).
 */
export class GroundMarker extends Entity {
  life: number;
  readonly max: number;
  style: MarkerStyle;
  radius: number;
  /** Follow another entity's x (e.g. a falling icicle) while alive. */
  track: Entity | null = null;

  constructor(x: number, y: number, life: number, style: MarkerStyle = 'cross', radius = 8) {
    super();
    this.x = x;
    this.y = y;
    this.life = this.max = Math.max(0.05, life);
    this.style = style;
    this.radius = radius;
    this.anchor = 'bottom';
    this.w = radius * 2;
    this.h = 4;
    this.z = Z.PROP + 1;
    this.persistent = true;
  }

  /** 0 at creation → 1 at impact. */
  get progress(): number {
    return 1 - this.life / this.max;
  }

  override update(dt: number): void {
    if (this.track) {
      if (this.track.dead) this.remove();
      else this.x = this.track.x;
    }
    this.life -= dt;
    if (this.life <= 0) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const t = this.progress;
    if (this.style === 'shadow') {
      const r = this.radius * (0.35 + 0.65 * t);
      pixelEllipse(g, this.x, this.y - 1, r, Math.max(1, r * 0.32), '#0a0c18', 0.18 + 0.4 * t);
      if (t > 0.55) pixelEllipse(g, this.x, this.y - 1, r * 0.55, Math.max(1, r * 0.2), '#0a0c18', 0.25);
      return;
    }
    const rate = 4 + t * 14;
    const on = Math.floor(this.age * rate) % 2 === 0;
    pixelEllipse(g, this.x, this.y - 1, this.radius + 2, 2, on ? '#ff3020' : '#ffd040', 0.35);
    sprites.get('bm3_marker').draw(g, this.x, this.y + 1, on ? 0 : 1);
  }
}

// ------------------------------------------------------------------ debris

/** A tumbling piece of armor that bounces on the floor and blinks out. Cosmetic. */
export class Debris extends Entity {
  spriteName: string;
  frame: number;
  rot = 0;
  vr: number;
  life: number;
  bounces = 0;
  private resting = false;

  constructor(spriteName: string, frame: number, x: number, y: number, vx: number, vy: number, life = 2.4) {
    super();
    this.spriteName = spriteName;
    this.frame = frame;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = fxRng.range(-9, 9);
    this.life = life;
    this.anchor = 'center';
    this.z = Z.FX - 2;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.life -= dt;
    if (this.life <= 0) {
      this.remove();
      return;
    }
    if (this.resting) return;
    this.vy += 560 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    const gy = this.world.terrain.groundTopAt(this.x);
    const floor = this.world.terrain.floorAt(this.x, this.y - 8, this.y + 2, { solidTolerance: 4 });
    const fy = floor ? Math.min(floor.y, gy) : gy;
    if (this.vy > 0 && this.y >= fy - 2) {
      this.y = fy - 2;
      this.bounces++;
      this.vy = -this.vy * 0.33;
      this.vx *= 0.55;
      this.vr *= 0.5;
      if (Math.abs(this.vy) < 40 || this.bounces > 3) {
        this.resting = true;
        this.rot = Math.round(this.rot / Math.PI) * Math.PI;
      }
    }
    if (this.y > this.world.terrain.killY) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.life < 0.6 && Math.floor(this.life * 16) % 2 === 0) return;
    const rot = Math.round(this.rot / (Math.PI / 4)) * (Math.PI / 4);
    sprites.get(this.spriteName).draw(g, this.x, this.y, this.frame, rot ? { rot } : undefined);
  }
}

// ------------------------------------------------------------------ particle presets

export function puffSmoke(world: World, x: number, y: number, big = false, dark = true): void {
  world.particles.add({
    kind: 'smoke',
    x: x + fxRng.range(-2, 2),
    y,
    vx: fxRng.range(-8, 8) + 6,
    vy: fxRng.range(-30, -16),
    life: fxRng.range(0.9, 1.5),
    color: dark ? '#3a3640' : '#6a6670',
    color2: dark ? '#1e1c24' : '#46424e',
    size: big ? 3 : 2,
    size2: big ? 8 : 5,
    drag: 0.8,
  });
}

export function puffFire(world: World, x: number, y: number): void {
  world.particles.add({
    kind: 'px',
    x: x + fxRng.range(-3, 3),
    y: y + fxRng.range(-1, 1),
    vx: fxRng.range(-10, 10),
    vy: fxRng.range(-55, -25),
    life: fxRng.range(0.25, 0.5),
    color: fxRng.pick(['#ffe27a', '#f9a12e', '#ffcf3a']),
    color2: '#e2491d',
    size: fxRng.pick([1, 2, 2]),
    drag: 1,
  });
  if (fxRng.chance(0.25)) puffSmoke(world, x, y - 6);
}

export function puffSteam(world: World, x: number, y: number, vx: number, vy: number, n = 3, size = 3): void {
  for (let i = 0; i < n; i++) {
    world.particles.add({
      kind: 'smoke',
      x: x + fxRng.range(-2, 2),
      y: y + fxRng.range(-2, 2),
      vx: vx * fxRng.range(0.6, 1.2) + fxRng.range(-6, 6),
      vy: vy * fxRng.range(0.6, 1.2) + fxRng.range(-6, 4),
      life: fxRng.range(0.45, 0.9),
      color: '#f2f6ff',
      color2: '#aebccc',
      size: size * 0.6,
      size2: size * 1.6,
      drag: 2.4,
      front: true,
      alpha: 0.85,
    });
  }
}

export function puffSnow(world: World, x: number, y: number, n = 6, spread = 60, front = false): void {
  for (let i = 0; i < n; i++) {
    world.particles.add({
      kind: 'px',
      x: x + fxRng.range(-4, 4),
      y: y + fxRng.range(-2, 2),
      vx: fxRng.range(-spread, spread),
      vy: fxRng.range(-spread * 1.6, -spread * 0.3),
      life: fxRng.range(0.4, 0.9),
      color: fxRng.pick(['#ffffff', '#e4f0ff', '#c4dcf4']),
      gravity: 320,
      size: fxRng.pick([1, 1, 2]),
      front,
    });
  }
  world.particles.add({ kind: 'smoke', x, y, vx: 0, vy: -10, life: 0.6, color: '#f4f8ff', color2: '#c8d8ea', size: 3, size2: 7, drag: 2, alpha: 0.8 });
}

export function puffFoam(world: World, x: number, y: number, n = 6, up = 140, spread = 50): void {
  for (let i = 0; i < n; i++) {
    world.particles.add({
      kind: 'px',
      x: x + fxRng.range(-5, 5),
      y,
      vx: fxRng.range(-spread, spread),
      vy: -fxRng.range(up * 0.4, up),
      life: fxRng.range(0.35, 0.8),
      color: fxRng.pick(['#ffffff', '#dff2ff', '#a8d8f4']),
      gravity: 520,
      size: fxRng.pick([1, 2, 2]),
      front: true,
    });
  }
}

/** Sparks + a hot white pixel burst (armor deflections). */
export function deflectFx(world: World, x: number, y: number): void {
  world.particles.sparks(x, y, 3, fxRng.chance(0.5) ? '#ffe7a0' : '#ffffff', 110);
}
