// STORMFRONT background (screen space, drawn behind the world):
//   sky gradient (indigo -> violet -> glowing dusk horizon)
//   far storm towers (cumulonimbus with flat anvils and rain shafts) that light up from inside
//     with lightning flashes, plus the occasional distant bolt
//   a distant Legion fleet (tiny airship silhouettes with lit windows) and, late in the mission,
//     the flagship's silhouette looming on the horizon
//   mid cloud banks, then the cloud sea far below (the level's "floor").
// Clouds are volumetric blob clouds (clouds.ts): each billow is a shaded dome, masses get volume
// light from the top-left, self-shadowing, warm dusk glow underneath and lit rims.
// Every image is procedural PixelArt baked once; per frame only drawImage calls are made.

import { PixelArt } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { settings } from '../../../engine/storage';
import { bandedGradient } from '../../../art/textures';
import type { LevelDef } from '../../../game/level';
import type { ParallaxLayer } from '../../../game/theme';
import { P5 } from './palette';
import { cloudArt, cloudField, paintCloud, type Blob, type CloudLook } from './clouds';

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

/** Far storm-tower shading: cool top-left light, warm dusk glow on the undersides. */
const TOWER_LOOK: CloudLook = {
  ramp: [P5.towerDeep, P5.towerShade, P5.towerBody, P5.towerMid, P5.towerLight, P5.towerRim],
  ambient: 0.12,
  shadow: 0.3,
  glow: [P5.towerGlow1, P5.towerGlow2],
  glowDepth: 8,
  rim: P5.towerRim,
  heightLight: 0.1,
  volume: 16,
  volumeMix: 0.6,
};

/**
 * One cumulonimbus: a broad flat-bottomed skirt, a massive column of billows widening and leaning
 * downwind as it rises, a thick anvil spreading downwind with a flat top that catches the last
 * sunlight, and a rain shaft below.
 */
