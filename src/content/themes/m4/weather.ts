// Mission 4 sky, parallax and weather (screen space).
//  - Background: banded dusk sky, drifting storm clouds (a lightning-lit copy cross-fades in during
//    a strike), a far skyline, the harbour mid-ground and the near rooftops. Red aviation beacons
//    blink and the near lamp posts flicker; a lightning bolt now and then.
//  - Overlay: wind-driven rain streaks in three depths, splash crowns on the ground and solid tops,
//    ripple rings on the water, and a gentle lightning brightening (off with the FLASHES option).
// Canvases are created lazily on first render (never at import time).

import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { PixelArt } from '../../../engine/pixelart';
import { settings } from '../../../engine/storage';
import type { LevelDef } from '../../../game/level';
import { bandedGradient } from '../../../art/textures';
import { P4, cloudArt, skylineArt, harbourArt, nearArt, hash01, type LightSpot } from './art';

interface BgLayer {
  make: () => { art: PixelArt; lights: LightSpot[] };
  factor: number;
  y: number;
  speed?: number;
  canvas?: HTMLCanvasElement;
  lights?: LightSpot[];
}

const layers: BgLayer[] = [
  { make: () => ({ art: skylineArt().art, lights: skylineArt().lights }), factor: 0.07, y: 70 },
  { make: () => harbourArt(), factor: 0.17, y: 66 },
  { make: () => nearArt(), factor: 0.4, y: 98 },
];

let skyCanvas: HTMLCanvasElement | null = null;
let cloudCanvas: HTMLCanvasElement | null = null;
let cloudLitCanvas: HTMLCanvasElement | null = null;

// ------------------------------------------------------------------ lightning

const STRIKE_FIRST = 7;
const STRIKE_EVERY = 14;

/** Lightning brightness 0..1 at time t (deterministic schedule: one strike every ~14-20 s). */
export function lightning(t: number): { k: number; amount: number; age: number } {
  const n = Math.floor((t - STRIKE_FIRST) / STRIKE_EVERY);
  for (const k of [n, n - 1]) {
    if (k < 0) continue;
    const t0 = STRIKE_FIRST + k * STRIKE_EVERY + hash01(k, 3) * 6;
    const a = t - t0;
    if (a < 0 || a > 0.9) continue;
    let amount: number;
    if (a < 0.05) amount = 1;
    else if (a < 0.1) amount = 0.3;
    else if (a < 0.16) amount = 0.85;
    else amount = 0.6 * Math.exp(-(a - 0.16) * 6);
    return { k, amount, age: a };
  }
  return { k: -1, amount: 0, age: 0 };
}

