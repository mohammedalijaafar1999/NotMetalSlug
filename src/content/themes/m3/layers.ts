// FROSTBITE PASS backgrounds and terrain textures (pure PixelArt, deterministic).
//  - peaksLayer: far alpine peaks (lit left faces, shadowed right faces, snow caps, haze).
//  - ridgeLayer: mid-distance ridges dotted with tiny pines and snowfields.
//  - forestLayer: near pine forest edge (snow-laden tiers) - the closest parallax layer.
//  - mistLayer: soft valley mist wisps (drawn with alpha, drifting).
//  - groundTile / snowEdge / stoneTile / stoneEdge: terrain fill + snow caps.

import { PixelArt, mixColor } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { P3 } from './palette';

const TAU = Math.PI * 2;

/** Periodic smooth noise in [-1, 1] over a period of w px (integer frequencies => tileable). */
function wave(x: number, w: number, seed: number, octaves = 3): number {
  const r = new Rng(seed);
  let v = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const f = (i + 1) * 2 + r.int(0, 2);
    const a = 1 / (i + 1);
    v += Math.sin((x / w) * TAU * f + r.range(0, TAU)) * a;
    norm += a;
  }
  return v / norm;
}

/** Integer hash -> [0, 1). */
export function hash01(n: number): number {
  let t = (n * 0x9e3779b1) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ far peaks

export function peaksLayer(): PixelArt {
  const W = 512;
  const H = 132;
  const p = new PixelArt(W, H);
  const r = new Rng(311);
  const peaks: { x: number; h: number; sl: number; sr: number }[] = [];
  let x = 10;
  while (x < W - 20) {
    const big = r.chance(0.45);
    peaks.push({ x, h: big ? r.range(100, 126) : r.range(62, 96), sl: r.range(0.75, 1.25), sr: r.range(0.85, 1.5) });
    x += r.int(54, 92);
  }
  const heightAt = (xx: number): number => {
    let best = 0;
    for (const pk of peaks) {
      let dx = xx - pk.x;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const v = pk.h - Math.abs(dx) * (dx < 0 ? pk.sl : pk.sr);
      if (v > best) best = v;
    }
    // Craggy detail.
    return best + wave(xx, W, 17, 3) * 3 + (hash01(xx * 7 + 3) - 0.5) * 1.6;
  };
  const hs: number[] = [];
  for (let i = 0; i < W; i++) hs.push(heightAt(i));
  const haze = '#c4d6ea';
  for (let i = 0; i < W; i++) {
    const h = hs[i];
    const top = Math.round(H - h);
    const lit = hs[(i + 1) % W] > hs[(i - 1 + W) % W];
    const snowLine = H - (68 + wave(i, W, 29, 3) * 12);
    for (let y = Math.max(0, top); y < H; y++) {
      const depth = y - top;
      let c: string;
      const inSnow = y < snowLine || (depth < 3 && y < snowLine + 14);
      // Gullies: streaks of snow running down the faces.
      const gully = hash01(Math.floor(i / 3) * 13 + 5) > 0.82 && y < snowLine + 22 && depth > 2;
      if (inSnow || gully) c = lit ? (depth === 0 ? '#f6faff' : '#e4edf7') : depth === 0 ? '#d8e4f2' : '#bfcfe4';
      else c = lit ? '#9ab0cc' : '#7e96b8';
      // Rock strata.
      if (!inSnow && !gully && hash01(i * 31 + y * 7) > 0.93) c = lit ? '#a8bcd6' : '#7088ac';
      // Atmospheric haze toward the bottom.
      const hz = Math.max(0, (y - (H - 40)) / 40);
      if (hz > 0) c = mixColor(c, haze, Math.min(0.85, hz * 0.9));
      p.px(i, y, c);
    }
  }
  return p;
}

// ------------------------------------------------------------------ mid ridges

export function ridgeLayer(): PixelArt {
  const W = 448;
  const H = 100;
  const p = new PixelArt(W, H);
  const r = new Rng(421);
  const top: number[] = [];
  for (let i = 0; i < W; i++) top.push(Math.round(H - (52 + wave(i, W, 43, 3) * 22 + wave(i, W, 47, 2) * 6)));
  const haze = '#b4c8de';
  for (let i = 0; i < W; i++) {
    const lit = top[(i + 1) % W] < top[(i - 1 + W) % W];
    for (let y = top[i]; y < H; y++) {
      const d = y - top[i];
      let c = d < 2 ? (lit ? '#dce6f2' : '#bccce0') : d < 7 && hash01(i * 3 + d) > 0.35 ? (lit ? '#c6d4e6' : '#a8bad2') : lit ? '#7a93b4' : '#6a83a6';
      const hz = Math.max(0, (y - (H - 34)) / 34);
      if (hz > 0) c = mixColor(c, haze, Math.min(0.8, hz * 0.85));
      p.px(i, y, c);
    }
  }
  // Tiny pines on the slopes (denser lower down).
  for (let k = 0; k < 150; k++) {
    const tx = r.int(0, W - 1);
    const d = r.int(5, 46);
    const by = top[tx] + d;
    if (by >= H - 6) continue;
    const th = 4 + Math.round(d / 9) + r.int(0, 2);
    const col = mixColor('#526e92', haze, Math.max(0, (by - (H - 34)) / 40));
    for (let j = 0; j < th; j++) {
      const half = Math.floor((j / th) * 2.6);
      for (const wrap of [0, -W, W]) p.rect(tx - half + wrap, by - th + j, half * 2 + 1, 1, j === 0 ? '#c8d6e8' : col);
    }
  }
  return p;
}

// ------------------------------------------------------------------ near forest

/** Colors for drawPine. */
export interface PineColors {
  lit: string;
  shade: string;
  dark: string;
  snow: string;
  snowS: string;
  trunk: string;
}

/** One snow-laden pine: overlapping tiers that flare out under the skirt of the tier above;
 *  snow lies on the flaring upper surfaces (bright on the lit left, bluish on the right). */
export function drawPine(p: PixelArt, cx: number, base: number, h: number, c: PineColors, seed = 1): void {
  const r = new Rng(seed);
  const tiers = Math.max(3, Math.round(h / 13));
  const trunkH = Math.max(4, Math.round(h * 0.1));
  p.rect(cx - 1, base - trunkH, 3, trunkH, c.trunk);
  p.px(cx - 1, base - trunkH, c.dark);
  const top = base - h;
  const crownH = h - trunkH + 2;
  const step = crownH / (tiers + 0.6);
  const maxHW = h * 0.3;
  const yb = (t: number) => Math.round(top + step * (t + 1.6));
  const hws: number[] = [];
  for (let t = 0; t < tiers; t++) hws.push(2.5 + maxHW * Math.pow((t + 1) / tiers, 0.85) * (0.94 + r.range(0, 0.1)));
  for (let t = tiers - 1; t >= 0; t--) {
    const b = yb(t);
    const th = Math.max(5, Math.round(step * 1.8));
    const ya = b - th;
    const hw = hws[t];
    const yv = t === 0 ? ya : yb(t - 1) + 1;
    for (let y = Math.max(ya, top); y <= b; y++) {
      const k = (y - ya) / th;
      const w = hw * (0.1 + 0.9 * Math.pow(k, 1.25));
      const xl = Math.round(cx - w);
      const xr = Math.round(cx + w);
      p.rect(xl, y, cx - xl + 1, 1, c.lit);
      if (xr > cx) p.rect(cx + 1, y, xr - cx, 1, c.shade);
      // Snow on the visible flaring surface.
      const kv = b === yv ? 1 : Math.max(0, (y - yv) / (b - yv));
      if (t === 0 && k < 0.34) {
        p.rect(xl, y, xr - xl + 1, 1, c.snow);
        if (xr > cx) p.rect(cx + 1, y, xr - cx, 1, c.snowS);
      } else if (y >= yv && kv < 0.85) {
        const sl = Math.max(1, Math.round((1 - kv) * w * 0.55));
        p.rect(xl, y, sl, 1, c.snow);
        const sr = Math.max(1, Math.round((1 - kv) * w * 0.3));
        p.rect(xr - sr + 1, y, sr, 1, c.snowS);
      }
      if (y === yv && t > 0) p.rect(Math.round(cx - w * 0.5), y, Math.round(w), 1, c.dark);
    }
    // Ragged dark skirt + drooping snowy tips.
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw);
    for (let x = x0; x <= x1; x++) if ((x + t) % 2 === 0) p.px(x, b + 1, c.dark);
    p.px(x0 - 1, b, c.snow);
    p.px(x0 - 1, b + 1, c.lit);
    p.px(x1 + 1, b, c.snowS);
  }
  p.px(cx, top - 1, c.snow);
}

