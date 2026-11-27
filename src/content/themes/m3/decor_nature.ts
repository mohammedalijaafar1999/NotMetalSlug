// FROSTBITE PASS scenery sprites, part 1: nature (pines, boulders, snowman, campfire, fence,
// frozen waterfall) plus the tiling backdrops for the gorge and the frozen lake.
// All face right / are lit from the top-left; outlined in a muted navy so actors stay crisper.

import { sprites } from '../../../engine/sprites';
import { PixelArt, mixColor } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { P3 } from './palette';
import { drawPine, hash01 } from './layers';
import { icicles, snowCap } from './art';

const OUT = P3.outline;

// ------------------------------------------------------------------ pines

export const PINE_HEIGHTS = [44, 58, 72, 88, 100, 32];

sprites.define({
  name: 'm3_pine',
  w: 76,
  h: 106,
  frames: PINE_HEIGHTS.length,
  outline: OUT,
  draw: (p, f) => {
    const h = PINE_HEIGHTS[f];
    const base = 103;
    drawPine(p, 38, base, h, { lit: '#447c69', shade: '#2f5c4e', dark: '#23463b', snow: P3.snow, snowS: '#bccee0', trunk: P3.trunk }, 40 + f * 7);
    // Snow mound around the foot.
    const mw = 5 + h * 0.07;
    p.ellipse(38, base + 1, mw + 2, 3, P3.snowS);
    p.ellipse(37.5, base + 0.5, mw + 1, 2.5, P3.snow);
  },
});

/** Muted, bluish pines for depth (behind the mid-ground ones). */
sprites.define({
  name: 'm3_pine_far',
  w: 62,
  h: 96,
  frames: 3,
  outline: '#3a4c66',
  draw: (p, f) => {
    const h = [56, 74, 90][f];
    drawPine(p, 31, 94, h, { lit: '#5d8090', shade: '#4b6d80', dark: '#40607a', snow: '#e2ebf4', snowS: '#b4c4d8', trunk: '#4e4a52' }, 90 + f * 11);
    p.ellipse(31, 95, 8, 2, '#d0dcea');
  },
});

// ------------------------------------------------------------------ boulders

/** Logical y of the first opaque pixel in logical column x (sprite draw offsets respected). */
export function topAt(p: PixelArt, x: number, from = 0): number {
  const rx = Math.floor(x + p.ox);
  let ry = Math.max(0, Math.floor(from + p.oy));
  while (ry < p.h && !p.opaque(rx, ry)) ry++;
  return ry - p.oy;
}

function boulder(p: PixelArt, cx: number, base: number, rx: number, ry: number, seed: number): void {
  const r = new Rng(seed);
  const pts: number[] = [];
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = Math.PI + (k / (n - 1)) * Math.PI;
    const rr = 1 + r.range(-0.12, 0.1);
    pts.push(cx + Math.cos(a) * rx * rr, base + Math.sin(a) * ry * 2 * rr);
  }
  pts.push(cx + rx, base, cx - rx, base);
  // Shadow body first, then the lit part offset up-left, then a highlight.
  p.poly(pts, P3.rockM);
  const lit: number[] = [];
  for (let i = 0; i < pts.length; i += 2) lit.push(cx + (pts[i] - cx) * 0.86 - rx * 0.12, base + (pts[i + 1] - base) * 0.9 - 1);
  p.poly(lit, P3.rock);
  p.ellipse(cx - rx * 0.35, base - ry * 1.2, rx * 0.45, ry * 0.5, P3.rockHi);
  p.rect(cx - rx + 2, base - 1, rx * 2 - 3, 1, P3.rockD);
  // Cracks.
  p.line(cx + rx * 0.1, base - ry * 1.4, cx + rx * 0.3, base - ry * 0.6, P3.rockD);
  // Snow on top.
  for (let x = Math.round(cx - rx * 0.85); x <= Math.round(cx + rx * 0.7); x++) {
    const top = topAt(p, x);
    if (top >= base - 1) continue;
    const t = 1 + Math.round(1 + Math.sin(x * 0.7 + seed) * 1);
    for (let k = 0; k < t; k++) p.px(x, top + k, k === 0 ? P3.snowHi : x > cx + rx * 0.3 ? P3.snowS : P3.snow);
    if (hash01(x * 3 + seed) > 0.7) p.px(x, top - 1, P3.snow);
  }
  // Drift at the base.
  p.ellipse(cx - rx * 0.6, base - 0.5, rx * 0.5, 2, P3.snow);
  p.ellipse(cx + rx * 0.7, base - 0.5, rx * 0.35, 1.5, P3.snowS);
}

