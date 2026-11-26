// boss_m5 - THUNDERHEAD, the Rustcoat Legion flagship airship (mission 5, STORMFRONT).
// Implementation in ./m5/ (art.ts sprites, projectiles.ts mines/shells/lightning/wreck,
// thunderhead.ts the boss). Arena requirements are in the registerEntity description below.

import { registerEntity } from '../../game/registry';
import { Thunderhead } from './m5/thunderhead';

registerEntity(
  'boss_m5',
  'boss',
  (_w, s) => new Thunderhead(s.props ?? {}),
  'THUNDERHEAD flagship airship (mission 5 boss, 400 HP x difficulty, 30000 pts), fought from the DRAGONFLY gyro. ' +
    'Holds a station relative to the CAMERA (ship centre at screen (270, 100); with its slow drift the body covers ' +
    'screen x ~168-386, y ~48-189), so its spawn x/y only need to be inside the boss lock wave (e.g. x = lockX + 300, ' +
    'y = 100). Entrance: slides in from the right for 2.6 s, not hittable. Arena: LevelDef.startVehicle "gyro"; open sky ' +
    'across the whole locked view - no ground, solids or platforms inside it (kill floor = ground far below, e.g. ground ' +
    'y = height + 160 so falls end the life); keep the camera y fixed in the arena (camera key minY = maxY) and the ' +
    'lock x <= width - 384. Use the lock announce "WARNING!" (the boss does not announce); boss music starts from ' +
    'bossStart. Spawns its own "drone" enemies (max 3) and parachute mines. Phases at 62% / 33%: turrets + drones + ' +
    'mines, then broadside volleys, then the nose storm core (x1.35 damage) opens and fires aimed lightning.',
);
