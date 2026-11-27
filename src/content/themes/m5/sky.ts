// STORMFRONT background (screen space, drawn behind the world):
//   sky gradient (indigo -> violet -> glowing dusk horizon)
//   far storm towers (cumulonimbus with flat anvils and rain shafts) that light up from inside
//     with lightning flashes, plus the occasional distant bolt
//   a distant Legion fleet (tiny airship silhouettes with lit windows) and, late in the mission,
//     the flagship's silhouette looming on the horizon
//   mid cloud banks, then the cloud sea far below (the level's "floor").
// Every image is procedural PixelArt baked once; per frame only drawImage calls are made.

import { PixelArt, mixColor } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { bandedGradient } from '../../../art/textures';
import type { LevelDef } from '../../../game/level';
import type { ParallaxLayer } from '../../../game/theme';
import { P5 } from './palette';

// ------------------------------------------------------------------ helpers

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold (0..1) at a pixel. */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Cheap deterministic hash -> [0, 1). */
export function hash1(n: number): number {
  let t = (n * 0x9e3779b1) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Pick from a color ramp with ordered dithering between steps. t in 0..1. */
function ramp(colors: readonly string[], t: number, x: number, y: number): string {
  const s = Math.max(0, Math.min(0.9999, t)) * (colors.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  return f > bayer(x, y) ? colors[Math.min(colors.length - 1, i + 1)] : colors[i];
}

interface Puff {
  x: number;
  y: number;
  r: number;
}

// ------------------------------------------------------------------ storm towers

export interface Tower {
  /** Left x inside the layer period. */
  x: number;
  /** Top y (screen, at the base camera height). */
  y: number;
  body: PixelArt;
  lit: PixelArt;
  /** Flash centre inside the image (bolt start). */
  fx: number;
  fy: number;
}

/** One cumulonimbus: a puffy column on a broad base, a flat anvil top and a rain shaft below. */
function makeTower(w: number, h: number, seed: number, shaftH: number): { body: PixelArt; lit: PixelArt; fx: number; fy: number } {
  const r = new Rng(seed);
  const H = h + shaftH;
  const body = new PixelArt(w, H);
  const baseY = h - 8;
  const cx = w * r.range(0.36, 0.5);
  const puffs: Puff[] = [];
  // Broad dark base.
  const baseW = w * r.range(0.55, 0.72);
  for (let i = 0; i < 8; i++) puffs.push({ x: cx - baseW / 2 + (i / 7) * baseW + r.range(-4, 4), y: baseY - r.range(0, 7), r: r.range(8, 13) });
  // Column of billows, leaning downwind (right) as it rises.
  const anvilY = h * r.range(0.2, 0.3);
  let y = baseY - 14;
  while (y > anvilY + 10) {
    const k = (baseY - y) / (baseY - anvilY);
    const rad = 12 + k * 9 + r.range(-2, 2);
    const x = cx + k * w * 0.08 + r.range(-5, 5);
    puffs.push({ x, y, r: rad });
    puffs.push({ x: x - rad * r.range(0.6, 0.9), y: y + r.range(2, 6), r: rad * r.range(0.55, 0.75) });
    puffs.push({ x: x + rad * r.range(0.6, 0.9), y: y + r.range(2, 6), r: rad * r.range(0.55, 0.75) });
    y -= rad * 0.62;
  }
  // Anvil: spreads far downwind with a flat top.
  const aL = cx - w * r.range(0.22, 0.3);
  const aR = Math.min(w - 8, cx + w * r.range(0.42, 0.52));
  for (let i = 0; i <= 10; i++) puffs.push({ x: aL + (i / 10) * (aR - aL), y: anvilY + 6 + r.range(-2, 3) + (i > 7 ? (i - 7) * 1.5 : 0), r: r.range(6, 10) * (i > 8 ? 0.7 : 1) });
  const flatTop = anvilY - 2;
  // Paint bottom-up so higher billows overlap lower ones (puffy layering).
  puffs.sort((a, b) => b.y - a.y);
  for (const pf of puffs) {
    const t = 1 - Math.max(0, Math.min(1, (pf.y - anvilY) / (baseY - anvilY)));
    const shadeC = mixColor(P5.towerDeep, P5.towerShade, t);
    const bodyC = mixColor(P5.towerShade, P5.towerBody, 0.4 + t * 0.6);
    const lightC = mixColor(P5.towerBody, P5.towerLight, 0.3 + t * 0.7);
    body.circle(pf.x, pf.y + 1, pf.r, shadeC);
    body.circle(pf.x - 0.6, pf.y - 0.6, pf.r - 1.2, bodyC);
    body.circle(pf.x - pf.r * 0.32, pf.y - pf.r * 0.36, pf.r * 0.5, lightC);
  }
  // Flatten the anvil top and give it a warm sunset rim.
  for (let x = 0; x < w; x++) {
    for (let yy = 0; yy < flatTop; yy++) body.setRaw(x, yy, 0);
  }
  for (let x = 0; x < w; x++) {
    let top = -1;
    for (let yy = 0; yy < H; yy++) {
      if (body.opaque(x, yy)) {
        top = yy;
        break;
      }
    }
    if (top < 0 || top > baseY - 6) continue;
    const hot = top <= flatTop + 1;
    body.px(x, top, hot ? P5.towerRimHot : P5.towerRim);
    if (body.opaque(x, top + 1)) body.px(x, top + 1, hot ? P5.towerRim : P5.towerLight);
  }
  // Rain shaft under part of the base: thin dithered streaks fading out downward.
  const s0 = cx - baseW * r.range(0.3, 0.42);
  const s1 = cx + baseW * r.range(0.05, 0.25);
  for (let x = Math.floor(s0); x < s1; x++) {
    if ((x * 7 + seed) % 3 === 0) continue;
    for (let yy = baseY + 2; yy < H; yy++) {
      if (body.opaque(x, yy)) continue;
      const fade = (yy - baseY) / (H - baseY);
      if (((x + yy * 3) & 3) === 0 && fade < bayer(x, yy) * 1.2) body.px(x, yy, P5.rainShaft);
    }
  }
  // Lightning-lit interior: only the changed pixels (drawn over the body with alpha).
  const lit = new PixelArt(w, H);
  const fx = cx + r.range(-6, 10);
  const fy = anvilY + (baseY - anvilY) * r.range(0.45, 0.7);
  const R = w * 0.42;
  const litRamp = [P5.litLow, P5.litMid, P5.litHigh, P5.litCore];
  for (let yy = 0; yy <= baseY + 6; yy++) {
    for (let x = 0; x < w; x++) {
      if (!body.opaque(x, yy)) continue;
      const d = Math.hypot((x - fx) * 0.85, yy - fy);
      const k = 1 - d / R;
      if (k <= 0) continue;
      if (k * 1.15 < bayer(x, yy) * 0.6) continue;
      lit.px(x, yy, ramp(litRamp, k * k * 1.3, x, yy));
    }
  }
  return { body, lit, fx, fy };
}

/** Layer period of the storm towers. */
export const TOWER_PERIOD = 1180;
export const TOWER_FACTOR = 0.035;

let towersCache: Tower[] | null = null;

export function stormTowers(): Tower[] {
  if (towersCache) return towersCache;
  const specs = [
    { x: 0, w: 190, h: 112, y: 46 },
    { x: 210, w: 140, h: 86, y: 74 },
    { x: 370, w: 230, h: 128, y: 32 },
    { x: 640, w: 150, h: 94, y: 66 },
    { x: 810, w: 200, h: 118, y: 42 },
    { x: 1030, w: 130, h: 80, y: 80 },
  ];
  towersCache = specs.map((s, i) => {
    const t = makeTower(s.w, s.h, 900 + i * 37, 34);
    return { x: s.x, y: s.y, ...t };
  });
  return towersCache;
}

// ------------------------------------------------------------------ distant fleet

/** Tiny airship silhouette (facing right) with lit gondola windows. */
function fleetShip(p: PixelArt, x: number, y: number, len: number, flip: boolean): void {
  const h = Math.max(4, Math.round(len * 0.24));
  const dir = flip ? -1 : 1;
  const cx = x + len / 2;
  p.ellipse(cx, y, len / 2, h / 2, P5.fleet);
  p.hline(Math.round(cx - len * 0.36), Math.round(cx + len * 0.3), Math.round(y - h / 2), P5.fleetTop);
  // Fins at the tail.
  const tx = cx - (dir * len) / 2;
  p.poly([tx + dir * 3, y - 1, tx - dir * 1, y - h * 0.9, tx - dir * 1, y + h * 0.9], P5.fleet);
  // Gondola + windows.
  const gw = Math.max(4, Math.round(len * 0.3));
  p.rect(Math.round(cx - gw / 2 + dir * 2), Math.round(y + h / 2), gw, 2, P5.fleet);
  for (let i = 1; i < gw - 1; i += 3) p.px(Math.round(cx - gw / 2 + dir * 2) + i, Math.round(y + h / 2), i % 2 ? P5.fleetLight : P5.fleetLightDim);
  // Nav light.
  p.px(Math.round(cx + (dir * len) / 2 - dir), Math.round(y), P5.red);
}

export const FLEET_PERIOD = 1400;
export const FLEET_FACTOR = 0.075;

export function fleetLayer(): PixelArt {
  const p = new PixelArt(FLEET_PERIOD, 90);
  const r = new Rng(77);
  const ships = [
    [60, 30, 34],
    [250, 58, 20],
    [420, 18, 44],
    [640, 70, 16],
    [760, 40, 28],
    [980, 24, 22],
    [1120, 62, 38],
    [1300, 36, 18],
  ];
  for (const [x, y, len] of ships) fleetShip(p, x, y, len, r.chance(0.3));
  return p;
}

/** The flagship's silhouette on the horizon (approach to the boss). Facing left. */
export function flagshipSilhouette(): PixelArt {
  const w = 120;
  const h = 44;
  const p = new PixelArt(w, h);
  const cx = 62;
  const cy = 18;
  p.ellipse(cx, cy, 52, 14, P5.fleet);
  p.hline(cx - 40, cx + 36, cy - 14, P5.fleetTop);
  p.hline(cx - 30, cx + 28, cy - 13, P5.fleetTop);
  // Tail fins (right, since it faces left).
  p.poly([cx + 46, cy - 2, cx + 58, cy - 16, cx + 60, cy - 2], P5.fleet);
  p.poly([cx + 46, cy + 2, cx + 58, cy + 15, cx + 60, cy + 2], P5.fleet);
  // Gondola and lit bridge.
  p.rect(cx - 30, cy + 12, 44, 7, P5.fleet);
  p.poly([cx - 30, cy + 12, cx - 36, cy + 16, cx - 30, cy + 19], P5.fleet);
  for (let i = 0; i < 9; i++) p.px(cx - 26 + i * 4, cy + 15, i % 3 === 1 ? P5.fleetLightDim : P5.fleetLight);
  // Turret bumps and mast.
  p.circle(cx - 12, cy - 14, 2.5, P5.fleet);
  p.circle(cx + 14, cy - 14, 2.5, P5.fleet);
  p.vline(cx + 2, cy - 22, cy - 14, P5.fleet);
  p.px(cx + 2, cy - 23, P5.red);
  // Engine pods.
  p.rect(cx + 30, cy - 4, 10, 5, P5.fleet);
  p.rect(cx + 30, cy + 11, 10, 5, P5.fleet);
  return p;
}

// ------------------------------------------------------------------ cloud banks

/** Tileable band of lumpy cloud banks (transparent above). */
function cloudBank(w: number, h: number, seed: number, cols: { shade: string; body: string; light: string; rim: string }, count: number, minY: number, maxY: number): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i++) {
    const cx = r.range(0, w);
    const cy = r.range(minY, maxY);
    const n = r.int(4, 8);
    const spread = r.range(5, 8);
    for (let j = 0; j < n; j++) {
      const k = j - (n - 1) / 2;
      puffs.push({ x: cx + k * spread, y: cy + Math.abs(k) * 1.2 + r.range(-1.5, 1.5), r: r.range(5, 10) - Math.abs(k) * 0.5 });
    }
    // Flat underside.
    puffs.push({ x: cx, y: cy + 6, r: 0 });
  }
  puffs.sort((a, b) => b.y - a.y);
  for (const pf of puffs) {
    if (pf.r <= 0) continue;
    for (const o of [-w, 0, w]) {
      p.circle(pf.x + o, pf.y + 1.5, pf.r, cols.shade);
      p.circle(pf.x + o - 0.5, pf.y - 0.5, pf.r - 1.2, cols.body);
      p.circle(pf.x + o - pf.r * 0.3, pf.y - pf.r * 0.38, pf.r * 0.48, cols.light);
    }
  }
  // Rim light on the very tops.
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!p.opaque(x, y)) continue;
      p.px(x, y, cols.rim);
      break;
    }
  }
  return p;
}

