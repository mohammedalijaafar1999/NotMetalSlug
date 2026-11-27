// STORMFRONT weather overlay (screen space, drawn over the world): slanted rain streaks in two
// depths and a few translucent wind-blown wisps racing past. Both scale with the storm intensity
// along the mission; the wisps thin out and vanish before the boss arena so nothing ever covers
// the flagship, its lightning tracking lines or the lock line. Kept faint on purpose: actors and
// bullets must stay readable through it.

import { PixelArt } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import type { LevelDef } from '../../../game/level';
import { P5 } from './palette';
import { bossLockX, stormLevel } from './sky';

const RAIN_TILE = 128;

/** A tileable sheet of slanted rain streaks (wind from the right: streaks lean left going down). */
export function rainTile(seed: number, count: number, minLen: number, maxLen: number, color: string): PixelArt {
  const p = new PixelArt(RAIN_TILE, RAIN_TILE);
  const r = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const x0 = r.int(0, RAIN_TILE - 1);
    const y0 = r.int(0, RAIN_TILE - 1);
    const len = r.int(minLen, maxLen);
    for (let k = 0; k < len; k++) {
      const x = (((x0 - Math.round(k * 0.45)) % RAIN_TILE) + RAIN_TILE) % RAIN_TILE;
      const y = (y0 + k) % RAIN_TILE;
      p.setRaw(x, y, 0);
      p.px(x, y, color);
    }
  }
  return p;
}

/** Small translucent cloud wisp (drawn with low alpha). */
export function wispArt(seed: number, w: number, h: number): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  const n = Math.round(w / 9);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = 6 + k * (w - 12) + r.range(-2, 2);
    const y = h / 2 + r.range(-1.5, 1.5) + Math.abs(k - 0.4) * 3;
    const rad = (1 - Math.abs(k - 0.45) * 1.3) * (h / 2 - 1) + r.range(-0.5, 0.8);
    if (rad < 1.5) continue;
    p.circle(x, y + 1, rad, P5.wispShade);
    p.circle(x - 0.5, y - 0.5, rad - 1, P5.wisp);
  }
  // Streaky tail.
  for (let x = 0; x < w * 0.35; x++) if (x % 3 !== 0) p.px(w - 1 - x, Math.round(h / 2 + 1), P5.wispShade);
  return p;
}

interface Cache {
  rainFar: HTMLCanvasElement;
  rainNear: HTMLCanvasElement;
  wisps: HTMLCanvasElement[];
}

let cache: Cache | null = null;

function ensure(): Cache {
  if (cache) return cache;
  cache = {
    rainFar: rainTile(5, 34, 3, 5, P5.rain).toCanvas(),
    rainNear: rainTile(9, 12, 6, 9, P5.rain).toCanvas(),
    wisps: [wispArt(1, 64, 14), wispArt(2, 44, 11), wispArt(3, 86, 16)].map((w) => w.toCanvas()),
  };
  return cache;
}

function tile(g: CanvasRenderingContext2D, c: HTMLCanvasElement, ox: number, oy: number): void {
  const x0 = (((ox % RAIN_TILE) + RAIN_TILE) % RAIN_TILE) - RAIN_TILE;
  const y0 = (((oy % RAIN_TILE) + RAIN_TILE) % RAIN_TILE) - RAIN_TILE;
  for (let y = y0; y < VIEW_H; y += RAIN_TILE) for (let x = x0; x < VIEW_W; x += RAIN_TILE) g.drawImage(c, x, y);
}

/** Wisp schedule: a long virtual strip of wisps that the camera flies through (fast parallax). */
const WISPS = Array.from({ length: 14 }, (_, i) => {
  const r = new Rng(400 + i * 7);
  return { x: i * 240 + r.range(0, 160), y: r.range(44, 200), kind: r.int(0, 2), a: r.range(0.16, 0.26) };
});
const WISP_SPAN = 14 * 240;

export function renderStormOverlay(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  const C = ensure();
  const storm = stormLevel(camX, level);
  const prev = g.globalAlpha;
  // Rain: the far sheet falls slower than the near one; both drift with the wind.
  g.globalAlpha = 0.16 + storm * 0.16;
  tile(g, C.rainFar, Math.round(-camX * 0.9 - time * 70), Math.round(time * 170 - camY * 0.9));
  g.globalAlpha = 0.14 + storm * 0.2;
  tile(g, C.rainNear, Math.round(-camX * 1.2 - time * 110), Math.round(time * 260 - camY));
  // Wisps (never in the boss arena).
  const bx = bossLockX(level);
  const fade = isFinite(bx) ? Math.max(0, Math.min(1, (bx - 420 - camX) / 360)) : 1;
  if (fade > 0) {
    for (const w of WISPS) {
      const sx = ((((w.x - camX * 1.45 - time * 28) % WISP_SPAN) + WISP_SPAN) % WISP_SPAN) - 120;
      if (sx > VIEW_W || sx < -100) continue;
      g.globalAlpha = w.a * fade * (0.6 + storm * 0.4);
      g.drawImage(C.wisps[w.kind], Math.round(sx), Math.round(w.y - camY * 0.2 + (level.height - VIEW_H) * 0.2));
    }
  }
  g.globalAlpha = prev;
}
