// FROSTBITE PASS one-way platforms. Each platform is rasterized once (PixelArt, outlined) and
// cached as a canvas, so drawing costs one drawImage per frame.
// Styles: 'wood' (default: snow-capped planks with icicles), 'metal' (snowy steel girder),
// 'ice' (translucent ice shelf), 'rock' (snowy rock ledge).

import { PixelArt } from '../../../engine/pixelart';
import { P3 } from './palette';
import { hash01 } from './layers';

const TOP = 3;
const BOTTOM = 18;
const cache = new Map<string, HTMLCanvasElement>();

/** Rasterize a platform of width w whose surface drops by dy from left to right. */
export function platformArt(w: number, dy: number, style: string, seed: number): PixelArt {
  const W = Math.max(2, Math.round(w)) + 2;
  const H = Math.abs(Math.round(dy)) + TOP + BOTTOM + 2;
  const p = new PixelArt(W, H);
  const base = dy < 0 ? -Math.round(dy) : 0;
  const n = W - 2;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const t = n <= 1 ? 0 : i / (n - 1);
    const s = TOP + 1 + Math.round(base + dy * t);
    const hsh = hash01(i * 31 + seed);
    const edge = Math.min(i, n - 1 - i);
    if (style === 'metal') {
      p.px(x, s, hsh > 0.35 ? P3.snowHi : P3.steelHi);
      p.px(x, s + 1, hsh > 0.7 ? P3.snowM : '#aab4c2');
      p.px(x, s + 2, P3.steel);
      p.px(x, s + 3, i % 8 === 3 ? P3.steelD : P3.steel);
      p.px(x, s + 4, P3.steelD);
      // Truss.
      const m = i % 16;
      const ty = m < 8 ? m : 15 - m;
      if (ty < 6) p.px(x, s + 5 + ty, P3.steelM);
      if (m === 0) for (let k = 5; k < 11; k++) p.px(x, s + k, P3.steelM);
      p.px(x, s + 10, i % 16 < 15 ? P3.steelD : P3.steelM);
      if (edge > 2 && hash01(i * 7 + seed) > 0.86) {
        const len = 2 + Math.floor(hash01(i * 3 + seed) * 4);
        for (let k = 0; k < len; k++) p.px(x, s + 11 + k, k === len - 1 ? P3.iceHi : P3.ice);
      }
    } else if (style === 'ice') {
      if (edge > 0 && hsh > 0.6) p.px(x, s - 1, P3.snowHi);
      p.px(x, s, P3.iceHi);
      p.px(x, s + 1, hsh > 0.5 ? P3.iceHi : P3.ice);
      p.px(x, s + 2, P3.ice);
      p.px(x, s + 3, i % 7 === 2 ? P3.iceHi : P3.iceM);
      p.px(x, s + 4, P3.iceD);
      const len = edge > 1 && hash01(i * 11 + seed) > 0.55 ? 1 + Math.floor(hash01(i * 5 + seed) * 7) : 0;
      for (let k = 0; k < len; k++) p.px(x, s + 5 + k, k === len - 1 ? P3.iceHi : k < 2 ? P3.iceM : P3.ice);
    } else if (style === 'rock') {
      if (edge > 1 && hsh > 0.55) p.px(x, s - 1, P3.snowHi);
      p.px(x, s, P3.snowHi);
      p.px(x, s + 1, P3.snow);
      p.px(x, s + 2, P3.snowS);
      const depth = 4 + Math.round(hash01(Math.floor(i / 3) * 17 + seed) * 4) - (edge < 3 ? 3 - edge : 0);
      for (let k = 3; k < 3 + depth; k++) p.px(x, s + k, k === 3 ? P3.rockHi : k > depth ? P3.rockD : (i + k) % 9 === 0 ? P3.rockM : P3.rock);
    } else {
      // Wood planks under a snow cap.
      const lump = edge > 1 && hsh > 0.45 ? (hsh > 0.85 ? 2 : 1) : 0;
      for (let k = 1; k <= lump; k++) p.px(x, s - k, k === lump ? P3.snowHi : P3.snow);
      p.px(x, s, lump ? P3.snow : P3.snowHi);
      p.px(x, s + 1, P3.snowM);
      const seam = i % 12 === 0;
      p.px(x, s + 2, seam ? P3.woodD : P3.woodHi);
      p.px(x, s + 3, seam ? P3.woodD : P3.wood);
      p.px(x, s + 4, seam ? P3.woodDD : P3.woodM);
      p.px(x, s + 5, P3.woodDD);
      // Brackets.
      const m = i % 40;
      if (m >= 6 && m < 8) for (let k = 6; k < 10; k++) p.px(x, s + k, P3.woodD);
      if (m === 8) for (let k = 6; k < 8; k++) p.px(x, s + k, P3.woodDD);
      if (edge > 1 && hash01(i * 13 + seed) > 0.8) {
        const len = 1 + Math.floor(hash01(i * 19 + seed) * 4);
        for (let k = 0; k < len; k++) p.px(x, s + 6 + k, k === len - 1 ? P3.iceHi : P3.ice);
      }
    }
  }
  p.outline('#241c2c');
  return p;
}

/** ThemeDef.platform implementation. */
export function drawPlatform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const key = `${x1}|${y1}|${x2}|${y2}|${style}`;
  let c = cache.get(key);
  if (!c) {
    c = platformArt(x2 - x1, y2 - y1, style, Math.round(x1 * 7 + y1)).toCanvas();
    cache.set(key, c);
  }
  g.drawImage(c, Math.round(x1) - 1, Math.round(Math.min(y1, y2)) - TOP - 1);
}