export function forestLayer(): PixelArt {
  const W = 384;
  const H = 92;
  const p = new PixelArt(W, H);
  const r = new Rng(509);
  // Snowy forest floor bank.
  for (let i = 0; i < W; i++) {
    const t = Math.round(H - 12 - wave(i, W, 61, 2) * 4);
    for (let y = t; y < H; y++) p.px(i, y, y === t ? '#d2deec' : y < t + 3 ? '#bccbe0' : '#a6b8d0');
  }
  const back = { lit: '#58779a', shade: '#4a6889', dark: '#3e5a78', snow: '#c4d2e4', snowS: '#a8bad2', trunk: '#465a74' };
  const front = { lit: '#456685', shade: '#375674', dark: '#2c4662', snow: '#b6c8dc', snowS: '#94aac4', trunk: '#384a60' };
  const plant = (n: number, minH: number, maxH: number, c: typeof back, seedBase: number) => {
    for (let k = 0; k < n; k++) {
      const tx = r.int(0, W - 1);
      const h = r.int(minH, maxH);
      const base = H - r.int(6, 12);
      for (const wrap of [0, -W, W]) drawPine(p, tx + wrap, base, h, c, seedBase + k);
    }
  };
  plant(16, 26, 44, back, 100);
  plant(13, 40, 74, front, 200);
  return p;
}