sprites.define({
  name: 'm3_rock',
  w: 44,
  h: 26,
  frames: 3,
  outline: OUT,
  draw: (p, f) => {
    if (f === 0) boulder(p, 22, 25, 17, 10, 5);
    else if (f === 1) boulder(p, 22, 25, 9, 6, 9);
    else {
      boulder(p, 15, 25, 12, 8, 13);
      boulder(p, 31, 25, 9, 5.5, 17);
    }
  },
});

// ------------------------------------------------------------------ snowman (Legion helmet)

sprites.define({
  name: 'm3_snowman',
  w: 26,
  h: 36,
  outline: OUT,
  draw: (p) => {
    const ball = (cx: number, cy: number, r: number) => {
      p.circle(cx, cy, r, P3.snowS);
      p.circle(cx - 0.6, cy - 0.6, r - 0.8, P3.snow);
      p.circle(cx - r * 0.35, cy - r * 0.4, r * 0.35, P3.snowHi);
    };
    // Stick arms behind.
    p.line(7, 19, 1, 14, P3.woodD);
    p.line(2, 15, 1, 12, P3.woodD);
    p.line(19, 19, 25, 15, P3.woodD);
    p.line(24, 16, 25, 13, P3.woodD);
    ball(13, 28.5, 7.5);
    ball(13, 18, 5.8);
    ball(13, 9.5, 4.6);
    // Coal buttons.
    p.px(12, 16, '#2a2a34');
    p.px(12, 19, '#2a2a34');
    p.px(12, 26, '#2a2a34');
    // Red scarf.
    p.rect(8, 12.5, 10, 2, P3.red);
    p.rect(8, 13.5, 10, 1, P3.redD);
    p.rect(15, 14, 2, 4, P3.red);
    p.px(16, 17, P3.redD);
    // Face: coal eyes + carrot.
    p.px(12, 9, '#2a2a34');
    p.px(15, 9, '#2a2a34');
    p.tri(15, 10, 15, 12, 20, 11.5, '#e8802a');
    p.px(15, 10, '#ffa040');
    // Legion helmet (olive, with a red band).
    p.ellipse(13, 6, 5.6, 3.4, P3.ol);
    p.rect(7, 6, 12, 2, P3.ol);
    p.rect(6, 7, 14, 1, P3.olD);
    p.ellipse(11.5, 4.5, 2.5, 1.2, P3.olHi);
    p.rect(8, 5, 10, 1, P3.redD);
    p.px(13, 5, P3.gold);
    // Snow on the helmet.
    p.rect(10, 2, 5, 1, P3.snowHi);
  },
});

// ------------------------------------------------------------------ campfire (animated)

