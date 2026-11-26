// Small math helpers shared by the whole game. Pure functions, no DOM.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));
export const sign = (v: number): -1 | 0 | 1 => (v < 0 ? -1 : v > 0 ? 1 : 0);

/** Move `v` toward `target` by at most `delta` (delta >= 0). */
export function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

/** Frame-rate independent exponential smoothing factor. `rate` ~ 1/seconds-to-63%. */
export function smoothing(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Wrap angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Shortest signed difference from a to b (radians). */
export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

/** Rotate angle `a` toward `target` by at most `maxDelta` radians. */
export function rotateTowards(a: number, target: number, maxDelta: number): number {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxDelta) return target;
  return a + Math.sign(d) * maxDelta;
}

/** Distance from point to rectangle (0 if inside). */
export function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Does segment (x0,y0)-(x1,y1) intersect rect? Liang-Barsky. Returns entry t in [0,1] or -1. */
export function segmentRect(x0: number, y0: number, x1: number, y1: number, r: Rect): number {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return -1;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return -1;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return -1;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
}

export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t: number): number => t * t;
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Triangle wave in [0,1] with given period. */
export function pingPong(t: number, period: number): number {
  const p = (t % period) / period;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** Format an integer with leading zeros. */
export function pad(n: number, width: number, ch = '0'): string {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= width ? s : ch.repeat(width - s.length) + s;
}
