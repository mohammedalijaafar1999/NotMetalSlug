// boss_m4 - LEVIATHAN, the Legion's monster submarine (Mission 4, Rustwater Docks).
// Implementation and art live in ./m4/ (leviathan.ts, art.ts, arm.ts, weapons.ts).
//
// ARENA CONTRACT (L = the boss lock's camera-left x, the sub faces the dock on its left):
//  - Dock/pier: flat solid ground at y = 180 from (at least) L to L + 148; vertical face at L + 148
//    dropping into the water (ground below the water at y >= 250, or no ground). Keep the deck
//    between L and L + 148 clear: no platforms, solids, props, pits or water on it.
//  - Water: deadly water from x = L + 148 to at least L + 384, surface y = 190, >= 70 px deep.
//  - Lock: { x: L, trigger: L - 40, boss: true, announce: 'WARNING!' } (the camera leads the player at
//    0.42 of the view, so without the earlier trigger the player would walk into the water before the
//    camera reaches L). The boss never calls world.announce. Music: bossStart plays bossMusic ?? 'boss'.
//  - Spawn: { type: 'boss_m4', x: L + 300 } with y omitted (it finds the water surface itself;
//    props.facing optional, default = toward the arena centre).
//  - Level width >= L + 384 (the stern runs ~70 px past the right edge, nothing needed there).
//    Camera at the bottom of a 216-tall level (camera top y = 0).

import { registerEntity } from '../../game/registry';
import { Leviathan } from './m4/leviathan';

registerEntity(
  'boss_m4',
  'boss',
  () => new Leviathan(),
  'LEVIATHAN monster submarine (mission 4 boss, 360 base HP, 3 phases). Rises from the harbour (2.7 s, unhittable); torpedoes skim the water and ride up onto the dock (jump), missile pod salvos with landing markers, periscope laser whip (thin line + swept-path telegraph, then a fast sweep across the dock: jump it); phase 2 a claw arm slams (shadow) then rakes the planks; phase 3 dives (only the tower is hittable). Weak points: conning tower, missile pods (destructible), open mouth. ARENA (L = lock x): flat dock y=180 from L to L+148 (vertical face, deck kept clear), deadly water L+148..>=L+384 with surface y=190 and >=70 px depth; lock { x: L, trigger: L-40, boss: true, announce: "WARNING!" }; spawn { type: "boss_m4", x: L+300 } (y omitted); level width >= L+384, camera at the bottom.',
);
