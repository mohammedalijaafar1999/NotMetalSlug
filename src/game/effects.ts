// Visual effects: a lightweight particle system plus effect entities
// (explosions, sprite animations, floating score text).

import { sprites, type Sprite } from '../engine/sprites';
import { fxRng, Rng } from '../engine/rng';
import { drawText } from '../engine/font';
import { Entity } from './entity';
import { Z } from './constants';
import type { Terrain } from './terrain';
import { PixelArt } from '../engine/pixelart';

export type ParticleKind = 'px' | 'smoke' | 'spark' | 'debris' | 'sprite' | 'ring';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  color2?: string;
  size: number;
  /** Size at end of life (smoke grows). */
  size2: number;
  gravity: number;
  drag: number;
  bounce: number;
  rot: number;
  vr: number;
  sprite?: Sprite;
  fps: number;
  flip: boolean;
  front: boolean;
  alpha: number;
}

/** 1px line between integer points, one rect per run (uses the current fillStyle). */
function pixelStreak(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dy === 0) {
    g.fillRect(Math.min(x0, x1), y0, Math.abs(dx) + 1, 1);
    return;
  }
  if (dx === 0) {
    g.fillRect(x0, Math.min(y0, y1), 1, Math.abs(dy) + 1);
    return;
  }
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), 1, 1);
}

/** Crisp 1px ring sprites by color and radius (canvas arcs are anti-aliased). */
const ringCache = new Map<string, HTMLCanvasElement | null>();
function ringCanvas(color: string, r: number): HTMLCanvasElement | null {
  const key = color + r;
  let c = ringCache.get(key);
  if (c === undefined) {
    if (ringCache.size > 256) ringCache.clear();
    c = typeof document === 'undefined' ? null : new PixelArt(r * 2 + 1, r * 2 + 1).ring(r + 0.5, r + 0.5, r + 0.5, color, 1.3).toCanvas();
    ringCache.set(key, c);
  }
  return c;
}

export class Particles {
  list: Particle[] = [];
  max = 1400;

  add(p: Partial<Particle> & { x: number; y: number }): Particle | null {
    // At the cap, drop the oldest tenth in one go (shift() per particle is O(n) each).
    if (this.list.length >= this.max) this.list.splice(0, Math.max(1, Math.ceil(this.max / 10)));
    const life = p.life ?? 0.5;
    const q: Particle = {
      kind: 'px',
      vx: 0,
      vy: 0,
      max: life,
      color: '#ffffff',
      size: 1,
      size2: p.size ?? 1,
      gravity: 0,
      drag: 0,
      bounce: 0,
      rot: 0,
      vr: 0,
      fps: 12,
      flip: false,
      front: false,
      alpha: 1,
      ...p,
      life,
    };
    this.list.push(q);
    return q;
  }

