// Palm Harbor decor sprites (pure PixelArt, authored facing right, lit from the top-left, with the
// automatic dark outline). Rendered by the theme's decor renderers (./decor.ts).
//   m1_palm_0..2 (3 sway frames)  m1_banana (2)  m1_fern (3)  m1_hut  m1_torch (4)  m1_net
//   m1_boat  m1_rock (3 sizes)  m1_crates (3)  m1_sign (4)  m1_landing  m1_palisade  m1_tower
//   m1_banner (4)  m1_silo  m1_campfire (4)  m1_jtree  m1_vines (3)  m1_beachprop (4)  m1_drums
//   m1_fence  m1_rack

import { PixelArt, shade } from '../../../engine/pixelart';
import { sprites } from '../../../engine/sprites';
import { ramp, shaded } from '../../vehicles/art';
import { Pen, cog, MC, sandbag } from '../../machines/common';
import { PH, h01 } from './layout';

// ------------------------------------------------------------------ helpers

/** 3x5 stencil font for signs. */
const TINY: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '-': ['...', '...', '###', '...', '...'],
  ' ': ['...', '...', '...', '...', '...'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
};

function tinyWidth(text: string): number {
  return text.length * 4 - 1;
}

function tinyText(p: PixelArt, text: string, x: number, y: number, col: string): void {
  let cx = x;
  for (const ch of text) {
    const rows = TINY[ch] ?? TINY[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === '#') p.px(cx + c, y + r, col);
    cx += 4;
  }
}

/** Vertical bamboo pole with nodes. */
function bambooPole(p: PixelArt, x: number, y0: number, y1: number, w = 3): void {
  p.rect(x, y0, w, y1 - y0, PH.bamboo);
  p.rect(x, y0, 1, y1 - y0, PH.bambooL);
  p.rect(x + w - 1, y0, 1, y1 - y0, PH.bambooD);
  for (let y = y0 + 4 + Math.floor(h01(x, y0, 3) * 5); y < y1 - 1; y += 9) p.rect(x, y, w, 1, shade(PH.bambooD, -0.15));
}

/** Wooden post (lit left). */
function post(p: PixelArt, x: number, y0: number, y1: number, w = 3): void {
  p.rect(x, y0, w, y1 - y0, PH.wood);
  p.rect(x, y0, 1, y1 - y0, PH.woodL);
  p.rect(x + w - 1, y0, 1, y1 - y0, PH.woodD);
}

// ------------------------------------------------------------------ palm

const PALM_W = 120;
const PALM_H = 130;
const LEAF = { b: '#4c9e44', l: '#78c254', ll: '#a6dc76', d: '#33803a', dd: '#246230' };

/**
 * One feathered palm frond: a spine that leaves the crown at `a0` (radians, screen space) and
 * curls downward by `curl` along its length; leaflets hang from the lower side of the spine.
 */
function frond(p: PixelArt, tx: number, ty: number, dir: 1 | -1, a0: number, len: number, curl: number, sway: number, col: { b: string; l: string; d: string; s: string }): void {
  const n = 12;
  const pts: [number, number][] = [[tx, ty]];
  let x = tx;
  let y = ty;
  for (let k = 1; k <= n; k++) {
    const u = k / n;
    const a = a0 + curl * Math.pow(u, 1.4);
    x += Math.cos(a) * (len / n) * dir + sway * 0.18 * u;
    y += Math.sin(a) * (len / n);
    pts.push([x, y]);
  }
  // Leaflets: a comb along the lower side, longest in the middle, slanting toward the tip.
  for (let k = 1; k <= n; k++) {
    const [x0, y0] = pts[k - 1];
    const [x1, y1] = pts[k];
    const u = k / n;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dl = Math.hypot(dx, dy) || 1;
    // Perpendicular pointing "down" (positive y side).
    let nx = -dy / dl;
    let ny = dx / dl;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const L = 1.5 + Math.pow(Math.sin(Math.min(1, u * 1.1) * Math.PI), 0.8) * 6 * Math.min(1.15, len / 38);
    for (let s = 0; s < 2; s++) {
      const bx = x0 + dx * (s * 0.5);
      const by = y0 + dy * (s * 0.5);
      const ex = bx + nx * L + (dx / dl) * L * 0.55;
      const ey = by + ny * L + (dy / dl) * L * 0.25 + 1;
      p.line(bx, by, ex, ey, (k + s) % 2 ? col.d : col.b);
    }
    // Upper leaflets (short, lit) give the frond its V-shaped volume.
    if (u > 0.15 && u < 0.85) p.line(x1, y1, x1 - nx * 2.2 + (dx / dl) * 2, y1 - ny * 2.2 + (dy / dl) * 1.5, col.l);
  }
  for (let k = 1; k <= n; k++) {
    const [x0, y0] = pts[k - 1];
    const [x1, y1] = pts[k];
    p.line(x0, y0, x1, y1, col.s, k <= 4 ? 2 : 1);
  }
}

