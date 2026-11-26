// Procedural texture & scenery generators (pure PixelArt, deterministic via seeds).
// Used by themes for terrain fills, edges and parallax background layers.

import { PixelArt, shade, mixColor } from '../engine/pixelart';
import { Rng } from '../engine/rng';

/** Speckled fill: base color with random flecks of the given colors. */
export function speckleTile(w: number, h: number, base: string, flecks: string[], density = 0.12, seed = 1): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  p.rect(0, 0, w, h, base);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (r.chance(density)) p.px(x, y, r.pick(flecks));
  return p;
}

/** Dirt with embedded pebbles (tileable). */
export function dirtTile(w = 32, h = 32, base = '#7a5236', dark = '#5e3e28', light = '#946644', pebble = '#a08a70', seed = 3): PixelArt {
  const p = speckleTile(w, h, base, [dark, dark, light], 0.14, seed);
  const r = new Rng(seed + 9);
  for (let i = 0; i < Math.floor((w * h) / 140); i++) {
    const x = r.int(1, w - 3);
    const y = r.int(1, h - 3);
    const s = r.pick([1, 1.5, 2]);
    p.ellipse(x + 0.5, y + 0.5, s + 0.5, s, dark);
    p.ellipse(x, y, s, s - 0.5, pebble);
    p.px(x - 1, y - 1, shade(pebble, 0.3));
  }
  return p;
}

/** Stone bricks (tileable). */
export function brickTile(w = 32, h = 16, mortar = '#3a3440', brick = '#7a7484', seed = 5, bw = 16, bh = 8): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  p.rect(0, 0, w, h, mortar);
  for (let row = 0; row < h / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < w / bw + 1; col++) {
      const x = col * bw + off;
      const y = row * bh;
      const c = shade(brick, r.range(-0.12, 0.1));
      p.rect(x + 1, y + 1, bw - 1, bh - 1, c);
      p.rect(x + 1, y + 1, bw - 1, 1, shade(c, 0.18));
      p.rect(x + 1, y + bh - 1, bw - 1, 1, shade(c, -0.2));
      if (r.chance(0.3)) p.px(x + r.int(3, bw - 3), y + r.int(2, bh - 2), shade(c, -0.25));
    }
  }
  // Wrap seam fix: copy left column logic is fine as bricks are periodic by construction.
  return p;
}

/** Metal plate floor (tileable). */
export function metalTile(w = 32, h = 32, base = '#5a6470', seed = 7): PixelArt {
  const p = new PixelArt(w, h);
  p.rect(0, 0, w, h, base);
  const hi = shade(base, 0.2);
  const lo = shade(base, -0.3);
  for (let y = 0; y < h; y += 16) {
    for (let x = 0; x < w; x += 16) {
      p.rect(x, y, 16, 1, hi);
      p.rect(x, y, 1, 16, hi);
      p.rect(x, y + 15, 16, 1, lo);
      p.rect(x + 15, y, 1, 16, lo);
      p.px(x + 3, y + 3, lo);
      p.px(x + 12, y + 3, lo);
      p.px(x + 3, y + 12, lo);
      p.px(x + 12, y + 12, lo);
    }
  }
  const r = new Rng(seed);
  for (let i = 0; i < 10; i++) p.px(r.int(0, w - 1), r.int(0, h - 1), shade(base, -0.12));
  return p;
}

/**
 * Grass edge strip: `up` rows of blades above the surface, then a grass band fading into dirt.
 * Use with ThemeDef.groundEdgeUp = up.
 */
export function grassEdge(w = 32, up = 3, band = 5, grass = '#4fa83a', dark = '#2f7a2a', light = '#8ed85a', seed = 11): PixelArt {
  const h = up + band + 3;
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  for (let x = 0; x < w; x++) {
    const blade = r.int(0, up);
    for (let y = up - blade; y < up; y++) p.px(x, y, y === up - blade ? light : grass);
    for (let y = up; y < up + band; y++) p.px(x, y, y === up ? light : r.chance(0.2) ? dark : grass);
    const drip = r.int(0, 3);
    for (let y = up + band; y < up + band + drip; y++) p.px(x, y, dark);
  }
  return p;
}

/** Generic edge strip: a solid top band with highlight (sand, snow, concrete...). */
export function bandEdge(w: number, top: string, body: string, depth = 4, up = 1, seed = 13, rough = 1): PixelArt {
  const h = up + depth + 2;
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  for (let x = 0; x < w; x++) {
    const t = up - r.int(0, rough);
    for (let y = Math.max(0, t); y < up + depth + r.int(0, 2); y++) p.px(x, y, y <= t ? top : body);
  }
  return p;
}

