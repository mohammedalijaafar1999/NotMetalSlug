// Mission 1 (PALM HARBOR) scenery placements (theme 'm1' decor kinds, see themes/m1/decor.ts).
// y is the ground (or deck / water line) the piece stands on; 'front' pieces are drawn over actors
// and are kept small (ferns at the ground line).

import type { DecorDef } from '../../../game/level';
import { M1 } from '../../themes/m1/layout';

const G = M1.GY;
const P = M1.PY;
const DECK = 288;

const d = (kind: string, x: number, y: number, props?: Record<string, any>, layer: 'back' | 'front' = 'back'): DecorDef => ({ kind, x, y, layer, props });

export const DECOR: DecorDef[] = [
  // ---- Landing beach: the squad's wrecked landing craft in the surf.
  d('landing', 96, 317),
  d('beachprop', 196, G, { v: 1 }),
  d('palm', 236, G, { v: 1 }),
  d('sign', 286, G, { v: 2 }),
  d('rock', 318, G, { v: 0 }),
  d('palm', 392, G - 5, { v: 0 }),
  d('boat', 430, G - 5),
  d('torch', 462, G),
  d('campfire', 500, G),
  d('torch', 548, G),
  d('crates', 586, G, { v: 2 }),
  d('palm', 640, G, { v: 2 }),
  d('beachprop', 690, G, { v: 0 }),
  // ---- Beach outpost: dune, watchtower, sandbagged camp, arena 1.
  d('palm', 734, G - 6, { v: 1 }),
  d('sign', 870, G, { v: 0 }),
  d('tower', 950, G),
  d('crates', 1004, G, { v: 1 }),
  d('banner', 1094, G),
  d('palm', 1150, G, { v: 0 }),
  d('torch', 1196, G),
  d('rock', 1262, G, { v: 2 }),
  d('palm', 1318, G, { v: 2 }),
  d('beachprop', 1376, G, { v: 2 }),
  d('crates', 1442, G, { v: 0 }),
  d('palm', 1508, G, { v: 1 }),
  d('drums', 1570, G),
  d('net', 1612, G),
  // ---- Stilt village over the lagoon.
  d('palm', 1652, G + 2, { v: 0 }),
  d('torch', 1690, DECK),
  d('hut', 1791, DECK),
  d('rack', 1856, DECK - 26),
  d('boat', 1906, 310, { bob: true }),
  d('net', 1990, DECK),
  d('torch', 2044, DECK),
  d('hut', 2121, DECK),
  d('rack', 2187, DECK - 26),
  d('boat', 2250, 310, { bob: true }),
  d('torch', 2290, DECK),
  d('palm', 2372, G, { v: 2 }),
  // ---- Village square (arena 2).
  d('hut', 2470, G),
  d('beachprop', 2536, G, { v: 3 }),
  d('net', 2588, G),
  d('boat', 2668, G),
  d('palm', 2730, G, { v: 1 }),
  d('banana', 2790, G, { v: 1 }),
  // ---- Jungle road (the BULLDOG is parked at a Legion cache).
  d('jtree', 2836, G),
  d('crates', 2924, G, { v: 1 }),
  d('fern', 2968, G - 4, {}, 'front'),
  d('banana', 3020, G - 10),
  d('sign', 3082, G - 10, { v: 0 }),
  d('palm', 3140, G - 6, { v: 0 }),
  d('fern', 3196, G, { v: 1 }, 'front'),
  d('jtree', 3312, G),
  d('banana', 3396, G, { v: 0 }),
  d('crates', 3440, G, { v: 0 }),
  d('jtree', 3548, G),
  d('fern', 3610, G, { v: 2 }, 'front'),
  d('banana', 3676, G, { v: 1 }),
  d('drums', 3744, G),
  d('jtree', 3812, G),
  d('fern', 3836, G, { v: 0 }, 'front'),
  d('sign', 3950, 300, { v: 4 }),
  // ---- River crossing, the bunker bank and the cliff.
  d('fern', 4166, G, { v: 1 }, 'front'),
  d('banana', 4196, G, { v: 0 }),
  d('sign', 4240, G, { v: 0 }),
  d('vines', 4342, G - 39, { v: 1 }),
  d('vines', 4394, G - 79, { v: 2 }),
  d('vines', 4440, P + 1, { v: 0 }),
  d('rock', 4318, G, { v: 0 }),
  // ---- Fuel depot on the plateau (arena 4).
  d('sign', 4462, P, { v: 3 }),
  d('silo', 4530, P),
  d('silo', 4626, P),
  d('drums', 4700, P),
  d('crates', 4820, P, { v: 2 }),
  d('silo', 4904, P),
  d('banner', 4966, P),
  d('crates', 5010, P, { v: 1 }),
  // ---- Down the slope to the jungle floor. The tree grows out of the hillside: its downhill roots
  // touch the slope and the uphill ones are buried (drawn behind the terrain).
  d('jtree', 5150, 268, { behindTerrain: true }),
  d('banana', 5270, G, { v: 1 }),
  d('sign', 5300, G, { v: 1 }), // MINES warning before the minefield
  d('jtree', 5390, G),
  d('banana', 5470, G, { v: 0 }),
  // ---- Stockade outskirts (gauntlet arena) and the calm approach.
  d('torch', 5600, G),
  d('banner', 5740, G),
  d('tower', 5860, G),
  d('palisade', 5930, G, { n: 1 }),
  d('torch', 6010, G),
  d('crates', 6060, G, { v: 1 }),
  d('tower', 6170, G),
  d('banner', 6232, G),
  d('palisade', 6270, G, { n: 2 }),
  d('sign', 6330, G, { v: 0 }),
  d('drums', 6380, G),
  d('torch', 6440, G),
  // ---- Boss arena: the stockade yard (the gate the GRINDER smashes through is an entity).
  d('torch', 6760, G),
];
