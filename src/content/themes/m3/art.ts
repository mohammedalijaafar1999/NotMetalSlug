// Small pixel-art helpers shared by the FROSTBITE PASS decor, platforms and mission props:
// snow caps, icicles, a 3x5 stencil font for signs, shaded boxes.

import type { PixelArt } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { P3 } from './palette';
import { hash01 } from './layers';

/** Snow resting on a horizontal surface [x0, x1) whose top is y: lumps above, a bright layer
 *  `thick` px deep, a soft blue underside and a few drips/icicles. */
export function snowCap(p: PixelArt, x0: number, x1: number, y: number, thick = 3, seed = 1, icy = true): void {
  const r = new Rng(seed);
  const w = x1 - x0;
  for (let i = 0; i < w; i++) {
    const x = x0 + i;
    const edge = Math.min(i, w - 1 - i);
    const lump = edge < 1 ? 0 : Math.max(0, Math.round(0.9 + Math.sin(i * 0.55 + seed) * 0.9 + (hash01(i * 7 + seed) - 0.5)));
    for (let k = 1; k <= lump; k++) p.px(x, y - k, k === lump ? P3.snowHi : P3.snow);
    for (let d = 0; d < thick; d++) p.px(x, y + d, d === 0 ? (lump ? P3.snow : P3.snowHi) : d === thick - 1 ? P3.snowS : P3.snowM);
    if (icy && edge > 1 && hash01(i * 13 + seed * 3) > 0.8) {
      const len = r.int(1, 4);
      for (let k = 0; k < len; k++) p.px(x, y + thick + k, k === len - 1 ? P3.iceHi : P3.ice);
    }
  }
}

/** A row of hanging icicles under y between x0 and x1. */
export function icicles(p: PixelArt, x0: number, x1: number, y: number, maxLen = 6, density = 0.35, seed = 3): void {
  for (let x = x0; x < x1; x++) {
    if (hash01(x * 17 + seed) > density) continue;
    const len = 2 + Math.floor(hash01(x * 29 + seed) * (maxLen - 1));
    for (let k = 0; k < len; k++) p.px(x, y + k, k < 1 ? P3.iceM : k === len - 1 ? P3.iceHi : P3.ice);
    if (len > 4 && x + 1 < x1) p.px(x + 1, y, P3.ice);
  }
}

/** Box with top-left light: highlight on the top/left, shade on the bottom/right. */
export function shadedBox(p: PixelArt, x: number, y: number, w: number, h: number, base: string, hi: string, lo: string): void {
  p.rect(x, y, w, h, base);
  p.rect(x, y, w, 1, hi);
  p.rect(x, y, 1, h, hi);
  p.rect(x, y + h - 1, w, 1, lo);
  p.rect(x + w - 1, y, 1, h, lo);
}

// ------------------------------------------------------------------ 3x5 stencil font

const GLYPHS: Record<string, string> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '!': '010010010000010',
  '-': '000000111000000',
  '>': '100010001010100',
  '.': '000000000000010',
};

/** Width in px of `text` in the 3x5 font. */
export function textWidth(text: string): number {
  return Math.max(0, text.length * 4 - 1);
}

/** Draw `text` in the 3x5 stencil font with its top-left at (x, y). */
export function pxText(p: PixelArt, x: number, y: number, text: string, color: string): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') p.px(cx + (i % 3), y + Math.floor(i / 3), color);
    cx += 4;
  }
}

/** Legion emblem: a gold cog with a red star (radius ~r). */
export function legionEmblem(p: PixelArt, cx: number, cy: number, r: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(0.8, r * 0.28), P3.goldD);
  }
  p.circle(cx, cy, r, P3.gold);
  p.circle(cx - 0.4, cy - 0.4, r * 0.7, '#f4d860');
  p.circle(cx, cy, r * 0.55, P3.redD);
  const pts: number[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const rr = k % 2 ? r * 0.22 : r * 0.5;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.poly(pts, P3.red);
}
