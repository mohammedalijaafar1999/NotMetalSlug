// MISSION 2 - DUSTWIND CANYON (theme 'm2', music 'm2', boss HORNET KING).
// Noon at the canyon mouth -> sunset on the salt flat (the theme reads camera progress).
//
//   0     canyon mouth: breather, sleeping/chatting riflemen, first hostage (H)
//   760   oasis + sandstone ruins: ruin lintels on pillars, LOCK 1 introduces trucks + bazookas
//   1600  Legion checkpoint: H crate, STRIDER walker parked behind the barrier, mortar crew
//   2200  canyon road (vehicle beat): jeep, bazooka nests, LOCK 2 convoy ambush (trucks, jeep,
//         light tank, heli)
//   3180  ramp up to the rigged rail bridge over the dry gorge: LOCK 3 on the bridge (jetpacks,
//         paratroopers) ends with the Legion blowing the bridge (m2_bridge / m2_detonator):
//         everyone drops into the riverbed and any vehicle on the deck is wrecked
//   3640  vertical section: climb the mesa face (34 px rock steps, scaffold and ledges, camera keys)
//   3994  mesa top lookout: MG turret, watchtower sniper, bunker, caged hostage (C)
//   4700  switchback descent into the Legion oil field
//   5120  oil field: pumpjacks, derricks, pipelines, barrels and a fuel tank, LOCK 4 GAUNTLET
//   6280  salt flat (calm, > 1 screen), then the HORNET KING arena (lock x 6800, flat y 408).

import { registerLevel, type DecorDef, type LevelDef, type PlatformDef, type SolidDef } from '../../game/level';
import type { SpawnSpec } from '../../game/registry';
import { BRIDGE_DROP, SPAN } from './m2/bridge';

/** Level height and base ground (32 px above the bottom, like a 216-tall level). */
const H = 440;
const B = H - 32;
/** Mesa top height. */
const MESA = B - 208;
/** Boss lock x (arena [L, L + 384]); level ends 160 px past the arena. */
export const M2_BOSS_X = 6800;
const L = M2_BOSS_X;
const W = L + 384 + 160;

/** Bridge: 5 spans from the ramp abutment over the gorge to the far abutment. */
export const M2_BRIDGE = { x1: 3330, spans: 5, y: B - BRIDGE_DROP };
const BX2 = M2_BRIDGE.x1 + M2_BRIDGE.spans * SPAN; // 3660
const DECK = M2_BRIDGE.y;

/** Mesa climb: rock steps (x where each step starts, its height). */
const STEPS: Array<[number, number]> = [
  [3730, B - 78],
  [3796, B - 112],
  [3862, B - 146],
  [3928, MESA],
];
/** Rock ledge jutting out of the last (62 px) cliff: the only way up onto the mesa. */
const LEDGE_Y = B - 177;

const ground: Array<[number, number]> = [
  // 0. canyon mouth: low dunes
  [0, B],
  [150, B],
  [186, B - 6],
  [262, B - 6],
  [298, B],
  [520, B],
  [552, B - 8],
  [646, B - 8],
  [678, B],
  // 1. oasis basin (shallow water) then the ruins plaza
  [790, B],
  [808, B + 6],
  [822, B + 10],
  [918, B + 10],
  [932, B + 6],
  [950, B],
  // 2-3. checkpoint + canyon road (a few bumps)
  [2250, B],
  [2272, B - 5],
  [2336, B - 5],
  [2358, B],
  [3180, B],
  // 4. ramp to the bridge abutment, cliff into the gorge, riverbed, rubble step, far abutment
  [3290, DECK],
  [M2_BRIDGE.x1, DECK],
  [M2_BRIDGE.x1, B],
  [BX2 - 30, B],
  [BX2 - 30, B - 22],
  [BX2, B - 22],
  [BX2, DECK],
  // 5. mesa face: 34 px rock steps up to the top
  ...STEPS.flatMap(([x, y], i): Array<[number, number]> => [
    [x, i === 0 ? DECK : STEPS[i - 1][1]],
    [x, y],
  ]),
  // 6. mesa top
  [4700, MESA],
  // 7. switchback descent
  [4780, MESA + 32],
  [4840, MESA + 32],
  [4840, MESA + 70],
  [4900, MESA + 70],
  [5000, MESA + 130],
  [5040, MESA + 130],
  [5040, B - 36],
  [5080, B - 36],
  [5120, B],
  // 8-9. oil field, salt flat and the boss arena: flat
  [W, B],
];

