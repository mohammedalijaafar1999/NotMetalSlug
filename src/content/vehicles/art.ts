// Shared pixel-art helpers for player vehicles and props: the Ruckus Squad motor-pool palette and
// an edge-lit fill (light from the top-left) so plates, pods and drums get consistent bevels.
// Pure PixelArt (no DOM) - safe to run in Node tests.

import { PixelArt, parseColor, shade } from '../../engine/pixelart';

/** A color ramp for edge lighting: top edge = light, left = light2, bottom = dark, right = dark2. */
export interface Ramp {
  base: string;
  light: string;
  dark: string;
  light2?: string;
  dark2?: string;
}

/** Build a ramp from a base color. */
export function ramp(base: string, light = 0.32, dark = -0.32): Ramp {
  return {
    base,
    light: shade(base, light),
    dark: shade(base, dark),
    light2: shade(base, light * 0.5),
    dark2: shade(base, dark * 0.5),
  };
}

/** Ruckus Squad motor pool: teal-green hulls, gunmetal, rubber, orange trim, cream stencils. */
export const VP = {
  hull: ramp('#4f9a80', 0.3, -0.3),
  hullDeep: '#24514a',
  hullL: '#8fd0b0',
  steel: ramp('#848c9c', 0.32, -0.32),
  steelDark: ramp('#545a68', 0.3, -0.3),
  rubber: '#2a262c',
  rubberL: '#48424c',
  rubberLL: '#655c66',
  orange: '#f0902e',
  orangeL: '#ffc45a',
  orangeD: '#b45c1c',
  cream: '#f4e6c0',
  creamD: '#cdb990',
  glass: '#7fd0ee',
  glassL: '#e2faff',
  glassD: '#3f88ae',
  lamp: '#fff2a0',
  lampOff: '#6a6a5a',
  red: '#e84a3a',
  dark: '#1e1a22',
  hole: '#16121a',
};

/**
 * Fill a silhouette with automatic top-left lighting. `mask` draws the shape (any color) into a
 * scratch layer sharing p's transform; every covered pixel is then colored by which of its
 * neighbours are empty: top -> light, bottom -> dark, left -> light2, right -> dark2, else base.
 */
export function shaded(p: PixelArt, mask: (m: PixelArt) => void, r: Ramp): void {
  const m = new PixelArt(p.w, p.h);
  m.ox = p.ox;
  m.oy = p.oy;
  m.mirror = p.mirror;
  mask(m);
  const vb = parseColor(r.base);
  const vl = parseColor(r.light);
  const vd = parseColor(r.dark);
  const vl2 = parseColor(r.light2 ?? r.light);
  const vd2 = parseColor(r.dark2 ?? r.dark);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.opaque(x, y)) continue;
      let v = vb;
      if (!m.opaque(x, y - 1)) v = vl;
      else if (!m.opaque(x, y + 1)) v = vd;
      else if (!m.opaque(x - 1, y)) v = vl2;
      else if (!m.opaque(x + 1, y)) v = vd2;
      p.setRaw(x, y, v);
    }
  }
}

/** Edge-lit polygon. */
export function shadedPoly(p: PixelArt, pts: number[], r: Ramp): void {
  shaded(p, (m) => m.poly(pts, '#ffffff'), r);
}

/** Edge-lit rectangle. */
export function shadedRect(p: PixelArt, x: number, y: number, w: number, h: number, r: Ramp): void {
  shaded(p, (m) => m.rect(x, y, w, h, '#ffffff'), r);
}

/** Edge-lit circle. */
export function shadedCircle(p: PixelArt, cx: number, cy: number, rad: number, r: Ramp): void {
  shaded(p, (m) => m.circle(cx, cy, rad, '#ffffff'), r);
}

/** Edge-lit capsule. */
export function shadedCapsule(p: PixelArt, x0: number, y0: number, x1: number, y1: number, rad: number, r: Ramp): void {
  shaded(p, (m) => m.capsule(x0, y0, x1, y1, rad, '#ffffff'), r);
}

/** A rivet / bolt head: light dot with a dark pixel below-right. */
export function rivet(p: PixelArt, x: number, y: number, light: string, dark: string): void {
  p.px(x, y, light);
  p.px(x + 1, y + 1, dark);
}

/** Rotate a flat point list around (cx, cy). */
export function rotPts(pts: number[], cx: number, cy: number, a: number): number[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - cx;
    const dy = pts[i + 1] - cy;
    out.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return out;
}

/** Point rotated around (cx, cy). */
export function rotPt(x: number, y: number, cx: number, cy: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Polygon approximating an ellipse (so it can be rotated). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 16): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/** Tiny 3x5 stencil digits/letters for hull numbers and labels. */
const STENCIL: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
};

export function stencil(p: PixelArt, s: string, x: number, y: number, c: string): void {
  let cx = x;
  for (const ch of s) {
    const g = STENCIL[ch];
    if (g) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '#') p.px(cx + xx, y + yy, c);
    cx += 4;
  }
}
