// Mission 2 (DUSTWIND CANYON) palette: terrain/decor colors plus the time-of-day keyframes the
// backdrop blends between as the camera moves from the canyon mouth (noon) to the salt flat (sunset).

import { mixColor } from '../../../engine/pixelart';

/** Fixed colors for terrain and props (lit from the top-left). */
export const C = {
  ink: '#140c1c',
  // sand
  sandHi: '#f4dca4',
  sandL: '#e8c890',
  sand: '#d8b27a',
  sandM: '#c89c66',
  sandD: '#b08052',
  sandDD: '#8c6040',
  // red rock strata
  rockHi: '#e8a878',
  rockL: '#d08a5e',
  rock: '#b86c48',
  rockM: '#a45c3e',
  rockD: '#884632',
  rockDD: '#683426',
  // pale sandstone (ruins)
  stoneHi: '#f6e4bc',
  stoneL: '#e8cc98',
  stone: '#d4b07c',
  stoneM: '#bc9466',
  stoneD: '#9a744e',
  stoneDD: '#74543a',
  // wood
  woodHi: '#d8a868',
  woodL: '#b88448',
  wood: '#946434',
  woodD: '#6c4424',
  woodDD: '#4a2c18',
  // steel / oil field
  steelHi: '#c4ccd0',
  steelL: '#98a2aa',
  steel: '#707c88',
  steelD: '#4c5662',
  steelDD: '#323a46',
  rustL: '#c0703c',
  rust: '#9c5230',
  rustD: '#6e3620',
  oil: '#1e1a22',
  oilHi: '#4a4258',
  // legion colors (match the enemy army: olive + rust)
  olive: '#6e7040',
  oliveL: '#8e9058',
  oliveD: '#4c4e2c',
  canvas: '#b4a47a',
  canvasL: '#d0c49a',
  canvasD: '#8c7c58',
  red: '#b83c30',
  redL: '#e0604a',
  // plants
  cactus: '#5e8a4e',
  cactusL: '#82ac64',
  cactusHi: '#a8cc80',
  cactusD: '#3e6438',
  cactusDD: '#2a4428',
  palm: '#4e7a3e',
  palmL: '#78a454',
  palmD: '#345a2c',
  dry: '#c8b060',
  dryD: '#9c8440',
  // bone
  bone: '#ece4cc',
  boneD: '#c4b898',
  boneDD: '#948a70',
  // misc
  glass: '#8cc4d0',
  glassD: '#4a7a8c',
  fire: '#ffb040',
  fireHi: '#fff0a0',
  fireD: '#e05a20',
  water: '#2e7a78',
  waterHi: '#bfe8d8',
};

/** One time-of-day keyframe for the backdrop. */
export interface Tod {
  /** Sky gradient top -> horizon. */
  sky: string[];
  /** Sun: screen-space center (camera at the level bottom), radius, colors. */
  sun: { x: number; y: number; r: number; core: string; rim: string; glow: string; stripes: boolean };
  /** Thin drifting haze/cloud streaks. */
  haze: string;
  hazeD: string;
  /** Far mesas (low contrast silhouettes). */
  far: { lit: string; base: string; shadow: string };
  /** Mid canyon walls: strata band colors (top -> bottom repeating), lit rim and shadow. */
  mid: { bands: string[]; lit: string; shadow: string; dark: string };
  /** Near rocks / dunes / silhouettes. */
  near: { lit: string; base: string; shadow: string; plant: string; plantD: string; metal: string; metalD: string };
  /** Screen tint applied over the whole world (warm light at sunset). */
  tint: string;
  tintAlpha: number;
  /** Heat shimmer strength 0..1. */
  shimmer: number;
}

const NOON: Tod = {
  sky: ['#5a88bc', '#7ea4c8', '#a8bcc4', '#d2c8a4', '#e8d4a2'],
  sun: { x: 286, y: 24, r: 7, core: '#fffbe8', rim: '#fff2c0', glow: '#f8f0d0', stripes: false },
  haze: '#eee4cc',
  hazeD: '#d4cab4',
  far: { lit: '#d8c0a8', base: '#c8aa94', shadow: '#b49884' },
  mid: { bands: ['#c08a6c', '#b47e64', '#c89678', '#a87460', '#bc8668', '#cca080'], lit: '#dcb494', shadow: '#94685a', dark: '#7e5a50' },
  near: { lit: '#b88a66', base: '#9e7052', shadow: '#82583e', plant: '#6c8a58', plantD: '#506c44', metal: '#7a7c84', metalD: '#5a5c66' },
  tint: '#ffe8b0',
  tintAlpha: 0.0,
  shimmer: 1,
};