/** Ground y at x (for placing decor and props). */
function gy(x: number): number {
  let best = Infinity;
  for (let i = 0; i < ground.length - 1; i++) {
    const [x1, y1] = ground[i];
    const [x2, y2] = ground[i + 1];
    if (x < x1 || x > x2) continue;
    const y = x2 === x1 ? Math.min(y1, y2) : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    if (y < best) best = y;
  }
  return Math.round(best);
}

// ------------------------------------------------------------------ platforms & solids

const platforms: PlatformDef[] = [
  // Ruins: lintels on pillars (see decor 'pillar').
  { x: 978, y: B - 40, w: 66, style: 'ruin' },
  { x: 1058, y: B - 78, w: 62, style: 'ruin' },
  { x: 1218, y: B - 36, w: 52, style: 'ruin' },
  { x: 1388, y: B - 44, w: 72, style: 'ruin' },
  // Canyon road: Legion lookout scaffold.
  { x: 2588, y: B - 40, w: 60 },
  // Mesa climb: a scaffold over the first step and a rock ledge higher up.
  { x: 3736, y: B - 112, w: 46 },
  { x: 3897, y: LEDGE_Y, w: 31, style: 'ledge' },
  // Mesa top watchtower deck.
  { x: 4383, y: MESA - 46, w: 34, style: 'plank' },
  // Oil field catwalks (two in the gauntlet arena).
  { x: 5470, y: B - 40, w: 64, style: 'metal' },
  { x: 5940, y: B - 42, w: 66, style: 'metal' },
  { x: 6150, y: B - 42, w: 66, style: 'metal' },
];

const solids: SolidDef[] = [
  // Red-rock outcrop on the canyon road.
  { x: 2466, y: B - 22, w: 38, h: 22 },
  // Rock block on the mesa top (cover in front of the turret).
  { x: 4200, y: MESA - 18, w: 30, h: 18 },
];

// ------------------------------------------------------------------ decor

const D = (kind: string, x: number, props?: Record<string, any>, layer: 'back' | 'front' = 'back', y?: number): DecorDef => ({
  kind,
  x,
  y: y ?? gy(x),
  layer,
  props,
});

