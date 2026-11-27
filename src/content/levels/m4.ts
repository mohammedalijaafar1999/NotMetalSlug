// Mission 4 - RUSTWATER DOCKS (hard). A ruined harbour city at dusk, rain and a storm surge: the
// canals are brimming. Flow (x = world px; street level y = 180, level 352 tall so the camera can dip
// into the dry dock; everywhere else the camera sits at the top, y 0):
//   0     Waterfront promenade: drop in under the RUSTWATER sign, soldiers warming up at a burning
//         drum, a sleeper, the first hostage (H). Gentle ramps.
//   860   Canal A on three bobbing pontoons - a frogman lurks (signature enemy introduced).
//   1200  LOCK 1 "canal ambush": frogmen burst out of canal B, troops from the left and the far bank,
//         an officer rallies them, a jetpack and paratroopers. Cross canal B on pontoons.
//   1640  BULLDOG tank parked by the warehouses: truck, light tanks, a cannon turret on a container
//         stack, a window sniper, bazookas - LOCK 2 "warehouse yard" (truck, tank + jetpacks, flamers +
//         shield + officer + paratroopers).
//   3420  The Legion's gantry magnet snatches the tank (m4_magnet) - on foot from here.
//   3800  DRY DOCK (vertical): down the stepped altars into a flooded dock with a Legion hull on its
//         blocks; LOCK 3 inside (troops down the steps, jetpacks, sabers); climb out up the steps.
//   4560  Canal C (pontoons, frogmen), then the container yard: climb container stacks, MG turret,
//         sniper on a catwalk, sleepers, a caged hostage, mines.
//   5600  LOCK 4 "the slip" (gauntlet): gunboats in the slip, a heli, jetpacks, a tank from behind;
//         the lift bridge (m4_bridge) comes down for the final wave - and you cross it.
//   6040  Far quay, a last squad, then a full screen of calm along the harbour front (bombs, laser).
//   6960  BOSS LOCK: the dock (y 180, L..L+148) over the open basin (water y 190): LEVIATHAN.
// Mission mechanics live in ./m4/: harbor (deep-water splashes), pontoon, magnet, bridge.

import { registerLevel, type DecorDef, type PlatformDef, type SolidDef, type WaterDef, type LockDef } from '../../game/level';
import type { SpawnSpec } from '../../game/registry';

const G = 180; // street level
const WL = 182; // canal / slip water level (brimming: gunboats and frogmen fight at street height)
const H = 352; // level height (216 + the dry dock's 136)
const WIDTH = 7400;
/** Boss lock camera x (arena contract: dock L..L+148 at y 180, water from L+148, surface y 190). */
const L = 6960;
const TIP = L + 148;

const ground: Array<Array<[number, number]>> = [];
const platforms: PlatformDef[] = [];
const solids: SolidDef[] = [];
const water: WaterDef[] = [];
const decor: DecorDef[] = [];
const entities: SpawnSpec[] = [];
const locks: LockDef[] = [];

// ------------------------------------------------------------------ helpers

const back = (kind: string, x: number, y = G, props: Record<string, any> = {}): void => {
  decor.push({ kind, x, y, props });
};
const far = (kind: string, x: number, y = G, props: Record<string, any> = {}): void => {
  decor.push({ kind, x, y, props: { ...props, behindTerrain: true } });
};
const spawn = (type: string, x: number, props: Record<string, any> = {}, y?: number, trigger?: number): void => {
  const s: SpawnSpec = { type, x, props };
  if (y !== undefined) s.y = y;
  if (trigger !== undefined) s.trigger = trigger;
  entities.push(s);
};
const at = (type: string, x: number, props: Record<string, any> = {}, y?: number): SpawnSpec => {
  const s: SpawnSpec = { type, x, props };
  if (y !== undefined) s.y = y;
  return s;
};

/** Deep canal (a pit filled with water) with a far-wall backdrop and pontoons (centre x, width). */
function canal(x: number, w: number, pontoons: Array<[number, number]>): void {
  water.push({ x, y: WL, w, h: H - WL, deadly: true });
  far('canal', x, G, { w, depth: H - G, water: WL - G, seed: x });
  pontoons.forEach(([cx, pw], i) => spawn('m4_pontoon', cx, { w: pw, phase: i * 1.3 + x * 0.01 }, undefined, cx - 40));
  back('fender', x - 4, G + 3);
  back('fender', x + w + 4, G + 3);
}