export const MID_PERIOD = 720;
export const MID_FACTOR = 0.16;

export function midClouds(): PixelArt {
  return cloudBank(MID_PERIOD, 64, 31, { shade: P5.midShade, body: P5.midBody, light: P5.midLight, rim: P5.midRim }, 9, 22, 44);
}

/** The cloud sea: big lit billows on top, a dense dithered body below. */
export function cloudSea(w: number, h: number, seed: number, near: boolean): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  const top = near ? 14 : 12;
  // Body.
  for (let y = top; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (y - top) / (h - top);
      p.px(x, y, ramp([P5.seaBody, P5.seaShade, P5.seaDeep, P5.seaDeeper], Math.min(1, t * 1.6), x, y));
    }
  }
  // Billows along the top (tileable).
  const puffs: Puff[] = [];
  const n = Math.round(w / (near ? 16 : 11));
  for (let i = 0; i < n; i++) {
    const x = (i / n) * w + r.range(-4, 4);
    const big = r.chance(0.3);
    puffs.push({ x, y: top + r.range(-2, 4) + (big ? -2 : 3), r: (near ? r.range(9, 15) : r.range(6, 11)) + (big ? 3 : 0) });
  }
  // Secondary billows inside the body (depth).
  for (let i = 0; i < n * 0.7; i++) puffs.push({ x: r.range(0, w), y: top + r.range(12, 26), r: r.range(5, 9) });
  puffs.sort((a, b) => b.y - a.y);
  for (const pf of puffs) {
    const deep = pf.y > top + 10;
    for (const o of [-w, 0, w]) {
      p.circle(pf.x + o, pf.y + 1.5, pf.r, deep ? P5.seaDeep : P5.seaShade);
      p.circle(pf.x + o - 0.5, pf.y - 0.5, pf.r - 1.2, deep ? P5.seaShade : P5.seaBody);
      p.circle(pf.x + o - pf.r * 0.3, pf.y - pf.r * 0.38, pf.r * 0.52, deep ? P5.seaBody : P5.seaLight);
    }
  }
  // Warm sunset rim on the billow tops.
  for (let x = 0; x < w; x++) {
    let found = 0;
    for (let y = 0; y < h && found < 2; y++) {
      if (!p.opaque(x, y)) continue;
      p.px(x, y, found === 0 ? P5.seaRim : P5.seaLight);
      found++;
    }
  }
  return p;
}

