// MISSION 6 - IRON CITADEL: the Rustcoat Legion's fortress-factory at night, the finale.
//
// Route (two storeys: the lower works at floor y 426, the hangar level at floor y 198):
//   A  0-1560     the approach under the outer wall, a powered-down robot, then the GATE arena
//   B  1560-2960  the foundry: furnaces, molten-metal channels, a pouring ladle over a catwalk,
//                 the FOUNDRY arena
//   C  2960-4090  conveyor halls: belts that carry everything, hydraulic presses, the CONVEYOR arena
//   D  4090-5290  robot assembly line: the STRIDER walker, tanks and robot trucks (ASSEMBLY arena),
//                 then the scrap presses that wreck any vehicle
//   E  5290-5390  the reactor shaft: the maintenance lift climbs 228 px past the reactor core while
//                 drones and jetpacks ambush it (camera keys follow the climb)
//   F  5390-end   the hangar: the GAUNTLET arena, a calm walk past the walker cradles, then the
//                 JUGGERNAUT (boss arena built to the boss's spec: lock x = width - 384, flat floor
//                 at y 198 with the camera at the top, nothing else inside it)

import { registerLevel, type DecorDef, type LevelDef, type LockDef, type PlatformDef, type SolidDef, type WaterDef } from '../../game/level';
import type { SpawnSpec } from '../../game/registry';
import './m6/molten';
import './m6/conveyor';
import './m6/crusher';
import './m6/ladle';
import './m6/lift';

/** Level height and the two floors. */
export const M6_H = 456;
export const GL = 426;
export const GU = 198;

/** Reactor shaft: lift centre and the cliff up to the hangar level. */
export const SHAFT_L = 5292;
export const SHAFT_R = 5388;
export const LIFT_X = 5340;

/** Boss arena (built to src/content/levels/test/bosstest_m6.ts). */
export const BOSS_LOCK = 6720;
export const M6_W = BOSS_LOCK + 384;

// ------------------------------------------------------------------ builders

const entities: SpawnSpec[] = [];
const decor: DecorDef[] = [];
const platforms: PlatformDef[] = [];
const solids: SolidDef[] = [];
const water: WaterDef[] = [];

function E(type: string, x: number, y?: number, props?: Record<string, any>, trigger?: number): SpawnSpec {
  const s: SpawnSpec = { type, x };
  if (y !== undefined) s.y = y;
  if (props) s.props = props;
  if (trigger !== undefined) s.trigger = trigger;
  return s;
}

function add(...specs: SpawnSpec[]): void {
  entities.push(...specs);
}

function D(kind: string, x: number, y: number, props?: Record<string, any>, layer: 'back' | 'front' = 'back'): void {
  const d: DecorDef = { kind, x, y, layer };
  if (props) d.props = props;
  decor.push(d);
}

/** A back wall of riveted plates from x0 to x1 standing on floor y (split into <= 256 px decor pieces). */
function wallPanels(x0: number, x1: number, y: number, h: number, windows = true): void {
  for (let x = x0; x < x1; x += 256) D('panel', x, y, { w: Math.min(256, x1 - x), h, windows, behindTerrain: true, rib: 48 - ((x - x0) % 96) + 96 });
}

/** Lower floor profile (without pits). */
const LOWER: Array<[number, number]> = [
  [0, GL],
  [300, GL],
  [356, 412],
  [600, 412],
  [656, GL],
  [SHAFT_R, GL],
];

/** Molten channels cut into the lower floor: [x0, x1, surface depth below the floor]. */
const PITS: Array<[number, number, number]> = [
  [1700, 1726, 12],
  [1960, 1986, 12],
  [2150, 2270, 20],
  [2420, 2446, 12],
];

function yOn(line: Array<[number, number]>, x: number): number {
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    if (x >= x1 && x <= x2) return x2 === x1 ? Math.min(y1, y2) : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  }
  return line[line.length - 1][1];
}