  update(dt: number, terrain: Terrain | null): void {
    // Compact in place (no new array every step).
    const list = this.list;
    let live = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.bounce && terrain && p.vy > 0) {
        const gy = terrain.groundTopAt(p.x);
        if (p.y >= gy) {
          p.y = gy - 0.1;
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.7;
          p.vr *= 0.6;
          if (Math.abs(p.vy) < 20) {
            p.vy = 0;
            p.gravity = 0;
            p.vx *= 0.5;
          }
        }
      }
      list[live++] = p;
    }
    list.length = live;
  }

  render(g: CanvasRenderingContext2D, front: boolean): void {
    for (const p of this.list) {
      if (p.front !== front) continue;
      const t = 1 - p.life / p.max; // 0 -> 1
      const size = p.size + (p.size2 - p.size) * t;
      switch (p.kind) {
        case 'px': {
          g.globalAlpha = p.alpha * (p.life < 0.15 ? p.life / 0.15 : 1);
          g.fillStyle = p.color2 && t > 0.5 ? p.color2 : p.color;
          const s = Math.max(1, Math.round(size));
          g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
          break;
        }
        case 'smoke': {
          g.globalAlpha = p.alpha * (1 - t) * 0.85;
          g.fillStyle = p.color2 && t > 0.35 ? p.color2 : p.color;
          const r = Math.max(1, Math.round(size));
          // Chunky "pixel circle": draw as stacked rects for a crisp look.
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          g.fillRect(x - r, y - Math.round(r * 0.6), r * 2, Math.round(r * 1.2));
          g.fillRect(x - Math.round(r * 0.6), y - r, Math.round(r * 1.2), r * 2);
          break;
        }
        case 'spark': {
          // A crisp pixel streak behind the spark (a canvas stroke would be anti-aliased).
          g.globalAlpha = p.alpha * (1 - t * 0.6);
          g.fillStyle = p.color;
          const len = 0.025;
          pixelStreak(g, Math.round(p.x), Math.round(p.y), Math.round(p.x - p.vx * len), Math.round(p.y - p.vy * len));
          break;
        }
        case 'debris': {
          // A chip turned in 45-degree steps, drawn with axis-aligned rects: crisp, and no
          // save/translate/rotate/restore per particle.
          g.globalAlpha = p.alpha * (p.life < 0.3 ? p.life / 0.3 : 1);
          g.fillStyle = p.color;
          const s = Math.max(1, Math.round(size));
          const th = Math.max(1, s >> 1);
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          const q = ((Math.round(p.rot / (Math.PI / 4)) % 8) + 8) % 8;
          if (q % 4 === 0) g.fillRect(x - s, y - th, s * 2, Math.max(1, s));
          else if (q % 4 === 2) g.fillRect(x - th, y - s, Math.max(1, s), s * 2);
          else {
            const dy = q % 4 === 1 ? 1 : -1;
            for (let i = 0; i < s * 2; i++) g.fillRect(x - s + i, y + dy * (i - s) - (dy < 0 ? 1 : 0), 1, th);
          }
          break;
        }
        case 'ring': {
          g.globalAlpha = p.alpha * (1 - t);
          const r = Math.max(1, Math.round(size));
          const c = ringCanvas(p.color, r);
          if (c) g.drawImage(c, Math.round(p.x) - r, Math.round(p.y) - r);
          break;
        }
        case 'sprite': {
          if (!p.sprite) break;
          const frame = Math.min(p.sprite.frameCount - 1, Math.floor((p.max - p.life) * p.fps));
          p.sprite.draw(g, p.x, p.y, frame, { flip: p.flip, alpha: p.alpha });
          break;
        }
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.list = [];
  }

  // ---- Common presets ----

  dust(x: number, y: number, n = 4, color = '#c8b48a'): void {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'smoke', x: x + fxRng.range(-4, 4), y: y - 1, vx: fxRng.range(-30, 30), vy: fxRng.range(-18, -4), life: fxRng.range(0.25, 0.45), color, size: 1, size2: 3, drag: 3 });
    }
  }

  sparks(x: number, y: number, n = 5, color = '#ffe080', speed = 110): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.range(0, Math.PI * 2);
      const s = fxRng.range(speed * 0.4, speed);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: fxRng.range(0.08, 0.2), color, gravity: 300 });
    }
  }

  debris(x: number, y: number, n: number, colors: string[], speed = 160): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.range(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = fxRng.range(speed * 0.35, speed);
      this.add({
        kind: 'debris',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: fxRng.range(0.6, 1.3),
        color: fxRng.pick(colors),
        size: fxRng.pick([1, 1, 2]),
        gravity: 520,
        bounce: 0.35,
        rot: fxRng.range(0, 6),
        vr: fxRng.range(-12, 12),
      });
    }
  }

  smokePuffs(x: number, y: number, n: number, radius: number, color = '#4a4a52', color2 = '#2a2a30'): void {
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'smoke',
        x: x + fxRng.range(-radius, radius),
        y: y + fxRng.range(-radius, radius * 0.5),
        vx: fxRng.range(-15, 15),
        vy: fxRng.range(-40, -10),
        life: fxRng.range(0.6, 1.2),
        color,
        color2,
        size: fxRng.range(2, 4),
        size2: fxRng.range(5, 9),
        drag: 1.5,
      });
    }
  }

  splash(x: number, y: number, n = 8, color = '#bfe6ff'): void {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'px', x: x + fxRng.range(-5, 5), y, vx: fxRng.range(-50, 50), vy: fxRng.range(-160, -60), life: fxRng.range(0.3, 0.6), color, gravity: 600, size: fxRng.pick([1, 2]) });
    }
  }

  blood(x: number, y: number, n = 4, color = '#d8c8a0'): void {
    // Cartoon "impact puff" (no gore).
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'px', x, y, vx: fxRng.range(-60, 60), vy: fxRng.range(-90, -20), life: fxRng.range(0.2, 0.4), color, gravity: 400, size: 1 });
    }
  }
}