function makeTower(w: number, h: number, seed: number, shaftH: number): { body: PixelArt; lit: PixelArt; fx: number; fy: number } {
  const r = new Rng(seed);
  const H = h + shaftH;
  const baseY = h - 6;
  const cx = w * r.range(0.34, 0.42);
  const anvilY = h * r.range(0.2, 0.26);
  const flatTop = Math.round(anvilY - r.range(6, 9));
  const blobs: Blob[] = [];
  const S = Math.min(1.15, Math.max(0.7, h / 118));
  // Skirt: broad flattened billows, bottoms cut flat.
  const baseW = w * r.range(0.56, 0.7);
  const nb = Math.max(4, Math.round(baseW / 18));
  for (let i = 0; i < nb; i++) {
    const t = i / (nb - 1);
    const rad = r.range(12, 16) * S * (1.05 - Math.abs(t - 0.42) * 0.6);
    blobs.push({ x: cx - baseW / 2 + t * baseW + r.range(-3, 3), y: baseY - rad * 0.2, r: rad * 1.25, ry: rad * 0.8, z: r.range(0, 2), cut: baseY });
  }
  // Column: big billows, widening toward the top and leaning downwind (right).
  let y = baseY - 10 * S;
  let topX = cx;
  while (y > anvilY + 4) {
    const k = (baseY - y) / (baseY - anvilY);
    const rad = (13 + k * 9) * S + r.range(-1.5, 1.5);
    const x = cx + k * k * w * 0.1 + r.range(-2, 2);
    topX = x;
    blobs.push({ x, y, r: rad, z: 4 + r.range(0, 2) });
    blobs.push({ x: x - rad * r.range(0.6, 0.8), y: y + rad * 0.25, r: rad * r.range(0.62, 0.78), z: r.range(0, 2) });
    blobs.push({ x: x + rad * r.range(0.6, 0.8), y: y + rad * 0.3, r: rad * r.range(0.58, 0.72), z: r.range(0, 2) });
    y -= rad * 0.58;
  }
  // Anvil: a thick wedge spreading downwind from the column top, thinning toward the tip, with a
  // flat top (cut below) and a few lobes hanging under it.
  const aL = topX - w * r.range(0.2, 0.26);
  const aR = Math.min(w - 5, topX + w * r.range(0.44, 0.52));
  const na = Math.max(5, Math.round((aR - aL) / 12));
  for (let i = 0; i <= na; i++) {
    const t = i / na;
    const dCol = Math.abs(aL + t * (aR - aL) - topX) / (aR - aL);
    const thick = 1.15 - dCol * 1.25;
    const rx = r.range(15, 19) * S * Math.max(0.4, 1 - Math.max(0, t - 0.7) * 1.6);
    const ry = Math.max(4, rx * 0.62 * Math.max(0.35, thick));
    blobs.push({ x: aL + t * (aR - aL), y: anvilY + 2 - ry * 0.25 + t * 2, r: rx, ry, z: 8 });
    if (t > 0.35 && t < 0.8 && r.chance(0.6)) blobs.push({ x: aL + t * (aR - aL) + r.range(-4, 4), y: anvilY + ry * 0.55 + 2, r: r.range(4, 6) * S, z: 7 });
  }
  // Overshooting top: a dome punching up through the flat anvil above the updraft.
  blobs.push({ x: topX + r.range(-4, 6), y: flatTop + 2, r: r.range(9, 12) * S, ry: r.range(7, 9) * S, z: 12 });
  const field = cloudField(w, H, blobs, false);
  // Flat anvil top (except the overshooting dome).
  const dome = blobs[blobs.length - 1];
  for (let yy = 0; yy < flatTop; yy++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - dome.x) / dome.r;
      const v = (yy + 0.5 - dome.y) / (dome.ry ?? dome.r);
      if (u * u + v * v >= 1) field.hgt[yy * w + x] = -1e9;
    }
  const body = new PixelArt(w, H);
  paintCloud(body, field, TOWER_LOOK);
  // The flat top catches the sunset (hot rim), the rest of the silhouette top a softer rim.
  for (let x = 0; x < w; x++) {
    for (let yy = flatTop; yy < baseY; yy++) {
      if (!body.opaque(x, yy)) continue;
      if (yy <= flatTop + 1) {
        body.px(x, yy, P5.towerRimHot);
        if (body.opaque(x, yy + 1) && (x + yy) % 3 !== 0) body.px(x, yy + 1, P5.towerRim);
      }
      break;
    }
  }
  // Rain shaft under part of the base: slanted streaks fading out downward.
  const s0 = Math.floor(cx - baseW * r.range(0.32, 0.44));
  const s1 = Math.floor(cx + baseW * r.range(0.04, 0.22));
  for (let x = s0; x < s1; x++) {
    for (let yy = baseY + 1; yy < H; yy++) {
      if (body.opaque(x, yy)) continue;
      const fade = (yy - baseY) / (H - baseY);
      const lane = (x * 2 + Math.floor(yy / 3)) % 5;
      if (lane === 0 && fade < bayer(x, yy) * 1.15 + 0.08) body.px(x, yy, fade < 0.35 ? P5.rainShaftL : P5.rainShaft);
    }
  }
  // Lightning-lit interior (drawn over the body with alpha): domes glow around the flash point.
  const lit = new PixelArt(w, H);
  const fx = cx + r.range(-6, 10);
  const fy = anvilY + (baseY - anvilY) * r.range(0.45, 0.68);
  const R = w * 0.44;
  const litRamp = [P5.litLow, P5.litMid, P5.litHigh, P5.litCore];
  for (let yy = 0; yy <= baseY + 2; yy++) {
    for (let x = 0; x < w; x++) {
      if (!body.opaque(x, yy)) continue;
      const i = yy * w + x;
      if (field.hgt[i] < -1e8) continue;
      const d = Math.hypot((x - fx) * 0.85, yy - fy);
      const k = (1 - d / R) * (0.55 + 0.45 * field.nz[i]);
      if (k <= 0.04) continue;
      if (k * 1.2 < bayer(x, yy) * 0.55) continue;
      lit.px(x, yy, ramp(litRamp, k * k * 1.45, x, yy));
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
    { x: 0, w: 196, h: 118, y: 40 },
    { x: 220, w: 136, h: 84, y: 76 },
    { x: 372, w: 236, h: 134, y: 24 },
    { x: 646, w: 150, h: 94, y: 66 },
    { x: 812, w: 206, h: 122, y: 36 },
    { x: 1036, w: 128, h: 80, y: 82 },
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

const MID_LOOK: CloudLook = {
  ramp: [P5.midDeep, P5.midShade, P5.midBody, P5.midLight, P5.midRim, P5.midHigh],
  ambient: 0.14,
  shadow: 0.25,
  glow: [P5.midGlow1, P5.midGlow2],
  glowDepth: 5,
  rim: P5.midHigh,
  wrap: true,
  volume: 9,
  volumeMix: 0.6,
};

/** Tileable band of flat-bottomed cumulus banks drifting at mid depth (transparent elsewhere). */
function cloudBank(w: number, h: number, seed: number, count: number, minY: number, maxY: number): PixelArt {
  const r = new Rng(seed);
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const cx = (i + r.range(0.1, 0.7)) * (w / count);
    const base = r.range(minY, maxY);
    const len = r.range(50, 116);
    const n = Math.max(3, Math.round(len / 13));
    const peak = r.range(0.3, 0.55);
    for (let j = 0; j < n; j++) {
      const t = j / (n - 1);
      const bell = 1 - Math.pow(Math.abs(t - peak) * 2, 1.5) * 0.7;
      const rad = r.range(7, 10) * bell + 3;
      blobs.push({ x: cx - len / 2 + t * len + r.range(-2, 2), y: base - rad * 0.35 - bell * r.range(2, 7), r: rad * 1.2, ry: rad * 0.85, z: r.range(0, 3), cut: base });
    }
    // A taller cauliflower head on the bigger banks.
    if (len > 72) {
      const hx = cx - len / 2 + len * peak + r.range(-6, 6);
      const hr = r.range(9, 12);
      blobs.push({ x: hx, y: base - hr - r.range(6, 10), r: hr * 1.1, ry: hr * 0.9, z: 5, cut: base });
      blobs.push({ x: hx + hr * 0.9, y: base - hr * 0.7 - 4, r: hr * 0.75, z: 3, cut: base });
    }
  }
  return cloudArt(w, h, blobs, MID_LOOK).art;
}

export const MID_PERIOD = 720;
export const MID_FACTOR = 0.16;

export function midClouds(): PixelArt {
  return cloudBank(MID_PERIOD, 64, 31, 7, 40, 58);
}

/**
 * The cloud sea far below (the level's "floor"): rows of billows, each row deeper and darker, the
 * front row's tops catching the warm horizon glow. Tileable; solid down to the bottom.
 */
export function cloudSea(w: number, h: number, seed: number, near: boolean): PixelArt {
  const r = new Rng(seed);
  const blobs: Blob[] = [];
  const top = near ? 16 : 13;
  const rows = near ? 3 : 4;
  const rowH = near ? 13 : 10;
  for (let row = 0; row < rows; row++) {
    const y = top + row * rowH;
    const step = (near ? 26 : 17) - row * 2;
    const n = Math.round(w / step);
    for (let i = 0; i < n; i++) {
      const big = r.chance(row === 0 ? 0.3 : 0.15);
      const rad = (near ? r.range(11, 15) : r.range(7.5, 10.5)) * (1 - row * 0.1) + (big ? 3 : 0);
      blobs.push({ x: (i + r.range(0.2, 0.8)) * (w / n), y: y + r.range(-2, 2) - (big ? 3 : 0) + rad * 0.3, r: rad * r.range(1.25, 1.5), ry: rad * 0.8, z: 30 - row * 8 + r.range(0, 3) });
    }
  }
  const look: CloudLook = {
    ramp: near ? [P5.seaDeeper, P5.seaDeep, P5.seaShade, P5.seaBody, P5.seaMid, P5.seaLight, P5.seaHigh] : [P5.seaDeeper, P5.seaDeep, P5.seaShade, P5.seaBody, P5.seaMid, P5.seaLight],
    ambient: 0.2,
    shadow: 0.3,
    rim: P5.seaRim,
    wrap: true,
    depthFade: near ? 0.5 : 0.4,
    volume: near ? 11 : 8,
    volumeMix: 0.55,
  };
  const field = cloudField(w, h, blobs, true);
  // Solid body below the billows: a dim plane facing slightly up.
  const bodyTop = top + (rows - 1) * rowH;
  for (let y = bodyTop; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (field.hgt[i] > -1e8) continue;
      field.hgt[i] = -30;
      field.nx[i] = 0;
      field.ny[i] = -0.25;
      field.nz[i] = 0.97;
    }
  }
  const art = new PixelArt(w, h);
  paintCloud(art, field, look);
  return art;
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

/** Peak strength of a cloud flash when the SCREEN FLASHES option is off. */
export const SOFT_FLASH = 0.3;

/**
 * Lightning inside the far clouds: deterministic in time; `rate` 0..1 scales how often.
 * `bright` (the SCREEN FLASHES option): a double flicker to full strength. Off: one soft swell
 * to SOFT_FLASH with no flicker, and the bolt stays lit instead of blinking.
 */
export function flashAt(time: number, rate: number, bright = true): Flash | null {
  if (rate <= 0) return null;
  const slot = Math.floor(time / SLOT);
  const h = hash1(slot * 13 + 7);
  if (h > rate * 0.42) return null;
  const start = slot * SLOT + hash1(slot * 31 + 3) * 0.35;
  const t = time - start;
  if (t < 0 || t > 0.5) return null;
  // Double flicker, then a soft decay.
  let k = 0;
  if (!bright) k = SOFT_FLASH * (t < 0.16 ? Math.min(1, t / 0.08) : Math.max(0, 1 - (t - 0.16) / 0.34));
  else if (t < 0.05) k = 1;
  else if (t < 0.09) k = 0.25;
  else if (t < 0.16) k = 0.85;
  else k = Math.max(0, 0.6 * (1 - (t - 0.16) / 0.34));
  const bolt = hash1(slot * 17 + 1) < 0.45 && t < 0.15 && (!bright || t < 0.05 || t > 0.09);
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
  const fl = flashAt(time, storm, settings.flashes);
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
