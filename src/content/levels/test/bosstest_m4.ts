// Boss test arena for boss_m4 (LEVIATHAN): a short walk along a dock, then the harbour arena.
// ?level=bosstest_m4 - geometry mirrors the arena contract documented in src/content/bosses/boss_m4.ts:
// lock x L = 520, dock y = 180 up to L + 148 = 668, deadly water L + 148 .. end (surface y = 190).

import { registerLevel } from '../../../game/level';

const L = 520;
const TIP = L + 148;

registerLevel({
  id: 'bosstest_m4',
  mission: 0,
  name: 'LEVIATHAN TEST',
  subtitle: 'Boss arena test',
  theme: 'default',
  music: 'boss',
  bossName: 'LEVIATHAN',
  width: L + 440,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 180],
      [TIP, 180],
      [TIP, 262],
      [L + 440, 262],
    ],
  ],
  water: [{ x: TIP, y: 190, w: L + 440 - TIP, h: 72, deadly: true }],
  entities: [
    { type: 'pickup', x: 260, props: { item: 'bomb' } },
    { type: 'pickup', x: 420, props: { item: 'bomb' } },
  ],
  locks: [
    {
      x: L,
      trigger: L - 40,
      boss: true,
      announce: 'WARNING!',
      waves: [{ spawns: [{ type: 'boss_m4', x: L + 300 }] }],
    },
  ],
  decor: [{ kind: 'sign', x: 120, y: 180 }],
});