/** Cut the lower floor at the pits, then add the shaft cliff and the hangar level. */
function buildGround(): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  let pi = 0;
  const pts = LOWER.slice();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    while (pi < PITS.length && PITS[pi][0] <= x) {
      const [a, b] = PITS[pi];
      cur.push([a, yOn(LOWER, a)]);
      out.push(cur);
      cur = [[b, yOn(LOWER, b)]];
      pi++;
    }
    if (!cur.length || cur[cur.length - 1][0] < x || i === 0) cur.push([x, y]);
  }
  cur.push([SHAFT_R, GU]);
  cur.push([M6_W, GU]);
  out.push(cur);
  return out;
}

for (const [a, b, depth] of PITS) {
  const fy = yOn(LOWER, a);
  const sy = fy + depth;
  water.push({ x: a, y: sy, w: b - a, h: M6_H - sy, deadly: true });
  D('pit', a, fy, { w: b - a, surface: sy, behindTerrain: true });
  add(E('m6_molten', (a + b) / 2, sy, { w: b - a, floor: fy }, a - 60));
}

// ================================================================== A: approach + gate (0-1560)

D('scrap', 150, GL);
D('sign', 240, GL, { icon: 'skull', post: 18 });
D('beacon', 330, 420, { post: 30 });
D('ammo', 520, 412);
// outer wall with searchlights, the gatehouse
D('wall', 700, GL, { w: 560, behindTerrain: true });
D('searchlight', 800, GL - 120);
D('searchlight', 1080, GL - 120);
D('gate', 1300, GL, { behindTerrain: true, w: 200 });
D('banner', 1236, GL - 150);
D('banner', 1364, GL - 150);
D('beacon', 1212, GL, { post: 24, color: 'red' });
D('beacon', 1388, GL, { post: 24, color: 'red' });
D('pipes', 940, GL);
D('sign', 1180, GL, { icon: 'cog', post: 20 });

add(
  E('hostage', 470, 412, { drop: 'H', look: 0 }),
  E('rifleman', 560, 412, { behavior: 'chat', facing: 1 }),
  E('rifleman', 580, 412, { behavior: 'chat', facing: -1 }),
  E('rifleman', 760, undefined, { behavior: 'sleep' }),
  // the signature enemy, introduced powered down
  E('robot', 860, undefined, { behavior: 'sleep', facing: -1 }),
  E('pickup', 905, undefined, { item: 'bomb' }),
  E('hostage', 950, undefined, { mode: 'caged', drop: 'bomb', look: 1 }),
  E('sandbags', 1060, undefined, { bags: 3, rows: 2 }),
  E('barrel', 1200),
  E('barrel', 1214),
);
// a watchtower past the gate with a marksman on it (walk under it and shoot up)
platforms.push({ x: 1436, y: 360, w: 52, style: 'girder' });
D('girder', 1442, GL, { h: 60 });
D('girder', 1482, GL, { h: 60 });
add(E('sniper', 1462, 360, { facing: -1 }), E('rifleman', 1520, undefined, { behavior: 'guard', facing: -1 }));

