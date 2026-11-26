// Mission 1 - PALM HARBOR (level 'm1', theme 'm1', boss GRINDER).
// Skeleton: terrain + boss arena. Encounters are added in m1/encounters.ts.

import { registerLevel } from '../../game/level';
import { M1 } from '../themes/m1/layout';
import { CAMERA, GROUND, PLATFORMS, SOLIDS, WATER } from './m1/geometry';

const L = M1.bossL;

registerLevel({
  id: 'm1',
  mission: 1,
  name: 'PALM HARBOR',
  subtitle: 'Operation Sunrise',
  briefing: 'BRIEFING',
  theme: 'm1',
  music: 'm1',
  bossMusic: 'boss',
  bossName: 'GRINDER',
  width: M1.W,
  height: M1.H,
  start: { x: 60 },
  ground: [GROUND],
  platforms: PLATFORMS,
  solids: SOLIDS,
  water: WATER,
  camera: CAMERA,
  timeLimit: 99,
  checkpoints: [1000, 2150, 3100, 4150, 5100, 6000],
  entities: [],
  locks: [{ x: L, boss: true, waves: [{ spawns: [{ type: 'boss_m1', x: L + 282 }] }] }],
  decor: [],
});