// ------------------------------------------------------------------ lightning schedule

export interface Flash {
  /** Index of the lit tower among the visible ones (hash, resolve with modulo). */
  pick: number;
  /** 0..1 brightness this frame. */
  k: number;
  /** Draw a visible bolt this frame. */
  bolt: boolean;
  seed: number;
}

const SLOT = 0.85;

/** Lightning inside the far clouds: deterministic in time; `rate` 0..1 scales how often. */
export function flashAt(time: number, rate: number): Flash | null {
  if (rate <= 0) return null;
  const slot = Math.floor(time / SLOT);
  const h = hash1(slot * 13 + 7);
  if (h > rate * 0.42) return null;
  const start = slot * SLOT + hash1(slot * 31 + 3) * 0.35;
  const t = time - start;
  if (t < 0 || t > 0.5) return null;
  // Double flicker, then a soft decay.
  let k = 0;
  if (t < 0.05) k = 1;
  else if (t < 0.09) k = 0.25;
  else if (t < 0.16) k = 0.85;
  else k = Math.max(0, 0.6 * (1 - (t - 0.16) / 0.34));
  const bolt = hash1(slot * 17 + 1) < 0.45 && t < 0.15 && (t < 0.05 || t > 0.09);
  return { pick: Math.floor(hash1(slot * 5 + 11) * 1000), k, bolt, seed: slot };
}

