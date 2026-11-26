// BOSS TEST: GRINDER (boss_m1) - a short walk, then the mission 1 boss arena (?level=bosstest_m1).
// The arena geometry is the reference for the real Palm Harbor boss arena: flat ground across the
// locked screen [L, L + 384], nothing in the left 70 px (the blade-charge safe pocket).

import { registerLevel } from '../../../game/level';

const L = 420; // camera-left x of the boss lock
const GY = 184; // ground line

registerLevel({
  id: 'bosstest_m1',
  mission: 0,
  name: 'GRINDER TEST',
  subtitle: 'Boss arena test',
  theme: 'default',
  music: 'boss',
  bossMusic: 'boss',
  bossName: 'GRINDER',
  width: L + 384,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, GY],
      [L + 384, GY],
    ],
  ],
  entities: [{ type: 'pickup', x: 200, props: { item: 'bomb' } }],
  locks: [
    {
      x: L,
      boss: true,
      waves: [{ spawns: [{ type: 'boss_m1', x: L + 282 }] }],
    },
  ],
  decor: [{ kind: 'sign', x: 90, y: GY }],
});