function drawBolt(g: CanvasRenderingContext2D, k: number, age: number): void {
  if (age > 0.24) return;
  let x = 40 + hash01(k, 11) * (VIEW_W - 80);
  let y = 24;
  const pts: [number, number][] = [[x, y]];
  let i = 0;
  while (y < 104) {
    y += 5 + hash01(k, 20 + i) * 7;
    x += (hash01(k, 50 + i) - 0.5) * 16;
    pts.push([x, y]);
    i++;
  }
  const flick = age < 0.05 || (age > 0.1 && age < 0.16) ? 1 : 0.45;
  g.globalAlpha = 0.35 * flick;
  g.fillStyle = '#9a88ff';
  for (const [px, py] of pts) g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
  g.globalAlpha = flick;
  g.fillStyle = '#f4eeff';
  for (let j = 0; j < pts.length - 1; j++) {
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[j + 1];
    const steps = Math.max(1, Math.ceil(Math.abs(y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const tt = s / steps;
      g.fillRect(Math.round(x0 + (x1 - x0) * tt), Math.round(y0 + (y1 - y0) * tt), 1, 1);
    }
  }
  // A short fork.
  const [fx, fy] = pts[Math.min(2, pts.length - 1)];
  for (let s = 0; s < 10; s++) g.fillRect(Math.round(fx + s * 0.8), Math.round(fy + s), 1, 1);
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ background

function tiled(g: CanvasRenderingContext2D, c: HTMLCanvasElement, off: number, y: number): number {
  const o = ((off % c.width) + c.width) % c.width - c.width;
  for (let x = Math.round(o); x < VIEW_W; x += c.width) g.drawImage(c, x, y);
  return o;
}

export function renderM4Background(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  if (!skyCanvas) skyCanvas = bandedGradient(4, VIEW_H, [...P4.sky], 26).toCanvas();
  g.drawImage(skyCanvas, 0, 0, VIEW_W, VIEW_H);
  const baseY = Math.max(0, level.height - VIEW_H);
  const dy = camY - baseY;
  const flash = lightning(time);
  const strike = flash.amount > 0;
  if (strike) {
    g.globalAlpha = 0.14 * flash.amount * (settings.flashes ? 1 : 0.5);
    g.fillStyle = '#b0a0e8';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;
    drawBolt(g, flash.k, flash.age);
  }
  // Clouds (with the lit copy cross-faded in during a strike).
  if (!cloudCanvas) cloudCanvas = cloudArt(false).toCanvas();
  const cy = Math.round(-2 - dy * 0.02);
  const coff = -(camX * 0.03 + time * 4);
  tiled(g, cloudCanvas, coff, cy);
  if (strike) {
    if (!cloudLitCanvas) cloudLitCanvas = cloudArt(true).toCanvas();
    g.globalAlpha = flash.amount * (settings.flashes ? 0.85 : 0.4);
    tiled(g, cloudLitCanvas, coff, cy);
    g.globalAlpha = 1;
  }
  // Skyline, harbour, near rooftops (+ their blinking lights).
  for (const L of layers) {
    if (!L.canvas) {
      const made = L.make();
      L.canvas = made.art.toCanvas();
      L.lights = made.lights;
    }
    const y = Math.round(L.y - dy * L.factor * 0.6);
    const o = tiled(g, L.canvas, -camX * L.factor, y);
    for (const s of L.lights ?? []) {
      let a: number;
      if (s.period > 0) {
        const ph = (time + s.phase) % s.period;
        a = ph < 0.22 ? 1 : 0;
      } else {
        // Lamps: steady with a rare flicker.
        const n = Math.floor(time * 9 + s.phase * 13);
        a = hash01(n, Math.round(s.phase * 100)) < 0.03 ? 0.3 : 0.9;
      }
      if (a <= 0) continue;
      for (let x = Math.round(o) + s.x; x < VIEW_W + 4; x += L.canvas.width) {
        if (x < -4) continue;
        g.globalAlpha = 0.3 * a;
        g.fillStyle = s.color;
        g.fillRect(x - 1, y + s.y - 1, 3, 3);
        g.globalAlpha = a;
        g.fillRect(x, y + s.y, 1, 1);
      }
      g.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------------ surfaces (for splashes)

interface SurfaceMap {
  top: Float32Array;
  water: Float32Array;
}

const surfCache = new WeakMap<LevelDef, SurfaceMap>();

/** Top-most static surface (ground, solid, platform) and water surface per world x. */
export function surfaceMap(def: LevelDef): SurfaceMap {
  let m = surfCache.get(def);
  if (m) return m;
  const W = Math.ceil(def.width) + 1;
  const top = new Float32Array(W).fill(Infinity);
  const water = new Float32Array(W).fill(Infinity);
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    for (let x = Math.max(0, Math.ceil(x1)); x < Math.min(W, x2); x++) {
      const y = x2 === x1 ? y1 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
      if (y < top[x]) top[x] = y;
    }
  };
  for (const line of def.ground) for (let i = 0; i < line.length - 1; i++) if (line[i + 1][0] > line[i][0]) seg(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
  for (const s of def.solids ?? []) seg(s.x, s.y, s.x + s.w, s.y);
  for (const p of def.platforms ?? []) seg(p.x, p.y, p.x + p.w, p.y2 ?? p.y);
  for (const w of def.water ?? []) for (let x = Math.max(0, Math.ceil(w.x)); x < Math.min(W, w.x + w.w); x++) if (w.y < water[x]) water[x] = w.y;
  m = { top, water };
  surfCache.set(def, m);
  return m;
}

// ------------------------------------------------------------------ overlay

interface DropClass {
  n: number;
  len: number;
  vy: number;
  par: number;
  alpha: number;
}

const DROPS: DropClass[] = [
  { n: 44, len: 3, vy: 250, par: 0.35, alpha: 0.16 },
  { n: 34, len: 5, vy: 330, par: 0.65, alpha: 0.24 },
  { n: 20, len: 8, vy: 430, par: 1, alpha: 0.32 },
];
const WIND = -0.26;
const RAIN = '#bcc8ec';

export function renderM4Overlay(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  // Rain streaks.
  const span = VIEW_H + 16;
  g.fillStyle = RAIN;
  DROPS.forEach((c, ci) => {
    g.globalAlpha = c.alpha;
    for (let i = 0; i < c.n; i++) {
      const hx = hash01(i, ci, 17);
      const hy = hash01(i, ci, 29);
      const v = c.vy * (0.85 + hash01(i, ci, 41) * 0.3);
      let y = (hy * span + time * v - camY * c.par) % span;
      if (y < 0) y += span;
      y -= 12;
      let x = (hx * (VIEW_W + 40) + time * v * WIND - camX * c.par) % (VIEW_W + 40);
      if (x < 0) x += VIEW_W + 40;
      x -= 20;
      const xi = Math.round(x);
      const yi = Math.round(y);
      const h1 = Math.ceil(c.len / 2);
      g.fillRect(xi, yi, 1, h1);
      g.fillRect(xi - 1, yi + h1, 1, c.len - h1);
    }
  });
  g.globalAlpha = 1;
  // Splash crowns on surfaces and ripples on the water.
  const m = surfaceMap(level);
  const RATE = 34;
  const LIFE = 0.18;
  const s0 = Math.floor((time - LIFE) * RATE);
  const s1 = Math.floor(time * RATE);
  for (let s = s0; s <= s1; s++) {
    for (let j = 0; j < 2; j++) {
      const age = time - s / RATE - j * 0.013;
      if (age < 0 || age > LIFE) continue;
      const ph = age / LIFE;
      const sx = Math.floor(hash01(s, j, 5) * VIEW_W);
      const wx = Math.floor(camX + sx);
      if (wx < 0 || wx >= m.top.length) continue;
      const top = m.top[wx];
      const wat = m.water[wx];
      if (wat < top) {
        // Ripple ring on the water.
        const sy = Math.round(wat - camY);
        if (sy < 34 || sy > VIEW_H) continue;
        const r = 1 + Math.round(ph * 4);
        g.globalAlpha = 0.5 * (1 - ph);
        g.fillStyle = '#9ab4d8';
        g.fillRect(sx - r - 1, sy, 2, 1);
        g.fillRect(sx + r, sy, 2, 1);
        if (ph < 0.3) g.fillRect(sx, sy - 1, 1, 1);
      } else if (isFinite(top)) {
        const sy = Math.round(top - camY);
        if (sy < 34 || sy > VIEW_H) continue;
        g.globalAlpha = 0.6 * (1 - ph * 0.7);
        g.fillStyle = '#d0daf2';
        if (ph < 0.45) {
          g.fillRect(sx, sy - 1, 1, 1);
          g.fillRect(sx - 1, sy - 2, 1, 1);
          g.fillRect(sx + 1, sy - 2, 1, 1);
        } else {
          g.fillRect(sx - 2, sy - 2, 1, 1);
          g.fillRect(sx + 2, sy - 2, 1, 1);
          g.fillRect(sx - 1, sy - 3, 1, 1);
          g.fillRect(sx + 1, sy - 3, 1, 1);
        }
      }
    }
  }
  g.globalAlpha = 1;
  // Lightning brightening (gentle; only with the FLASHES option).
  const fl = lightning(time);
  if (fl.amount > 0 && settings.flashes) {
    g.globalAlpha = 0.12 * fl.amount;
    g.fillStyle = '#dcd4ff';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;
  }
}