function drawPalm(p: PixelArt, v: number, sway: number): void {
  const lean = [14, -12, 18][v];
  const hgt = [96, 84, 108][v];
  const bx = PALM_W / 2;
  const by = PALM_H - 1;
  // Trunk: ringed, tapering, curving toward the crown.
  for (let i = 0; i <= hgt; i++) {
    const t = i / hgt;
    const cx = bx + lean * Math.pow(t, 1.7);
    const cy = by - i;
    const r = 3.8 - 1.7 * t;
    const ring = i % 4 === 0;
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (Math.abs(dx) > r) continue;
      const u = (dx + r) / (2 * r); // 0 = left edge
      let c = u < 0.28 ? '#c49c6a' : u > 0.72 ? '#6e5034' : '#9a7650';
      if (ring) c = u < 0.28 ? '#9a7650' : '#5e4228';
      p.px(Math.round(cx + dx), cy, c);
    }
  }
  // Root flare.
  p.poly([bx - 7, by + 1, bx - 3, by - 6, bx + 3, by - 6, bx + 7, by + 1], '#8a6846');
  p.poly([bx - 7, by + 1, bx - 3, by - 6, bx - 1, by - 6, bx - 3, by + 1], '#b08a5c');
  const tx = bx + lean;
  const ty = by - hgt;
  const D = Math.PI / 180;
  const back = { b: LEAF.d, l: LEAF.b, d: LEAF.dd, s: LEAF.b };
  const mid = { b: LEAF.b, l: LEAF.l, d: LEAF.d, s: LEAF.l };
  const front = { b: LEAF.l, l: LEAF.ll, d: LEAF.b, s: LEAF.ll };
  // Back fronds (darker, mostly up and out).
  frond(p, tx, ty, -1, -62 * D, 38, 92 * D, sway, back);
  frond(p, tx, ty, 1, -70 * D, 34, 90 * D, sway, back);
  frond(p, tx, ty, 1, -28 * D, 46, 100 * D, sway, back);
  // Mid fronds.
  frond(p, tx, ty, -1, -26 * D, 48, 104 * D, sway, mid);
  frond(p, tx, ty, 1, -4 * D, 48, 100 * D, sway, mid);
  frond(p, tx, ty, -1, -98 * D, 22, 55 * D, sway, mid);
  // Front fronds (lit, drooping toward the viewer).
  frond(p, tx, ty, -1, 2 * D, 40, 96 * D, sway, front);
  frond(p, tx, ty, 1, 18 * D, 34, 90 * D, sway, front);
  frond(p, tx, ty, -1, 34 * D, 24, 60 * D, sway, mid);
  // Crown heart + coconuts.
  p.circle(tx, ty + 1, 3, LEAF.dd);
  p.circle(tx - 1, ty, 2, LEAF.d);
  for (const [ox, oy, green] of [
    [-2, 4, false],
    [2, 5, false],
    [0, 7, true],
    [-4, 7, false],
  ] as const) {
    p.circle(tx + ox, ty + oy, 2.2, green ? '#6a8a30' : '#6e4a26');
    p.px(tx + ox - 1, ty + oy - 1, green ? '#94b44a' : '#9a6c3a');
  }
}

for (let v = 0; v < 3; v++) {
  sprites.define({ name: `m1_palm_${v}`, w: PALM_W, h: PALM_H, frames: 3, draw: (p, f) => drawPalm(p, v, f - 1) });
}

// ------------------------------------------------------------------ banana plant, fern

function paddleLeaf(p: PixelArt, x0: number, y0: number, x1: number, y1: number, wid: number, col: { b: string; l: string; d: string }, tears: number): void {
  const n = 14;
  const L: number[] = [];
  const R: number[] = [];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const w = Math.sin(Math.min(1, t * 1.15) * Math.PI) * wid * (t < 0.1 ? 0.5 : 1);
    const cx = x0 + dx * t;
    const cy = y0 + dy * t + Math.sin(t * Math.PI) * len * 0.12;
    L.push(cx + nx * w, cy + ny * w);
    R.push(cx - nx * w, cy - ny * w);
  }
  const poly: number[] = [...L];
  for (let k = n; k >= 0; k--) poly.push(R[k * 2], R[k * 2 + 1]);
  p.poly(poly, col.b);
  // Lit half.
  const half: number[] = [];
  for (let k = 0; k <= n; k++) half.push(x0 + dx * (k / n) + nx * 0.4, y0 + dy * (k / n) + Math.sin((k / n) * Math.PI) * len * 0.12 + ny * 0.4);
  for (let k = n; k >= 0; k--) half.push(L[k * 2], L[k * 2 + 1]);
  p.poly(half, ny < 0 ? col.l : col.b);
  // Midrib.
  for (let k = 0; k < n; k++) {
    const t = k / n;
    p.px(x0 + dx * t, y0 + dy * t + Math.sin(t * Math.PI) * len * 0.12, shade(col.l, 0.25));
  }
  // Tears in the blade.
  for (let i = 0; i < tears; i++) {
    const t = 0.3 + i * 0.22;
    const k = Math.round(t * n);
    p.line(x0 + dx * t, y0 + dy * t + Math.sin(t * Math.PI) * len * 0.12, R[k * 2] + dx * 0.04, R[k * 2 + 1] + dy * 0.04, '#0000');
  }
}

sprites.define({
  name: 'm1_banana',
  w: 50,
  h: 46,
  frames: 2,
  draw: (p, f) => {
    const c1 = { b: '#4a9a3c', l: '#7cc454', d: '#2e7432' };
    const c2 = { b: '#3c8636', l: '#62ac48', d: '#2a6a2e' };
    // Back leaves.
    paddleLeaf(p, 25, 22, 4, 8, 4.5, c2, 1);
    paddleLeaf(p, 25, 21, 46, 12, 4.5, c2, 2);
    // Pseudo-stem.
    p.poly([21, 45, 23, 18, 27, 18, 29, 45], '#7a8c3c');
    p.poly([21, 45, 23, 18, 24, 18, 23, 45], '#9aac54');
    p.rect(27, 20, 1, 25, '#5c6c2c');
    // Front leaves.
    paddleLeaf(p, 25, 19, 9, 1, 5, c1, 2);
    paddleLeaf(p, 25, 19, 42, 2, 5, c1, 1);
    paddleLeaf(p, 26, 24, 47, 30, 4, c1, 1);
    paddleLeaf(p, 24, 25, 2, 31, 4, c1, 2);
    if (f === 1) {
      // Hanging bunch + purple flower bud.
      p.line(27, 24, 32, 31, '#6a7a30');
      for (let i = 0; i < 4; i++) {
        p.capsule(29 + (i % 2) * 3, 27 + i * 2, 31 + (i % 2) * 3, 30 + i * 2, 1, i < 2 ? '#c8d85a' : '#a8c048');
      }
      p.ellipse(33, 38, 2, 3, '#7a2a4a');
      p.px(32, 37, '#a84a6a');
    }
  },
});

