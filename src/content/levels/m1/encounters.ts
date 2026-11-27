// Mission 1 (PALM HARBOR) encounters: one-off spawns (entities) and the camera-lock arenas.
// Tutorial pacing, forgiving: calm soldiers with personality (sleeping by the campfire, chatting on
// the boardwalk), the grenadier introduced behind a rock, a gun jeep, paratroopers and a troop truck
// in the village square, the BULLDOG at ~42% followed by the jungle road (fodder, two Stomper light
// tanks, the bunker) that ends in the muddy river ford (m1_bog: vehicles sink there), the cliff
// climb to the fuel depot (the only mortar crew), the minefield, then the stockade gauntlet (shield
// troopers, the Hornet, an officer on the watchtower) and a calm walk to the stockade gate.
// One sniper, on a hut roof. 10 hostages drop the good weapons; bomb crates sit before the arenas.
// Grenade budget: 7 bomb cases (+10 each) and the fire-bomb case on top of the 10 you start with -
// with more, a player walks into the GRINDER's yard with 60-90 grenades and scraps it in ~15 s.
//
// Wave rules learned the hard way: riflemen and grenadiers only walk toward you from beyond ~130-170
// px and back away when you get close - spawned at (or pushed past) the LEFT edge of a locked screen
// they never come back into view and the wave never ends. So wave infantry enters off the RIGHT edge
// (they walk in) or from above (paratroopers); only sabers (who always charge) come in from behind,
// and only after a blinking "!" on the left edge (sneak(): m2_incoming, then they run in from just
// past the edge - never popping into view next to you). Officers stand on screen.

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

/** Wave helper: off the right edge of an arena (walks in). */
const right = (L: number, d: number) => L + 384 + d;
/**
 * A swordsman coming up behind you: a blinking "!" on the left edge of the locked screen first
 * (m2_incoming, no engine rumble), then he runs in from just past that edge. He never pops into
 * view next to a player who is backing away from the right side.
 */
const sneak = (L: number) => at('m2_incoming', L - 18, { type: 'saber', rumble: false, delay: 1.0, props: { behavior: 'charge', facing: 1 } });
/** Paratrooper dropping in over arena x (starts above the screen). */
const para = (x: number, props: Props = {}) => at('paratrooper', x, props);

