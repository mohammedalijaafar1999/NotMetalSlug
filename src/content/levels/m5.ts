// Mission 5 - STORMFRONT. The whole mission is flown in the DRAGONFLY gyro (startVehicle), auto-
// scrolling through a storm at dusk above the clouds into the Legion air fleet, ending at the
// flagship THUNDERHEAD. There is no ground: the cloud sea far below is a kill floor (ground line at
// height + 160), and the airships' decks and hulls are the only solids (see levels/m5/build.ts).
//
// Camera: the view rides low over the cloud sea (camera y = 112) except for THE CLIMB, a vertical
// section where camera keys lift the view 112 px into the upper fleet layer (the carrier battle)
// and then dive back down. Auto-scroll everywhere (36-46 px/s); camera locks pause it.
//
//   0      takeoff: open sky, a Legion picket skiff with chatting deck hands and the first cage
//   600    first contact: the signature jet fighter, a gunship with deck turrets, zap drones,
//          jetpack escorts                                                    [checkpoint 1100]
//   1360   LOCK 1 "INTERCEPT": fighters from both sides, a mixed drone swarm, a HORNET +
//          paratroopers onto a sky barge
//   1750   the cargo convoy: two blimps (crates, barrels, sleeping crew + officer, bottom turret),
//          jetpack escorts, a fighter from behind                             [checkpoint 2200]
//   2560   LOCK 2 "FUEL ZEPPELIN": blow up the tanker (its fireball clears the escorts), revenge
//          drones, then a HORNET + fighter
//   2900   THE CLIMB: camera rises past a frigate into the upper fleet layer  [checkpoint 3300]
//   3560   LOCK 3 "CARRIER": battle over a 620 px cruiser deck (turrets, troops, paratroopers,
//          jetpacks, HORNET, kamikaze drones); then the dive back down
//   4300   storm front: barge with a sniper, gunship with a bottom turret, fighter pair, HORNET
//                                                                             [checkpoint 4400]
//   4900   LOCK 4 "GAUNTLET": four waves of everything                       [checkpoint 5500]
//   5300   last escort frigate, then the calm approach: an abandoned skiff with the last prisoner,
//          supplies, the flagship's silhouette on the horizon                 [checkpoint 6300]
//   6616   BOSS: THUNDERHEAD, open sky, camera y fixed.
//
// Hostages (8, all caged on decks: shoot the cage) drop fuel / bombs / 1UPs - weapon cases would
// only turn into points inside the gyro. Allied supply crates (m5_supply) float down at intervals.

import { registerLevel } from '../../game/level';
import { LevelBuilder } from './m5/build';

export const M5_W = 7000;
export const M5_H = 328;
/** Camera top while flying low over the cloud sea. */
export const LOW = 112;
export const BOSS_X = M5_W - 384;
/** Screen y (at the low camera) -> world y. */
const S = (y: number) => LOW + y;

const b = new LevelBuilder();

// Flight-safety helpers (one alive at a time; the extras only matter after debug warps).
for (const x of [0, 1500, 3000, 4500, 6000]) b.add('m5_airspace', x, 0, {}, x === 0 ? -9999 : x);

// ------------------------------------------------------------------ 0: takeoff

{
  const s1 = b.ship('skiff', 640, S(150), -1);
  b.deco('m5_mast', s1.deck1 - 10, s1.deckY, { h: 34 });
  b.deco('m5_lamp', s1.deck0 + 8, s1.deckY);
  b.add('rifleman', 606, s1.deckY, { behavior: 'chat', facing: 1 });
  b.add('rifleman', 626, s1.deckY, { behavior: 'chat', facing: -1 });
  b.add('hostage', 664, s1.deckY, { mode: 'tied', drop: 'bomb', look: 0, facing: -1 });
  b.add('rifleman', 690, s1.deckY, { behavior: 'sleep', facing: -1 });
}

// ------------------------------------------------------------------ A: first contact