sprites.define({
  name: 'm1_fern',
  w: 34,
  h: 16,
  frames: 3,
  draw: (p, f) => {
    const cols = [LEAF.d, LEAF.b, LEAF.l];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * 2 - 1; // -1..1
      const spread = (f === 1 ? 15 : f === 2 ? 11 : 13) * s;
      const hgt = 13 - Math.abs(s) * 5 + (f === 2 ? 2 : 0);
      const col = cols[Math.abs(s) > 0.7 ? 0 : Math.abs(s) > 0.3 ? 1 : 2];
      let px = 17;
      let py = 15;
      for (let k = 1; k <= 6; k++) {
        const u = k / 6;
        const x = 17 + spread * u;
        const y = 15 - hgt * Math.sin(u * Math.PI * 0.62) + u * u * 5;
        p.line(px, py, x, y, col);
        if (k > 1) {
          p.px(x - Math.sign(spread || 1), y + 1, col);
          p.px(x + Math.sign(spread || 1) * 0.5, y - 1, shade(col, 0.2));
        }
        px = x;
        py = y;
      }
    }
  },
});

// ------------------------------------------------------------------ stilt hut

const HUT_W = 96;
const HUT_H = 54;

sprites.define({
  name: 'm1_hut',
  w: HUT_W,
  h: HUT_H,
  draw: (p) => {
    const fl = HUT_H; // floor row (exclusive)
    const wallTop = fl - 30;
    const x0 = 13;
    const x1 = HUT_W - 13;
    // Walls: woven panels between bamboo corner posts.
    for (let y = wallTop; y < fl; y++) {
      for (let x = x0; x < x1; x++) {
        const k = (x + y) % 6 < 3 !== (x - y + 600) % 6 < 3;
        p.px(x, y, k ? PH.weave : PH.weaveD);
      }
    }
    p.rect(x0, wallTop, x1 - x0, 2, shade(PH.weaveD, -0.25)); // shadow under the eaves
    for (const bx of [x0, 46, x1 - 3]) bambooPole(p, bx, wallTop - 2, fl, 3);
    p.rect(x0, fl - 3, x1 - x0, 3, PH.woodD); // sill beam
    p.rect(x0, fl - 3, x1 - x0, 1, PH.wood);
    // Door with a striped curtain.
    p.rect(26, wallTop + 6, 15, fl - 3 - (wallTop + 6), '#3a2a20');
    for (let x = 26; x < 41; x++) {
      const drop = 12 + Math.round(Math.sin(x * 0.9) * 1.5);
      p.rect(x, wallTop + 6, 1, drop, Math.floor((x - 26) / 3) % 2 ? PH.red : PH.white);
    }
    p.rect(26, wallTop + 6, 15, 1, PH.woodDD);
    // Window with a propped thatch shutter + a lamp.
    p.rect(56, wallTop + 9, 14, 9, '#3a2a20');
    p.rect(62, wallTop + 11, 2, 3, '#f8d878');
    p.px(62, wallTop + 10, '#fff2b0');
    p.poly([53, wallTop + 9, 73, wallTop + 9, 76, wallTop + 4, 56, wallTop + 4], PH.thatchD);
    p.line(56, wallTop + 4, 75, wallTop + 4, PH.thatch);
    p.line(70, wallTop + 9, 72, wallTop + 17, PH.woodD); // prop stick
    // Fishing float + coiled rope on the wall.
    p.circle(80, wallTop + 14, 2, '#f0802a');
    p.px(79, wallTop + 13, '#ffc070');
    p.ring(18, wallTop + 16, 3, PH.rope);
    // Roof: thatch trapezoid with layered bundles and a ragged eave fringe.
    const rTop = 4;
    const eave = wallTop + 1;
    const l0 = 1;
    const r0 = HUT_W - 1;
    const lt = 22;
    const rt = HUT_W - 22;
    p.poly([l0, eave, lt, rTop, rt, rTop, r0, eave], PH.thatch);
    for (let y = rTop; y <= eave; y++) {
      const t = (y - rTop) / (eave - rTop);
      const xa = lt + (l0 - lt) * t;
      const xb = rt + (r0 - rt) * t;
      for (let x = Math.ceil(xa); x < xb; x++) {
        const layer = (y - rTop) % 5;
        let c: string = PH.thatch;
        if (layer === 4) c = PH.thatchD;
        else if (layer === 0) c = PH.thatchL;
        if (h01(x, y, 5) < 0.12) c = PH.thatchD;
        if (x < (xa + xb) / 2 - 8 && layer !== 4 && h01(x, y, 6) < 0.3) c = PH.thatchL; // sunlit left half
        if (x > xb - 5) c = layer === 4 ? PH.thatchDD : PH.thatchD; // shaded right slope
        p.px(x, y, c);
      }
    }
    for (let x = l0; x < r0; x++) {
      const len = 1 + Math.floor(h01(x, 1, 7) * 3);
      for (let k = 1; k <= len; k++) p.px(x, eave + k, k === len ? PH.thatchDD : PH.thatchD);
    }
    // Ridge bundle just under the walkable ridge pole (drawn by the platform).
    p.rect(lt, rTop, rt - lt, 2, PH.thatchD);
  },
});

/** Fish hanging under a drying-rack bar (anchored at the bar: top-centre; the bar is a platform). */
sprites.define({
  name: 'm1_rack',
  w: 30,
  h: 30,
  oy: 0,
  draw: (p) => {
    for (let i = 0; i < 4; i++) {
      const x = 5 + i * 7;
      p.line(x, 0, x, 3, PH.rope);
      p.ellipse(x, 7.5, 1.7, 3.6, i % 2 ? '#a8b4bc' : '#c4ccd2');
      p.px(x - 1, 5, '#eef4f6');
      p.px(x, 6, PH.ink);
      p.tri(x - 2.5, 12.5, x + 2.5, 12.5, x, 10, '#8a96a0');
    }
    // Net bundle and a basket on the deck below.
    p.ellipse(10, 23.5, 8, 2.4, '#a89a6e');
    for (let x = 4; x < 18; x += 3) p.px(x, 22, '#c8ba8a');
    p.rect(20, 19, 8, 7, PH.weaveD);
    p.rect(20, 19, 8, 1, PH.weave);
    p.px(22, 21, PH.weave);
    p.px(25, 22, PH.weave);
  },
});

