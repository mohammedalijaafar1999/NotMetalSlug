// Mission 5 (STORMFRONT) palette: a storm at dusk above the clouds. Backgrounds stay in muted
// violets/indigos (lower contrast and saturation than the actors); the Legion fleet uses the same
// olive / gunmetal / brass family as THUNDERHEAD and the machines (MC palette).

export const P5 = {
  /** Sky gradient, top -> bottom (deep indigo -> violet -> glowing dusk horizon). */
  sky: ['#100c20', '#171128', '#1f1634', '#291c42', '#35224f', '#45295a', '#5a3062', '#743a68', '#924a6c', '#b2606c', '#cc7a6c'],

  // Far storm towers (cumulonimbus).
  towerDeep: '#1a1430',
  towerShade: '#221a3a',
  towerBody: '#2c2246',
  towerMid: '#382c54',
  towerLight: '#4a3a64',
  towerRim: '#6c4e74',
  towerRimHot: '#94667c',
  towerGlow1: '#4a3054',
  towerGlow2: '#5e3a5c',
  rainShaft: '#1e1834',
  rainShaftL: '#272040',
  /** Lightning-lit cloud interior. */
  litLow: '#5a4a8c',
  litMid: '#8a78c0',
  litHigh: '#c4b6ec',
  litCore: '#ece6ff',
  bolt: '#f4f0ff',
  boltGlow: '#9c8ce0',

  // Distant fleet silhouettes.
  fleet: '#1c1530',
  fleetTop: '#2e2446',
  fleetLight: '#e8a860',
  fleetLightDim: '#a8704a',

  // Mid cloud banks.
  midDeep: '#241c3c',
  midShade: '#2e2448',
  midBody: '#3a2e56',
  midLight: '#4a3a66',
  midRim: '#5e4a76',
  midHigh: '#786088',
  midGlow1: '#583a62',
  midGlow2: '#704668',

  // Cloud sea (the "floor").
  seaRim: '#ecbcbc',
  seaHigh: '#cc9eb4',
  seaLight: '#b08aac',
  seaMid: '#967aa4',
  seaBody: '#7c6496',
  seaShade: '#655186',
  seaDeep: '#4e4072',
  seaDeeper: '#3c3260',

  // Near wisps / rain (overlay, drawn with alpha).
  wisp: '#c8b8e0',
  wispShade: '#9a88c0',
  rain: '#c4b8ec',

  // Legion airship hulls (match the machines / THUNDERHEAD).
  hull: '#4c4e5a',
  hullL: '#6a6e7c',
  hullLL: '#8c909e',
  hullD: '#363844',
  hullDD: '#262630',
  olive: '#7d7343',
  oliveL: '#a39a62',
  oliveLL: '#c6be86',
  oliveD: '#5a522e',
  oliveDD: '#3e3820',
  brass: '#d4a23a',
  brassL: '#f4d878',
  brassD: '#8e6620',
  rust: '#a8502a',
  rustD: '#6e3218',
  orange: '#e0782c',
  orangeD: '#a04c1c',
  cream: '#e8dcb4',
  creamD: '#b8a884',
  wood: '#8a5a36',
  woodL: '#b07a48',
  woodD: '#5e3c22',
  woodDD: '#42281a',
  glass: '#6ab4d8',
  glassD: '#2e6a8c',
  window: '#ffd27a',
  windowD: '#c88a3c',
  red: '#d8402a',
  redL: '#ff7a4a',
  green: '#5ad06a',
  canvas: '#b8a478',
  canvasL: '#d8c89c',
  canvasD: '#8c7854',
  canvasDD: '#6a583c',
  rope: '#c8a050',
  ropeD: '#8a6a2a',
  dark: '#140c1c',
} as const;
