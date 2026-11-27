// IRON CITADEL palette: a night-time Legion fortress-factory. Backgrounds stay dark, cool and
// desaturated (violet-greys) so brass robots, crimson troops and bullets read on top of them;
// the warm accents (furnace glow, molten metal, lit windows, embers) are reserved for light sources.

export const M6 = {
  // sky (top -> horizon)
  sky: ['#07050b', '#0e0811', '#170b13', '#241015', '#381715', '#522214', '#6a2c14'],

  // far citadel silhouettes
  far: '#1a1220',
  farHi: '#251a2b',
  farLo: '#120c17',
  farWin: '#7a3a1e',
  farWinHi: '#c8642a',

  // smoke
  smoke: '#30222a',
  smokeD: '#241a20',
  smokeL: '#3a2a30',

  // mid factory skyline
  mid: '#211821',
  midHi: '#2e222d',
  midLo: '#181119',
  midWin: '#6e321c',
  midWinHi: '#c46426',
  midWinHot: '#ffa040',

  // near girders / pipes
  near: '#151017',
  nearHi: '#251c25',
  nearRim: '#47231b',
  nearLo: '#0d0a0f',

  // steel (floors, structures)
  steel: '#3c3943',
  steelL: '#57535f',
  steelLL: '#7c7784',
  steelLLL: '#a6a0ae',
  steelD: '#29262f',
  steelDD: '#1a171f',

  // firebrick (solids, furnaces)
  brick: '#5a2c25',
  brickL: '#74392d',
  brickD: '#40201c',
  mortar: '#211518',

  // iron (frames, bands)
  iron: '#46424f',
  ironL: '#625d6b',
  ironD: '#2c2933',

  // brass (Legion fittings)
  brass: '#b48a34',
  brassL: '#e0bc5c',
  brassD: '#7a5a20',

  // crimson (Legion banners)
  crimson: '#8c2226',
  crimsonL: '#b8372f',
  crimsonD: '#5a1519',

  // hazard
  hazard: '#d8a628',
  hazardD: '#2a2224',

  // heat / molten
  molten: '#ff6a14',
  moltenL: '#ffb43a',
  moltenLL: '#fff0a0',
  moltenD: '#c43a10',
  moltenDD: '#7a1e0c',
  crust: '#4a1a10',
  glow: '#ff8a2a',

  // lamps / alarm
  amber: '#ffb030',
  red: '#ff3a2a',
  redD: '#a01c18',
  green: '#5adc5a',

  outline: '#140c1c',
} as const;

/** Small deterministic hash -> [0, 1). */
export function hash01(a: number, b = 0, seed = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