/** Shipping-container block: a solid you can climb with a container skin over it. */
function container(x: number, y: number, w: number, h: number, c: string, opts: { doors?: string; mark?: string } = {}): void {
  solids.push({ x, y, w, h });
  back('container', x + w / 2, y + h, { w, h, c, doors: opts.doors ?? 'none', mark: opts.mark, seed: x });
}

/** Background container stack (decor only, standing on the street). */
function stack(x: number, cols: string[], w = 64): void {
  cols.forEach((c, i) => far('container', x + (i % 2 ? 6 : 0), G - i * 30, { w, h: 30, c, doors: i % 2 ? 'left' : 'right', seed: x + i }));
}

// ------------------------------------------------------------------ S0 promenade (0-860)

ground.push([
  [0, G],
  [400, G],
  [436, 168],
  [640, 168],
  [676, G],
  [860, G],
]);
far('fence', 120, G, { w: 168 });
far('fence', 760, G, { w: 120 });
back('lamp', 34);
back('sign', 168, G, { v: 'welcome' });
back('wreck', 296, G, { flip: true });
back('lamp', 380);
back('net', 470, 168);
back('bollard', 520, 168, { rope: true });
back('firebarrel', 580, 168);
back('lamp', 626, 168);
back('crates', 712);
back('tires', 742);
back('lamp', 830);
back('sign', 842, G, { v: 'warn' });
spawn('hostage', 352, { drop: 'H', look: 0 });
spawn('rifleman', 476, { behavior: 'sleep', facing: -1 });
spawn('rifleman', 566, { behavior: 'chat', facing: 1 });
spawn('rifleman', 594, { behavior: 'chat', facing: -1 });
spawn('crate_prop', 664, { drop: 'S' });
spawn('barrel', 728);
spawn('rifleman', 790, { behavior: 'guard', facing: -1 });
spawn('m4_harbor', 0);

// ------------------------------------------------------------------ S1 canal A + lock 1 (860-1640)

canal(860, 224, [
  [904, 48],
  [972, 48],
  [1040, 48],
]);
spawn('frogman', 1000, {}, undefined, 900);
ground.push([
  [1084, G],
  [1362, G],
]);
back('bollard', 1100, G, { rope: true });
back('lamp', 1140);
back('crates', 1200, G, { flip: true });
back('bollard', 1340);
spawn('hostage', 1180, { drop: 'bomb', look: 1 });
spawn('crate_prop', 1262, { drop: 'bomb', size: 'big' });
canal(1362, 160, [
  [1406, 48],
  [1474, 48],
]);
locks.push({
  x: 1200,
  trigger: 1160,
  waves: [
    {
      spawns: [
        at('frogman', 1420, { range: 28 }),
        at('frogman', 1490, { range: 28 }),
        at('rifleman', 1176, { behavior: 'charge' }),
        at('rifleman', 1150, { behavior: 'charge' }),
      ],
    },
    {
      delay: 1,
      spawns: [
        at('rifleman', 1548, { behavior: 'guard', facing: -1 }),
        at('rifleman', 1574, { behavior: 'guard', facing: -1 }),
        at('officer', 1604, { facing: -1 }),
        at('jetpack', 1460, {}, 70),
      ],
    },
    {
      delay: 1,
      spawns: [
        at('frogman', 1400, { range: 28 }),
        at('frogman', 1500, { range: 28 }),
        at('grenadier', 1566, { behavior: 'guard', facing: -1 }),
        at('paratrooper', 1290, {}),
        at('paratrooper', 1240, {}),
      ],
    },
  ],
});

// ------------------------------------------------------------------ S2 warehouse district + tank (1522-3800)