export function mistLayer(): PixelArt {
  const W = 420;
  const H = 40;
  const p = new PixelArt(W, H);
  const r = new Rng(613);
  for (let k = 0; k < 9; k++) {
    const cx = r.int(0, W - 1);
    const cy = r.int(10, 30);
    const len = r.int(40, 110);
    for (let j = 0; j < 5; j++) {
      const ox = cx + r.range(-len / 2, len / 2);
      const rx = r.range(12, 26);
      const ry = r.range(3, 6);
      for (const wrap of [0, -W, W]) p.ellipse(ox + wrap, cy + r.range(-2, 2), rx, ry, '#f2f7fc');
    }
  }
  return p;
}

// ------------------------------------------------------------------ terrain

/** Frozen ground: blue-grey rock with packed snow streaks and ice crystals (tileable 32x32). */
export function groundTile(): PixelArt {
  const W = 32;
  const H = 32;
  const p = new PixelArt(W, H);
  const r = new Rng(717);
  p.rect(0, 0, W, H, '#8194ad');
  // Strata bands (wrap horizontally).
  for (let b = 0; b < 4; b++) {
    const y0 = b * 8 + r.int(0, 3);
    for (let x = 0; x < W; x++) {
      const y = y0 + Math.round(Math.sin((x / W) * TAU * 2 + b) * 1.2);
      p.px(x, ((y % H) + H) % H, '#6f829c');
      if (hash01(x * 5 + b * 97) > 0.6) p.px(x, (((y + 1) % H) + H) % H, '#76889f');
    }
  }
  // Light flecks + ice crystals.
  for (let i = 0; i < 70; i++) p.px(r.int(0, W - 1), r.int(0, H - 1), r.chance(0.25) ? '#cfe0f0' : '#9cadc3');
  // Embedded stones.
  for (let i = 0; i < 6; i++) {
    const sx = r.int(2, W - 4);
    const sy = r.int(2, H - 4);
    const s = r.pick([1.5, 2, 2.5]);
    p.ellipse(sx + 0.5, sy + 0.8, s + 0.6, s, '#5f708a');
    p.ellipse(sx, sy, s, s - 0.4, '#8b9cb3');
    p.px(sx - 1, sy - 1, '#b4c3d4');
  }
  return p;
}