const LOCK_GATE: LockDef = {
  x: 1000,
  announce: 'THE GATE',
  waves: [
    {
      spawns: [
        E('robot', 1330, undefined, { behavior: 'charge', facing: -1 }),
        E('rifleman', 1300, undefined, { behavior: 'charge', facing: -1 }),
        E('rifleman', 1405, undefined, { behavior: 'charge', facing: -1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('shield_trooper', 1370, undefined, { behavior: 'charge', facing: -1 }),
        E('robot', 1420, undefined, { behavior: 'charge', facing: -1 }),
        E('jetpack', 1150, 226, { facing: 1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('officer', 1395, undefined, { behavior: 'charge', facing: -1 }),
        E('rifleman', 1340, undefined, { behavior: 'charge', facing: -1 }),
        E('saber', 985, undefined, { behavior: 'charge', facing: 1 }),
        E('flametrooper', 1425, undefined, { behavior: 'charge', facing: -1 }),
      ],
    },
  ],
};

// ================================================================== B: foundry (1560-2960)

D('furnace', 1620, GL);
D('girder', 1670, GL, { h: 230 });
D('sign', 1690, GL, { icon: 'molten', post: 14 });
D('chain', 1780, 236, { len: 56, load: 'ingot' });
D('furnace', 1880, GL);
D('banner', 1930, 300);
D('pipes', 2072, 396);
D('girder', 2120, GL, { h: 230 });
D('sign', 2136, GL, { icon: 'molten', post: 14 });
D('crane', 2120, 282, { w: 192, len: 22 });
D('furnace', 2340, GL);
D('chain', 2400, 236, { len: 70 });
D('girder', 2470, GL, { h: 230 });
D('furnace', 2600, GL);
D('banner', 2680, 296);
D('pipes', 2806, GL);
D('furnace', 2860, GL);
D('chain', 2915, 236, { len: 48, load: 'ingot' });

platforms.push({ x: 1752, y: 386, w: 96, style: 'grate' });
solids.push({ x: 2030, y: 396, w: 70, h: 30 });
// catwalk across the molten basin, the ladle pouring into it
platforms.push({ x: 2146, y: GL, w: 128, style: 'grate' });
platforms.push({ x: 2690, y: 384, w: 80, style: 'grate' });

add(
  E('crate_prop', 1610, undefined, { drop: 'S' }),
  E('hostage', 1800, 386, { drop: 'F', look: 2 }),
  E('grenadier', 1836, 386, { behavior: 'guard', facing: -1 }),
  E('robot', 1905, undefined, { behavior: 'patrol', facing: -1 }),
  E('flametrooper', 2072, 396, { behavior: 'guard', facing: -1 }),
  E('m6_ladle', 2210, GL + 20, { height: 112, cycle: 4.6, splash: 2 }, 2080),
  E('robot', 2320, undefined, { behavior: 'guard', facing: -1 }),
  E('hostage', 2350, undefined, { mode: 'wander', drop: 'R', look: 0 }),
  E('rifleman', 2385, undefined, { behavior: 'sleep' }),
  E('pickup', 2480, undefined, { item: 'bomb' }),
  E('barrel', 2862),
  E('barrel', 2876),
);

const LOCK_FOUNDRY: LockDef = {
  x: 2520,
  announce: 'FOUNDRY',
  waves: [
    {
      spawns: [
        E('flametrooper', 2925, undefined, { behavior: 'charge', facing: -1 }),
        E('robot', 2955, undefined, { behavior: 'charge', facing: -1 }),
        E('shield_trooper', 2505, undefined, { behavior: 'charge', facing: 1 }),
      ],
    },
    {
      delay: 0.8,
      spawns: [
        E('jetpack', 2700, 226, { facing: -1 }),
        E('drone', 2935, undefined, { kind: 'zap' }),
        E('drone', 2965, undefined, { kind: 'zap' }),
        E('rifleman', 2930, undefined, { behavior: 'charge', facing: -1 }),
      ],
    },
    {
      delay: 0.8,
      spawns: [
        E('officer', 2940, undefined, { behavior: 'charge', facing: -1 }),
        E('shield_trooper', 2915, undefined, { behavior: 'charge', facing: -1 }),
        E('robot', 2965, undefined, { behavior: 'charge', facing: -1 }),
        E('saber', 2500, undefined, { behavior: 'charge', facing: 1 }),
      ],
    },
  ],
};

// ================================================================== C: conveyor halls (2960-4090)

wallPanels(2968, 4096, GL, 112);
D('vent', 3040, 360);
D('sign', 3010, GL, { icon: 'crush', post: 16 });
D('chain', 3130, 236, { len: 64, load: 'ingot' });
D('beacon', 3180, 340, { color: 'amber' });
D('banner', 3412, 312);
D('banner', 3612, 312);
D('sign', 3416, GL, { icon: 'crush', post: 16 });
D('pipes', 3650, GL);
D('vent', 3760, 356);
D('emblem', 3900, 352);
D('chain', 3990, 236, { len: 40 });
D('beacon', 3820, 340, { color: 'red' });
D('beacon', 4040, 340, { color: 'red' });

solids.push({ x: 3200, y: 394, w: 170, h: 32 });

add(
  E('m6_conveyor', 3075, GL, { w: 150, speed: 32 }, 2960),
  E('m6_crusher', 3080, GL, { cycle: 3.4, offset: 0 }, 2980),
  E('crate_prop', 3015, undefined, { drop: 'R' }),
  E('rifleman', 3150, undefined, { behavior: 'idle', facing: -1 }),
  E('rifleman', 3172, undefined, { behavior: 'idle', facing: -1 }),
  E('officer', 3192, undefined, { facing: -1 }),
  E('m6_conveyor', 3285, 394, { w: 160, speed: -34 }, 3150),
  E('m6_crusher', 3300, 394, { cycle: 3.6, offset: 1.2, clearance: 42 }, 3160),
  E('hostage', 3352, 394, { mode: 'caged', drop: 'L', look: 1 }, 3230),
  E('robot', 3330, 394, { behavior: 'patrol', facing: -1 }),
  E('m6_conveyor', 3510, GL, { w: 180, speed: -40 }, 3380),
  E('m6_crusher', 3466, GL, { cycle: 3.4, offset: 0 }, 3390),
  E('m6_crusher', 3556, GL, { cycle: 3.4, offset: 1.7 }, 3400),
  E('robot', 3590, undefined, { behavior: 'guard', facing: -1 }),
  E('hostage', 3630, undefined, { drop: 'H', look: 2 }),
  E('pickup', 3672, undefined, { item: 'bomb' }),
  E('m6_conveyor', 3900, GL, { w: 240, speed: -26 }, 3700),
);

const LOCK_CONVEYOR: LockDef = {
  x: 3700,
  announce: 'CONVEYOR HALL',
  waves: [
    {
      spawns: [
        E('robot', 4100, undefined, { behavior: 'charge', facing: -1 }),
        E('robot', 4140, undefined, { behavior: 'charge', facing: -1 }),
        E('robot', 4185, undefined, { behavior: 'charge', facing: -1 }),
        E('saber', 3685, undefined, { behavior: 'charge', facing: 1 }),
      ],
    },
    {
      delay: 0.8,
      spawns: [E('bunker', 4050, undefined, { facing: -1, troop: 'robot', maxTroops: 2, spawnEvery: 4.5 }), E('drone', 4120, undefined, { kind: 'kamikaze' }), E('drone', 4150, undefined, { kind: 'kamikaze' })],
    },
    {
      delay: 0.8,
      spawns: [
        E('shield_trooper', 4100, undefined, { behavior: 'charge', facing: -1 }),
        E('shield_trooper', 4150, undefined, { behavior: 'charge', facing: -1 }),
        E('flametrooper', 3680, undefined, { behavior: 'charge', facing: 1 }),
        E('officer', 4170, undefined, { behavior: 'charge', facing: -1 }),
      ],
    },
  ],
};

// ================================================================== D: assembly line + STRIDER (4090-5290)

wallPanels(4096, 5240, GL, 136);
D('scrap', 4130, GL);
D('arm', 4290, GL);
D('arm', 4370, GL, { flip: true });
D('chain', 4330, 290, { len: 36, load: 'robot' });
D('walker', 4470, GL);
D('arm', 4560, GL);
D('banner', 4600, 290);
D('chain', 4700, 290, { len: 28, load: 'robot' });
D('crane', 4660, 292, { w: 224, len: 30 });
D('walker', 4820, GL);
D('arm', 4930, GL, { flip: true });
D('banner', 4990, 290);
D('beacon', 5050, 330, { color: 'red' });
D('scrap', 5060, GL);
D('sign', 5086, GL, { icon: 'crush', post: 20 });
D('beacon', 5236, 362, { color: 'red' });

solids.push({ x: 4600, y: 386, w: 60, h: 40 });

add(
  E('mech', 4180, undefined, { ammo: 20, facing: 1 }),
  E('hostage', 4250, undefined, { mode: 'caged', drop: 'C', look: 0 }),
  E('m6_conveyor', 4420, GL, { w: 160, speed: 20 }, 4300),
  E('robot', 4380, undefined, { behavior: 'sleep', facing: -1 }),
  E('robot', 4420, undefined, { behavior: 'sleep', facing: -1 }),
  E('robot', 4460, undefined, { behavior: 'sleep', facing: -1 }),
  E('pickup', 4540, undefined, { item: 'bomb' }),
  E('fuel_tank', 4930),
  E('mortar', 4630, 386, { facing: -1 }),
  E('light_tank', 4700, undefined, { behavior: 'hold', facing: -1 }),
  E('rifleman', 4672, undefined, { behavior: 'guard', facing: -1 }),
);

const LOCK_ASSEMBLY: LockDef = {
  x: 4620,
  announce: 'ASSEMBLY LINE',
  waves: [
    {
      spawns: [
        E('light_tank', 5050, GL, { behavior: 'advance', facing: -1 }),
        E('robot', 5025, GL, { behavior: 'charge', facing: -1 }),
        E('robot', 5080, GL, { behavior: 'charge', facing: -1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('truck', 5070, GL, { troop: 'robot', troops: 3, facing: -1 }),
        E('drone', 4600, undefined, { kind: 'kamikaze' }),
        E('drone', 4585, undefined, { kind: 'kamikaze' }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('light_tank', 5060, GL, { behavior: 'advance', facing: -1 }),
        E('jetpack', 4770, 226, { facing: 1 }),
        E('jetpack', 4910, 226, { facing: -1 }),
        E('officer', 5040, GL, { behavior: 'charge', facing: -1 }),
      ],
    },
  ],
};

add(
  E('hostage', 5030, GL, { drop: 'S', look: 1 }),
  // the scrap line: vehicles do not get past these
  E('m6_crusher', 5120, GL, { scrap: true, cycle: 3.0, offset: 0 }, 4990),
  E('m6_crusher', 5184, GL, { scrap: true, cycle: 3.0, offset: 1.5 }, 5000),
);

// ================================================================== E: reactor shaft (5290-5390)

solids.push({ x: 5240, y: 0, w: SHAFT_L - 5240, h: 362 });
D('reactor', LIFT_X, GL, { h: 340, behindTerrain: true, w: 120 });
D('pipes', 5420, 300);
D('vent', 5452, 350);
D('beacon', 5400, 250, { color: 'red' });
D('sign', 5260, 300, { icon: 'volt', post: 0 });
D('vent', 5266, 330);

add(
  E(
    'm6_lift',
    LIFT_X,
    GL,
    {
      top: GU,
      w: SHAFT_R - SHAFT_L,
      speed: 44,
      events: [
        { at: 0.1, type: 'drone', dx: 420, props: { kind: 'zap' } },
        { at: 0.14, type: 'drone', dx: 440, props: { kind: 'zap' } },
        // flies in from the right at hover height (dropping in from above, it began aiming inside
        // the HUD band while the camera climbed), hovering a little lower than usual for headroom
        { at: 0.38, type: 'jetpack', dx: 160, dy: -14, props: { facing: -1, height: 54 } },
        { at: 0.6, type: 'drone', dx: -24, props: { kind: 'kamikaze' } },
        { at: 0.64, type: 'drone', dx: -36, props: { kind: 'kamikaze' } },
      ],
    },
    5100,
  ),
  // The hangar's guard stands back from the shaft, out of view during the climb (camera right edge
  // ~5562-5605): a rider on the lift cannot shoot back at the floor above him, so nobody up there
  // may shoot down at him either, and he steps off onto clear floor before anyone engages. (A turret,
  // a sniper and a robot used to wait at the shaft's lip and shot riders from the top edge.)
  E('robot', 5640, GU, { behavior: 'guard', facing: -1 }),
);

// ================================================================== F: hangar (5390-end)

wallPanels(5388, BOSS_LOCK + 270, GU, 112);
for (let x = 5388; x < M6_W; x += 240) D('truss', x, 76, { w: Math.min(240, M6_W - x), behindTerrain: true });
D('hangar_door', BOSS_LOCK + 270, GU, { h: 150, w: 114 });
D('banner', 5470, 84);
D('beacon', 5560, 132, { color: 'red' });
D('banner', 5700, 84);
D('emblem', 5832, 128);
D('banner', 5964, 84);
D('beacon', 6020, 132, { color: 'red' });
D('walker', 6160, GU);
D('ammo', 6260, GU);
D('banner', 6330, 84);
D('chain', 6390, 84, { len: 28, load: 'robot' });
D('walker', 6480, GU);
D('crane', 6520, 92, { w: 160, len: 18 });
D('vent', 6650, 140);
// boss arena backdrop: sparse so the walker reads
D('banner', 6790, 84);
D('beacon', 6740, 132, { color: 'red' });
D('banner', 6900, 84);
D('beacon', 6950, 132, { color: 'red' });

platforms.push({ x: 5800, y: 156, w: 84, style: 'girder' });

add(
  E('hostage', 5500, GU, { drop: 'bomb', look: 2 }),
  E('pickup', 5590, GU, { item: 'bomb' }),
  E('sniper', 5850, 156, { facing: -1 }),
  E('barrel', 5986, GU),
  E('barrel', 6000, GU),
);

const LOCK_GAUNTLET: LockDef = {
  x: 5640,
  announce: 'WARNING! HANGAR GAUNTLET',
  waves: [
    {
      spawns: [
        E('robot', 6045, GU, { behavior: 'charge', facing: -1 }),
        E('robot', 6085, GU, { behavior: 'charge', facing: -1 }),
        E('flametrooper', 6065, GU, { behavior: 'charge', facing: -1 }),
        E('saber', 5625, GU, { behavior: 'charge', facing: 1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('light_tank', 6090, GU, { behavior: 'advance', facing: -1 }),
        E('shield_trooper', 6050, GU, { behavior: 'charge', facing: -1 }),
        E('shield_trooper', 5622, GU, { behavior: 'charge', facing: 1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('jetpack', 5760, -14, { facing: 1 }),
        E('jetpack', 5950, -14, { facing: -1 }),
        E('drone', 6060, undefined, { kind: 'zap' }),
        E('drone', 6090, undefined, { kind: 'zap' }),
        E('officer', 6050, GU, { behavior: 'charge', facing: -1 }),
      ],
    },
    {
      delay: 1,
      spawns: [
        E('truck', 6100, GU, { troop: 'robot', troops: 3, facing: -1 }),
        E('drone', 5615, undefined, { kind: 'kamikaze' }),
        E('drone', 5600, undefined, { kind: 'kamikaze' }),
        E('flametrooper', 5610, GU, { behavior: 'charge', facing: 1 }),
      ],
    },
  ],
};

add(
  E('hostage', 6150, GU, { drop: 'L', look: 0 }),
  E('crate_prop', 6300, GU, { drop: 'H', size: 'big' }),
  E('hostage', 6420, GU, { mode: 'caged', drop: 'R', look: 1 }),
  E('pickup', 6560, GU, { item: 'bomb' }),
  E('pickup', 6600, GU, { item: 'bomb' }),
);

const LOCK_BOSS: LockDef = {
  x: BOSS_LOCK,
  boss: true,
  waves: [{ spawns: [{ type: 'boss_m6', x: BOSS_LOCK + 290 }] }],
};

// ------------------------------------------------------------------ the level

export const M6_LEVEL: LevelDef = {
  id: 'm6',
  mission: 6,
  name: 'IRON CITADEL',
  subtitle: 'OPERATION IRON FIST',
  briefing:
    "THIS IS IT: GRISTLE'S IRON CITADEL. STORM THE GATE, CROSS THE FOUNDRY AND MIND THE MOLTEN CHANNELS. " +
    'THE CONVEYOR HALLS ARE FULL OF PRESSES - TIME YOUR RUNS. GRAB THE STRIDER ON THE ROBOT LINE, RIDE THE ' +
    'REACTOR LIFT TO THE HANGAR AND STOP THE JUGGERNAUT BEFORE IT WAKES. FREE THE LAST CAPTIVES. GOOD LUCK.',
  theme: 'm6',
  music: 'm6',
  bossMusic: 'boss_final',
  bossName: 'JUGGERNAUT',
  width: M6_W,
  height: M6_H,
  start: { x: 60 },
  ground: buildGround(),
  platforms,
  solids,
  water,
  camera: [
    [0, M6_H - 216, M6_H - 216],
    [5120, M6_H - 216, M6_H - 216],
    [5150, 0, M6_H - 216],
    [5260, 0, M6_H - 216],
    [5420, 0, 0],
  ],
  checkpoints: [1100, 2300, 3400, 4500, 5250, 5900, 6600],
  timeLimit: 99,
  entities,
  locks: [LOCK_GATE, LOCK_FOUNDRY, LOCK_CONVEYOR, LOCK_ASSEMBLY, LOCK_GAUNTLET, LOCK_BOSS],
  decor,
};

registerLevel(M6_LEVEL);
