// Sandbox / test level (mission 0): a compact arena used by tests and for trying out
// entities (?level=sandbox). Has slopes, platforms, a solid block, water and a pit.

import { registerLevel } from '../../game/level';

registerLevel({
  id: 'sandbox',
  mission: 0,
  name: 'PROVING GROUNDS',
  subtitle: 'Test range',
  theme: 'default',
  music: 'm1',
  width: 2400,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 180],
      [400, 180],
      [460, 160],
      [600, 160],
      [660, 185],
      [900, 185],
      [900, 170],
      [1100, 170],
    ],
    [
      [1140, 180],
      [2400, 180],
    ],
  ],
  platforms: [
    { x: 200, y: 140, w: 80 },
    { x: 700, y: 140, w: 120, y2: 125 },
    { x: 1500, y: 130, w: 96, style: 'metal' },
  ],
  solids: [{ x: 1300, y: 150, w: 40, h: 30 }],
  water: [{ x: 1800, y: 172, w: 160, h: 44 }],
  checkpoints: [800],
  entities: [
    { type: 'rifleman', x: 520 },
    { type: 'hostage', x: 640, props: { drop: 'H' } },
    { type: 'rifleman', x: 760, y: 125, props: { behavior: 'guard' } },
    { type: 'rifleman', x: 1000, props: { behavior: 'idle' } },
    { type: 'pickup', x: 300, props: { item: 'bomb' } },
  ],
  locks: [
    {
      x: 1450,
      waves: [
        { spawns: [{ type: 'rifleman', x: 1850, props: { behavior: 'charge' } }, { type: 'rifleman', x: 1880, props: { behavior: 'charge' } }] },
        { spawns: [{ type: 'rifleman', x: 1860, props: { behavior: 'charge' } }], delay: 1 },
      ],
    },
  ],
  endX: 2000,
  decor: [{ kind: 'sign', x: 90, y: 180 }],
});