ground.push([
  [1522, G],
  [2460, G],
  [2500, 170],
  [2560, 170],
  [2600, G],
  [3800, G],
  // Dry dock: stepped altars down to the floor...
  [3800, 204],
  [3830, 204],
  [3830, 228],
  [3860, 228],
  [3860, 252],
  [3890, 252],
  [3890, 276],
  [3920, 276],
  [3920, 300],
  [3950, 300],
  [3950, 320],
  [4290, 320],
  // ...and back up the far side.
  [4290, 290],
  [4326, 290],
  [4326, 260],
  [4362, 260],
  [4362, 230],
  [4398, 230],
  [4398, 204],
  [4434, 204],
  [4434, G],
  [4560, G],
]);
// Warehouse facades behind the street.
far('warehouse', 1830, G, { w: 236, h: 112, door: 150, name: 'PIER 9 STORES', seed: 3 });
far('warehouse', 2110, G, { w: 196, h: 96, door: 60, name: 'COLDSTORE', seed: 5 });
far('warehouse', 2740, G, { w: 280, h: 118, door: 200, name: 'BONDED WAREHOUSE 12', seed: 7 });
far('warehouse', 3070, G, { w: 220, h: 100, door: 90, name: 'NET LOFT', seed: 9 });
stack(2560, ['teal', 'red', 'blue']);
stack(2950, ['orange', 'grey']);
stack(3250, ['purple', 'yellow', 'green']);
back('lamp', 1580);
back('sign', 1700, G, { v: 'legion' });
back('lamp', 1980);
back('firebarrel', 2050);
back('lamp', 2420);
back('sign', 2660, G, { v: 'dock' });
back('lamp', 2880);
back('tires', 3010, G, { small: true });
back('lamp', 3150);
back('wreck', 3300);
// Loading dock, a container stack with a cannon turret, a window balcony with a sniper.
solids.push({ x: 1900, y: 164, w: 68, h: 16 });
container(2180, 148, 64, 32, 'blue', { doors: 'left', mark: 'RLX' });
container(2244, 116, 96, 64, 'red', { mark: 'OKM' });
container(2340, 148, 64, 32, 'green', { doors: 'right' });
platforms.push({ x: 2730, y: 128, w: 28, style: 'catwalk' });
spawn('tank', 1640, { ammo: 30 });
spawn('hostage', 1704, { mode: 'wander', drop: 'fuel', look: 2 });
spawn('rifleman', 1790, { behavior: 'patrol' });
spawn('rifleman', 1820, { behavior: 'idle', facing: -1 });
spawn('grenadier', 1934, { behavior: 'guard', facing: -1 });
spawn('barrel', 1890);
spawn('flametrooper', 2020, { behavior: 'charge' });
spawn('rifleman', 2060, { behavior: 'guard', facing: -1 });
spawn('hostage', 2120, { mode: 'caged', drop: 'S', look: 0 });
spawn('truck', 2450, { troops: 3, facing: -1 });
spawn('turret', 2292, { kind: 'cannon', dir: -1 });
spawn('barrel', 2410);
spawn('light_tank', 2620, { behavior: 'advance', facing: -1 });
spawn('bazooka', 2530, { behavior: 'guard', facing: -1 });
spawn('rifleman', 2470, { behavior: 'guard', facing: -1 });
spawn('crate_prop', 2590, { drop: 'bomb' });
spawn('fuel_tank', 2600);
locks.push({
  x: 2640,
  trigger: 2610,
  waves: [
    {
      spawns: [at('truck', 3060, { troops: 3, facing: -1 }), at('rifleman', 2612, { behavior: 'charge' }), at('rifleman', 2590, { behavior: 'charge' })],
    },
    {
      delay: 1,
      spawns: [at('light_tank', 3070, { behavior: 'advance', facing: -1 }), at('jetpack', 2760, {}, 60), at('jetpack', 2960, {}, 50)],
    },
    {
      delay: 1,
      spawns: [
        at('flametrooper', 3050, { behavior: 'charge' }),
        at('shield_trooper', 3080, { behavior: 'charge' }),
        at('flametrooper', 2600, { behavior: 'charge' }),
        at('officer', 3110, { facing: -1 }),
        at('paratrooper', 2720, {}),
        at('paratrooper', 2880, {}),
      ],
    },
  ],
});
spawn('sniper', 2744, { behavior: 'guard', facing: -1 }, 128);
spawn('jeep', 3320, { facing: -1, bursts: 3 });
spawn('rifleman', 3140, { behavior: 'guard', facing: -1 });
spawn('rifleman', 3170, { behavior: 'guard', facing: -1 });
spawn('hostage', 3236, { drop: 'bomb', look: 1 });
spawn('m4_magnet', 3420);
back('sign', 3530, G, { v: 'warn' });