b.add('fighter', 1040, undefined, { facing: -1, passes: 3, alt: 92 });
{
  const g1 = b.ship('gunship', 1140, S(156), -1);
  b.deco('m5_searchlight', g1.deck1 - 12, g1.deckY, { facing: -1 });
  b.deco('m5_mast', g1.deck1 - 34, g1.deckY, { h: 30 });
  b.add('airship_turret', 1132, g1.deckY, { mount: 'top' });
  b.add('airship_turret', 1206, g1.deckY, { mount: 'top' });
  b.add('rifleman', 1160, g1.deckY, { behavior: 'guard' });
  b.add('bazooka', 1186, g1.deckY, { behavior: 'guard' });
}
b.add('drone', 1300, undefined, { kind: 'zap', alt: 70 });
b.add('drone', 1316, undefined, { kind: 'zap', alt: 104 });
b.add('drone', 1332, undefined, { kind: 'zap', alt: 136 });
b.add('m5_supply', 1250, undefined, { item: 'bomb' }, 1320);
b.add('jetpack', 1520, S(80));
b.add('jetpack', 1560, S(126), {}, 1580);

// ------------------------------------------------------------------ LOCK 1: intercept

b.barge(1530, 1690, S(170), -1, [1560, 1660]);
b.platform(1572, S(170) - 34, 76, 'catwalk');
b.deco('m5_cargo', 1600, S(170), { kind: 1 });

// ------------------------------------------------------------------ B: cargo convoy

b.add('m5_supply', 1830, undefined, { item: 'fuel' }, 1890);
{
  const a = b.ship('blimp', 2000, S(126), 1);
  b.deco('m5_mast', a.deck0 + 6, a.deckY, { h: 30, facing: -1 });
  b.deco('m5_cargo', a.deck1 - 20, a.deckY, { kind: 2 });
  b.add('crate_prop', 1944, a.deckY, { drop: 'fuel', size: 'big' });
  b.add('barrel', 1962, a.deckY);
  b.add('barrel', 1973, a.deckY);
  b.add('hostage', 2000, a.deckY, { mode: 'caged', drop: 'bomb', look: 1 });
  b.add('rifleman', 2026, a.deckY, { behavior: 'chat', facing: 1 });
  b.add('rifleman', 2046, a.deckY, { behavior: 'chat', facing: -1 });
}
b.add('jetpack', 2230, S(70));
b.add('jetpack', 2270, S(118), {}, 2300);
b.add('fighter', 2440, undefined, { facing: 1, passes: 2, alt: 104 });
{
  const bl = b.ship('blimp', 2370, S(92), 1);
  b.deco('m5_lamp', bl.deck1 - 6, bl.deckY, { facing: 1 });
  b.deco('m5_cargo', bl.deck0 + 22, bl.deckY, { kind: 0 });
  b.add('airship_turret', 2372, bl.keelY, { mount: 'bottom' });
  b.add('rifleman', 2326, bl.deckY, { behavior: 'sleep', facing: 1 });
  b.add('rifleman', 2348, bl.deckY, { behavior: 'sleep', facing: 1 });
  b.add('officer', 2390, bl.deckY, { facing: -1 });
  b.add('hostage', 2414, bl.deckY, { mode: 'caged', drop: 'life', look: 2 });
  b.add('grenadier', 2436, bl.deckY, { behavior: 'guard', facing: -1 });
}
b.add('m5_supply', 2620, undefined, { item: 'bomb' }, 2690);

// ------------------------------------------------------------------ THE CLIMB

b.add('m5_supply', 3090, undefined, { item: 'fuel' }, 3150);
{
  const f1 = b.ship('frigate', 3150, 236, -1);
  b.deco('m5_searchlight', f1.deck0 + 14, f1.deckY, { facing: -1 });
  b.deco('m5_mast', f1.deck1 - 16, f1.deckY, { h: 40 });
  b.add('airship_turret', 3100, f1.deckY, { mount: 'top' });
  b.add('airship_turret', 3232, f1.deckY, { mount: 'top' });
  b.add('rifleman', 3126, f1.deckY, { behavior: 'guard' });
  b.add('hostage', 3164, f1.deckY, { mode: 'caged', drop: 'fuel', look: 0 });
  b.add('bazooka', 3204, f1.deckY, { behavior: 'guard' });
  b.add('rifleman', 3260, f1.deckY, { behavior: 'patrol' });
}
b.add('drone', 3560, 70, { kind: 'zap' });
b.add('drone', 3576, 104, { kind: 'zap' }, 3560);
b.add('drone', 3592, 138, { kind: 'zap' }, 3560);
{
  const g2 = b.ship('gunship', 3480, 150, -1);
  b.deco('m5_mast', g2.deck1 - 20, g2.deckY, { h: 34 });
  b.add('airship_turret', 3418, g2.deckY, { mount: 'top' });
  b.add('rifleman', 3462, g2.deckY, { behavior: 'guard' });
  b.add('sniper', 3540, g2.deckY, { behavior: 'guard' });
}
b.add('jetpack', 3690, 70);
b.add('jetpack', 3720, 124, {}, 3700);
b.add('m5_supply', 3700, undefined, { item: 'bomb' }, 3770);