const AFTERNOON: Tod = {
  sky: ['#5480b4', '#7c9cc0', '#b0b4b0', '#dcbc90', '#ecc890'],
  sun: { x: 262, y: 46, r: 8, core: '#fff4d0', rim: '#ffe4a0', glow: '#f8e0b0', stripes: false },
  haze: '#f0dcbc',
  hazeD: '#d8c0a4',
  far: { lit: '#d4b49c', base: '#c49e88', shadow: '#ae8a78' },
  mid: { bands: ['#bc7e60', '#ae725a', '#c68a6a', '#a26856', '#b87a5e', '#ca9474'], lit: '#dca888', shadow: '#8c5e52', dark: '#76524a' },
  near: { lit: '#b07c5a', base: '#966448', shadow: '#7a4e38', plant: '#64804e', plantD: '#4a643e', metal: '#74747e', metalD: '#55545e' },
  tint: '#ffd8a0',
  tintAlpha: 0.03,
  shimmer: 0.7,
};

const GOLDEN: Tod = {
  sky: ['#4a5c94', '#7a76a0', '#c4928a', '#eeaa70', '#f8c47a'],
  sun: { x: 236, y: 78, r: 10, core: '#ffeab0', rim: '#ffc870', glow: '#f8c890', stripes: false },
  haze: '#f4c8a0',
  hazeD: '#d8a688',
  far: { lit: '#d29c88', base: '#b88478', shadow: '#9c706a' },
  mid: { bands: ['#b46a52', '#a45e4c', '#bc7658', '#985646', '#ae6850', '#c27e5e'], lit: '#e09a70', shadow: '#7c4c48', dark: '#663e40' },
  near: { lit: '#9c6448', base: '#80503c', shadow: '#663c30', plant: '#566c44', plantD: '#3e5034', metal: '#686270', metalD: '#4a4452' },
  tint: '#ffb070',
  tintAlpha: 0.06,
  shimmer: 0.35,
};

const SUNSET: Tod = {
  sky: ['#2c2c5c', '#5a3a6c', '#a24a64', '#e46e4c', '#f8a84e'],
  sun: { x: 214, y: 112, r: 15, core: '#ffd890', rim: '#ff9c48', glow: '#f88c58', stripes: true },
  haze: '#f09a78',
  hazeD: '#c2706a',
  far: { lit: '#a8586a', base: '#82465e', shadow: '#683a54' },
  mid: { bands: ['#8e4652', '#80404c', '#96505a', '#743a48', '#8a4650', '#9c5660'], lit: '#d07060', shadow: '#5c3046', dark: '#4a283e' },
  near: { lit: '#6e3c48', base: '#56303e', shadow: '#422634', plant: '#3e4636', plantD: '#2c3228', metal: '#4c4054', metalD: '#363044' },
  tint: '#ff8858',
  tintAlpha: 0.1,
  shimmer: 0.1,
};

/** Keyframes at progress 0, 1/3, 2/3, 1. */
export const TODS: Tod[] = [NOON, AFTERNOON, GOLDEN, SUNSET];

function mixArr(a: string[], b: string[], t: number): string[] {
  return a.map((c, i) => mixColor(c, b[i] ?? c, t));
}

/** Blend two keyframes (used for the sky, sun and overlay; layers crossfade baked keyframes). */
export function mixTod(a: Tod, b: Tod, t: number): Tod {
  const m = (x: string, y: string) => mixColor(x, y, t);
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    sky: mixArr(a.sky, b.sky, t),
    sun: {
      x: n(a.sun.x, b.sun.x),
      y: n(a.sun.y, b.sun.y),
      r: n(a.sun.r, b.sun.r),
      core: m(a.sun.core, b.sun.core),
      rim: m(a.sun.rim, b.sun.rim),
      glow: m(a.sun.glow, b.sun.glow),
      stripes: t < 0.5 ? a.sun.stripes : b.sun.stripes,
    },
    haze: m(a.haze, b.haze),
    hazeD: m(a.hazeD, b.hazeD),
    far: { lit: m(a.far.lit, b.far.lit), base: m(a.far.base, b.far.base), shadow: m(a.far.shadow, b.far.shadow) },
    mid: { bands: mixArr(a.mid.bands, b.mid.bands, t), lit: m(a.mid.lit, b.mid.lit), shadow: m(a.mid.shadow, b.mid.shadow), dark: m(a.mid.dark, b.mid.dark) },
    near: {
      lit: m(a.near.lit, b.near.lit),
      base: m(a.near.base, b.near.base),
      shadow: m(a.near.shadow, b.near.shadow),
      plant: m(a.near.plant, b.near.plant),
      plantD: m(a.near.plantD, b.near.plantD),
      metal: m(a.near.metal, b.near.metal),
      metalD: m(a.near.metalD, b.near.metalD),
    },
    tint: m(a.tint, b.tint),
    tintAlpha: n(a.tintAlpha, b.tintAlpha),
    shimmer: n(a.shimmer, b.shimmer),
  };
}

/** Continuous time of day for progress p (0 = noon at the canyon mouth, 1 = sunset at the boss). */
export function todAt(p: number): Tod {
  const k = Math.max(0, Math.min(1, p)) * (TODS.length - 1);
  const i = Math.min(TODS.length - 2, Math.floor(k));
  return mixTod(TODS[i], TODS[i + 1], k - i);
}
