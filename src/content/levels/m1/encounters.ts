// Mission 1 (PALM HARBOR) encounters: one-off spawns (entities) and the camera-lock arenas.
// Tutorial pacing: calm soldiers with personality (sleeping by the campfire, chatting on the
// boardwalk), the grenadier introduced behind cover, paratroopers + a troop truck in the village
// square, the BULLDOG tank at ~42% followed by a jungle road full of fodder and two light tanks,
// one bunker at the river, one sniper (hut roof) and one mortar crew (depot), shield troopers late,
// a helicopter in the gauntlet, then a calm walk to the stockade gate and the GRINDER.
// Hostages (10) drop the good weapons; bomb crates sit before every arena.

import type { LockDef } from '../../../game/level';
import type { SpawnSpec } from '../../../game/registry';
import { M1 } from '../../themes/m1/layout';

const G = M1.GY;
const P = M1.PY;
const DECK = 288;

type Props = Record<string, any>;
const at = (type: string, x: number, props?: Props, y?: number, trigger?: number): SpawnSpec => ({ type, x, y, props, trigger });
const rifle = (x: number, behavior: string, props: Props = {}, y?: number) => at('rifleman', x, { behavior, ...props }, y);
const charge = (type: string, x: number, props: Props = {}) => at(type, x, { behavior: 'charge', ...props });
const hostage = (x: number, drop: string, mode: 'tied' | 'caged' | 'wander' = 'tied', look = 0, y?: number) => at('hostage', x, { drop, mode, look }, y);

/** Arena camera-left positions (the boss lock is at M1.bossL). */
export const ARENAS = { beach: 1180, village: 2400, road: 3460, depot: 4600, gauntlet: 5600 } as const;

export const ENTITIES: SpawnSpec[] = [
  // ---- Landing beach: a breather. First hostage hands out the heavy machine gun.
  hostage(330, 'H', 'tied', 0),
  rifle(478, 'sleep', { facing: 1 }),
  rifle(524, 'sleep', { facing: -1 }),
  rifle(614, 'idle', { facing: -1 }),
  // ---- Beach outpost: the grenadier behind the rock, a lookout on the tower, sandbag cover.
  rifle(800, 'patrol', { facing: -1 }),
  at('sandbags', 980, { bags: 3, rows: 2 }),
  rifle(950, 'guard', { facing: -1 }, 262),
  at('grenadier', 1098, { behavior: 'guard', facing: -1 }),
  at('barrel', 1118),
  at('crate_prop', 1150, { drop: 'bomb' }),
  // Arena 1 hostage (rescued during the fight).
  hostage(1480, 'bomb', 'tied', 1),
  // ---- Stilt village: chatters on the boardwalk, a grenadier on a roof, the sniper on the other.
  rifle(1764, 'sleep', { facing: 1 }, DECK),
  rifle(1880, 'chat', {}, DECK),
  rifle(1899, 'chat', {}, DECK),
  at('grenadier', 1792, { behavior: 'guard', facing: -1 }, 234),
  hostage(1962, 'S', 'caged', 2, DECK),
  at('sniper', 2121, { facing: -1 }, 234),
  charge('saber', 2262, {}),
  hostage(2384, 'bomb', 'wander', 1),
  at('crate_prop', 2364, { drop: 'bomb' }),
  // ---- Jungle road: the BULLDOG waits at a Legion cache; fodder and a light tank to crush.
  at('tank', 2884, { facing: 1 }),
  at('pickup', 2944, { item: 'bomb' }),
  rifle(3046, 'chat', {}, G - 10),
  rifle(3064, 'chat', {}, G - 10),
  rifle(3104, 'patrol', { facing: -1 }, G - 10),
  at('barrel', 3126, {}, G - 10),
  hostage(3164, 'bomb', 'tied', 2),
  at('grenadier', 3312, { behavior: 'guard', facing: -1 }, 266),
  at('light_tank', 3330, { facing: -1 }),
  rifle(3392, 'patrol', { facing: -1 }),
  rifle(3418, 'idle', { facing: -1 }),
  at('crate_prop', 3446, { drop: 'bomb', size: 'big' }),
  // Arena 3 hostage.
  hostage(3700, 'H', 'tied', 0),
  // ---- River crossing: a weapon case after the arena, the bunker on the far bank.
  at('pickup', 3892, { item: 'H' }),
  rifle(3996, 'idle', { facing: -1 }, 300),
  at('bunker', 4238, { facing: -1 }),
  hostage(4300, 'F', 'caged', 1),
  // ---- Cliff climb to the fuel depot.
  rifle(4362, 'guard', { facing: -1 }, G - 40),
  at('grenadier', 4410, { behavior: 'guard', facing: -1 }, G - 80),
  rifle(4456, 'guard', { facing: -1 }, P),
  hostage(4528, 'R', 'tied', 2, P),
  at('crate_prop', 4566, { drop: 'bomb' }, P),
  // Depot props: fuel tanks and barrels near the Legion troops.
  at('barrel', 4662, {}, P),
  at('barrel', 4846, {}, P),
  at('fuel_tank', 4948, {}, P),
  hostage(4790, 'points', 'tied', 0, P),
  // ---- Down the slope: a patrol, a marked minefield, a wandering hostage, weapon cases.
  rifle(5176, 'patrol', { facing: -1 }),
  at('mine', 5344),
  at('mine', 5426),
  hostage(5500, 'firebomb', 'wander', 2),
  at('pickup', 5536, { item: 'S' }),
  at('pickup', 5566, { item: 'bomb' }),
  // ---- Calm approach to the stockade: a last hostage and supplies for the boss.
  hostage(6262, 'life', 'caged', 0),
  at('pickup', 6386, { item: 'bomb' }),
  at('pickup', 6430, { item: 'H' }),
  // The stockade gate the GRINDER smashes through (cosmetic).
  at('m1_gate', M1.bossL + 352, {}),
];