const decor: DecorDef[] = [
  // Backdrop regions.
  ...(
    [
      ['desert', 0],
      ['ruins', 760],
      ['canyon', 1640],
      ['gorge', 3260],
      ['mesa', 3700],
      ['oil', 5020],
      ['salt', 6280],
    ] as const
  ).map(([region, x]) => D('m2_bg', x, { region })),
  // Crisp rims on every cliff face / step.
  D('cliffs', 0, { w: 2 * W }),
  // Ground paint: the canyon road and the salt flat.
  D('surface', 1700, { type: 'road', w: 1600 }),
  D('surface', 6230, { type: 'salt', w: W - 6230 }),
  // 0. canyon mouth
  D('saguaro', 22, { v: 0 }),
  D('sign', 70, { v: 0 }),
  D('bones', 122, { v: 0 }),
  D('wreck', 226, { v: 0 }),
  D('vulture', 236, undefined, 'back', gy(226) - 20),
  D('cactus', 340, { v: 0 }),
  D('saguaro', 446, { v: 1 }),
  D('rocks', 502, { v: 0 }),
  D('cactus', 566, { v: 2 }),
  D('saguaro', 662, { v: 2 }),
  D('rocks', 730, { v: 1 }),
  D('tumbleweed', 420, { w: 560 }),
  // 1. oasis + ruins
  D('sign', 762, { v: 5 }),
  D('palm', 796),
  D('reeds', 818),
  D('reeds', 912, { flip: true }),
  D('palm', 944, { flip: true }),
  D('pillar', 988, { h: 40 }),
  D('pillar', 1034, { h: 40 }),
  D('pillar', 1068, { h: 78 }),
  D('pillar', 1110, { h: 78 }),
  D('ruinwall', 1168, { v: 0 }),
  D('pillar', 1228, { h: 36 }),
  D('pillar', 1260, { h: 36 }),
  D('column', 1312, { v: 0 }),
  D('column', 1348, { v: 2 }),
  D('pillar', 1398, { h: 44 }),
  D('pillar', 1450, { h: 44 }),
  D('ruinwall', 1508, { v: 1 }),
  D('column', 1566, { v: 1 }),
  D('windpump', 1612),
  D('bones', 1650, { v: 1 }),
  // 2. Legion checkpoint
  D('sign', 1752, { v: 3 }),
  D('barrier', 1790, { w: 44 }),
  D('tent', 1878),
  D('flag', 1924),
  D('drums', 2014, { v: 2 }),
  D('tent', 2104, { flip: true }),
  D('flag', 2196),
  // 3. canyon road
  D('sign', 2236, { v: 1 }),
  D('rocks', 2300, { v: 2 }),
  D('cactus', 2420, { v: 3 }),
  D('bones', 2540, { v: 0 }),
  D('rocks', 2690, { v: 0 }),
  D('wreck', 2850, { v: 1 }),
  D('saguaro', 2970, { v: 0 }),
  D('cactus', 3070, { v: 0 }),
  D('tumbleweed', 2700, { w: 600 }),
  // 4. ramp + gorge
  D('rocks', 3140, { v: 1 }),
  D('sign', 3306, { v: 2 }),
  D('bones', 3440, { v: 1 }),
  D('rocks', 3586, { v: 1 }),
  // 5. climb
  D('cactus', 3770, { v: 3 }),
  D('rocks', 3846, { v: 1 }),
  D('saguaro', 3952, { v: 2 }),
  // 6. mesa top
  D('sign', 4030, { v: 3 }),
  D('flag', 4150),
  D('tent', 4300),
  D('watchtower', 4400, { h: 46 }),
  D('drums', 4520, { v: 0 }),
  D('rocks', 4664, { v: 2 }),
  // 7. descent
  D('cactus', 4810, { v: 1 }),
  D('rocks', 4930, { v: 1 }),
  D('saguaro', 5060, { v: 1 }),
  // 8. oil field
  D('sign', 5150, { v: 2 }),
  D('derrick', 5236),
  D('pipeline', 5170, { w: 260, h: 12, valve: 120 }),
  D('pumpjack', 5300),
  D('tank', 5420),
  D('drums', 5560, { v: 1 }),
  D('pumpjack', 5650, { flip: true }),
  D('derrick', 5800),
  D('pipeline', 5860, { w: 420, h: 12, valve: 200 }),
  D('pumpjack', 6040),
  D('drums', 6236, { v: 2 }),
  // 9. salt flat
  D('sign', 6330, { v: 4 }),
  D('bones', 6420, { v: 0 }),
  D('rocks', 6560, { v: 1 }),
  D('bones', 6690, { v: 1 }),
  D('tumbleweed', 6600, { w: 700 }),
];

// ------------------------------------------------------------------ entities