// ------------------------------------------------------------------ LOCK 3: carrier deck

const carrier = b.ship('cruiser', 3800, 150, -1);
b.deco('m5_lamp', 3664, 150);
b.deco('m5_searchlight', 3770, 150, { facing: -1 });
b.deco('m5_mast', 3716, 150, { h: 44 });
b.deco('m5_mast', 3996, 150, { h: 36 });
b.deco('m5_searchlight', 3958, 150, { facing: -1 });
b.deco('m5_banner', 3690, 156);
b.deco('m5_banner', 3910, 156);
b.platform(3812, 116, 64, 'girder', 150 - 4);
b.add('hostage', 3866, 150, { mode: 'caged', drop: 'bomb', look: 1 });
// Weapon case lashed on the flight deck (points + a patch-up for a gyro, a gun for a stranded pilot).
b.add('crate_prop', 3680, 150, { drop: 'H', size: 'small' });

// ------------------------------------------------------------------ D: the dive and the storm front

b.add('m5_supply', 4080, undefined, { item: 'fuel' }, 4140);
b.add('fighter', 4340, undefined, { facing: -1, passes: 3, alt: 100 });
b.add('fighter', 4400, undefined, { facing: 1, passes: 2, alt: 64 }, 4420);
b.barge(4330, 4560, S(160), 1, [4362, 4528]);
b.platform(4452, S(160) - 30, 60, 'catwalk');
b.add('rifleman', 4380, S(160), { behavior: 'patrol' });
b.add('bazooka', 4418, S(160), { behavior: 'guard' });
b.add('hostage', 4448, S(160), { mode: 'caged', drop: 'fuel', look: 2 });
b.add('rifleman', 4486, S(160), { behavior: 'idle', facing: -1 });
b.add('sniper', 4482, S(160) - 30, { behavior: 'guard' });
b.add('heli', 4920, undefined, { facing: -1, alt: 72, bombs: false });
{
  const g3 = b.ship('gunship', 4760, S(110), 1);
  b.deco('m5_lamp', g3.deck0 + 8, g3.deckY, { facing: -1 });
  b.add('airship_turret', 4700, g3.deckY, { mount: 'top' });
  b.add('airship_turret', 4766, g3.keelY, { mount: 'bottom' });
  b.add('rifleman', 4730, g3.deckY, { behavior: 'guard' });
  b.add('hostage', 4790, g3.deckY, { mode: 'caged', drop: 'bomb', look: 0 });
  b.add('grenadier', 4822, g3.deckY, { behavior: 'guard', facing: -1 });
}
b.add('drone', 5000, undefined, { kind: 'kamikaze', alt: 80 }, 4980);
b.add('drone', 5020, undefined, { kind: 'kamikaze', alt: 130 }, 4980);
b.add('m5_supply', 5050, undefined, { item: 'bomb' }, 5110);

// ------------------------------------------------------------------ LOCK 4: gauntlet

b.barge(5050, 5200, S(176), 1, [5080, 5170]);

// ------------------------------------------------------------------ E: last escorts, calm approach

{
  const f2 = b.ship('frigate', 5640, S(150), -1);
  b.deco('m5_searchlight', f2.deck0 + 12, f2.deckY, { facing: -1 });
  b.deco('m5_mast', f2.deck1 - 18, f2.deckY, { h: 36 });
  b.platform(5600, f2.deckY - 32, 70, 'catwalk');
  b.add('airship_turret', 5560, f2.deckY, { mount: 'top' });
  b.add('airship_turret', 5706, f2.deckY, { mount: 'top' });
  b.add('rifleman', 5590, f2.deckY, { behavior: 'sleep', facing: -1 });
  b.add('crate_prop', 5616, f2.deckY, { drop: 'R', size: 'small' });
  b.add('officer', 5634, f2.deckY - 32, { facing: -1 });
  b.add('rifleman', 5650, f2.deckY, { behavior: 'guard' });
  b.add('grenadier', 5680, f2.deckY, { behavior: 'guard' });
}
b.add('fighter', 5890, undefined, { facing: -1, passes: 2, alt: 92 });
b.add('jetpack', 5780, S(66));
b.add('jetpack', 5820, S(118), {}, 5830);
b.add('m5_supply', 6040, undefined, { item: 'fuel' }, 6100);
{
  // Abandoned skiff adrift with the last prisoner; its lamp blinks SOS.
  const s2 = b.ship('skiff', 6190, S(148), 1);
  b.deco('m5_lamp', s2.deck1 - 6, s2.deckY, { facing: 1 });
  b.add('hostage', 6176, s2.deckY, { mode: 'wander', drop: 'life', look: 1 });
}
b.add('m5_supply', 6470, undefined, { item: 'bomb' }, 6530);