/** Snow cap along the ground surface: `up` rows of lumps above the line, a bright band below. */
export function snowEdge(w = 32, up = 3, band = 8, seed = 7): PixelArt {
  const h = up + band + 4;
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  for (let x = 0; x < w; x++) {
    const lump = Math.max(0, Math.min(up, Math.round(1.4 + 1.4 * Math.sin((x / w) * TAU * 2 + 0.7) + 0.8 * Math.sin((x / w) * TAU * 5 + 2.1))));
    for (let y = up - lump; y < up; y++) p.px(x, y, y === up - lump ? '#ffffff' : '#f0f6fb');
    for (let d = 0; d < band; d++) {
      const y = up + d;
      const c = d === 0 && lump === 0 ? '#ffffff' : d < 3 ? '#eaf2f9' : d < 5 ? '#dbe6f2' : d < band - 1 ? '#c6d5e6' : '#b0c3da';
      p.px(x, y, c);
    }
    // Icy drips into the rock below.
    const drip = hash01(x * 11 + seed) > 0.55 ? r.int(1, 3) : 0;
    for (let d = 0; d < drip; d++) p.px(x, up + band + d, d === drip - 1 ? '#a3bcd8' : '#b0c3da');
  }
  return p;
}

/** Legion masonry: blue granite blocks (tileable 32x16). */
export function stoneTile(): PixelArt {
  const W = 32;
  const H = 16;
  const p = new PixelArt(W, H);
  const r = new Rng(823);
  p.rect(0, 0, W, H, '#3c475c');
  for (let row = 0; row < 2; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 3; col++) {
      const x = col * 16 + off;
      const y = row * 8;
      const c = mixColor('#7b8aa2', r.chance(0.5) ? '#8796ad' : '#6f7d96', 0.5);
      p.rect(x + 1, y + 1, 15, 7, c);
      p.rect(x + 1, y + 1, 15, 1, '#97a5ba');
      p.rect(x + 1, y + 1, 1, 6, '#8c9ab0');
      p.rect(x + 1, y + 7, 15, 1, '#5c6a82');
      if (r.chance(0.5)) p.px(x + r.int(3, 13), y + r.int(3, 5), '#5f6d86');
    }
  }
  return p;
}

/** Sheer granite cliff face (tileable 64x64): vertical fractures, lit buttresses, snowy ledge lines
 *  with icicles. Painted over the ground mass where the level climbs a cliff (decor 'cliff'). */
export function cliffTile(): PixelArt {
  const W = 64;
  const H = 64;
  const p = new PixelArt(W, H);
  const r = new Rng(907);
  const bandAt = (x: number) => Math.sin((x / W) * TAU * 2 + 0.6) + Math.sin((x / W) * TAU * 5 + 1.9) * 0.35;
  // Buttresses: broad vertical bands, lit on their left edge.
  for (let x = 0; x < W; x++) {
    const band = bandAt(x);
    for (let y = 0; y < H; y++) {
      let c = band > 0.55 ? '#7f90aa' : band > -0.2 ? '#6c7c96' : '#5c6b86';
      if (hash01(x * 7 + y * 131) > 0.93) c = band > 0 ? '#8c9cb4' : '#52607a';
      p.px(x, y, c);
    }
    const prev = bandAt(x - 1);
    if (prev <= 0.55 && band > 0.55) for (let y = 0; y < H; y++) p.px(x, y, '#98a8c0');
    if (prev > -0.2 && band <= -0.2) for (let y = 0; y < H; y++) p.px(x, y, '#4a5872');
  }
  // Vertical fractures (random walks, wrapping).
  for (let k = 0; k < 5; k++) {
    let x = r.int(0, W - 1);
    const y0 = r.int(0, H - 1);
    const len = r.int(18, 40);
    for (let i = 0; i < len; i++) {
      const y = (y0 + i) % H;
      p.px(((x % W) + W) % W, y, '#3e4a62');
      p.px((((x + 1) % W) + W) % W, y, '#8494ae');
      if (r.chance(0.2)) x += r.chance(0.5) ? 1 : -1;
    }
  }
  // Two snowy ledge lines with icicles.
  for (const ly of [14, 46]) {
    for (let x = 0; x < W; x++) {
      const yy = ly + Math.round(Math.sin((x / W) * TAU * 3 + ly) * 1.5);
      p.px(x, yy - 1, '#c8d6e6');
      p.px(x, yy, '#eef4fa');
      p.px(x, yy + 1, '#3e4a62');
      if (hash01(x * 17 + ly) > 0.8) {
        const len = 1 + Math.floor(hash01(x * 5 + ly) * 4);
        for (let i = 0; i < len; i++) p.px(x, yy + 2 + i, i === len - 1 ? '#e8f6ff' : '#b4def2');
      }
    }
  }
  return p;
}