export const LOCKS: LockDef[] = [
  // Arena 1 - beach outpost: riflemen from both sides, the grenadier, then a gun jeep.
  {
    x: ARENAS.beach,
    waves: [
      { spawns: [charge('rifleman', 1600), charge('rifleman', 1632), charge('rifleman', ARENAS.beach + 12, { facing: 1 })], delay: 0.8 },
      { spawns: [charge('grenadier', 1596), charge('rifleman', 1628), charge('rifleman', ARENAS.beach + 12, { facing: 1 })], delay: 1.0 },
      { spawns: [at('jeep', 1660, { facing: -1, stopX: 1452, bursts: 3 })], delay: 1.2 },
    ],
  },
  // Arena 2 - village square: paratroopers drop in, a troop truck, then a mixed squad.
  {
    x: ARENAS.village,
    waves: [
      { spawns: [at('paratrooper', 2540), at('paratrooper', 2640), at('paratrooper', 2736)], delay: 0.8 },
      { spawns: [at('truck', 2860, { facing: -1, stopX: 2700, troops: 3 }), charge('rifleman', ARENAS.village + 12, { facing: 1 })], delay: 1.0 },
      { spawns: [at('paratrooper', 2490), at('paratrooper', 2690), charge('saber', 2824), charge('grenadier', 2836)], delay: 1.0 },
    ],
  },
  // Arena 3 - jungle road: infantry rush, the second light tank, sabers.
  {
    x: ARENAS.road,
    waves: [
      { spawns: [charge('rifleman', 3880), charge('rifleman', 3904), charge('grenadier', 3920), charge('rifleman', ARENAS.road + 12, { facing: 1 })], delay: 0.8 },
      { spawns: [at('light_tank', 3910, { facing: -1 }), charge('rifleman', ARENAS.road + 12, { facing: 1 }), charge('rifleman', 3930)], delay: 1.2 },
      { spawns: [charge('saber', 3900), charge('saber', ARENAS.road + 12, { facing: 1 }), charge('rifleman', 3926)], delay: 1.0 },
    ],
  },
  // Arena 4 - fuel depot on the plateau: riflemen, then the mortar crew, then a shield trooper.
  {
    x: ARENAS.depot,
    waves: [
      { spawns: [charge('rifleman', 5016), charge('rifleman', 5040), charge('grenadier', 5052), charge('rifleman', ARENAS.depot + 12, { facing: 1 })], delay: 0.8 },
      { spawns: [at('mortar', 4930, { facing: -1 }), charge('rifleman', 5020), charge('rifleman', 5044)], delay: 1.2 },
      { spawns: [charge('shield_trooper', 5020), charge('rifleman', 5044), charge('rifleman', ARENAS.depot + 12, { facing: 1 })], delay: 1.0 },
    ],
  },
  // Arena 5 - the gauntlet at the stockade: shields, the Hornet, an officer's rally, a last rush.
  {
    x: ARENAS.gauntlet,
    waves: [
      { spawns: [charge('shield_trooper', 6020), charge('shield_trooper', 6052), charge('grenadier', 6040), charge('rifleman', ARENAS.gauntlet + 12, { facing: 1 })], delay: 0.8 },
      { spawns: [at('heli', 6080, { facing: -1 }), charge('rifleman', 6024), charge('rifleman', ARENAS.gauntlet + 12, { facing: 1 })], delay: 1.2 },
      { spawns: [at('officer', 6044, { facing: -1 }), charge('rifleman', 6004), charge('rifleman', 6024), charge('saber', 6064), charge('rifleman', ARENAS.gauntlet + 12, { facing: 1 })], delay: 1.2 },
      { spawns: [charge('saber', ARENAS.gauntlet + 12, { facing: 1 }), charge('shield_trooper', 6030), charge('grenadier', 6050)], delay: 1.0 },
    ],
  },
  // Boss - GRINDER (no announce: the boss shows its own WARNING banner).
  { x: M1.bossL, boss: true, waves: [{ spawns: [{ type: 'boss_m1', x: M1.bossL + 282 }] }] },
];