// ------------------------------------------------------------------ tiki torch, campfire

function flame(p: PixelArt, cx: number, by: number, f: number, size: number): void {
  const wob = [0, 1, 0, -1][f % 4];
  const hgt = size * (1 + [0, 0.15, 0.05, 0.2][f % 4]);
  p.poly([cx - size * 0.55, by, cx + wob * 0.6, by - hgt, cx + size * 0.55, by], PH.flameD);
  p.ellipse(cx, by - size * 0.25, size * 0.55, size * 0.4, PH.flameD);
  p.poly([cx - size * 0.38, by - 0.5, cx + wob, by - hgt * 0.78, cx + size * 0.38, by - 0.5], PH.flame);
  p.ellipse(cx, by - size * 0.2, size * 0.32, size * 0.28, PH.flameL);
  p.px(cx + wob + (f % 2), by - hgt - 2, PH.flame);
}

sprites.define({
  name: 'm1_torch',
  w: 12,
  h: 42,
  frames: 4,
  draw: (p, f) => {
    bambooPole(p, 5, 14, 42, 2);
    // Woven cup.
    p.poly([2, 10, 10, 10, 8, 15, 4, 15], PH.weaveD);
    p.rect(2, 10, 8, 1, PH.weave);
    p.px(4, 12, PH.weave);
    p.px(7, 13, PH.weave);
    flame(p, 6, 10, f, 6);
  },
});

sprites.define({
  name: 'm1_campfire',
  w: 28,
  h: 24,
  frames: 4,
  draw: (p, f) => {
    // Crossed logs.
    p.capsule(5, 21, 22, 17, 2, PH.woodD);
    p.capsule(5, 17, 22, 21, 2, PH.wood);
    p.line(6, 16, 21, 20, PH.woodL);
    p.circle(22, 17, 1.6, '#c8905a');
    p.circle(5, 17, 1.6, '#c8905a');
    flame(p, 14, 18, f, 8);
    flame(p, 10, 19, f + 1, 4);
    flame(p, 18, 19, f + 2, 4.5);
    // Stones.
    for (const [x, s] of [
      [3, 2.4],
      [8, 2],
      [14, 2.2],
      [20, 2],
      [25, 2.4],
    ] as const) {
      p.ellipse(x, 21.5, s + 0.6, s, PH.rockD);
      p.ellipse(x - 0.5, 21, s, s - 0.6, PH.rockL);
    }
  },
});

// ------------------------------------------------------------------ fishing net, boat, beach props

sprites.define({
  name: 'm1_net',
  w: 62,
  h: 42,
  draw: (p) => {
    bambooPole(p, 2, 3, 42, 3);
    bambooPole(p, 57, 5, 42, 3);
    const top = (x: number) => 7 + Math.sin(((x - 4) / 53) * Math.PI) * 3;
    const bot = (x: number) => 30 + Math.sin(((x - 4) / 53) * Math.PI) * 6;
    // Mesh: diagonal cords inside the net shape.
    for (let x = 5; x < 57; x++) {
      for (let y = Math.ceil(top(x)); y < bot(x); y++) {
        const a = (x + y) % 5 === 0;
        const b = (x - y + 500) % 5 === 0;
        if (a || b) p.px(x, y, (x + y) % 2 ? '#c8b486' : '#a89466');
      }
    }
    // Ropes, floats, caught fish.
    for (let x = 4; x < 58; x++) {
      p.px(x, Math.round(top(x)), PH.rope);
      p.px(x, Math.round(bot(x)), '#a08a5a');
    }
    for (let x = 9; x < 56; x += 9) {
      p.ellipse(x, top(x) + 0.5, 1.6, 1.2, '#f08a2a');
      p.px(x - 1, Math.round(top(x)), '#ffc070');
    }
    for (const [x, y] of [
      [20, 20],
      [38, 24],
    ]) {
      p.ellipse(x, y, 3.5, 1.5, '#b8c4cc');
      p.px(x - 2, y - 1, '#eef4f6');
      p.tri(x + 3, y, x + 6, y - 2, x + 6, y + 2, '#8e9aa4');
      p.px(x - 2, y, PH.ink);
    }
  },
});

sprites.define({
  name: 'm1_boat',
  w: 80,
  h: 30,
  draw: (p) => {
    // Outrigger float + arms (behind the hull).
    p.capsule(16, 15, 64, 15, 2.2, PH.woodD);
    p.capsule(16, 14.5, 64, 14.5, 1.6, PH.wood);
    for (const ax of [26, 54]) {
      p.line(ax, 15, ax - 1, 10, PH.bambooD);
      p.line(ax - 1, 10, ax + 2, 19, PH.bamboo);
    }
    // Hull with upturned bow (right) and stern (left).
    const hull = [2, 14, 10, 18, 70, 18, 78, 13, 74, 24, 66, 28, 14, 28, 6, 24];
    p.poly(hull, PH.white);
    p.poly([6, 24, 74, 24, 66, 28, 14, 28], PH.blue);
    p.poly([4, 20, 76, 20, 75, 22, 5, 22], PH.red);
    p.line(10, 18, 70, 18, '#ffffff');
    p.poly([66, 27, 74, 24, 74, 26, 68, 28], PH.blueD);
    // Painted eye on the bow.
    p.circle(70, 21, 1.6, '#f8f4e8');
    p.px(70, 21, PH.ink);
    // Paddle across the gunwale + coiled rope.
    p.line(30, 16, 52, 14, PH.woodD);
    p.ellipse(54, 14, 3, 1.4, PH.wood);
    p.ring(40, 17, 2, PH.rope);
  },
});

