// Mission 2 weather overlay (screen space, drawn over the world): wind-blown sand streaks, a
// sandstorm gust every ~17 s (denser, faster streaks and a dust haze hugging the ground) and a
// warm late-day tint that deepens toward sunset. Deterministic (time-based), purely cosmetic.

import { mixColor } from '../../../engine/pixelart';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import type { LevelDef } from '../../../game/level';
import { progressAt } from './backdrop';
import { todAt } from './palette';

const GUST_PERIOD = 17;
const GUST_LEN = 5.5;

/** Gust strength 0..1 at a time (smooth bump once per period). */
export function gustAt(time: number): number {
  const k = (time % GUST_PERIOD) - (GUST_PERIOD - GUST_LEN);
  if (k < 0) return 0;
  return Math.sin((k / GUST_LEN) * Math.PI) ** 2;
}

function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

let hazeGrad: CanvasGradient | null = null;
let hazeFor: string | null = null;

export function renderWeather(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  const prog = progressAt(level, camX);
  const tod = todAt(prog);
  const gust = gustAt(time);
  const sand = mixColor('#f4dca4', tod.haze, 0.35);
  const sandD = mixColor('#d8b27a', tod.haze, 0.3);
  // Ground dust haze during gusts.
  if (gust > 0.01) {
    const key = sand;
    if (!hazeGrad || hazeFor !== key) {
      hazeGrad = g.createLinearGradient(0, 60, 0, VIEW_H);
      hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
      hazeGrad.addColorStop(1, key);
      hazeFor = key;
    }
    g.globalAlpha = 0.2 * gust;
    g.fillStyle = hazeGrad;
    g.fillRect(0, 60, VIEW_W, VIEW_H - 60);
    g.globalAlpha = 0.05 * gust;
    g.fillStyle = sand;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;
  }
  // Sand streaks blowing right -> left; a few always, many during gusts.
  const n = 14 + Math.round(gust * 46);
  const span = VIEW_W + 60;
  for (let i = 0; i < n; i++) {
    const h1 = hash(i);
    const h2 = hash(i + 101);
    const h3 = hash(i + 211);
    const speed = 110 + h2 * 90 + gust * 120;
    const len = Math.round(3 + h3 * 9 + gust * 10);
    const x = span - ((((h1 * span + time * speed + camX * 1.0) % span) + span) % span) - 30;
    const yBase = 40 + h2 * (VIEW_H - 50);
    const y = Math.round(yBase + Math.sin(time * 1.7 + i) * 3 + (camY % 7) * 0);
    g.globalAlpha = (0.22 + h3 * 0.2) * (i < 14 ? 1 : gust);
    g.fillStyle = i % 3 ? sand : sandD;
    g.fillRect(Math.round(x), y, len, 1);
    if (len > 9) g.fillRect(Math.round(x + 3), y + 1, Math.round(len * 0.5), 1);
  }
  // Late-day warm tint.
  if (tod.tintAlpha > 0.005) {
    g.globalAlpha = tod.tintAlpha;
    g.fillStyle = tod.tint;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  g.globalAlpha = 1;
}
