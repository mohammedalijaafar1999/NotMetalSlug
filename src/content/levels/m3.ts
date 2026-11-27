// MISSION 3 - FROSTBITE PASS. A snowy mountain pass held by the Rustcoat Legion: a pine forest, rolling
// slopes where snowmobile raiders hunt, a Legion alpine station (STRIDER walker beat, collapsing
// bridge), a cable-car ride across a gorge (m3_cablecar: jetpacks, drones, paratroopers and a
// gunship attack while the cabin is jammed mid-gorge), a frozen lake, a vertical cliff climb and the
// fortress gate - FROST BASTION (boss_m3).
//
// Heights: G = 488 low ground (camera top 304), S = 456 station shelf, D = 420 cable-car decks,
// P = 184 fortress plateau (camera top 0, as the boss requires). Camera keys pin the camera to the
// bottom except for the ride (a little headroom) and the climb (free vertical follow).
//   ?level=m3&autoplay=1&invincible=1      (warp=<cameraX> to jump around; warp before 3000 keeps the cable car)

import { registerLevel, type DecorDef, type PlatformDef } from '../../game/level';
import type { SpawnSpec } from '../../game/registry';
import './m3/cablecar';
import './m3/bridge';

const W = 7904;
const H = 520;
const G = 488;
const S = 456;
const D = 420;
const P = 184;

// Cable car: docks (cabin centre), pylon, the jam stop and its lock.
const DOCK_A = 3508;
const PYLON = 4016;
const DOCK_B = 4524;
const CABLE: [number, number][] = [
  [DOCK_A, D - 44],
  [PYLON, 352],
  [DOCK_B, D - 44],
];
// The jam lock frames the stalled cabin at 40% of the view (where the autopilot holds position);
// it engages a little before the cabin stops so the camera is already settled.
const JAM_LOCK = PYLON - 154;
const JAM_TRIGGER = PYLON - 214;

// Climb: rock ledges stacked on the cliff face at CLIFF.
const CLIFF = 6200;
const BOSS_X = 7520;

const GROUND: Array<Array<[number, number]>> = [
  [
    // Pine forest (a little hummock).
    [0, G],
    [250, G],
    [282, 482],
    [372, 482],
    [402, G],
    // Rolling slopes up to the clearing.
    [820, G],
    [880, 472],
    [930, 472],
    [968, 478],
    [1020, 478],
    [1090, 460],
    [1140, S],
    // Clearing + Legion station.
    [3090, S],
    // Creek ravine (bridge on top), its far bank sloping back up.
    [3090, 512],
    [3176, 512],
    [3250, S],
    // Terminal: ramp up to the boarding deck.
    [3292, S],
    [3330, D],
    [3472, D],
  ],
  // Gorge: no ground from 3472 to 4560.
  [
    [4560, D],
    [4700, D],
    [4738, S],
    [4820, S],
    [4880, G],
    // Frozen lake + the foot of the cliff.
    [CLIFF, G],
    [CLIFF, P],
    [W, P],
  ],
];

/** Ground top at x (the polylines above, interpolated). */
function gy(x: number): number {
  for (const line of GROUND) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i];
      const [x2, y2] = line[i + 1];
      if (x >= x1 && x <= x2) {
        if (x2 === x1) return Math.min(y1, y2);
        return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
      }
    }
  }
  return G;
}

/** Cable height (matches m3_cablecar's piecewise parabolas, sag 40). */
function cableY(x: number): number {
  for (let i = 0; i < CABLE.length - 1; i++) {
    const [x0, y0] = CABLE[i];
    const [x1, y1] = CABLE[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t + 160 * t * (1 - t);
    }
  }
  return CABLE[0][1];
}

const dec = (kind: string, x: number, props?: Record<string, any>, layer?: 'back' | 'front', y?: number): DecorDef => ({
  kind,
  x,
  y: y ?? gy(x),
  layer,
  props,
});
const at = (type: string, x: number, props?: Record<string, any>, extra: Partial<SpawnSpec> = {}): SpawnSpec => ({ type, x, props, ...extra });

// ------------------------------------------------------------------ climb ledges

const TIERS = [452, 416, 380, 344, 308, 272, 236, 200];
const climbLedges: PlatformDef[] = TIERS.map((y, i) => ({ x: CLIFF - (i % 2 === 0 ? 128 : 74), y, w: i % 2 === 0 ? 128 : 74, style: 'rock' }));

// ------------------------------------------------------------------ decor

