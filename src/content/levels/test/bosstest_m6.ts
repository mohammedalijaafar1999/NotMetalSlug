// Test arena for boss_m6 (JUGGERNAUT): a short walk, then the boss lock.
// The geometry follows what the boss needs (copy it for mission 6): a flat floor at y 198 in a
// 216-tall level (camera at the bottom), the lock one screen wide at the end of the level, nothing
// inside the arena (no platforms / solids / water / pits), the boss spawned at its home x
// (lockX + 290; it walks in from the right edge by itself and announces itself, so the lock has no
// announce), bossMusic 'boss_final'.
// ?level=bosstest_m6

import { registerLevel } from '../../../game/level';

const LOCK_X = 520;
const GROUND = 198;

registerLevel({
  id: 'bosstest_m6',
  mission: 0,
  name: 'JUGGERNAUT TEST',
  subtitle: 'Boss arena test',
  theme: 'default',
  music: 'boss',
  bossMusic: 'boss_final',
  bossName: 'JUGGERNAUT',
  width: LOCK_X + 384,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, GROUND],
      [LOCK_X + 384, GROUND],
    ],
  ],
  entities: [{ type: 'pickup', x: 240, props: { item: 'bomb' } }],
  locks: [
    {
      x: LOCK_X,
      boss: true,
      waves: [{ spawns: [{ type: 'boss_m6', x: LOCK_X + 290 }] }],
    },
  ],
});
