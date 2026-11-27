// FROSTBITE PASS (mission 3) palette. Background art is cooler and lower in contrast than the
// actors (olive Rustcoat troops, orange hostages) so they always pop against the snow.

export const P3 = {
  // Sky (top -> horizon).
  sky: ['#2b4a7c', '#3f6599', '#6a92c0', '#a6c4e0', '#d6e4f0'],

  // Snow.
  snowHi: '#ffffff',
  snow: '#eaf2f9',
  snowM: '#d3e0ee',
  snowS: '#b2c6dc',
  snowD: '#8fa6c2',

  // Ice.
  iceHi: '#effaff',
  ice: '#b4def2',
  iceM: '#86c0de',
  iceD: '#5a94bc',
  iceDD: '#3a6a94',

  // Rock (blue granite, matches the FROST BASTION).
  rockHi: '#9aa8bc',
  rock: '#7a889e',
  rockM: '#626f86',
  rockD: '#4a556c',
  rockDD: '#343c52',

  // Pines.
  pineHi: '#4f8676',
  pine: '#386a5a',
  pineM: '#2b5446',
  pineD: '#1f4036',
  trunk: '#5a3a26',
  trunkD: '#3a2416',

  // Wood.
  woodHi: '#c08c58',
  wood: '#93633a',
  woodM: '#744a2a',
  woodD: '#52321c',
  woodDD: '#381e10',

  // Legion iron / cloth.
  olHi: '#9aa060',
  ol: '#737a40',
  olM: '#585e30',
  olD: '#3e4222',
  red: '#b8352e',
  redD: '#7e1e2c',
  redHi: '#e05a44',
  gold: '#e8c040',
  goldD: '#a8802a',

  steelHi: '#c4ccd8',
  steel: '#8e98a8',
  steelM: '#6c7686',
  steelD: '#4a5262',
  steelDD: '#30363f',

  concrete: '#9aa2ac',
  concreteHi: '#bcc4cc',
  concreteD: '#6e7682',
  concreteDD: '#4e5460',

  // Warm lights.
  lampHi: '#fff4c0',
  lamp: '#ffd060',
  lampD: '#ff9a30',
  fire: '#ff7a20',
  fireD: '#c83a10',

  // Muted outline for scenery (actors use the near-black default outline).
  outline: '#2a3850',
} as const;
