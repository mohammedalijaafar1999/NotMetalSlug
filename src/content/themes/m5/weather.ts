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

/**
 * A wind-torn cloud wisp (drawn with low alpha): a long tapered streak with a brighter core, frayed
 * into thin trailing strands downwind (to the right - the wind blows them past, right to left).
 */
export function wispArt(seed: number, w: number, h: number): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  const cy = h / 2;
  const head = r.range(0.18, 0.3);
  const phase = r.range(0, 6);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    // Thick near the head, tapering into the tail.
    const prof = t < head ? Math.sin((t / head) * Math.PI * 0.5) : Math.pow(1 - (t - head) / (1 - head), 0.8);
    const half = prof * (h / 2 - 1) * (0.85 + 0.15 * Math.sin(x * 0.35 + phase));
    const mid = cy + Math.sin(x * 0.09 + phase) * 1.2;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y + 0.5 - mid);
      if (d > half) continue;
      const core = d < half * 0.45;
      if (!core && (x + y * 3) % 4 === 0) continue;
      p.px(x, y, core ? P5.wisp : P5.wispShade);
    }
  }
  // Frayed strands trailing downwind.
  for (let k = 0; k < 4; k++) {
    const y = Math.round(cy + r.range(-h * 0.35, h * 0.35));
    const x0 = Math.round(w * r.range(0.35, 0.6));
    const len = Math.round(w * r.range(0.25, 0.4));
    for (let x = x0; x < Math.min(w, x0 + len); x++) if ((x + k) % 5 !== 0) p.px(x, y, P5.wispShade);
  }
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
    wisps: [wispArt(1, 150, 13), wispArt(2, 104, 10), wispArt(3, 210, 16)].map((w) => w.toCanvas()),
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
  return { x: i * 240 + r.range(0, 160), y: r.range(44, 200), kind: r.int(0, 2), a: r.range(0.3, 0.42) };
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
      const sx = ((((w.x - camX * 1.45 - time * 28) % WISP_SPAN) + WISP_SPAN) % WISP_SPAN) - 220;
      if (sx > VIEW_W || sx < -220) continue;
      g.globalAlpha = w.a * fade * (0.6 + storm * 0.4);
      g.drawImage(C.wisps[w.kind], Math.round(sx), Math.round(w.y - camY * 0.2 + (level.height - VIEW_H) * 0.2));
    }
  }
  g.globalAlpha = prev;
}