const decor: DecorDef[] = [
  // Pine forest.
  dec('pine_far', 30, { f: 2 }),
  dec('pine_far', 150, { f: 1 }),
  dec('pine_far', 330, { f: 0 }),
  dec('pine_far', 452, { f: 2 }),
  dec('pine_far', 610, { f: 1 }),
  dec('pine_far', 730, { f: 0 }),
  dec('pine', 8, { f: 4 }),
  dec('pine', 96, { f: 2 }),
  dec('pine', 196, { f: 5 }),
  dec('pine', 258, { f: 3 }),
  dec('pine', 418, { f: 1 }),
  dec('pine', 566, { f: 4 }),
  dec('pine', 712, { f: 3 }),
  dec('sign', 146, { f: 0 }),
  dec('snowman', 222),
  dec('fence', 330, { n: 2 }),
  dec('rock', 392, { f: 1 }),
  dec('cabin', 500),
  dec('drift', 456, { w: 30, h: 5 }),
  dec('campfire', 640),
  dec('rock', 690, { f: 2 }),
  // Slopes.
  dec('pine_far', 820, { f: 1 }),
  dec('pine_far', 950, { f: 2 }),
  dec('pine_far', 1070, { f: 0 }),
  dec('pine', 790, { f: 2 }),
  dec('pine', 868, { f: 4 }),
  dec('pine', 1004, { f: 1 }),
  dec('pine', 1104, { f: 3 }),
  dec('rock', 905, { f: 0 }),
  dec('skirack', 1046),
  dec('sign', 1128, { f: 1 }),
  // Clearing (LOCK 1).
  dec('pine_far', 1200, { f: 2 }),
  dec('pine_far', 1390, { f: 1 }),
  dec('pine_far', 1560, { f: 2 }),
  dec('pine_far', 1700, { f: 0 }),
  dec('pine', 1176, { f: 0 }),
  dec('truck', 1330),
  dec('rock', 1470, { f: 1 }),
  dec('drums', 1600),
  dec('crates', 1652),
  dec('pine', 1726, { f: 2 }),
  // Legion alpine station.
  dec('sign', 1760, { f: 4 }),
  dec('warnlight', 1774, { color: 'red' }),
  dec('gate', 1806),
  dec('tower', 1880),
  dec('banner', 1940),
  dec('hangar', 2060),
  dec('lamp', 2140),
  dec('crates', 2190),
  dec('cabin', 2280),
  dec('skirack', 2336),
  dec('banner', 2380),
  dec('lamp', 2470),
  dec('mast', 2620),
  dec('hut', 2700),
  dec('drums', 2770),
  dec('lamp', 2830),
  dec('tower', 2900),
  dec('banner', 2980),
  dec('pine', 3040, { f: 1 }),
  // Creek ravine + terminal.
  dec('sign', 3058, { f: 1 }),
  dec('sign', 3076, { f: 2 }),
  dec('icefall', 3093, {}, 'back', S + 1),
  dec('sign', 3268, { f: 3 }),
  dec('terminal', 3400),
  dec('lamp', 3346),
  dec('warnlight', 3466, { color: 'amber' }),
  // Gorge.
  dec('gorge', 3472, { w: 1088, behindTerrain: true }, 'back', 432),
  dec('pylon', PYLON, {}, 'back', Math.round(cableY(PYLON)) - 3),
  // Arrival station.
  dec('warnlight', 4566, { color: 'amber' }),
  dec('terminal', 4630),
  dec('lamp', 4718),
  dec('sign', 4790, { f: 5 }),
  dec('pine', 4846, { f: 2 }),
  dec('pine_far', 4800, { f: 2 }),
  // Frozen lake.
  dec('lake', 4900, { w: 900 }),
  dec('icebank', 4904),
  dec('pine_far', 4960, { f: 1 }),
  dec('hut', 5050),
  dec('pine_far', 5200, { f: 0 }),
  dec('truck', 5300),
  dec('hut', 5470),
  dec('pine_far', 5620, { f: 2 }),
  dec('icebank', 5796),
  dec('rock', 5840, { f: 0 }),
  dec('pine', 5870, { f: 3 }),
  // Climb.
  dec('cliff', CLIFF, { w: 420, h: H - P - 12 }, 'back', P + 12),
  dec('pine_far', 5960, { f: 2 }),
  dec('rock', 6020, { f: 2 }),
  dec('icefall', CLIFF - 40, {}, 'back', TIERS[1] + 6),
  dec('icefall', CLIFF - 100, {}, 'back', TIERS[4] + 6),
  dec('icefall', CLIFF - 30, {}, 'back', TIERS[7] + 6),
  // Fortress plateau.
  dec('banner', 6260),
  dec('sign', 6330, { f: 5 }),
  dec('pine', 6420, { f: 2 }),
  dec('rock', 6610, { f: 0 }),
  dec('drums', 6760),
  dec('rock', 6880, { f: 1 }),
  dec('tower', 7010),
  dec('fortwall', 7120),
  dec('banner', 7120),
  dec('fortwall', 7248),
  dec('lamp', 7300),
  dec('fortwall', 7376),
  dec('banner', 7400),
  dec('warnlight', 7470, { color: 'red' }),
  dec('banner', 7560),
  dec('warnlight', 7640, { color: 'red' }),
];