// ------------------------------------------------------------------ level

registerLevel({
  id: 'm5',
  mission: 5,
  name: 'STORMFRONT',
  subtitle: 'SKY BATTLE ABOVE THE CLOUDS',
  briefing:
    'THE LEGION AIR FLEET IS MASSING ABOVE THE STORM. ITS FLAGSHIP, THE THUNDERHEAD, IS FERRYING ' +
    'OUR KIDNAPPED MECHANICS TO THE IRON CITADEL. TAKE THE DRAGONFLY GYROS UP THROUGH THE ' +
    'STORMFRONT, SHOOT THE CAGES OPEN ON THEIR DECKS AND GRAB OUR SUPPLY DROPS FOR REPAIRS. ' +
    'THEN BRING THAT FLAGSHIP DOWN.',
  theme: 'm5',
  music: 'm5',
  bossMusic: 'boss',
  bossName: 'THUNDERHEAD',
  width: M5_W,
  height: M5_H,
  start: { x: 120 },
  startVehicle: 'gyro',
  timeLimit: 99,
  // Kill floor only: the cloud sea far below the view.
  ground: [
    [
      [0, M5_H + 160],
      [M5_W, M5_H + 160],
    ],
  ],
  camera: [
    [0, LOW, LOW],
    [2900, LOW, LOW],
    [3300, 0, 0],
    [3900, 0, 0],
    [4260, LOW, LOW],
  ],
  autoScroll: [
    { x1: 0, x2: 620, speed: 36 },
    { x1: 620, x2: 1360, speed: 44 },
    { x1: 1360, x2: 2560, speed: 42 },
    { x1: 2560, x2: 3560, speed: 38 },
    { x1: 3560, x2: 4900, speed: 42 },
    { x1: 4900, x2: 6000, speed: 46 },
    { x1: 6000, x2: BOSS_X, speed: 40 },
  ],
  checkpoints: [1100, 2200, 3300, 4400, 5500, 6300],
  solids: b.solids,
  platforms: b.platforms,
  decor: b.decor,
  entities: b.entities,
  locks: [
    {
      x: 1360,
      waves: [
        {
          delay: 0.6,
          spawns: [
            { type: 'fighter', x: 1300, props: { facing: 1, passes: 3, alt: 76 } },
            { type: 'fighter', x: 1780, props: { facing: -1, passes: 3, alt: 136 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'drone', x: 1770, props: { kind: 'kamikaze', alt: 60 } },
            { type: 'drone', x: 1790, props: { kind: 'kamikaze', alt: 96 } },
            { type: 'drone', x: 1810, props: { kind: 'kamikaze', alt: 132 } },
            { type: 'drone', x: 1330, props: { kind: 'zap', alt: 80 } },
            { type: 'drone', x: 1318, props: { kind: 'zap', alt: 120 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'heli', x: 1800, props: { facing: -1, alt: 70, bombs: false } },
            { type: 'paratrooper', x: 1566, props: { drift: 0 } },
            { type: 'paratrooper', x: 1612, props: { drift: 0 } },
            { type: 'paratrooper', x: 1660, props: { drift: 0 } },
            { type: 'jetpack', x: 1320, y: S(96), props: { facing: 1 } },
          ],
        },
      ],
    },
    {
      x: 2560,
      announce: 'FUEL ZEPPELIN!',
      waves: [
        {
          delay: 0.6,
          spawns: [
            { type: 'm5_fuel_zeppelin', x: 2836, y: S(100), props: { facing: -1 } },
            { type: 'jetpack', x: 2540, y: S(70), props: { facing: 1 } },
            { type: 'jetpack', x: 2970, y: S(150), props: { facing: -1 } },
          ],
        },
        {
          delay: 1.4,
          spawns: [
            { type: 'drone', x: 2530, props: { kind: 'kamikaze', alt: 70 } },
            { type: 'drone', x: 2522, props: { kind: 'kamikaze', alt: 130 } },
            { type: 'drone', x: 2970, props: { kind: 'kamikaze', alt: 84 } },
            { type: 'drone', x: 2986, props: { kind: 'kamikaze', alt: 120 } },
            { type: 'drone', x: 2990, props: { kind: 'zap', alt: 100 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'heli', x: 2990, props: { facing: -1, alt: 74, bombs: false } },
            { type: 'fighter', x: 2520, props: { facing: 1, passes: 2, alt: 124 } },
          ],
        },
      ],
    },
    {
      x: 3560,
      waves: [
        {
          delay: 0.5,
          spawns: [
            { type: 'airship_turret', x: 3640, y: 150, props: { mount: 'top' } },
            { type: 'airship_turret', x: 3762, y: 150, props: { mount: 'top' } },
            { type: 'airship_turret', x: 3918, y: 150, props: { mount: 'top' } },
            { type: 'rifleman', x: 3700, y: 150, props: { behavior: 'guard' } },
            { type: 'rifleman', x: 3826, y: 150, props: { behavior: 'patrol' } },
            { type: 'bazooka', x: 3894, y: 150, props: { behavior: 'guard' } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'paratrooper', x: 3650, props: { drift: 0 } },
            { type: 'paratrooper', x: 3728, props: { drift: 0 } },
            { type: 'paratrooper', x: 3800, props: { drift: 0 } },
            { type: 'paratrooper', x: 3880, props: { drift: 0 } },
            { type: 'jetpack', x: 3980, y: 60, props: { facing: -1 } },
            { type: 'jetpack', x: 3990, y: 112, props: { facing: -1 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'heli', x: 3990, props: { facing: -1, alt: 66, bombs: false } },
            { type: 'drone', x: 3530, props: { kind: 'kamikaze', alt: 50 } },
            { type: 'drone', x: 3522, props: { kind: 'kamikaze', alt: 90 } },
            { type: 'drone', x: 3514, props: { kind: 'kamikaze', alt: 126 } },
          ],
        },
      ],
    },
    {
      x: 4900,
      waves: [
        {
          delay: 0.6,
          spawns: [
            { type: 'fighter', x: 4860, props: { facing: 1, passes: 3, alt: 70 } },
            { type: 'fighter', x: 5320, props: { facing: -1, passes: 3, alt: 132 } },
            { type: 'drone', x: 5300, props: { kind: 'zap', alt: 60 } },
            { type: 'drone', x: 5316, props: { kind: 'zap', alt: 150 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'heli', x: 5320, props: { facing: -1, alt: 64, bombs: false } },
            { type: 'heli', x: 4860, props: { facing: 1, alt: 104, bombs: false } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'jetpack', x: 4880, y: S(60), props: { facing: 1 } },
            { type: 'jetpack', x: 5300, y: S(100), props: { facing: -1 } },
            { type: 'jetpack', x: 5310, y: S(150), props: { facing: -1 } },
            { type: 'paratrooper', x: 5080, props: { drift: 0 } },
            { type: 'paratrooper', x: 5126, props: { drift: 0 } },
            { type: 'paratrooper', x: 5170, props: { drift: 0 } },
          ],
        },
        {
          delay: 1.0,
          spawns: [
            { type: 'drone', x: 5300, props: { kind: 'kamikaze', alt: 50 } },
            { type: 'drone', x: 5312, props: { kind: 'kamikaze', alt: 90 } },
            { type: 'drone', x: 5324, props: { kind: 'kamikaze', alt: 130 } },
            { type: 'drone', x: 4880, props: { kind: 'kamikaze', alt: 70 } },
            { type: 'drone', x: 4868, props: { kind: 'kamikaze', alt: 110 } },
            { type: 'fighter', x: 5320, props: { facing: -1, passes: 2, alt: 100 } },
          ],
        },
      ],
    },
    {
      x: BOSS_X,
      boss: true,
      announce: 'WARNING!',
      waves: [{ spawns: [{ type: 'boss_m5', x: BOSS_X + 300, y: S(100) }] }],
    },
  ],
});

/** Builder output (tests inspect ships and placements). */
export const M5_BUILD = b;