/** Jagged bolt from (x, y) downward ~len px (drawn straight onto the canvas). */
function drawBolt(g: CanvasRenderingContext2D, x: number, y: number, len: number, seed: number): void {
  const pts: [number, number][] = [[x, y]];
  let cx = x;
  let cy = y;
  let i = 0;
  while (cy < y + len) {
    cx += (hash1(seed * 97 + i * 13) - 0.5) * 9;
    cy += 4 + hash1(seed * 53 + i * 7) * 6;
    pts.push([Math.round(cx), Math.round(cy)]);
    i++;
  }
  const seg = (c: string, dx: number, a: number) => {
    g.globalAlpha = a;
    g.fillStyle = c;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[k + 1];
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let s = 0; s <= n; s++) g.fillRect(Math.round(ax + ((bx - ax) * s) / n) + dx, Math.round(ay + ((by - ay) * s) / n), 1, 1);
    }
  };
  seg(P5.boltGlow, -1, 0.35);
  seg(P5.boltGlow, 1, 0.35);
  seg(P5.bolt, 0, 0.9);
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ renderer

interface Cache {
  sky: HTMLCanvasElement;
  towers: { body: HTMLCanvasElement; lit: HTMLCanvasElement }[];
  flagship: HTMLCanvasElement;
  layers: HTMLCanvasElement[];
}

let cache: Cache | null = null;
let cachedLayers: ParallaxLayer[] | null = null;

