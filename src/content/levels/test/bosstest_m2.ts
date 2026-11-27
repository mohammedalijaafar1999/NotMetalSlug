// Boss test arena for boss_m2 (HORNET KING): a short walk, then a flat salt-flat style arena.
// ?level=bosstest_m2  (mission 0: not part of the campaign).
//
// Geometry the real Mission 2 arena should copy (relative to the lock x L):
//  - flat ground at one height (y 184 here) from L - 300 to L + 384 + 150, no pits/platforms/solids/
//    water inside [L, L + 384]; camera at the bottom (no camera keys), level height 216.
//  - lock { x: L, boss: true, music: 'boss', announce: 'WARNING! ...' }, first wave delay ~1 s,
//    spawn { type: 'boss_m2', x: L + 500 } (the boss flies in from the right edge by itself).

import { registerLevel } from '../../../game/level';

const L = 1100;
const GY = 184;

registerLevel({
  id: 'bosstest_m2',
  mission: 0,
  name: 'HORNET KING TEST',
  subtitle: 'Boss test arena',
  theme: 'default',
  music: 'boss',
  bossMusic: 'boss',
  bossName: 'HORNET KING',
  width: L + 384 + 160,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, GY],
      [420, GY],
      [460, GY - 10],
      [560, GY - 10],
      [600, GY],
      [L + 384 + 160, GY],
    ],
  ],
  entities: [
    { type: 'pickup', x: 240, props: { item: 'bomb' } },
    { type: 'pickup', x: 700, props: { item: 'H' } },
  ],
  locks: [
    {
      x: L,
      boss: true,
      music: 'boss',
      announce: 'WARNING! HORNET KING APPROACHING',
      waves: [{ delay: 1, spawns: [{ type: 'boss_m2', x: L + 500 }] }],
    },
  ],
  decor: [{ kind: 'sign', x: 90, y: GY }],
});
