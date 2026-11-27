// Mission 1 (PALM HARBOR) shared layout constants and palette. The theme uses the zone boundaries to
// change the backdrop and the ground surface along the level (beach -> fishing village -> jungle ->
// Legion stockade); the level imports the same numbers so both always agree.
// Pure data: safe to import from Node tests.

/** World geometry of level 'm1' (x in px, +y down). */
export const M1 = {
  /** Level size. */
  W: 6904,
  H: 336,
  /** Base ground line (camera at the bottom shows it at screen y 184). */
  GY: 304,
  /** Fuel-depot plateau (reached by the cliff climb). */
  PY: 184,
  /** Zone boundaries (world x). */
  beachEnd: 1690,
  villageEnd: 2780,
  stockade: 5540,
  /** River crossing (gravel bed under shallow water). */
  riverX0: 3956,
  riverX1: 4148,
  /** Lagoon under the stilt village. */
  lagoonX0: 1700,
  lagoonX1: 2330,
  /** Cliff climb + plateau. */
  cliffX0: 4330,
  plateauX0: 4470,
  plateauX1: 5040,
  /** Boss lock camera-left x (arena = [bossL, bossL + 384]). */
  bossL: 6520,
} as const;

/** Background zone of a world x. */
export type M1Zone = 'beach' | 'village' | 'jungle' | 'stockade';

export function m1Zone(x: number): M1Zone {
  if (x < M1.beachEnd) return 'beach';
  if (x < M1.villageEnd) return 'village';
  if (x < M1.stockade) return 'jungle';
  return 'stockade';
}

/** Palm Harbor palette (actors stay more saturated/contrasty than anything here). */
export const PH = {
  // sky + sea
  sky: ['#4a86cf', '#6fa9e0', '#9ccbea', '#c9e4ee', '#f3e5c2'],
  sun: '#fff6d8',
  sunGlow: '#fbe9b8',
  cloud: '#fffaf0',
  cloudShade: '#ead6c8',
  cloudFar: '#f4f2ee',
  cloudFarShade: '#d9dfe8',
  isle: '#9db1d3',
  isleL: '#b6c7e1',
  isleD: '#8a9ec4',
  volc: '#8c9cc3',
  volcL: '#a9b9da',
  volcD: '#7787b0',
  plume: '#cfd2dc',
  plumeL: '#e6e7ee',
  seaHorizon: '#a8e0ea',
  seaFar: '#5ca8cc',
  seaMid: '#43b2c6',
  seaNear: '#4ec6c2',
  seaGlint: '#ecfffb',
  foam: '#e4faf2',
  // distant jungle (hazy)
  hill: '#7cb09c',
  hillL: '#98c4ae',
  hillD: '#6ca08c',
  hillDD: '#629482',
  // near jungle (still behind the playfield)
  jungle: '#4f8b6c',
  jungleL: '#68a27c',
  jungleD: '#41775e',
  jungleDD: '#376a54',
  trunkBg: '#6b705e',
  trunkBgL: '#848a72',
  trunkBgD: '#565a4c',
  // sand
  sand: '#e2c48a',
  sandL: '#f0d9a6',
  sandLL: '#fbebc6',
  sandD: '#cdaa70',
  sandDD: '#b38f5a',
  wetSand: '#c9a873',
  shell: '#fbe8dc',
  shellP: '#efb9a6',
  // jungle soil
  soil: '#8c5a3a',
  soilL: '#a46e48',
  soilD: '#714630',
  soilDD: '#5a3624',
  pebble: '#b89c7c',
  root: '#5c3a26',
  grass: '#58a63a',
  grassL: '#93d65c',
  grassD: '#3c8230',
  grassDD: '#2f6a2a',
  beachGrass: '#a2b852',
  beachGrassD: '#7e9a3e',
  // gravel (river bed)
  gravel: '#9c8a74',
  gravelL: '#bcae96',
  gravelD: '#76685a',
  // rock
  rock: '#6f6a70',
  rockL: '#8e8a8e',
  rockLL: '#aaa6a8',
  rockD: '#55505a',
  rockDD: '#423e48',
  moss: '#6a9a44',
  mossL: '#8cbc58',
  // wood / thatch / bamboo
  wood: '#a8743e',
  woodL: '#c99558',
  woodLL: '#e0b474',
  woodD: '#7c5228',
  woodDD: '#583818',
  plank: '#b9874a',
  thatch: '#d6b25e',
  thatchL: '#ecd086',
  thatchD: '#b08a3e',
  thatchDD: '#8a6a2e',
  bamboo: '#c2b45a',
  bambooL: '#e0d488',
  bambooD: '#8e8238',
  weave: '#c7a464',
  weaveD: '#a2804a',
  rope: '#d8c08a',
  // paint / cloth
  red: '#d24a36',
  redL: '#ee7a5a',
  redD: '#9a2e22',
  white: '#f2eee2',
  whiteD: '#cfc8b8',
  blue: '#3d7ab8',
  blueL: '#68a4d8',
  blueD: '#2a5482',
  yellow: '#f2c440',
  // fire
  flame: '#ffb02e',
  flameL: '#ffe27a',
  flameD: '#e8641e',
  ember: '#c83a1a',
  // legion
  legion: '#7d7343',
  legionL: '#a39a62',
  legionD: '#5a522e',
  legionDD: '#3e3820',
  steel: '#5c6070',
  steelL: '#868a9a',
  steelD: '#3e404c',
  brass: '#d4a23a',
  brassL: '#f4d878',
  brassD: '#8e6620',
  dark: '#1e1a24',
  ink: '#140c1c',
} as const;

/** Small deterministic hash in [0, 1). */
export function h01(x: number, y = 0, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1-D value noise in [0, 1) (period-free, deterministic). */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = h01(i, 0, seed);
  const b = h01(i + 1, 0, seed);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

/** 0 -> 1 ramp over [a, b] (clamped, smoothstep). */
export function ramp01(x: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