sprites.define({
  name: 'm1_beachprop',
  w: 26,
  h: 28,
  frames: 4,
  draw: (p, f) => {
    if (f === 0) {
      // Rusty anchor half buried in the sand.
      p.rect(12, 6, 3, 20, '#7a5a4a');
      p.rect(12, 6, 1, 20, '#a07a62');
      p.ring(13.5, 4.5, 3, '#7a5a4a', 1.5);
      p.rect(7, 9, 13, 2, '#7a5a4a');
      p.capsule(4, 22, 12, 27, 1.5, '#6a4a3c');
      p.capsule(23, 22, 15, 27, 1.5, '#6a4a3c');
      p.px(4, 21, '#a07a62');
      p.px(23, 21, '#a07a62');
    } else if (f === 1) {
      // Lifebuoy on a post.
      post(p, 11, 4, 28, 3);
      p.ring(12.5, 12, 6.5, PH.white, 3);
      for (const a of [0.4, 2, 3.6, 5.2]) p.circle(12.5 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, 1.8, PH.red);
      p.px(8, 8, '#ffffff');
    } else if (f === 2) {
      // Woven crab trap.
      p.ellipse(13, 21, 10, 6, PH.weaveD);
      for (let x = 4; x < 23; x += 2) p.line(x, 16, x - 1, 26, PH.weave);
      p.ellipse(13, 16, 8, 2.5, PH.weave);
      p.ellipse(13, 16, 4, 1.2, '#4a3a2a');
    } else {
      // Two oars stuck in the sand.
      p.line(8, 27, 13, 2, PH.woodD);
      p.ellipse(13.5, 4, 2.4, 4.5, PH.wood);
      p.line(17, 27, 15, 6, PH.wood);
      p.ellipse(15, 7, 2.2, 4, PH.woodL);
      p.px(14, 5, PH.woodLL);
    }
  },
});

// ------------------------------------------------------------------ rocks

sprites.define({
  name: 'm1_rock',
  w: 44,
  h: 26,
  frames: 3,
  draw: (p, f) => {
    const R = ramp(PH.rock, 0.3, -0.3);
    const shapes = [
      () => [14, 25, 13, 19, 17, 15, 26, 14, 30, 18, 31, 25],
      () => [8, 25, 7, 17, 13, 11, 24, 9, 33, 12, 37, 18, 37, 25],
      () => [2, 25, 3, 15, 10, 7, 21, 3, 32, 5, 40, 11, 42, 19, 42, 25],
    ];
    const pts = shapes[f]();
    shaded(p, (m) => m.poly(pts, '#fff'), R);
    // Facets / cracks.
    const cx = f === 0 ? 22 : f === 1 ? 22 : 22;
    p.line(cx - 2, 26 - (f + 1) * 5, cx + 3, 24, PH.rockD);
    if (f > 0) p.line(cx + 6, 26 - f * 7, cx + 10, 22, PH.rockD);
    // Moss on top.
    for (let i = 0; i < pts.length - 2; i += 2) {
      const [x0, y0, x1, y1] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
      if (y0 > 18 || y1 > 18) continue;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        if (h01(Math.round(x), f, 9) < 0.7) p.px(x, y + 1, h01(Math.round(x), f, 10) < 0.5 ? PH.moss : PH.mossL);
      }
    }
  },
});

// ------------------------------------------------------------------ Legion crates, drums, signs

function legionCrate(p: PixelArt, x: number, y: number, w: number, h: number): void {
  const R = ramp(MC.olive, 0.26, -0.3);
  shaded(p, (m) => m.rect(x, y, w, h, '#fff'), R);
  p.box(x, y, w, h, MC.oliveDD);
  p.rect(x + 1, y + 1, w - 2, 1, MC.oliveL);
  for (let yy = y + 4; yy < y + h - 2; yy += 4) p.hline(x + 1, x + w - 2, yy, MC.oliveD);
  p.rect(x + 2, y + 2, 2, h - 4, MC.oliveD);
  p.rect(x + w - 4, y + 2, 2, h - 4, MC.oliveD);
  cog(new Pen(p), x + w / 2, y + h / 2, w > 16 ? 3 : 1.8);
}

sprites.define({
  name: 'm1_crates',
  w: 44,
  h: 38,
  frames: 3,
  draw: (p, f) => {
    if (f === 0) {
      legionCrate(p, 10, 16, 22, 22);
    } else if (f === 1) {
      legionCrate(p, 3, 20, 20, 18);
      legionCrate(p, 23, 22, 16, 16);
      legionCrate(p, 8, 4, 18, 16);
    } else {
      legionCrate(p, 2, 18, 20, 20);
      // Fuel drum.
      p.rect(25, 17, 14, 21, MC.rust);
      p.rect(25, 17, 3, 21, MC.rustL);
      p.rect(36, 17, 3, 21, MC.rustD);
      p.rect(25, 22, 14, 1, MC.rustD);
      p.rect(25, 31, 14, 1, MC.rustD);
      p.ellipse(32, 17, 7, 1.5, MC.rustD);
      p.rect(29, 16, 3, 1, MC.steelL);
    }
  },
});

sprites.define({
  name: 'm1_drums',
  w: 34,
  h: 24,
  draw: (p) => {
    for (const [x, c] of [
      [1, MC.olive],
      [12, MC.rust],
      [23, MC.olive],
    ] as const) {
      const R = ramp(c, 0.28, -0.32);
      shaded(p, (m) => m.rect(x, 3, 10, 21, '#fff'), R);
      p.rect(x, 8, 10, 1, shade(c, -0.35));
      p.rect(x, 17, 10, 1, shade(c, -0.35));
      p.ellipse(x + 5, 3, 5, 1.4, shade(c, -0.25));
      p.rect(x + 2, 11, 6, 3, MC.brass);
      p.rect(x + 2, 11, 6, 1, MC.brassL);
    }
  },
});

