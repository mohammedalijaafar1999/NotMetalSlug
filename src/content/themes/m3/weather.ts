// FROSTBITE PASS weather: parallax snowfall in three depths plus occasional wind gusts (flakes
// race sideways and streak, spindrift wisps sweep along the ground). Screen space, cosmetic
// only (deterministic from the world time; no gameplay effect).

import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { hash01 } from './layers';

interface FlakeLayer {
  n: number;
  size: number;
  color: string;
  alpha: number;
  fall: number;
  factor: number;
  sway: number;
  wind: number;
}

const FLAKES: FlakeLayer[] = [
  { n: 64, size: 1, color: '#d4e2f2', alpha: 0.55, fall: 13, factor: 0.25, sway: 5, wind: 0.45 },
  { n: 42, size: 1, color: '#ffffff', alpha: 0.85, fall: 23, factor: 0.6, sway: 7, wind: 0.75 },
  { n: 14, size: 2, color: '#ffffff', alpha: 0.9, fall: 38, factor: 1.15, sway: 9, wind: 1.1 },
];

/** Gust strength 0..1 at time t: a soft pulse roughly every 11-15 s lasting ~3 s. */
export function gustAt(t: number): number {
  const period = 13;
  const k = Math.floor(t / period);
  const start = k * period + 4 + hash01(k * 7 + 1) * 5;
  const u = (t - start) / 3.2;
  if (u <= 0 || u >= 1) return 0;
  const s = Math.sin(u * Math.PI);
  return s * s * (0.7 + hash01(k * 13 + 5) * 0.3);
}

// Integrated wind offset (cosmetic state; resets when time goes backwards, e.g. a new level).
let windPos = 0;
let lastT = -1;

function windOffset(t: number): number {
  if (lastT < 0 || t < lastT || t - lastT > 1) {
    lastT = t;
    return windPos;
  }
  const dt = t - lastT;
  lastT = t;
  windPos += (10 + gustAt(t) * 120) * dt;
  return windPos;
}

const W = VIEW_W + 24;
const H = VIEW_H + 24;
const mod = (a: number, m: number) => ((a % m) + m) % m;

export function renderSnow(g: CanvasRenderingContext2D, camX: number, camY: number, time: number): void {
  const gust = gustAt(time);
  const wind = windOffset(time);
  const prevAlpha = g.globalAlpha;
  for (let li = 0; li < FLAKES.length; li++) {
    const L = FLAKES[li];
    g.fillStyle = L.color;
    g.globalAlpha = prevAlpha * L.alpha;
    const streak = gust > 0.35 && L.size === 1 ? Math.round(1 + gust * 3 * L.wind) : 0;
    for (let i = 0; i < L.n; i++) {
      const seed = li * 1000 + i;
      const x0 = hash01(seed) * W;
      const y0 = hash01(seed + 500) * H;
      const ph = hash01(seed + 900) * 6.283;
      const fall = L.fall * (0.8 + hash01(seed + 77) * 0.4);
      const y = mod(y0 + time * fall - camY * L.factor, H) - 12;
      const x = mod(x0 + wind * L.wind - camX * L.factor + Math.sin(time * 1.1 + ph) * L.sway, W) - 12;
      if (streak) g.fillRect(Math.round(x) - streak, Math.round(y), streak + 1, 1);
      else g.fillRect(Math.round(x), Math.round(y), L.size, L.size);
    }
  }
  // Spindrift: wispy bands of blown snow skimming the lower screen during gusts.
  if (gust > 0.05) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const seed = 5000 + i;
      const y = 120 + hash01(seed) * 86;
      const len = 30 + hash01(seed + 3) * 70;
      const x = mod(hash01(seed + 7) * W + wind * 2.2 - camX * 0.9, W + len) - len;
      g.globalAlpha = prevAlpha * gust * (0.1 + hash01(seed + 11) * 0.12);
      g.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
      g.fillRect(Math.round(x + len * 0.2), Math.round(y + 1), Math.round(len * 0.6), 1);
    }
  }
  g.globalAlpha = prevAlpha;
}
