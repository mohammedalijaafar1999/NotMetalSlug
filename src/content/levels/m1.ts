// Mission 1 - PALM HARBOR (level 'm1', theme 'm1', boss GRINDER).
// A sunny tropical harbor at morning: the landing beach and its outpost, the fishing village on
// stilts over the lagoon, the jungle road (the BULLDOG mini-tank), the muddy river ford where the
// tank beat ends, the cliff climb to the Legion fuel depot, the minefield, the stockade gauntlet and
// the GRINDER's yard. Tutorial pacing: forgiving, lots of telegraphs, weapons from hostages.
// Pieces: m1/geometry.ts (terrain + camera keys), m1/decor.ts (scenery), m1/encounters.ts (spawns +
// arenas), m1/gate.ts (stockade gate the boss smashes), m1/bog.ts (river mud that sinks vehicles).

import { registerLevel } from '../../game/level';
import { M1 } from '../themes/m1/layout';
import { CAMERA, GROUND, PLATFORMS, SOLIDS, WATER } from './m1/geometry';
import { DECOR } from './m1/decor';
import { ENTITIES, LOCKS } from './m1/encounters';

registerLevel({
  id: 'm1',
  mission: 1,
  name: 'PALM HARBOR',
  subtitle: 'OPERATION BEACHHEAD',
  briefing:
    'THE RUSTCOAT LEGION HAS SEIZED PALM HARBOR AND CAGED THE ISLAND MECHANICS. HIT THE BEACH, SWEEP THE STILT VILLAGE AND THE JUNGLE ROAD AND FREE EVERY HOSTAGE. A BULLDOG MINI-TANK WAITS AT A LEGION CACHE - MIND THE MUDDY RIVER FORD. PAST THE FUEL DEPOT, THEIR WAR-DOZER GUARDS THE STOCKADE. SCRAP IT.',
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
  // Camera-left x: beach outpost, stilt village, jungle road, river ford, depot plateau, stockade.
  checkpoints: [1000, 2150, 3100, 4150, 5100, 6000],
  entities: ENTITIES,
  locks: LOCKS,
  decor: DECOR,
});