export const ENTITIES: SpawnSpec[] = [
  // ---- Landing beach: a breather. The first hostage hands out the heavy machine gun.
  hostage(330, 'H', 'tied', 0),
  // Two sentries asleep by the campfire, a third one dozing on his feet.
  rifle(478, 'sleep', { facing: 1 }),
  rifle(524, 'sleep', { facing: -1 }),
  rifle(614, 'idle', { facing: -1 }),
  // ---- Beach outpost: a patrol, a lookout on the tower, the grenadier behind the rock.
  rifle(800, 'patrol', { facing: -1 }),
  at('sandbags', 900, { bags: 3, rows: 2 }, undefined, 880),
  rifle(950, 'guard', { facing: -1 }, 262),
  at('grenadier', 1098, { behavior: 'guard', facing: -1 }),
  at('barrel', 1118),
  at('crate_prop', 1150, { drop: 'bomb' }),
  // Arena 1 hostage (tied up at the jetty, rescued during the fight): a score item (the crate above
  // already refilled the grenades).
  hostage(1480, 'item:item_watch', 'tied', 1),
  // ---- Stilt village: a sleeper and two chatters on the boardwalk, a grenadier on the first roof,
  // the sniper on the second, a swordsman guarding the far end.
  rifle(1764, 'sleep', { facing: 1 }, DECK),
  rifle(1880, 'chat', {}, DECK),
  rifle(1899, 'chat', {}, DECK),
  at('grenadier', 1792, { behavior: 'guard', facing: -1 }, 234),
  hostage(1962, 'S', 'caged', 2, DECK),
  at('sniper', 2121, { facing: -1 }, 234),
  at('saber', 2262, { behavior: 'guard', facing: -1 }),
  at('crate_prop', 2346, { drop: 'bomb' }),
  hostage(2384, 'item:item_gem', 'wander', 1),
  // ---- Jungle road: the BULLDOG waits at a Legion cache; fodder, a lookout, a Stomper to crush.
  at('tank', 2884, { facing: 1 }, undefined, 2852),
  at('pickup', 2944, { item: 'bomb' }),
  rifle(3046, 'chat', {}, G - 10),
  rifle(3064, 'chat', {}, G - 10),
  rifle(3104, 'patrol', { facing: -1 }, G - 10),
  at('barrel', 3126, {}, G - 10),
  // A fuel can for the BULLDOG (repairs half its armour) before the Stomper.
  hostage(3164, 'fuel', 'tied', 2),
  at('grenadier', 3312, { behavior: 'guard', facing: -1 }, 266),
  at('light_tank', 3340, { facing: -1, behavior: 'hold' }, undefined, 3310),
  rifle(3392, 'patrol', { facing: -1 }),
  rifle(3418, 'idle', { facing: -1 }),
  at('barrel', 3436),
  at('crate_prop', 3452, { drop: 'bomb', size: 'big' }),
  // Arena 3 hostage.
  hostage(3700, 'R', 'tied', 0),
  // ---- The bunker guards the ford. The bridge is out and the river bed is mud: vehicles sink.
  at('bunker', 3894, { facing: -1 }, undefined, 3860),
  at('m1_bog', (M1.riverX0 + M1.riverX1) / 2, { w: M1.riverX1 - M1.riverX0 - 20 }),
  // Far bank: a weapon case and a caged mechanic at the foot of the cliff.
  at('pickup', 4196, { item: 'H' }),
  hostage(4290, 'F', 'caged', 1),
  // ---- Cliff climb to the fuel depot.
  rifle(4362, 'guard', { facing: -1 }, G - 40),
  at('grenadier', 4410, { behavior: 'guard', facing: -1 }, G - 80),
  rifle(4466, 'guard', { facing: -1 }, P),
  hostage(4528, 'item:item_ration', 'tied', 2, P),
  at('crate_prop', 4566, { drop: 'bomb' }, P),
  // Depot props: barrels and a fuel tank among the Legion troops.
  at('barrel', 4662, {}, P),
  at('barrel', 4846, {}, P),
  at('fuel_tank', 4906, {}, P, 4880), // the mortar crew sets up right behind it
  // ---- Down the slope: a patrol, a marked minefield, a wandering mechanic, weapon cases.
  rifle(5176, 'patrol', { facing: -1 }),
  at('mine', 5344),
  at('mine', 5426),
  hostage(5480, 'firebomb', 'wander', 2),
  at('pickup', 5536, { item: 'S' }),
  at('crate_prop', 5566, { drop: 'bomb' }),
  // ---- Stockade outskirts: an officer on the watchtower rallies the gauntlet.
  at('officer', 5862, { facing: -1, behavior: 'guard', drop: 'item:item_medal' }, 262),
  // ---- Calm approach to the stockade: a last mechanic and supplies for the boss.
  hostage(6262, 'life', 'caged', 0),
  at('pickup', 6386, { item: 'bomb' }),
  at('pickup', 6430, { item: 'H' }),
  // The stockade gate the GRINDER smashes through (cosmetic).
  at('m1_gate', M1.bossL + 352, {}, undefined, M1.bossL + 310),
];

const A = ARENAS;