// ------------------------------------------------------------------ Explosion art

export type ExplosionSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
export const EXPLOSION_RADIUS: Record<ExplosionSize, number> = { tiny: 7, small: 12, medium: 18, large: 28, huge: 42 };

function defineExplosionSprite(size: ExplosionSize): void {
  const R = EXPLOSION_RADIUS[size];
  const frames = 12;
  const W = R * 2 + 8;
  const H = R * 2 + 12;
  sprites.fallback({
    name: `explosion_${size}`,
    w: W,
    h: H,
    ox: W / 2,
    oy: H / 2 + 4,
    frames,
    outline: null,
    draw: (p: PixelArt, f: number) => {
      const rng = new Rng(77 + R);
      const t = f / (frames - 1);
      const cx = W / 2;
      const cy = H / 2 + 4;
      const puffs = Array.from({ length: 7 }, (_, i) => ({
        a: (i / 7) * Math.PI * 2 + rng.range(-0.4, 0.4),
        d: rng.range(0.15, 0.55),
        s: rng.range(0.38, 0.62),
      }));
      const growth = t < 0.25 ? 0.45 + (t / 0.25) * 0.65 : 1.1 - (t - 0.25) * 0.45;
      const rise = t * R * 0.45;
      const fire = t < 0.6;
      // Flash core on first frames.
      if (f <= 1) p.circle(cx, cy, R * (0.35 + f * 0.3), '#ffffff');
      for (const layer of [0, 1, 2, 3]) {
        for (const pf of puffs) {
          const px = cx + Math.cos(pf.a) * pf.d * R * (0.35 + t * 0.9);
          const py = cy + Math.sin(pf.a) * pf.d * R * (0.35 + t * 0.7) - rise;
          const r = pf.s * R * growth;
          if (fire) {
            const cols = ['#7a1f12', '#e2491d', '#f9a12e', '#fff27a'];
            const k = [1.0, 0.82, 0.6, 0.36][layer];
            if (layer === 3 && t > 0.35) continue;
            p.circle(px, py, r * k, cols[layer]);
          } else {
            const st = (t - 0.6) / 0.4; // 0..1
            const cols = ['#2a2630', '#3f3a46', '#59525e', '#59525e'];
            if (layer > 2) continue;
            const k = [1.0, 0.75, 0.45][layer] * (1 + st * 0.25);
            if (st > 0.55 && layer === 0) {
              // Dithered dissipating smoke.
              const rr = r * k;
              for (let yy = Math.floor(py - rr); yy <= py + rr; yy++)
                for (let xx = Math.floor(px - rr); xx <= px + rr; xx++)
                  if ((xx + yy + f) % 2 === 0 && (xx - px) ** 2 + (yy - py) ** 2 <= rr * rr) p.px(xx, yy, cols[0]);
            } else {
              p.circle(px, py, r * k, cols[layer]);
            }
          }
        }
      }
    },
  });
}

(['tiny', 'small', 'medium', 'large', 'huge'] as ExplosionSize[]).forEach(defineExplosionSprite);

