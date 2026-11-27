// IRON CITADEL atmosphere overlay (screen space, drawn over the world, under the HUD):
//  - drifting embers and the odd bright spark rising through the air (parallax-anchored to the world)
//  - a faint warm heat haze rising from the floor, shimmering
//  - a dark smog vignette along the top edge (also keeps the HUD readable)
//  - an occasional red alarm-light pulse, more frequent in the hangar at the end of the level
// Everything is a pure function of (camera, time): no state, deterministic, cheap (a few fillRects).

import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { settings } from '../../../engine/storage';
import type { LevelDef } from '../../../game/level';
import { hash01 } from './palette';

const EMBERS = 34;
const EMBER_COLORS = ['#ffb43a', '#ff7a1e', '#fff0a0', '#ff5a14'];

/** Where the alarm section begins (camera-left x), set per level via props-free convention. */
function alarmFrom(level: LevelDef): number {
  return level.width - 2300;
}

export function renderM6Overlay(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  // --- top smog vignette (darkens the sky under the HUD a touch)
  g.fillStyle = '#07050b';
  for (let y = 0; y < 14; y++) {
    g.globalAlpha = 0.2 * (1 - y / 14);
    g.fillRect(0, y, VIEW_W, 1);
  }
  // --- heat haze: warm rows near the bottom that breathe
  g.fillStyle = '#ff6a14';
  const breathe = 0.75 + 0.25 * Math.sin(time * 1.7);
  for (let i = 0; i < 6; i++) {
    const y = VIEW_H - 1 - i * 3;
    g.globalAlpha = (0.05 - i * 0.008) * breathe;
    g.fillRect(0, y - 2, VIEW_W, 3);
  }
  g.globalAlpha = 1;

  // --- embers: rise, sway, flicker; parallax so they feel like they hang in the air
  for (let i = 0; i < EMBERS; i++) {
    const r1 = hash01(i, 1, 66);
    const r2 = hash01(i, 2, 66);
    const r3 = hash01(i, 3, 66);
    const depth = 0.7 + r3 * 0.5; // parallax factor
    const speed = 9 + r2 * 20;
    const spanX = VIEW_W + 40;
    const spanY = VIEW_H + 40;
    const sway = Math.sin(time * (0.8 + r1 * 1.4) + i) * (4 + r2 * 6);
    let sx = (r1 * 997 - camX * depth + sway + time * (3 + r3 * 5)) % spanX;
    if (sx < 0) sx += spanX;
    let sy = (r2 * 991 - camY * depth - time * speed) % spanY;
    if (sy < 0) sy += spanY;
    sx = Math.round(sx - 20);
    sy = Math.round(sy - 20);
    if (sy < 10) continue; // fade out before reaching the HUD
    const flick = hash01(i, Math.floor(time * (6 + r3 * 6)), 67);
    if (flick < 0.12) continue;
    const c = EMBER_COLORS[(i + (flick < 0.5 ? 0 : 1)) % EMBER_COLORS.length];
    g.globalAlpha = sy < 40 ? (sy - 10) / 30 : 1;
    g.fillStyle = c;
    g.fillRect(sx, sy, 1, 1);
    if (r3 > 0.72) {
      // a brighter, bigger ember with a short dim tail
      g.fillRect(sx + 1, sy, 1, 1);
      g.globalAlpha *= 0.45;
      g.fillRect(sx, sy + 1, 1, 2);
    } else if (r3 > 0.4) {
      g.globalAlpha *= 0.4;
      g.fillRect(sx, sy + 1, 1, 1);
    }
  }
  g.globalAlpha = 1;

  // --- alarm pulse: a red wash from the top that swells and fades
  const late = camX >= alarmFrom(level);
  const period = late ? 4.2 : 11;
  const ph = (time % period) / period;
  const len = late ? 0.3 : 0.12;
  if (ph < len) {
    const k = Math.sin((ph / len) * Math.PI);
    const peak = (late ? 0.13 : 0.08) * (settings.flashes ? 1 : 0.5);
    g.fillStyle = '#ff2010';
    for (let y = 0; y < VIEW_H; y += 4) {
      g.globalAlpha = peak * k * (1 - (y / VIEW_H) * 0.7);
      g.fillRect(0, y, VIEW_W, 4);
    }
    g.globalAlpha = 1;
  }
}