const entities: SpawnSpec[] = [
  // 0. canyon mouth (breather)
  { type: 'crate_prop', x: 318, props: { drop: 'points' } },
  { type: 'rifleman', x: 404, props: { behavior: 'sleep', facing: -1 } },
  { type: 'hostage', x: 474, props: { drop: 'H', look: 0 } },
  { type: 'rifleman', x: 588, props: { behavior: 'chat', facing: 1 } },
  { type: 'rifleman', x: 608, props: { behavior: 'chat', facing: -1 } },
  { type: 'rifleman', x: 740, props: { behavior: 'patrol', facing: -1 } },
  // 1. oasis + ruins
  { type: 'pickup', x: 966, props: { item: 'bomb' } },
  { type: 'grenadier', x: 1010, y: B - 40, props: { behavior: 'guard', facing: -1 } },
  { type: 'hostage', x: 1090, y: B - 78, props: { mode: 'caged', drop: 'S', look: 1 } },
  { type: 'bazooka', x: 1430, y: B - 44, props: { behavior: 'guard', facing: -1 } },
  // 2. checkpoint + the STRIDER
  { type: 'pickup', x: 1640, props: { item: 'H' } },
  { type: 'hostage', x: 1712, props: { mode: 'wander', drop: 'R', look: 2 } },
  { type: 'sandbags', x: 1846 },
  { type: 'rifleman', x: 1866, props: { behavior: 'guard', facing: -1 } },
  { type: 'shield_trooper', x: 1906, props: { behavior: 'guard', facing: -1 } },
  { type: 'mech', x: 1990, props: { ammo: 20 } },
  { type: 'hostage', x: 2050, props: { drop: 'bomb', look: 1 } },
  { type: 'rifleman', x: 2074, props: { behavior: 'idle', facing: -1 } },
  { type: 'mortar', x: 2170, props: { facing: -1 } },
  // 3. canyon road
  { type: 'jeep', x: 2460, props: { stopX: 2380, facing: -1 } },
  { type: 'hostage', x: 2392, props: { drop: 'fuel', look: 0 } },
  { type: 'bazooka', x: 2484, y: B - 22, props: { behavior: 'guard', facing: -1 } },
  { type: 'bazooka', x: 2620, y: B - 40, props: { behavior: 'guard', facing: -1 } },
  { type: 'pickup', x: 2660, props: { item: 'bomb' } },
  { type: 'truck', x: 2760, props: { troop: 'rifleman', troops: 3, facing: -1 } },
  // 4. ramp + bridge
  { type: 'm2_bridge', x: M2_BRIDGE.x1 + (M2_BRIDGE.spans * SPAN) / 2, y: DECK, trigger: 2950, props: { spans: M2_BRIDGE.spans } },
  { type: 'rifleman', x: 3244, props: { behavior: 'guard', facing: -1 } },
  { type: 'pickup', x: 3200, props: { item: 'bomb' } },
  // 5. mesa climb
  { type: 'rifleman', x: 3768, y: STEPS[0][1], props: { behavior: 'guard', facing: -1 } },
  { type: 'hostage', x: 3830, y: STEPS[1][1], props: { drop: 'L', look: 1 } },
  { type: 'grenadier', x: 3878, y: STEPS[2][1], props: { behavior: 'guard', facing: -1 } },
  { type: 'saber', x: 3984, y: MESA, props: { behavior: 'guard', facing: -1 } },
  { type: 'sniper', x: 4056, y: MESA, props: { facing: -1 } },
  // 6. mesa top lookout
  { type: 'sandbags', x: 4110, y: MESA },
  { type: 'rifleman', x: 4136, y: MESA, props: { behavior: 'guard', facing: -1 } },
  { type: 'turret', x: 4260, y: MESA, props: { kind: 'mg', dir: -1 } },
  { type: 'sniper', x: 4400, y: MESA - 46, props: { facing: -1 } },
  { type: 'hostage', x: 4470, y: MESA, props: { mode: 'caged', drop: 'C', look: 2 } },
  { type: 'pickup', x: 4520, y: MESA, props: { item: 'bomb' } },
  { type: 'bunker', x: 4610, y: MESA, props: { facing: -1 } },
  // 7. descent
  { type: 'rifleman', x: 4868, y: MESA + 70, props: { behavior: 'charge', facing: -1 } },
  { type: 'grenadier', x: 5060, y: B - 36, props: { behavior: 'guard', facing: -1 } },
  { type: 'hostage', x: 5170, props: { mode: 'wander', drop: 'bomb', look: 0 } },
  // 8. oil field
  { type: 'barrel', x: 5330 },
  { type: 'barrel', x: 5346 },
  { type: 'mortar', x: 5420, props: { facing: -1 } },
  { type: 'rifleman', x: 5500, y: B - 40, props: { behavior: 'guard', facing: -1 } },
  { type: 'fuel_tank', x: 5590 },
  { type: 'hostage', x: 5640, props: { drop: 'F', look: 1 } },
  { type: 'shield_trooper', x: 5700, props: { behavior: 'patrol', facing: -1 } },
  { type: 'pickup', x: 5740, props: { item: 'R' } },
  { type: 'crate_prop', x: 5790, props: { drop: 'bomb' } },
  { type: 'barrel', x: 6070 },
  // 9. salt flat (calm)
  { type: 'hostage', x: 6470, props: { mode: 'wander', drop: 'H', look: 2 } },
  { type: 'pickup', x: 6590, props: { item: 'bomb' } },
];