// ------------------------------------------------------------------ entities

const entities: SpawnSpec[] = [
  // Opening: a quiet forest camp.
  at('hostage', 300, { drop: 'H', look: 0 }),
  at('rifleman', 470, { behavior: 'idle', facing: -1 }),
  at('rifleman', 614, { behavior: 'sleep', facing: 1 }),
  at('rifleman', 666, { behavior: 'sleep', facing: -1 }),
  at('rifleman', 780, { behavior: 'patrol' }),
  // Slopes: the first snowmobile raider.
  at('pickup', 912, { item: 'S' }),
  at('snowmobile', 1190, { facing: -1 }, { trigger: 1110 }),
  at('grenadier', 1000, { behavior: 'guard', facing: -1 }, { y: 436 }),
  at('rifleman', 1100, { behavior: 'patrol' }),
  at('pickup', 1150, { item: 'bomb' }),
  at('hostage', 1236, { mode: 'caged', drop: 'R', look: 1 }),
  // Station.
  at('shield_trooper', 1840, { behavior: 'guard', facing: -1 }),
  at('sniper', 1880, { facing: -1 }, { y: S - 64 }),
  at('rifleman', 1960, { behavior: 'chat', facing: 1 }),
  at('rifleman', 1980, { behavior: 'chat', facing: -1 }),
  at('hostage', 2014, { drop: 'bomb', look: 2 }),
  at('mech', 2070, { ammo: 20 }),
  at('robot', 2196, { behavior: 'sleep', facing: -1 }),
  at('rifleman', 2250, { behavior: 'patrol' }),
  at('rifleman', 2300, { behavior: 'guard', facing: -1 }),
  at('crate_prop', 2340, { drop: 'fuel' }),
  at('turret', 2400, { kind: 'mg', dir: -1 }),
  at('grenadier', 2470, { behavior: 'guard', facing: -1 }, { y: 416 }),
  at('barrel', 2426),
  at('barrel', 2440),
  at('pickup', 2530, { item: 'bomb' }),
  at('fuel_tank', 2912),
  // After the yard.
  at('hostage', 2990, { mode: 'wander', drop: 'fuel', look: 0 }),
  at('rifleman', 3000, { behavior: 'guard', facing: -1 }),
  at('mortar', 3040, { facing: -1 }),
  at('sniper', 2900, { facing: -1 }, { y: S - 64 }),
  // The bridge and the cable car (spawned off-screen so they are there when you arrive).
  at('m3_weak_bridge', 3090, { w: 160, floor: 512 }, { y: S, trigger: 3000 }),
  at('m3_cablecar', DOCK_A, { cable: CABLE, to: DOCK_B, stops: [{ x: PYLON, lock: JAM_LOCK }], speed: 48, ends: [3475, 4557] }, { y: D, trigger: 3040 }),
  at('bazooka', 3300, { behavior: 'guard', facing: -1 }),
  at('rifleman', 3390, { behavior: 'guard', facing: -1 }),
  at('rifleman', 3420, { behavior: 'idle', facing: -1 }),
  at('hostage', 3448, { drop: 'C', look: 1 }),
  // The ride, before the jam.
  at('drone', 3812, { kind: 'zap' }, { trigger: 3760 }),
  at('drone', 3840, { kind: 'zap' }, { trigger: 3770 }),
  at('jetpack', 3990, { facing: -1 }, { y: 330, trigger: 3930 }),
  // The ride, after the jam.
  at('drone', 4330, { kind: 'kamikaze' }, { trigger: 4250 }),
  at('drone', 4350, { kind: 'kamikaze' }, { trigger: 4260 }),
  at('drone', 4370, { kind: 'kamikaze' }, { trigger: 4270 }),
  at('jetpack', 4470, { facing: -1 }, { y: 330, trigger: 4400 }),
  // Arrival deck.
  at('rifleman', 4600, { behavior: 'guard', facing: -1 }),
  at('shield_trooper', 4650, { behavior: 'guard', facing: -1 }),
  at('hostage', 4686, { mode: 'caged', drop: 'H', look: 2 }),
  at('rifleman', 4790, { behavior: 'patrol' }),
  at('grenadier', 4830, { behavior: 'guard', facing: -1 }),
  // Frozen lake.
  at('snowmobile', 5010, { facing: -1 }),
  at('hostage', 5080, { drop: 'bomb', look: 0 }),
  at('rifleman', 5120, { behavior: 'chat', facing: 1 }),
  at('rifleman', 5140, { behavior: 'chat', facing: -1 }),
  at('pickup', 5170, { item: 'F' }),
  at('hostage', 5600, { mode: 'wander', drop: 'S', look: 1 }),
  at('mortar', 5720, { facing: -1 }),
  at('rifleman', 5790, { behavior: 'guard', facing: -1 }),
  at('pickup', 5850, { item: 'bomb' }),
  // Climb.
  at('rifleman', CLIFF - 40, { behavior: 'guard', facing: -1 }, { y: TIERS[1] }),
  at('grenadier', CLIFF - 60, { behavior: 'guard', facing: -1 }, { y: TIERS[3] }),
  at('hostage', CLIFF - 50, { drop: 'L', look: 2 }, { y: TIERS[4] }),
  at('sniper', CLIFF - 100, { facing: -1 }, { y: TIERS[6] }),
  at('mortar', 6470, { facing: -1 }),
  // Plateau.
  at('rifleman', 6420, { behavior: 'patrol' }),
  at('rifleman', 6470, { behavior: 'guard', facing: -1 }),
  at('pickup', 6500, { item: 'bomb' }),
  // Calm before the gate.
  at('hostage', 7160, { drop: 'H', look: 1 }),
  at('pickup', 7300, { item: 'bomb' }),
];