sprites.define({
  name: 'm3_campfire',
  w: 30,
  h: 24,
  frames: 4,
  outline: OUT,
  draw: (p, f) => {
    // Stone ring.
    for (const [x, s] of [
      [5, 2.6],
      [10, 2.2],
      [20, 2.2],
      [25, 2.6],
    ] as const) {
      p.ellipse(x, 21.5, s + 0.5, 2, P3.rockD);
      p.ellipse(x - 0.4, 21, s, 1.6, P3.rock);
      p.px(Math.round(x - 1), 20, P3.rockHi);
    }
    // Crossed logs.
    p.line(7, 22, 22, 16, P3.woodD, 3);
    p.line(23, 22, 8, 16, P3.wood, 3);
    p.px(8, 16, P3.woodHi);
    p.px(22, 16, P3.woodHi);
    // Flames (flicker by frame).
    const r = new Rng(70 + f);
    const tongues = [
      [11, 9 + r.int(0, 3)],
      [15, 4 + r.int(0, 3)],
      [19, 9 + r.int(0, 3)],
    ];
    for (const [x, top] of tongues) p.poly([x - 3.5, 19, x, top, x + 3.5, 19], P3.fireD);
    for (const [x, top] of tongues) p.poly([x - 2.2, 19, x + 0.3, top + 3, x + 2.4, 19], P3.fire);
    p.poly([12, 19, 15, 8 + r.int(0, 3), 18, 19], P3.lamp);
    p.rect(13, 16, 4, 3, P3.lampHi);
    // Sparks.
    for (let k = 0; k < 3; k++) p.px(r.int(9, 21), r.int(0, 6), k ? P3.lamp : P3.lampHi);
  },
});

// ------------------------------------------------------------------ fence

sprites.define({
  name: 'm3_fence',
  w: 32,
  h: 20,
  outline: OUT,
  draw: (p) => {
    for (const x of [3, 25]) {
      p.rect(x, 4, 4, 16, P3.wood);
      p.rect(x, 4, 1, 16, P3.woodHi);
      p.rect(x + 3, 4, 1, 16, P3.woodD);
      p.rect(x, 3, 4, 2, P3.snowHi);
      p.px(x + 1, 2, P3.snow);
    }
    for (const y of [8, 14]) {
      p.rect(0, y, 32, 3, P3.woodM);
      p.rect(0, y, 32, 1, P3.woodHi);
      p.rect(0, y + 2, 32, 1, P3.woodD);
    }
    snowCap(p, 0, 32, 8, 2, 4, true);
    p.rect(0, 18, 32, 2, P3.snow);
  },
});

// ------------------------------------------------------------------ frozen waterfall (origin at the top)

sprites.define({
  name: 'm3_icefall',
  w: 34,
  h: 72,
  oy: 0,
  outline: OUT,
  draw: (p) => {
    const r = new Rng(77);
    for (let x = 2; x < 32; x++) {
      const len = 30 + Math.round(Math.sin(x * 0.4) * 10 + hash01(x * 9) * 26);
      for (let y = 0; y < len; y++) {
        const t = y / len;
        const c = x % 5 === 0 ? P3.iceHi : t > 0.85 ? P3.iceHi : (x + Math.floor(y / 6)) % 3 === 0 ? P3.iceM : P3.ice;
        p.px(x, y, c);
      }
      if (r.chance(0.3)) p.px(x, len, P3.iceHi);
    }
    // Shading on the right, glints on the left.
    for (let y = 0; y < 60; y++) p.px(31, y, P3.iceD);
    for (let k = 0; k < 8; k++) p.px(r.int(3, 12), r.int(4, 50), '#ffffff');
    snowCap(p, 0, 34, 0, 3, 2, false);
  },
});

// ------------------------------------------------------------------ backdrop tiles (no outline)

/** The gorge seen across: the far rim (hazy pines) and a cliff face that fades into the misty abyss.
 *  Tiles horizontally (128 px period); 120 px tall, origin at the top-left (the rim line). */
export const GORGE_H = 120;

