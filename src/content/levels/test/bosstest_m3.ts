// Boss test arena for FROST BASTION (boss_m3): a short snowy walk, then the boss lock.
// Geometry matches what the boss documents (flat ground across the whole arena, camera at the
// level bottom, ground at y 184). The mission 3 designer can copy the lock block as-is.
//   ?level=bosstest_m3&autoplay=1&invincible=1

import { registerLevel } from '../../../game/level';

const LOCK_X = 600;

registerLevel({
  id: 'bosstest_m3',
  mission: 0,
  name: 'FROST BASTION TEST',
  subtitle: 'Boss test arena',
  theme: 'default',
  music: 'boss',
  bossName: 'FROST BASTION',
  width: LOCK_X + 384 + 120,
  height: 216,
  start: { x: 80 },
  ground: [
    [
      [0, 184],
      [LOCK_X + 384 + 120, 184],
    ],
  ],
  entities: [
    { type: 'pickup', x: 260, props: { item: 'bomb' } },
    { type: 'rifleman', x: 470, props: { behavior: 'guard' } },
  ],
  locks: [
    {
      x: LOCK_X,
      boss: true,
      music: 'boss',
      announce: 'WARNING! FROST BASTION',
      waves: [{ spawns: [{ type: 'boss_m3', x: LOCK_X + 316 }] }],
    },
  ],
});