// ------------------------------------------------------------------ level

registerLevel({
  id: 'm3',
  mission: 3,
  name: 'FROSTBITE PASS',
  subtitle: 'Mission 3 - The mountain gate',
  briefing:
    'THE LEGION HOLDS THE ONLY ROAD OVER THE PEAKS. ' +
    'CROSS THE FOREST, HIT THEIR ALPINE STATION AND BORROW A STRIDER. ' +
    'RIDE THE CABLE CAR OVER THE GORGE, CROSS THE FROZEN LAKE AND CLIMB THE CLIFFS. ' +
    'THE FORTRESS GATE - FROST BASTION - MUST FALL. ' +
    'WATCH FOR SNOWMOBILE RAIDERS!',
  theme: 'm3',
  music: 'm3',
  bossMusic: 'boss',
  bossName: 'FROST BASTION',
  width: W,
  height: H,
  start: { x: 60 },
  timeLimit: 90,
  ground: GROUND,
  platforms: [
    { x: 970, y: 436, w: 60, style: 'rock' },
    { x: 1862, y: S - 64, w: 36, style: 'wood' },
    { x: 2420, y: 416, w: 96, style: 'metal' },
    { x: 2882, y: S - 64, w: 36, style: 'wood' },
    ...climbLedges,
  ],
  water: [{ x: 3090, y: 498, w: 104, h: 22 }],
  camera: [
    [0, 304, 304],
    [3200, 304, 304],
    [3330, 290, 304],
    [4380, 290, 304],
    [4500, 304, 304],
    [5740, 304, 304],
    [5800, 0, 304],
    [6040, 0, 304],
    [6110, 0, 0],
    [W, 0, 0],
  ],
  checkpoints: [560, 1300, 2300, 3300, 4400, 5100, 5900, 6560, 7300],
  entities,
  locks: [
    {
      // Clearing ambush: snowmobiles from both sides, paratroopers.
      x: 1300,
      waves: [
        { spawns: [at('snowmobile', 1720, { facing: -1 }), at('rifleman', 1310, { behavior: 'charge' }), at('rifleman', 1700, { behavior: 'charge' })] },
        {
          delay: 0.8,
          spawns: [at('paratrooper', 1420), at('paratrooper', 1520), at('paratrooper', 1610), at('shield_trooper', 1700, { behavior: 'charge' })],
        },
        {
          delay: 1,
          spawns: [at('snowmobile', 1268, { facing: 1 }), at('snowmobile', 1736, { facing: -1 }), at('officer', 1690), at('rifleman', 1712, { behavior: 'charge' })],
        },
      ],
    },
    {
      // Station yard: truck, tank, jetpacks.
      x: 2560,
      waves: [
        { spawns: [at('truck', 2990, { facing: -1, troops: 3, stopX: 2860 }), at('rifleman', 2570, { behavior: 'charge' }), at('rifleman', 2584, { behavior: 'charge' })] },
        { delay: 1, spawns: [at('light_tank', 3000, { facing: -1, behavior: 'advance' }), at('shield_trooper', 2964, { behavior: 'charge' }), at('shield_trooper', 2984, { behavior: 'charge' })] },
        {
          delay: 1,
          spawns: [
            at('jetpack', 2540, { facing: 1 }, { y: 360 }),
            at('jetpack', 2966, { facing: -1 }, { y: 350 }),
            at('grenadier', 2964, { behavior: 'charge' }),
            at('flametrooper', 2572, { behavior: 'charge' }),
          ],
        },
      ],
    },
    {
      // Mid-gorge: the cabin jams at the pylon.
      x: JAM_LOCK,
      trigger: JAM_TRIGGER,
      announce: 'CABLE JAMMED!',
      waves: [
        { spawns: [at('jetpack', JAM_LOCK + 404, { facing: -1 }, { y: 320 }), at('jetpack', JAM_LOCK - 24, { facing: 1 }, { y: 330 }), at('drone', JAM_LOCK + 400, { kind: 'zap' })] },
        {
          delay: 1,
          spawns: [
            at('paratrooper', PYLON - 22, { drift: 0 }),
            at('paratrooper', PYLON + 6, { drift: 0 }),
            at('paratrooper', PYLON + 28, { drift: 0 }),
            at('drone', JAM_LOCK - 20, { kind: 'kamikaze' }),
            at('drone', JAM_LOCK + 400, { kind: 'kamikaze' }),
          ],
        },
        { delay: 1.2, spawns: [at('heli', JAM_LOCK + 424, { facing: -1 })] },
      ],
    },
    {
      // Frozen lake.
      x: 5160,
      waves: [
        { spawns: [at('snowmobile', 5580, { facing: -1 }), at('snowmobile', 5136, { facing: 1 }), at('rifleman', 5560, { behavior: 'charge' })] },
        { delay: 1, spawns: [at('paratrooper', 5300), at('paratrooper', 5380), at('paratrooper', 5460), at('shield_trooper', 5570, { behavior: 'charge' })] },
        {
          delay: 1,
          spawns: [at('jetpack', 5580, { facing: -1 }, { y: 380 }), at('jetpack', 5140, { facing: 1 }, { y: 390 }), at('snowmobile', 5590, { facing: -1 }), at('grenadier', 5172, { behavior: 'charge' })],
        },
      ],
    },
    {
      // Gauntlet on the plateau.
      x: 6560,
      waves: [
        {
          spawns: [
            at('rifleman', 6960, { behavior: 'charge' }),
            at('rifleman', 6984, { behavior: 'charge' }),
            at('rifleman', 6572, { behavior: 'charge' }),
            at('shield_trooper', 6972, { behavior: 'charge' }),
            at('officer', 6996),
          ],
        },
        { delay: 1, spawns: [at('light_tank', 7000, { facing: -1, behavior: 'advance' }), at('grenadier', 6572, { behavior: 'charge' }), at('grenadier', 6586, { behavior: 'charge' })] },
        {
          delay: 1,
          spawns: [
            at('jetpack', 6970, { facing: -1 }, { y: 110 }),
            at('jetpack', 6540, { facing: 1 }, { y: 120 }),
            at('robot', 6976, { behavior: 'charge' }),
            at('paratrooper', 6700),
            at('paratrooper', 6820),
          ],
        },
        { delay: 1.2, spawns: [at('snowmobile', 6532, { facing: 1 }), at('snowmobile', 6990, { facing: -1 }), at('flametrooper', 6970, { behavior: 'charge' }), at('shield_trooper', 6990, { behavior: 'charge' })] },
      ],
    },
    {
      x: BOSS_X,
      boss: true,
      music: 'boss',
      announce: 'WARNING! FROST BASTION',
      waves: [{ spawns: [{ type: 'boss_m3', x: BOSS_X + 316 }] }],
    },
  ],
  decor,
});