sprites.define({
  name: 'm3_gorge',
  w: 128,
  h: GORGE_H,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    const W = 128;
    const H = GORGE_H;
    const mist = '#b4c6dc';
    const deep = '#26304a';
    // Far rim line (gently uneven) - everything below is the far cliff face.
    const rimAt = (x: number) => 10 + Math.round(Math.sin((x / W) * Math.PI * 4 + 1) * 2 + Math.sin((x / W) * Math.PI * 10) * 1);
    // Smooth periodic relief noise (lit bulges / shadowed gullies).
    const relief = (x: number, y: number) =>
      Math.sin((x / W) * Math.PI * 6 + y * 0.09) * 0.5 + Math.sin((x / W) * Math.PI * 14 - y * 0.05 + 2) * 0.3 + (hash01(x * 31 + y * 17) - 0.5) * 0.25;
    for (let x = 0; x < W; x++) {
      const rim = rimAt(x);
      for (let y = rim; y < H; y++) {
        const k = y - rim;
        const v = relief(x, y);
        let c = v > 0.35 ? '#8aa0bc' : v > -0.1 ? '#7088a8' : v > -0.45 ? '#5e7496' : '#506686';
        // Strata.
        if ((y + Math.floor(x / 16) * 2) % 13 === 0 && v > -0.3) c = '#667c9e';
        // Distance haze on the upper face, then the abyss swallows it.
        if (k < 16) c = mixColor(c, mist, 0.2 + (k / 16) * 0.3);
        else c = mixColor(mixColor(c, mist, 0.5), deep, Math.min(1, (k - 16) / 40));
        if (k < 2) c = k === 0 ? '#e2ebf5' : '#b8c8dc';
        p.px(x, y, c);
      }
      // Snow ledges catching on the face.
      if (hash01(Math.floor(x / 16) * 7 + 3) > 0.6 && x % 16 < 12) {
        const ly = rim + 6 + Math.floor(hash01(Math.floor(x / 16) * 5) * 16);
        p.px(x, ly, mixColor('#dce6f0', mist, 0.35));
      }
    }
    // Hazy pines on the far rim.
    const r = new Rng(97);
    for (let k = 0; k < 9; k++) {
      const tx = r.int(0, W - 1);
      const th = r.int(5, 11);
      const base = rimAt(tx) + 1;
      for (let j = 0; j < th; j++) {
        const half = Math.floor((j / th) * 2.4);
        for (const wrap of [0, -W, W]) p.rect(tx - half + wrap, base - th + j, half * 2 + 1, 1, j === 0 ? '#c8d6e6' : '#7088a8');
      }
    }
  },
});

/** Frozen lake cross-section: glossy ice crust over dark frozen water with bubbles and cracks. */
sprites.define({
  name: 'm3_ice',
  w: 64,
  h: 40,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    const r = new Rng(123);
    for (let x = 0; x < 64; x++) {
      for (let y = 0; y < 40; y++) {
        let c: string;
        if (y === 0) c = '#f4fbff';
        else if (y < 4) c = (x + y * 3) % 17 < 2 ? '#ffffff' : '#c8e8f6';
        else if (y === 4) c = '#9ccce6';
        else c = mixColor('#5c98c0', '#28507a', Math.min(1, (y - 5) / 30));
        p.px(x, y, c);
      }
    }
    // Reflection streaks on the crust.
    for (const sx of [6, 30, 47]) for (let k = 0; k < 3; k++) p.px((sx + k) % 64, 1 + (k % 2), '#ffffff');
    // Bubbles + cracks in the depth.
    for (let k = 0; k < 9; k++) {
      const bx = r.int(1, 62);
      const by = r.int(8, 36);
      p.px(bx, by, '#a8d6ee');
      if (r.chance(0.5)) p.px(bx + 1, by - 2, '#8cc0e0');
    }
    let cx = 14;
    let cy = 5;
    for (let k = 0; k < 12; k++) {
      p.px(cx, cy, '#d8f0fc');
      cx += r.int(0, 2) - (k % 3 === 0 ? 1 : 0);
      cy += 1;
    }
    cx = 44;
    cy = 5;
    for (let k = 0; k < 8; k++) {
      p.px(cx, cy, '#cde8f8');
      cx -= r.int(0, 2) - 1;
      cy += 1;
    }
  },
});

/** Snowy bank where the frozen lake meets the shore (origin bottom centre, sits at the ice level). */
sprites.define({
  name: 'm3_icebank',
  w: 28,
  h: 12,
  outline: OUT,
  draw: (p) => {
    p.ellipse(14, 12, 14, 7, P3.snowS);
    p.ellipse(13, 11.5, 12.5, 6, P3.snow);
    p.ellipse(10, 9, 5, 2, P3.snowHi);
    icicles(p, 3, 25, 11, 3, 0.25, 5);
  },
});