export const LOCKS: LockDef[] = [
  // Arena 1 - beach outpost: riflemen from the jetty and one sneaking up the beach, then the
  // grenadier with company, then a gun jeep races in along the shore.
  {
    x: A.beach,
    waves: [
      { spawns: [charge('rifleman', right(A.beach, 16)), charge('rifleman', right(A.beach, 44)), charge('rifleman', right(A.beach, 72))], delay: 0.8 },
      { spawns: [charge('grenadier', right(A.beach, 20)), charge('rifleman', right(A.beach, 48)), charge('rifleman', right(A.beach, 76))], delay: 1.0 },
      { spawns: [at('jeep', right(A.beach, 60), { facing: -1, stopX: A.beach + 280, bursts: 3 })], delay: 1.2 },
    ],
  },
  // Arena 2 - village square: paratroopers drop in, a troop truck, then a mixed squad.
  {
    x: A.village,
    waves: [
      { spawns: [para(A.village + 150), para(A.village + 250), para(A.village + 330)], delay: 0.8 },
      { spawns: [at('truck', right(A.village, 70), { facing: -1, stopX: A.village + 300, troops: 3 }), para(A.village + 110)], delay: 1.0 },
      { spawns: [para(A.village + 90), para(A.village + 290), charge('grenadier', right(A.village, 24)), charge('rifleman', right(A.village, 52))], delay: 1.0 },
    ],
  },
  // Arena 3 - jungle road: an infantry rush, the second Stomper, then a swordsman from behind.
  {
    x: A.road,
    waves: [
      { spawns: [charge('rifleman', right(A.road, 16)), charge('rifleman', right(A.road, 40)), charge('grenadier', right(A.road, 64)), charge('rifleman', right(A.road, 92))], delay: 0.8 },
      { spawns: [at('light_tank', right(A.road, 60), { facing: -1, behavior: 'advance' }), charge('rifleman', right(A.road, 20)), charge('rifleman', right(A.road, 110))], delay: 1.2 },
      { spawns: [sneak(A.road), charge('rifleman', right(A.road, 16)), charge('rifleman', right(A.road, 44))], delay: 1.0 },
    ],
  },
  // Arena 4 - fuel depot on the plateau: riflemen, then the mortar crew sets up at the far end,
  // then the first shield trooper.
  {
    x: A.depot,
    waves: [
      { spawns: [charge('rifleman', right(A.depot, 12)), charge('rifleman', right(A.depot, 30)), charge('grenadier', right(A.depot, 48))], delay: 0.8 },
      { spawns: [at('mortar', A.depot + 352, { facing: -1 }), charge('rifleman', right(A.depot, 20)), charge('rifleman', right(A.depot, 44))], delay: 1.2 },
      { spawns: [charge('shield_trooper', right(A.depot, 14)), charge('rifleman', right(A.depot, 32)), charge('rifleman', right(A.depot, 50))], delay: 1.0 },
    ],
  },
  // Arena 5 - the gauntlet at the stockade: shields, the Hornet, a rush, a last mixed squad.
  {
    x: A.gauntlet,
    waves: [
      { spawns: [charge('shield_trooper', right(A.gauntlet, 16)), charge('rifleman', right(A.gauntlet, 52)), charge('grenadier', right(A.gauntlet, 36)), charge('rifleman', right(A.gauntlet, 80))], delay: 0.8 },
      { spawns: [at('heli', right(A.gauntlet, 40), { facing: -1 }), charge('rifleman', right(A.gauntlet, 24)), charge('rifleman', right(A.gauntlet, 52))], delay: 1.2 },
      { spawns: [charge('rifleman', right(A.gauntlet, 16)), charge('rifleman', right(A.gauntlet, 40)), charge('grenadier', right(A.gauntlet, 64)), charge('rifleman', right(A.gauntlet, 92))], delay: 1.2 },
      { spawns: [sneak(A.gauntlet), charge('shield_trooper', right(A.gauntlet, 20)), charge('rifleman', right(A.gauntlet, 48))], delay: 1.0 },
    ],
  },
  // Boss - GRINDER (no announce: the boss shows its own WARNING banner).
  { x: M1.bossL, boss: true, waves: [{ spawns: [{ type: 'boss_m1', x: M1.bossL + 282 }] }] },
];