// Muzzle flash / impact sprites (generic fallbacks; content may override).
sprites.fallback({
  name: 'muzzle_flash',
  w: 10,
  h: 8,
  ox: 1,
  oy: 4,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    if (f === 0) {
      p.poly([0, 4, 6, 0, 9, 4, 6, 8], '#ffd23c');
      p.poly([1, 4, 5, 2, 7, 4, 5, 6], '#ffffff');
    } else {
      p.poly([0, 4, 4, 1, 6, 4, 4, 7], '#ff9a2e');
      p.circle(2.5, 4, 1.5, '#fff6a0');
    }
  },
});

sprites.fallback({
  name: 'impact_spark',
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const c = ['#ffffff', '#ffe27a', '#ff9a2e'][f];
    const r = [2, 3.5, 4][f];
    p.line(4 - r, 4, 4 + r, 4, c);
    p.line(4, 4 - r, 4, 4 + r, c);
    if (f < 2) p.circle(4.5, 4.5, 1.2, '#ffffff');
    if (f > 0) {
      p.px(4 - r + 1, 4 - r + 1, c);
      p.px(4 + r - 1, 4 + r - 1, c);
    }
  },
});

// ------------------------------------------------------------------ Effect entities

/** Plays a sprite animation once (or loops for `duration`) then removes itself. */
export class SpriteEffect extends Entity {
  sprite: Sprite;
  fps: number;
  loop: boolean;
  duration: number;
  alpha = 1;
  vxEffect = 0;
  vyEffect = 0;
  follow: Entity | null = null;
  followDx = 0;
  followDy = 0;
  /** Rotation in radians (sprite art points right). */
  rot = 0;

  constructor(spriteName: string, x: number, y: number, opts: { fps?: number; flip?: boolean; loop?: boolean; duration?: number; z?: number; vx?: number; vy?: number } = {}) {
    super();
    this.sprite = sprites.get(spriteName);
    this.x = x;
    this.y = y;
    this.anchor = 'center';
    this.fps = opts.fps ?? 20;
    this.facing = opts.flip ? -1 : 1;
    this.loop = !!opts.loop;
    this.duration = opts.duration ?? this.sprite.frameCount / this.fps;
    this.z = opts.z ?? Z.FX;
    this.vxEffect = opts.vx ?? 0;
    this.vyEffect = opts.vy ?? 0;
    this.persistent = true;
  }

  override update(dt: number): void {
    if (this.follow) {
      this.x = this.follow.x + this.followDx;
      this.y = this.follow.y + this.followDy;
    } else {
      this.x += this.vxEffect * dt;
      this.y += this.vyEffect * dt;
    }
    if (this.age >= this.duration) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    let frame = Math.floor(this.age * this.fps);
    if (this.loop) frame %= this.sprite.frameCount;
    else frame = Math.min(frame, this.sprite.frameCount - 1);
    if (this.rot) this.sprite.draw(g, this.x, this.y, frame, { rot: this.rot, alpha: this.alpha });
    else this.sprite.draw(g, this.x, this.y, frame, { flip: this.facing < 0, alpha: this.alpha });
  }
}

export class ExplosionEffect extends SpriteEffect {
  constructor(x: number, y: number, size: ExplosionSize) {
    super(`explosion_${size}`, x, y, { fps: size === 'huge' ? 16 : 22, z: Z.EXPLOSION });
  }
}

/** Floating text (score popups, "1UP", etc). */
export class FloatingText extends Entity {
  text: string;
  color: string;
  life: number;

  constructor(text: string, x: number, y: number, color = '#ffffff', life = 1.0) {
    super();
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = life;
    this.anchor = 'center';
    this.z = Z.FRONT;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.y -= 22 * dt * Math.max(0, 1 - this.age / this.life);
    if (this.age >= this.life) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const a = this.age > this.life * 0.7 ? 1 - (this.age - this.life * 0.7) / (this.life * 0.3) : 1;
    drawText(g, this.text, this.x, this.y - 3, { color: this.color, align: 'center', alpha: a, shadow: '#000000' });
  }
}