/** Mountain range silhouette layer (tileable horizontally). */
export function mountainLayer(w: number, h: number, color: string, opts: { peaks?: number; minH?: number; maxH?: number; snow?: string; seed?: number; highlight?: string } = {}): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(opts.seed ?? 21);
  const peaks = opts.peaks ?? 5;
  const minH = opts.minH ?? h * 0.3;
  const maxH = opts.maxH ?? h * 0.95;
  // Periodic height profile: sum of sines with integer frequencies => tileable.
  const comps = Array.from({ length: 4 }, (_, i) => ({ f: (i + 1) * Math.max(1, Math.round(peaks / 2)) + r.int(0, 2), a: r.range(0.3, 1) / (i + 1), ph: r.range(0, Math.PI * 2) }));
  const heights: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = 0; x < w; x++) {
    let v = 0;
    for (const c of comps) v += Math.abs(Math.sin((x / w) * Math.PI * c.f + c.ph)) * c.a;
    heights.push(v);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  for (let x = 0; x < w; x++) {
    const t = (heights[x] - lo) / (hi - lo || 1);
    const top = Math.round(h - (minH + (maxH - minH) * t));
    p.rect(x, top, 1, h - top, color);
    if (opts.highlight && heights[(x + 1) % w] < heights[x]) p.rect(x, top, 1, Math.max(1, Math.round((h - top) * 0.15)), opts.highlight);
    if (opts.snow && t > 0.7) p.rect(x, top, 1, Math.round((t - 0.7) * 20) + 1, opts.snow);
  }
  return p;
}

/** Rolling hills layer with optional tree bumps (tileable). */
export function hillsLayer(w: number, h: number, color: string, opts: { seed?: number; amp?: number; base?: number; trees?: string; treeDensity?: number } = {}): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(opts.seed ?? 31);
  const amp = opts.amp ?? h * 0.35;
  const base = opts.base ?? h * 0.55;
  const f1 = r.int(2, 3);
  const f2 = r.int(4, 6);
  const ph1 = r.range(0, 6);
  const ph2 = r.range(0, 6);
  for (let x = 0; x < w; x++) {
    const v = Math.sin((x / w) * Math.PI * 2 * f1 + ph1) * 0.6 + Math.sin((x / w) * Math.PI * 2 * f2 + ph2) * 0.4;
    const top = Math.round(h - base - v * amp * 0.5);
    p.rect(x, top, 1, h - top, color);
  }
  if (opts.trees) {
    const n = Math.round((w / 12) * (opts.treeDensity ?? 0.6));
    for (let i = 0; i < n; i++) {
      const x = r.int(0, w - 1);
      let top = 0;
      while (top < h && !p.opaque(x, top)) top++;
      const s = r.int(3, 6);
      p.circle(x, top - s + 2, s, opts.trees);
      p.circle(x + 4 - w * Math.floor((x + 4) / w), top - s + 3, s - 1, opts.trees);
    }
  }
  return p;
}

/** Puffy cloud strip (tileable, transparent background). */
export function cloudLayer(w: number, h: number, color = '#ffffff', shadow = '#d8e8f4', seed = 41, count = 6): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = r.int(0, w - 1);
    const cy = r.int(Math.floor(h * 0.3), Math.floor(h * 0.7));
    const n = r.int(3, 6);
    for (let j = 0; j < n; j++) {
      const ox = cx + (j - n / 2) * r.range(5, 8);
      const rad = r.range(4, 9);
      for (const wrap of [0, -w, w]) {
        p.circle(ox + wrap, cy + 2, rad, shadow);
        p.circle(ox + wrap, cy, rad - 1, color);
      }
    }
  }
  return p;
}

/** City skyline silhouette (tileable). */
export function skylineLayer(w: number, h: number, color: string, windowColor: string | null, seed = 51, minH = 0.3, maxH = 0.9): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  let x = 0;
  while (x < w) {
    const bw = r.int(10, 28);
    const bh = Math.round(h * r.range(minH, maxH));
    const top = h - bh;
    p.rect(x, top, Math.min(bw, w - x), bh, color);
    if (r.chance(0.3)) p.rect(x + Math.floor(bw / 2) - 1, top - r.int(3, 8), 2, 8, color);
    if (windowColor) {
      for (let wy = top + 3; wy < h - 2; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (r.chance(0.35)) p.px(wx, wy, windowColor);
    }
    x += bw + r.int(0, 3);
  }
  return p;
}

/** Vertical gradient as discrete bands (retro look). */
export function bandedGradient(w: number, h: number, colors: string[], bands = 16): PixelArt {
  const p = new PixelArt(w, h);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const seg = t * (colors.length - 1);
    const k = Math.min(colors.length - 2, Math.floor(seg));
    const c = mixColor(colors[k], colors[k + 1], seg - k);
    const y0 = Math.floor((i / bands) * h);
    const y1 = Math.floor(((i + 1) / bands) * h);
    p.rect(0, y0, w, y1 - y0, c);
  }
  return p;
}

/** Make a darker copy of a texture (for depth shading). amt 0..1 */
export function darken(src: PixelArt, amt: number): PixelArt {
  const out = new PixelArt(src.w, src.h);
  out.data.set(src.data);
  out.mapPixels((v) => {
    const r = v & 255;
    const g = (v >>> 8) & 255;
    const b = (v >>> 16) & 255;
    const a = v >>> 24;
    const k = 1 - amt;
    return ((a << 24) | (Math.round(b * k) << 16) | (Math.round(g * k) << 8) | Math.round(r * k)) >>> 0;
  });
  return out;
}
