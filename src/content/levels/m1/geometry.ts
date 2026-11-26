// Mission 1 (PALM HARBOR) terrain: ground polyline, one-way platforms, solids, water and the camera
// keys of the cliff climb. Shared numbers come from themes/m1/layout.ts (M1).

import type { PlatformDef, SolidDef, WaterDef } from '../../../game/level';
import { M1 } from '../../themes/m1/layout';

const G = M1.GY; // 304
const P = M1.PY; // 184 (plateau)

/** One continuous ground line (no pits in mission 1). */
export const GROUND: Array<[number, number]> = [
  // Surf at the landing beach (wading out of the sea).
  [0, 314],
  [110, 314],
  [170, G],
  // Beach with a low dune.
  [330, G],
  [370, G - 5],
  [430, G - 5],
  [470, G],
  [700, G],
  // Sand dune before the beach outpost.
  [760, G - 12],
  [840, G - 12],
  [880, G],
  // Beach outpost + arena 1 (flat).
  [1640, G],
  // Down into the lagoon (stilt village).
  [1700, 318],
  [2300, 318],
  [2350, G],
  // Village square (arena 2) and the start of the jungle road.
  [2940, G],
  [3000, G - 10],
  [3120, G - 10],
  [3170, G],
  // Jungle road (arena 3) to the river.
  [3956, G],
  // River crossing (shallow, gravel bed).
  [3974, 322],
  [4130, 322],
  [4148, G],
  // Far bank (bunker) then the cliff climb: three 40 px ledges.
  [4330, G],
  [4330, G - 40],
  [4382, G - 40],
  [4382, G - 80],
  [4428, G - 80],
  [4428, P],
  // Fuel depot plateau (arena 4).
  [M1.plateauX1, P],
  // Long slope back down to the jungle floor.
  [5250, G],
  // Jungle clearing (gauntlet), stockade approach, boss arena (flat to the end).
  [5520, G],
  [5560, G - 6],
  [5600, G],
  [M1.W, G],
];

export const PLATFORMS: PlatformDef[] = [
  // Beach outpost watchtower deck.
  { x: 930, y: 262, w: 40, style: 'pier:0' },
  // Stilt village boardwalk: ramp up, two decks with a gap, ramp down.
  { x: 1606, y: G, w: 54, y2: 288, style: 'pier:4' },
  { x: 1660, y: 288, w: 240, style: 'pier:25' },
  { x: 1930, y: 288, w: 370, style: 'pier:25' },
  { x: 2300, y: 288, w: 52, y2: G, style: 'pier:6' },
  // Hut roof ridges (54 px above the deck) and the fish-drying racks that lead up to them.
  { x: 1765, y: 234, w: 52, style: 'bamboo:0' },
  { x: 1840, y: 258, w: 32, style: 'bamboo:26' },
  { x: 2095, y: 234, w: 52, style: 'bamboo:0' },
  { x: 2171, y: 258, w: 32, style: 'bamboo:26' },
  // Jungle road: bamboo lookout.
  { x: 3290, y: 266, w: 44, style: 'bamboo:33' },
  // Broken river bridge (32 px gap in the middle).
  { x: 3934, y: 300, w: 94, style: 'pier:17' },
  { x: 4060, y: 300, w: 106, style: 'pier:17' },
  // Fuel depot catwalk.
  { x: 4690, y: P - 40, w: 82, style: 'metal:35' },
  // Gauntlet: bamboo platform and a watchtower deck.
  { x: 5690, y: 262, w: 60, style: 'bamboo:37' },
  { x: 5840, y: 262, w: 40, style: 'pier:0' },
  // Stockade approach: watchtower deck.
  { x: 6150, y: 262, w: 40, style: 'pier:0' },
];

export const SOLIDS: SolidDef[] = [
  // Basalt outcrop at the beach outpost.
  { x: 1040, y: G - 20, w: 32, h: 20 },
  // Boulders on the jungle road (tank hops / cover).
  { x: 3226, y: G - 22, w: 34, h: 22 },
];

/** Ground height of the polyline at x (lowest = largest y on a vertical cliff is ignored: top wins). */
export function groundAt(x: number): number {
  for (let i = 0; i < GROUND.length - 1; i++) {
    const [x1, y1] = GROUND[i];
    const [x2, y2] = GROUND[i + 1];
    if (x >= x1 && x <= x2 && x2 > x1) return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  }
  return GROUND[GROUND.length - 1][1];
}

/**
 * Water that fills exactly the basin between x0 and x1 below `surface`: narrow columns that follow
 * the ground, so the translucent water never tints dry ground or the earth under the bed.
 */
function basin(x0: number, x1: number, surface: number, step = 3): WaterDef[] {
  const out: WaterDef[] = [];
  for (let x = x0; x < x1; x += step) {
    const w = Math.min(step, x1 - x);
    const bed = Math.max(groundAt(x), groundAt(x + w));
    const h = Math.ceil(bed - surface) + 1;
    if (h <= 1) continue;
    const last = out[out.length - 1];
    if (last && last.x + last.w === x && last.h === h) last.w += w;
    else out.push({ x, y: surface, w, h });
  }
  return out;
}

export const WATER: WaterDef[] = [
  // Surf at the landing beach, the stilt-village lagoon, the jungle river.
  ...basin(0, 160, 306),
  ...basin(1640, 2350, 306),
  ...basin(3956, 4148, 308),
];

/** Camera keys [cameraLeftX, minTopY, maxTopY]: bottom everywhere except the climb and plateau. */
export const CAMERA: Array<[number, number, number]> = [
  [0, 120, 120],
  [4170, 120, 120],
  [4196, 0, 120],
  [4300, 0, 0],
  [4880, 0, 0],
  [5090, 120, 120],
];