function signBoard(p: PixelArt, x: number, y: number, w: number, h: number, base: string): void {
  const R = ramp(base, 0.25, -0.3);
  shaded(p, (m) => m.rect(x, y, w, h, '#fff'), R);
  p.rect(x + 1, y + h - 2, w - 2, 1, shade(base, -0.2));
}

sprites.define({
  name: 'm1_sign',
  w: 38,
  h: 32,
  frames: 5,
  draw: (p, f) => {
    if (f === 4) {
      // Ford warning: NO VEHICLES (tank crossed out) over a MUD plank - the BULLDOG sinks here.
      post(p, 17, 12, 32, 3);
      p.circle(18.5, 10.5, 10.4, '#c82a1a');
      p.circle(18.5, 10.5, 8.2, MC.cream);
      // Tiny tank silhouette (hull, turret, gun, treads).
      p.rect(11, 10, 15, 4, '#3a3e48');
      p.rect(14, 7, 7, 3, '#3a3e48');
      p.rect(21, 8, 5, 1, '#3a3e48');
      p.rect(12, 14, 13, 2, '#23252c');
      for (let x = 13; x < 25; x += 3) p.px(x, 15, '#8a92a0');
      // The slash (top-left to bottom-right).
      p.line(12.5, 4.5, 24.5, 16.5, '#e83a2a', 2.2);
      p.px(13, 4, '#f86a4a');
      // MUD plank.
      signBoard(p, 8, 22, 22, 8, PH.woodD);
      tinyText(p, 'MUD', 13, 23, MC.cream);
    } else if (f === 0) {
      // Legion KEEP OUT board on two posts.
      post(p, 6, 10, 32, 3);
      post(p, 29, 10, 32, 3);
      signBoard(p, 1, 6, 36, 16, MC.oliveD);
      cog(new Pen(p), 8, 14, 3);
      tinyText(p, 'KEEP', 14, 8, MC.cream);
      tinyText(p, 'OUT!', 14, 14, MC.redL);
    } else if (f === 1) {
      // MINES warning diamond.
      post(p, 17, 16, 32, 3);
      p.poly([18.5, 1, 31, 13, 18.5, 25, 6, 13], MC.brass);
      p.poly([18.5, 3, 29, 13, 18.5, 23, 8, 13], '#e83a2a');
      p.poly([18.5, 3, 23, 7.5, 18.5, 12, 14, 7.5], '#f86a4a');
      tinyText(p, '!', 17, 7, MC.cream);
      p.rect(9, 26, tinyWidth('MINES') + 2, 7, MC.cream);
      tinyText(p, 'MINES', 10, 27, '#c82a1a');
    } else if (f === 2) {
      // Wooden arrow pointing right (Ruckus Squad chalk mark).
      post(p, 9, 10, 32, 3);
      p.poly([1, 5, 26, 5, 26, 2, 36, 10, 26, 18, 26, 15, 1, 15], PH.wood);
      p.poly([1, 5, 26, 5, 26, 2, 33, 8, 1, 8], PH.woodL);
      p.rect(1, 14, 25, 1, PH.woodD);
      tinyText(p, 'GO', 10, 7, PH.white);
    } else {
      // Legion FUEL depot sign with a flame icon.
      post(p, 6, 12, 32, 3);
      post(p, 29, 12, 32, 3);
      signBoard(p, 1, 4, 36, 15, MC.rustD);
      p.poly([7, 16, 5, 11, 8, 6, 9, 10, 11, 8, 11, 13, 9, 16], PH.flame);
      p.poly([8, 15, 7, 12, 8, 10, 10, 13, 9, 15], PH.flameL);
      tinyText(p, 'FUEL', 15, 9, MC.brassL);
      p.rect(14, 5, 21, 1, MC.brass);
      p.rect(14, 17, 21, 1, MC.brass);
    }
  },
});

// ------------------------------------------------------------------ landing craft (the squad's)

const VP_ORANGE = '#f0902e';

sprites.define({
  name: 'm1_landing',
  w: 132,
  h: 64,
  draw: (p) => {
    p.oy += 10; // art below is authored with the flag reaching y = -6
    const hull = ramp('#4f8a7a', 0.28, -0.34);
    // Lowered bow ramp onto the beach (right).
    p.poly([104, 30, 108, 26, 131, 50, 127, 53], '#3d6e62');
    p.poly([104, 30, 108, 26, 129, 48, 126, 49], '#5c9c8a');
    for (let k = 0; k < 6; k++) p.line(108 + k * 3.6, 29 + k * 3.4, 105 + k * 3.6, 32 + k * 3.4, '#2e5248');
    // Hull box.
    shaded(p, (m) => m.poly([4, 22, 108, 22, 108, 46, 100, 53, 12, 53, 4, 46], '#fff'), hull);
    // Armour plates, rivets, orange stripe, number.
    for (let x = 14; x < 104; x += 18) p.vline(x, 24, 45, '#3d6e62');
    for (let x = 8; x < 106; x += 6) p.px(x, 25, '#8cc2b0');
    p.rect(5, 33, 103, 3, VP_ORANGE);
    p.rect(5, 33, 103, 1, '#ffc45a');
    tinyText(p, 'R-7', 62, 38, '#e8f0e0');
    // Damage: holes and rust streaks.
    for (const [x, y] of [
      [30, 40],
      [36, 43],
      [84, 28],
    ]) {
      p.circle(x, y, 1.8, '#1e2a26');
      p.px(x - 1, y - 1, '#7aa898');
      p.line(x, y + 2, x - 1, y + 8, '#8a5a3a');
    }
    p.poly([60, 22, 70, 22, 66, 27, 62, 25], '#2e5248'); // torn gunwale
    // Wheelhouse at the stern (left) with a cracked window and an antenna.
    shaded(p, (m) => m.rect(10, 6, 30, 17, '#fff'), hull);
    p.rect(14, 10, 9, 6, '#2e4c5a');
    p.rect(26, 10, 9, 6, '#2e4c5a');
    p.px(15, 11, '#bfe4f0');
    p.px(27, 11, '#bfe4f0');
    p.line(26, 10, 31, 15, '#bfe4f0');
    p.rect(9, 5, 32, 2, '#3d6e62');
    p.line(36, 5, 40, -6, '#6a7680');
    p.px(40, -6, '#f06a3a');
    // Squad flag (orange with a cream fist-and-bolt mark), tattered.
    p.vline(14, -6, 5, '#6a7680');
    p.poly([15, -6, 27, -5, 24, -1, 27, 3, 15, 2], VP_ORANGE);
    p.rect(19, -4, 3, 3, '#f4e6c0');
    // Outboard motor.
    p.rect(0, 30, 6, 12, '#545a68');
    p.rect(0, 30, 6, 2, '#848c9c');
    p.rect(2, 42, 2, 8, '#3a3e48');
  },
});