function ensure(layers: ParallaxLayer[]): Cache {
  if (cache && cachedLayers === layers) return cache;
  cachedLayers = layers;
  cache = {
    sky: bandedGradient(4, VIEW_H, [...P5.sky], 27).toCanvas(),
    towers: stormTowers().map((t) => ({ body: t.body.toCanvas(), lit: t.lit.toCanvas() })),
    flagship: flagshipSilhouette().toCanvas(),
    layers: layers.map((L) => {
      const a = L.art();
      return a instanceof PixelArt ? a.toCanvas() : a;
    }),
  };
  return cache;
}

/** Boss lock x of the level (or Infinity). */
export function bossLockX(level: LevelDef): number {
  const l = level.locks?.find((k) => k.boss);
  return l ? l.x : Infinity;
}

/**
 * Storm intensity 0..1 along the mission: builds up to the storm front around 70% of the way,
 * eases off for the calm approach, and stays moderate (subtle) in the boss arena.
 */
export function stormLevel(camX: number, level: LevelDef): number {
  const end = bossLockX(level);
  if (!isFinite(end)) return 0.6;
  const t = camX / end;
  if (t < 0.12) return 0.35;
  if (t < 0.55) return 0.35 + ((t - 0.12) / 0.43) * 0.4;
  if (t < 0.8) return 0.75 + ((t - 0.55) / 0.25) * 0.25;
  if (t < 0.9) return 1 - ((t - 0.8) / 0.1) * 0.6;
  return 0.4;
}

/** The ThemeRenderer's parallax math for one declared layer. */
function drawLayer(g: CanvasRenderingContext2D, L: ParallaxLayer, c: HTMLCanvasElement, camX: number, camY: number, time: number, baseY: number): void {
  const yF = L.yFactor ?? L.factor * 0.6;
  const y = Math.round(L.y - (camY - (L.baseY ?? baseY)) * yF);
  let off = -(camX * L.factor + time * (L.speed ?? 0));
  if (L.alpha !== undefined) g.globalAlpha = L.alpha;
  if (L.repeat === false) g.drawImage(c, Math.round(off), y);
  else {
    off = (((off % c.width) + c.width) % c.width) - c.width;
    for (let x = Math.round(off); x < VIEW_W; x += c.width) g.drawImage(c, x, y);
  }
  g.globalAlpha = 1;
}

/**
 * Full background: sky bands, far storm towers with lightning, then the theme's declared parallax
 * layers (far fleet, mid clouds, cloud sea x2) with the flagship silhouette after the first one.
 */
export function renderStormBackground(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef, layers: ParallaxLayer[]): void {
  const C = ensure(layers);
  const baseY = Math.max(0, level.height - VIEW_H);
  const dy = camY - baseY;
  g.drawImage(C.sky, 0, 0, VIEW_W, VIEW_H);
  const storm = stormLevel(camX, level);

  // Far storm towers (+ lightning).
  const towers = stormTowers();
  const tOff = -(camX * TOWER_FACTOR + time * 0.6);
  const ty = -dy * 0.05;
  const visible: { i: number; sx: number; sy: number }[] = [];
  const base = Math.floor(-tOff / TOWER_PERIOD) - 1;
  for (let k = base; k <= base + 2; k++) {
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const sx = Math.round(t.x + k * TOWER_PERIOD + tOff);
      if (sx > VIEW_W || sx + t.body.w < 0) continue;
      const sy = Math.round(t.y + ty);
      g.drawImage(C.towers[i].body, sx, sy);
      visible.push({ i, sx, sy });
    }
  }
  const fl = flashAt(time, storm);
  if (fl && visible.length) {
    const v = visible[fl.pick % visible.length];
    const t = towers[v.i];
    g.globalAlpha = fl.k * 0.9;
    g.drawImage(C.towers[v.i].lit, v.sx, v.sy);
    g.globalAlpha = 1;
    if (fl.bolt) drawBolt(g, v.sx + Math.round(t.fx), v.sy + Math.round(t.fy), Math.round(t.body.h - t.fy - 10), fl.seed);
  }

  layers.forEach((L, i) => {
    drawLayer(g, L, C.layers[i], camX, camY, time, baseY);
    if (i !== 0) return;
    // The flagship looms on the horizon during the approach, then hides in the clouds.
    const bx = bossLockX(level);
    if (!isFinite(bx)) return;
    const from = bx - 1500;
    if (camX <= from || camX >= bx + 40) return;
    const a = Math.min(1, (camX - from) / 240) * Math.min(1, Math.max(0, (bx - 160 - camX) / 300));
    if (a <= 0.02) return;
    g.globalAlpha = a;
    g.drawImage(C.flagship, Math.round(300 - (camX - from) * 0.05), Math.round(96 - dy * 0.08));
    g.globalAlpha = 1;
  });
}