// ------------------------------------------------------------------ S3 dry dock (3800-4560)

far('drydock', 3800, G, { w: 634, depth: 140 });
// The Legion hull on its blocks (solid; climb the keel block, then the deck).
solids.push({ x: 4016, y: 296, w: 24, h: 24 });
solids.push({ x: 4040, y: 272, w: 140, h: 48 });
back('ship', 4040, 320, { w: 140, h: 48, name: 'LGN-9', seed: 11 });
back('keelblocks', 3990, 320, { w: 50 });
back('keelblocks', 4232, 320, { w: 80 });
water.push({ x: 3950, y: 314, w: 66, h: 6 });
water.push({ x: 4180, y: 314, w: 110, h: 6 });
back('lamp', 3720);
back('crates', 3760);
back('tires', 4470);
back('lamp', 4520);
spawn('crate_prop', 3740, { drop: 'bomb' });
spawn('hostage', 3660, { drop: 'F', look: 2 });
spawn('rifleman', 3940, { behavior: 'sleep', facing: 1 });
spawn('hostage', 4236, { mode: 'caged', drop: 'bomb', look: 0 });
locks.push({
  x: 3900,
  trigger: 3860,
  waves: [
    {
      spawns: [at('rifleman', 3874, { behavior: 'charge' }), at('rifleman', 3846, { behavior: 'charge' }), at('flametrooper', 4300, { behavior: 'charge' })],
    },
    {
      delay: 1,
      spawns: [at('jetpack', 3980, {}, 200), at('jetpack', 4220, {}, 190), at('saber', 4310, { behavior: 'charge' }), at('saber', 4340, { behavior: 'charge' })],
    },
    {
      delay: 1,
      spawns: [
        at('grenadier', 4300, { behavior: 'guard', facing: -1 }),
        at('shield_trooper', 4330, { behavior: 'charge' }),
        at('rifleman', 3860, { behavior: 'charge' }),
        at('officer', 4370, { facing: -1 }),
      ],
    },
  ],
});
spawn('sniper', 4480, { behavior: 'guard', facing: -1 });
spawn('mortar', 4540, { facing: -1 });

// ------------------------------------------------------------------ S4 canal C + container yard (4560-5600)

canal(4560, 224, [
  [4604, 48],
  [4672, 48],
  [4740, 48],
]);
spawn('frogman', 4640, {}, undefined, 4560);
spawn('frogman', 4720, {}, undefined, 4600);
ground.push([
  [4784, G],
  [5820, G],
]);
far('crane', 4980, G, { cable: 64 });
container(4880, 148, 64, 32, 'teal', { doors: 'left', mark: 'TSU' });
container(4944, 116, 96, 64, 'orange', { mark: 'PLV' });
platforms.push({ x: 5040, y: 116, w: 96, style: 'catwalk' });
container(5136, 148, 64, 32, 'purple', { doors: 'right' });
stack(5330, ['grey', 'blue']);
back('bollard', 4800, G, { rope: true });
back('lamp', 4840);
back('net', 5240);
back('lamp', 5420);
back('firebarrel', 5480);
back('tires', 5530);
spawn('crate_prop', 4830, { drop: 'H' });
spawn('turret', 4996, { kind: 'mg', dir: -1 });
spawn('sniper', 5104, { behavior: 'guard', facing: -1 });
spawn('rifleman', 5070, { behavior: 'sleep', facing: 1 }, G);
spawn('rifleman', 5100, { behavior: 'sleep', facing: -1 }, G);
spawn('hostage', 5086, { mode: 'caged', drop: 'R', look: 1 }, G);
spawn('mine', 5250);
spawn('mine', 5292);
spawn('rifleman', 5380, { behavior: 'patrol' });
spawn('grenadier', 5440, { behavior: 'guard', facing: -1 });
spawn('hostage', 5470, { drop: 'C', look: 2 });
spawn('crate_prop', 5520, { drop: 'bomb' });
spawn('barrel', 5560);

// ------------------------------------------------------------------ S5 lock 4: the slip (5600-6040)