// ------------------------------------------------------------------ locks

const locks: LevelDef['locks'] = [
  // LOCK 1 - ruins: the signature pair (trucks dropping off riflemen and bazookas).
  {
    x: 1140,
    waves: [
      { delay: 0.6, spawns: [{ type: 'truck', x: 1590, props: { troops: 3, troop: 'rifleman', stopX: 1440, facing: -1 } }] },
      {
        delay: 1,
        spawns: [
          { type: 'truck', x: 1086, y: B, props: { troops: 2, troop: 'bazooka', stopX: 1200, facing: 1 } },
          { type: 'rifleman', x: 1560, props: { behavior: 'charge', facing: -1 } },
        ],
      },
      {
        delay: 0.8,
        spawns: [
          { type: 'saber', x: 1556, props: { behavior: 'charge', facing: -1 } },
          { type: 'saber', x: 1104, y: B, props: { behavior: 'charge', facing: 1 } },
          { type: 'grenadier', x: 1572, props: { behavior: 'charge', facing: -1, range: 40 } },
        ],
      },
    ],
  },
  // LOCK 2 - canyon road convoy ambush (the walker's moment).
  {
    x: 2720,
    waves: [
      {
        delay: 0.6,
        spawns: [
          { type: 'truck', x: 3170, props: { troops: 3, troop: 'rifleman', stopX: 3010, facing: -1 } },
          { type: 'jeep', x: 2664, props: { stopX: 2780, facing: 1 } },
        ],
      },
      {
        delay: 1,
        spawns: [
          { type: 'light_tank', x: 3180, props: { behavior: 'advance', facing: -1 } },
          { type: 'bazooka', x: 3150, props: { behavior: 'charge', facing: -1, range: 80 } },
        ],
      },
      {
        delay: 1,
        spawns: [
          { type: 'heli', x: 3160, props: { facing: -1 } },
          { type: 'rifleman', x: 3130, props: { behavior: 'charge', facing: -1 } },
          { type: 'grenadier', x: 3150, props: { behavior: 'charge', facing: -1, range: 40 } },
        ],
      },
    ],
  },
  // LOCK 3 - on the bridge: jetpacks and paratroopers, then the Legion blows it.
  {
    x: M2_BRIDGE.x1,
    waves: [
      {
        delay: 0.6,
        spawns: [
          { type: 'jetpack', x: BX2 + 70, y: DECK - 70, props: { facing: -1 } },
          { type: 'bazooka', x: BX2 + 80, props: { behavior: 'charge', facing: -1, range: 80 } },
        ],
      },
      {
        delay: 1,
        spawns: [
          { type: 'paratrooper', x: M2_BRIDGE.x1 + 110 },
          { type: 'paratrooper', x: M2_BRIDGE.x1 + 250 },
          { type: 'jetpack', x: M2_BRIDGE.x1 - 60, y: DECK - 80, props: { facing: 1 } },
          { type: 'rifleman', x: BX2 + 70, props: { behavior: 'charge', facing: -1 } },
        ],
      },
      { delay: 1.2, spawns: [{ type: 'm2_detonator', x: M2_BRIDGE.x1 + (M2_BRIDGE.spans * SPAN) / 2, y: DECK }] },
    ],
  },
  // LOCK 4 - oil field GAUNTLET.
  {
    x: 5880,
    waves: [
      {
        delay: 0.6,
        spawns: [
          { type: 'truck', x: 6330, props: { troops: 2, troop: 'bazooka', stopX: 6170, facing: -1 } },
          { type: 'truck', x: 5826, props: { troops: 3, troop: 'rifleman', stopX: 5940, facing: 1 } },
        ],
      },
      {
        delay: 1,
        spawns: [
          { type: 'shield_trooper', x: 6300, props: { behavior: 'charge', facing: -1 } },
          { type: 'shield_trooper', x: 6330, props: { behavior: 'charge', facing: -1 } },
          { type: 'shield_trooper', x: 5836, props: { behavior: 'charge', facing: 1 } },
          { type: 'jetpack', x: 6320, y: B - 90, props: { facing: -1 } },
        ],
      },
      {
        delay: 1,
        spawns: [
          { type: 'light_tank', x: 6340, props: { behavior: 'advance', facing: -1 } },
          { type: 'jeep', x: 5820, props: { stopX: 5960, facing: 1 } },
        ],
      },
      {
        delay: 1.2,
        spawns: [
          { type: 'heli', x: 6320, props: { facing: -1 } },
          { type: 'officer', x: 6336, props: { behavior: 'charge', facing: -1 } },
          { type: 'saber', x: 6300, props: { behavior: 'charge', facing: -1 } },
          { type: 'saber', x: 5830, props: { behavior: 'charge', facing: 1 } },
        ],
      },
    ],
  },
  // BOSS - HORNET KING over the salt flat.
  {
    x: L,
    boss: true,
    music: 'boss',
    announce: 'WARNING! HORNET KING APPROACHING',
    waves: [{ delay: 1, spawns: [{ type: 'boss_m2', x: L + 500 }] }],
  },
];