// ------------------------------------------------------------------ stockade: palisade, tower, banner

sprites.define({
  name: 'm1_palisade',
  w: 50,
  h: 82,
  draw: (p) => {
    for (let i = 0; i < 8; i++) {
      const x = 1 + i * 6;
      const top = 8 + Math.floor(h01(i, 0, 21) * 6);
      const c = shade('#8a6a44', (h01(i, 1, 21) - 0.5) * 0.16);
      p.rect(x, top, 6, 82 - top, c);
      p.rect(x, top, 1, 82 - top, shade(c, 0.22));
      p.rect(x + 5, top, 1, 82 - top, shade(c, -0.3));
      p.tri(x, top, x + 3, top - 7, x + 6, top, c);
      p.tri(x, top, x + 3, top - 7, x + 2, top, shade(c, 0.22));
      for (let k = 0; k < 3; k++) p.px(x + 2 + (k % 2), top + 10 + Math.floor(h01(i, k, 22) * 60), shade(c, -0.22));
    }
    // Cross beams with rope lashings.
    for (const y of [24, 62]) {
      p.rect(0, y, 50, 4, '#6a4e30');
      p.rect(0, y, 50, 1, '#9a7650');
      for (let x = 3; x < 50; x += 6) p.rect(x, y - 1, 2, 6, PH.rope);
    }
  },
});

/** Wooden watchtower around a level platform whose deck is 42 px above the ground. */
sprites.define({
  name: 'm1_tower',
  w: 58,
  h: 96,
  draw: (p) => {
    const g = 96; // ground row
    const deck = g - 42;
    // Legs and X-bracing below the deck, plank deck (a level platform sits exactly on it).
    for (const x of [6, 49]) post(p, x, deck + 4, g, 3);
    p.rect(5, deck, 48, 5, PH.plank);
    p.rect(5, deck, 48, 1, PH.woodLL);
    p.rect(5, deck + 4, 48, 1, PH.woodDD);
    for (let x = 13; x < 53; x += 9) p.rect(x, deck + 1, 1, 3, PH.woodD);
    p.line(8, deck + 8, 49, g - 6, PH.woodD);
    p.line(49, deck + 8, 8, g - 6, PH.wood);
    p.rect(7, deck + 22, 44, 2, PH.woodD);
    // Roof posts, railing (low, behind the deck edge) and a thatched roof.
    for (const x of [7, 48]) post(p, x, deck - 30, deck, 2);
    p.rect(6, deck - 10, 46, 2, PH.woodD);
    p.rect(6, deck - 10, 46, 1, PH.wood);
    p.poly([0, deck - 28, 29, deck - 44, 58, deck - 28, 52, deck - 26, 6, deck - 26], PH.thatch);
    p.poly([0, deck - 28, 29, deck - 44, 27, deck - 26, 6, deck - 26], PH.thatchL);
    for (let x = 1; x < 57; x += 2) p.px(x, deck - 26 + (x % 4 === 1 ? 1 : 0), PH.thatchDD);
    // A Legion pennant on the roof.
    p.vline(29, deck - 52, deck - 44, PH.woodD);
    p.poly([30, deck - 52, 38, deck - 50, 30, deck - 47], MC.red);
  },
});

sprites.define({
  name: 'm1_banner',
  w: 22,
  h: 58,
  frames: 4,
  draw: (p, f) => {
    p.rect(1, 2, 2, 56, PH.woodD);
    p.px(1, 2, PH.woodL);
    p.circle(2, 1.5, 1.5, MC.brass);
    for (let x = 3; x < 21; x++) {
      const t = (x - 3) / 17;
      const wave = Math.round(Math.sin(t * 5 + f * (Math.PI / 2)) * 1.6 * t);
      const top = 4 + wave;
      const len = 24 - (x % 3 === 0 ? 2 : 0) - Math.round(t * 2);
      for (let y = top; y < top + len; y++) {
        let c: string = MC.red;
        if (y >= top + len - 4) c = MC.redD;
        if (y === top) c = MC.redL;
        p.px(x, y, c);
      }
    }
    const wave = Math.round(Math.sin(0.5 * 5 + f * (Math.PI / 2)) * 0.8);
    cog(new Pen(p), 12, 15 + wave, 3, MC.brass);
  },
});

// ------------------------------------------------------------------ fuel silo