water.push({ x: 5820, y: WL, w: 220, h: H - WL, deadly: true });
far('deepwater', 5820, WL, { w: 220, depth: H - WL });
far('openharbour', 5700, G, { w: 440 });
spawn('m4_bridge', 5820, { w: 220, lockX: 5600 });
back('bollard', 5800, G, { rope: true });
locks.push({
  x: 5600,
  trigger: 5560,
  announce: 'BATTLE STATIONS!',
  waves: [
    {
      spawns: [at('gunboat', 5950, { facing: -1 }), at('rifleman', 5576, { behavior: 'charge' }), at('shield_trooper', 5550, { behavior: 'charge' })],
    },
    {
      delay: 1,
      spawns: [at('heli', 6060, { facing: -1 }), at('jetpack', 5700, {}, 60), at('grenadier', 5560, { behavior: 'charge' })],
    },
    {
      delay: 1,
      spawns: [at('light_tank', 5540, { behavior: 'advance', facing: 1 }), at('gunboat', 5900, { facing: -1 }), at('gunboat', 6000, { facing: -1 }), at('paratrooper', 5680, {})],
    },
    {
      delay: 1.5,
      spawns: [
        at('rifleman', 6070, { behavior: 'charge' }),
        at('rifleman', 6100, { behavior: 'charge' }),
        at('flametrooper', 6130, { behavior: 'charge' }),
        at('officer', 6160, { facing: -1 }),
        at('jetpack', 5900, {}, 50),
      ],
    },
  ],
});

// ------------------------------------------------------------------ S6 far quay, calm approach, boss (6040-7400)

ground.push([
  [6040, G],
  [TIP, G],
]);
stack(6180, ['red', 'teal']);
back('lamp', 6100);
back('crates', 6230);
back('lamp', 6400);
back('sign', 6470, G, { v: 'arrow' });
back('bollard', 6540, G, { rope: true });
back('lamp', 6620);
back('net', 6700);
back('bollard', 6780);
back('lamp', 6860);
back('firebarrel', 6920);
back('lamp', 6990);
back('bollard', TIP - 8, G, { rope: true });
far('openharbour', 6560, G, { w: 900 });
far('deepwater', TIP, 190, { w: WIDTH - TIP, depth: H - 190 });
water.push({ x: TIP, y: 190, w: WIDTH - TIP, h: H - 190, deadly: true });
spawn('rifleman', 6200, { behavior: 'guard', facing: -1 });
spawn('bazooka', 6260, { behavior: 'guard', facing: -1 });
spawn('rifleman', 6300, { behavior: 'chat', facing: 1 });
spawn('rifleman', 6322, { behavior: 'chat', facing: -1 });
spawn('hostage', 6150, { mode: 'wander', drop: 'bomb', look: 0 });
spawn('hostage', 6600, { drop: 'L', look: 1 });
spawn('pickup', 6720, { item: 'bomb' });
spawn('pickup', 6820, { item: 'bomb' });
locks.push({
  x: L,
  trigger: L - 40,
  boss: true,
  announce: 'WARNING!',
  waves: [{ spawns: [{ type: 'boss_m4', x: L + 300 }] }],
});

registerLevel({
  id: 'm4',
  mission: 4,
  name: 'RUSTWATER DOCKS',
  subtitle: 'OPERATION HIGH WATER',
  briefing:
    'THE LEGION HAS TURNED RUSTWATER HARBOUR INTO A SUB PEN. A STORM SURGE HAS THE CANALS BRIMMING - FROGMEN LURK IN EVERY ONE. GRAB A BULLDOG IN THE WAREHOUSE DISTRICT, FREE THE DOCKHANDS, PUSH THROUGH THE DRY DOCK TO THE BASIN AND SINK WHATEVER IS HIDING UNDER IT.',
  theme: 'm4',
  music: 'm4',
  bossMusic: 'boss',
  bossName: 'LEVIATHAN',
  width: WIDTH,
  height: H,
  start: { x: 60 },
  ground,
  platforms,
  solids,
  water,
  camera: [
    [3560, 0, 0],
    [3680, 0, 136],
    [4300, 0, 136],
    [4440, 0, 0],
  ],
  checkpoints: [900, 1700, 2560, 3540, 4460, 5420, 6300],
  timeLimit: 80,
  entities,
  locks,
  decor,
});