export const M2_LEVEL: LevelDef = {
  id: 'm2',
  mission: 2,
  name: 'DUSTWIND CANYON',
  subtitle: 'OPERATION SANDSTORM',
  briefing:
    'LEGION CONVOYS ARE HAULING STOLEN MACHINERY THROUGH DUSTWIND CANYON. AMBUSH THE TRUCKS, WATCH THE RUINS FOR BAZOOKA NESTS AND GRAB THE STRIDER AT THE CHECKPOINT. CROSS THE RAIL BRIDGE, SCALE THE MESA AND BRING DOWN THE GUNSHIP GUARDING THE OIL FIELD.',
  theme: 'm2',
  music: 'm2',
  bossMusic: 'boss',
  bossName: 'HORNET KING',
  width: W,
  height: H,
  start: { x: 60 },
  ground: [ground],
  platforms,
  solids,
  water: [{ x: 812, y: B + 1, w: 116, h: 11 }],
  camera: [
    [0, H - 216, H - 216],
    [3400, H - 216, H - 216],
    [3480, 40, H - 216],
    [5000, 40, H - 216],
    [5090, H - 216, H - 216],
  ],
  checkpoints: [1000, 2060, 3230, 4180, 5150, 6250],
  entities,
  locks,
  decor,
  timeLimit: 80,
};

registerLevel(M2_LEVEL);