sprites.define({
  name: 'm1_silo',
  w: 74,
  h: 86,
  draw: (p) => {
    const x0 = 6;
    const x1 = 64;
    const top = 14;
    const bot = 78;
    // Cylinder body: lit left third, shaded right edge, weld bands.
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const c = u < 0.12 ? MC.oliveL : u < 0.35 ? '#958b56' : u < 0.8 ? MC.olive : u < 0.92 ? MC.oliveD : MC.oliveDD;
      p.rect(x, top, 1, bot - top, c);
    }
    p.ellipse(35, top, 29, 7, MC.oliveD);
    p.ellipse(35, top - 1, 28, 6, MC.olive);
    p.ellipse(30, top - 3, 16, 3, MC.oliveL);
    for (const y of [30, 50, 66]) {
      p.rect(x0, y, x1 - x0, 1, MC.oliveDD);
      p.rect(x0, y + 1, x1 - x0, 1, MC.oliveL);
    }
    // Rust streaks under the welds.
    for (const x of [16, 27, 45, 52]) p.line(x, 31, x + (x % 3) - 1, 31 + 6 + (x % 7), MC.rust);
    // Stencil + emblem.
    tinyText(p, 'FUEL', 26, 38, MC.cream);
    cog(new Pen(p), 35, 58, 4.5, MC.brass);
    // Ladder on the right side.
    p.vline(57, top - 2, bot, MC.steelD);
    p.vline(61, top - 2, bot, MC.steelD);
    for (let y = top + 1; y < bot; y += 4) p.hline(57, 61, y, MC.steelL);
    // Legs / saddles and pipes into the ground.
    p.rect(10, bot, 6, 8, MC.steelD);
    p.rect(54, bot, 6, 8, MC.steelD);
    p.rect(10, bot, 2, 8, MC.steel);
    p.rect(30, bot - 4, 10, 4, MC.steel);
    p.rect(33, bot, 4, 8, MC.steelD);
    p.rect(0, 80, 33, 4, MC.steel);
    p.rect(0, 80, 33, 1, MC.steelL);
    p.ring(35, bot - 8, 3, MC.red, 1.2); // valve wheel
    p.px(35, bot - 8, MC.red);
  },
});

// ------------------------------------------------------------------ jungle tree, vines, fence

sprites.define({
  name: 'm1_jtree',
  w: 80,
  h: 214,
  draw: (p) => {
    const cx = 40;
    const bot = 213;
    const bark = '#7a6a54';
    const barkL = '#9a8a6c';
    const barkD = '#5a4c3c';
    // Trunk with slight taper.
    for (let y = 30; y <= bot; y++) {
      const t = (y - 30) / (bot - 30);
      const half = 6 + t * 3;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const u = (x - (cx - half)) / (2 * half);
        let c = u < 0.2 ? barkL : u > 0.75 ? barkD : bark;
        if (h01(x, Math.floor(y / 3), 31) < 0.08) c = barkD;
        p.px(x, y, c);
      }
    }
    // Buttress roots.
    p.poly([cx - 30, bot + 1, cx - 6, bot - 42, cx - 4, bot + 1], bark);
    p.poly([cx - 30, bot + 1, cx - 6, bot - 42, cx - 9, bot + 1], barkL);
    p.poly([cx + 32, bot + 1, cx + 7, bot - 36, cx + 5, bot + 1], barkD);
    p.poly([cx - 14, bot + 1, cx - 2, bot - 18, cx + 2, bot + 1], barkD);
    // Moss patches and a spiralling liana.
    for (let k = 0; k < 6; k++) p.ellipse(cx - 4 + (k % 2) * 6, 60 + k * 24, 3, 2, PH.moss);
    for (let y = 26; y < bot - 10; y++) {
      const x = cx + Math.sin(y * 0.09) * 9;
      p.px(x, y, Math.cos(y * 0.09) > 0 ? '#3c7a34' : '#2a5a28');
      if (y % 11 === 0) p.ellipse(x + 2, y, 2.2, 1.2, LEAF.b);
    }
    // Branches with leaf clumps at the top (mostly above the screen).
    p.line(cx, 40, cx - 26, 18, bark, 4);
    p.line(cx, 46, cx + 28, 24, barkD, 4);
    for (const [x, y, r] of [
      [cx - 30, 14, 11],
      [cx + 30, 20, 11],
      [cx, 8, 13],
    ] as const) {
      p.ellipse(x + 1, y + 2, r * 1.2, r * 0.75, LEAF.dd);
      p.ellipse(x, y, r * 1.15, r * 0.7, LEAF.d);
      p.ellipse(x - r * 0.35, y - r * 0.3, r * 0.6, r * 0.32, LEAF.b);
    }
  },
});

sprites.define({
  name: 'm1_vines',
  w: 26,
  h: 52,
  oy: 0,
  frames: 3,
  draw: (p, f) => {
    const n = 3 + f;
    for (let i = 0; i < n; i++) {
      const x0 = 3 + i * (20 / n) + h01(i, f, 41) * 3;
      const len = 18 + h01(i, f, 42) * 32;
      for (let y = 0; y < len; y++) {
        const x = x0 + Math.sin(y * 0.18 + i) * 1.3;
        p.px(x, y, '#2e6a2c');
        if (y % 5 === 2) {
          p.px(x - 1, y, LEAF.b);
          p.px(x - 2, y + 1, LEAF.l);
        } else if (y % 5 === 4) {
          p.px(x + 1, y, LEAF.d);
        }
      }
    }
  },
});

sprites.define({
  name: 'm1_fence',
  w: 50,
  h: 22,
  draw: (p) => {
    for (let x = 1; x < 49; x += 5) bambooPole(p, x, 2 + (x % 3), 22, 2);
    for (const y of [7, 15]) {
      p.rect(0, y, 50, 2, PH.bambooD);
      p.rect(0, y, 50, 1, PH.bamboo);
      for (let x = 2; x < 49; x += 5) p.rect(x, y - 1, 1, 4, PH.rope);
    }
  },
});

// ------------------------------------------------------------------ sandbag emplacement (decor)

sprites.define({
  name: 'm1_sandwall',
  w: 46,
  h: 16,
  draw: (p) => {
    const d = new Pen(p);
    for (let i = 0; i < 4; i++) sandbag(d, 1 + i * 11, 9, 12, 7);
    for (let i = 0; i < 3; i++) sandbag(d, 6 + i * 11, 3, 12, 7);
  },
});
