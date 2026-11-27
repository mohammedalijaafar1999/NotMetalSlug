# Content reference (levels, bosses, encounters)

Everything a level or boss author can place, with the props and placement rules each piece needs.
Read with docs/DESIGN.md (what the game is), docs/LEVEL_DESIGN.md (how missions are structured) and
docs/ARCHITECTURE.md (engine contracts). Entity descriptions below come from `registerEntity(...)`;
the source file header of each type documents it in more detail.

## Entity catalog

| type | category | description / props |
|---|---|---|
| `m5_supply` | pickup | Mission 5 sky supply drop: a pickup (props.item, default fuel) drifting down under an allied teal parachute with a green beacon; touch it with the gyro to collect. y omitted = starts above the screen. props.drift, fall |
| `pickup` | pickup | Item on the ground. props.item = spec string (H, bomb, firebomb, points:500, item:pineapple, life, fuel, random...) |
| `hostage` | hostage | Captured mechanic. props.drop = pickup spec; props.mode = "tied" (default) \| "caged" (shoot the cage, props.cageHp=8) \| "wander" (touch); props.look 0..2 |
| `airship_turret` | enemy | Airship ball turret (12 HP, no gravity): bolted to a hull plate at y (the hull surface); props.mount 'top' (default, aims up) \| 'bottom' (hanging, aims down); tracks you and fires telegraphed 3-shot bursts; props.vx drift to ride a moving ship; props.drop |
| `bazooka` | enemy | Kneels, aims 0.6 s (launcher glints), fires a slow straight rocket (60 -> 160 px/s, no homing, can be shot down). Keeps ~150 px away. props.behavior, range, facing, drop |
| `bunker` | enemy | Concrete pillbox (40 HP, blocksProgress): MG slit bursts toward props.facing (telegraphed glow) and a door that releases props.troop (default 'rifleman') every props.spawnEvery s (3.5) while fewer than props.maxTroops (3) are alive; collapses to rubble. props.drop |
| `drone` | enemy | Small flying drone (2 HP), swarms (spawn several). props.kind 'kamikaze' (default: telegraphed lock-on then straight dive, explodes on contact) \| 'zap' (slow electric bolts after a crackle); props.alt (swarm screen-y, default 76); props.drop |
| `fighter` | enemy | Jet fighter (8 HP, flying): edge warning, then strafing passes (aimed nose-gun bursts + one dropped homing missile), loops back between passes alternating low/high, leaves after props.passes (4). props.facing = first pass direction, props.alt (low-pass screen-y, default 112), props.drop |
| `flametrooper` | enemy | Gas-masked flamethrower trooper, 2 HP: 0.45 s pilot-light telegraph, ~1 s flame jet (~60 px), ~3 s cycle. Fuel tanks explode on death (hurts nearby enemies, not players). props.behavior, reach, facing, drop |
| `frogman` | enemy | Frogman: hides in deep water (invulnerable, snorkel tip visible), pops up with a splash, 0.45 s wind-up, throws an arcing harpoon, dives again. On land he waddles and throws harpoons. props.water (false = land only), range, behavior, facing, drop |
| `grenadier` | enemy | Lobs arcing grenades after a 0.5 s wind-up, keeps ~130 px away, backs off when you get close. props.behavior: patrol\|guard\|idle\|sleep\|chat\|charge, range (px), facing, drop |
| `gunboat` | enemy | Patrol gunboat (26 HP): floats on the water body it spawns in (patrols it; beached on the ground if there is no water), telegraphed arcing deck-gun shells + bridge-MG bursts; sinks when destroyed. Spawn with y omitted (or on the water surface). props.facing, props.drop |
| `heli` | enemy | HORNET attack helicopter (24 HP, flying): hovers near the top of the screen, telegraphed sweeping chin-gun bursts and bomb runs (whistle + ground marker); crashes when destroyed. props.facing, props.alt (skid screen-y, default 78), props.bombs (default true), props.drop. Spawn off-screen to fly in; y omitted = altitude band. |
| `jeep` | enemy | Gun jeep (16 HP): drives in fast, brakes at range (props.stopX), gunner swivels + telegraphed MG bursts, rams while fast, reverses off-screen after props.bursts (default 3) unless props.leave=false or the camera is locked. props.facing, props.drop |
| `jetpack` | enemy | Jetpack trooper, 2 HP: hovers ~65 px up and strafes inside the view; telegraphed 3-round downward bursts and grenade drops from above. Crashes in flames when shot down. No y = starts on the ground and takes off. props.height, facing, drop |
| `light_tank` | enemy | STOMPER light tank (30 HP): keeps range, telegraphed arcing cannon shells + close hull-MG bursts, treads crush. props.facing 1\|-1, props.behavior advance\|hold, props.drop |
| `m5_fuel_zeppelin` | enemy | Mission 5 set piece: Legion fuel tanker zeppelin (110 HP x difficulty, 5000 pts) hovering at x/y (envelope centre) with two escort airship_turrets (spine + keel; props.turrets=false for none). Pushes gyros out of its hull. Destroyed: 1.7 s chain of blasts, then a huge fireball that destroys nearby enemies (and singes a gyro right next to it). Blocks its wave until the fireball. props.facing (default -1), drop |
| `mortar` | enemy | 2-man mortar crew that stays put: blinking target marker shows where each shell lands ~1.35 s ahead. Each crewman is a 1-HP soldier; the survivor fires alone (slower). props.facing, drop (gunner), range (default 360), interval (default 3.2 s) |
| `officer` | enemy | Officer (500 pts, 3 HP): whistles to rally troops within ~240 px (they wake, engage and fire faster), points the charge, shoots a pistol; panics when hurt and flees off-screen when left alone. props.drop (default random score item, "none"), rally, behavior (default guard), facing |
| `paratrooper` | enemy | Descends under a shootable parachute (tear it and he falls - splat), then fights like a rifleman with an SMG. No y = starts above the screen. props.landed, drift, behavior (after landing, default charge), facing, drop |
| `rifleman` | enemy | Basic rifle infantry: patrols, notices you ("!"), shoots slow straight bullets (sometimes crouched, sometimes 2-round bursts), panics near heavy weapons. props.behavior: patrol\|guard\|idle\|sleep\|chat\|charge, facing, drop |
| `robot` | enemy | Clockwork Grunt robot, 4 HP armour (bullets clang but hurt, knife max 2 per stab, explosions normal): stomps in, 0.6 s glowing charge, fires 2 slow energy bolts; pops apart on death. props.behavior (sleep = powered down), facing, drop |
| `saber` | enemy | Swordsman: charges (jumps small gaps), 0.38 s wind-up with blade glint, then a slash that only hurts during the swing; sometimes a telegraphed leaping slash. props.behavior, leap (default true), facing, drop |
| `shield_trooper` | enemy | Riot shield blocks frontal bullets (sparks + clang) until it breaks; flank him, jump-shoot over it, knife or bomb him. Pistol peeks over the shield to fire. props.behavior, shield (hp, default 14), facing, drop |
| `sniper` | enemy | Marksman for high ledges: red laser sight tracks you ~0.75 s, locks (blinks) 0.25 s, then a fast 240 px/s shot along the locked line. Panics up close. props.behavior (default guard), range (default 330), facing, drop |
| `snowmobile` | enemy | Snowmobile raider (8 HP): charges and rams (crush), rider raises his pistol then fires 2-shot bursts, skids round after overshooting and charges again. props.facing, props.drop |
| `truck` | enemy | Troop truck (20 HP): drives in, stops on screen (props.stopX), opens the back and unloads props.troops (default 3) of props.troop (default 'rifleman'), then backs out (props.leave, default true); rams while fast. props.facing, props.drop |
| `turret` | enemy | Emplaced gun on a sandbagged pedestal (14 HP): telegraphed (barrel swing + muzzle glow). props.kind 'mg' (bursts) \| 'cannon' (arcing shells) \| 'flak' (air-burst shells, aims at flyers); props.dir -1\|1 fixed facing (else turns to face you slowly); props.drop |
| `boss_m1` | boss | GRINDER (mission 1 boss, 380 HP, 30000 pts): steam war-dozer that parks against the right edge of a one-screen arena; its hull is solid. Arena: FLAT ground across [L, L+384] (no pits/solids/water/platforms/props), boss lock at L with NO announce (the boss shows its own WARNING banner), bossMusic "boss". Spawn { type: "boss_m1", x: L + 282 } (resting hull centre; y read from the ground; it drives in from off-screen right). Camera at the bottom of the level (ground ~y 170-190 on screen, >= 120 px of sky above it for the 113 px tall stack). Keep the left 80 px clear: the blade charge stops 74/60/50 px from the left edge (safe pocket). |
| `boss_m2` | boss | HORNET KING twin-rotor heavy gunship (Mission 2 boss, flying, 380 HP x difficulty, 30000 pts). Flies in by itself from off the RIGHT edge of the locked screen (props.from = "left" for the other side; spawn x/y are ignored) and is not hittable during its ~2.6 s entrance. Telegraphed chin-gun sweeps (red sight line; safe under/behind the hull), top-attack missile salvos onto marked spots (keep moving / shoot them), carpet-bombing runs (bomb shadows every 64 px), low re-arm hover after salvos/runs (grenade window); 50%: the aft rotor tears off and crashes -> wobbly erratic flight, double sweeps, missile rain on marked 48 px slots; 20%: burning, faster. Crashes and burns on death (wreck stays). ARENA: flat open ground at ONE height across the whole locked screen [lock.x, lock.x + 384], ground about 30 px above the screen bottom (y 184 in a 216-tall level), camera at the level bottom (no camera keys there); NO platforms, solids, water, pits or tall foreground decor inside it (bombs, missiles and shadows need the floor; it flies 46-120 px above the ground); 150 px of flat ground beyond both edges is nice for the torn rotor. Lock: { x: L, boss: true, music: "boss", announce: "WARNING! ..." } (the boss itself never calls world.announce). Spawn it in the first wave (delay ~1 s), e.g. { type: "boss_m2", x: L + 500 }. |
| `boss_m3` | boss | FROST BASTION (mission 3 boss, 260 hp): a fortified gatehouse wall that rises out of the snow and fills the right side of the arena. Weak point: the frost core behind blast doors at the foot of the wall (hittable only while pushed out - plain forward fire hits it); 3 destructible turrets (MG under the gallery tip, ice flak + mortar nest on the gallery - shoot them from below). Attacks: head-height frost lance (crouch), floor spike wave (jump), avalanche boulders (jump or shoot), mortar/flak marks, icicles (shadows). ARENA: lock { x: lockX, boss: true, announce: "WARNING! FROST BASTION", music: "boss" } with the single spawn { type: "boss_m3", x: lockX + 316 } (the wall face always lands at lockX + 248). One flat floor from lockX - 40 to lockX + 384 or beyond, ground 184 px below the camera top (level height 216, ground y 184). No pits, water, platforms, solids, other enemies or front decor in the arena. |
| `boss_m4` | boss | LEVIATHAN monster submarine (mission 4 boss, 360 base HP, 3 phases). Rises from the harbour (2.7 s, unhittable); torpedoes skim the water and ride up onto the dock (jump), missile pod salvos with landing markers, periscope laser whip (thin line + swept-path telegraph, then a fast sweep across the dock: jump it); phase 2 a claw arm slams (shadow) then rakes the planks; phase 3 dives (only the tower is hittable). Weak points: conning tower, missile pods (destructible), open mouth. ARENA (L = lock x): flat dock y=180 from L to L+148 (vertical face, deck kept clear), deadly water L+148..>=L+384 with surface y=190 and >=70 px depth; lock { x: L, trigger: L-40, boss: true, announce: "WARNING!" }; spawn { type: "boss_m4", x: L+300 } (y omitted); level width >= L+384, camera at the bottom. |
| `boss_m5` | boss | THUNDERHEAD flagship airship (mission 5 boss, 380 HP x difficulty, 30000 pts), fought from the DRAGONFLY gyro. Holds a station relative to the CAMERA (ship centre at screen (270, 100); with its slow drift the body covers screen x ~168-386, y ~48-189), so its spawn x/y only need to be inside the boss lock wave (e.g. x = lockX + 300, y = 100). Entrance: slides in from the right for 2.6 s, not hittable. Arena: LevelDef.startVehicle "gyro"; open sky across the whole locked view - no ground, solids or platforms inside it (kill floor = ground far below, e.g. ground y = height + 160 so falls end the life); keep the camera y fixed in the arena (camera key minY = maxY) and the lock x <= width - 384. Use the lock announce "WARNING!" (the boss does not announce); boss music starts from bossStart. Spawns its own "drone" enemies (max 3) and parachute mines. Phases at 62% / 33%: turrets + drones + mines, then broadside volleys, then the nose storm core (x1.35 damage) opens and fires aimed lightning. |
| `boss_m6` | boss | JUGGERNAUT, Marshal Gristle's crimson war walker (final boss, 300 HP, ~165 px tall, ~120 px wide). Walks back and forth on the right of the arena: artillery volleys with landing markers, stomps that send ground shockwaves (jump), missile rain on markers 64 px apart (stand in a gap); <60% chest armour blows off -> reactor core (x2.2), core laser at 25 px above the floor after squatting (crouch), drones; <25% desperation. Walks in from the right edge (~2.7 s, not hittable) and announces itself (WARNING banner) - the boss lock must NOT have an announce. ARENA: flat floor at least 1 screen wide from the lock x, no platforms / solids / water / pits inside it, floor at screen y >= 196 (e.g. ground y 198 in a 216 tall level, camera at the bottom). Spawn: { type: "boss_m6", x: lockX + 290 } (its home x; y omitted). Level: bossMusic 'boss_final'. It spawns its own drones; ejects Gristle's escape pod on death. |
| `barrel` | prop | Explosive red barrel: blows up after a few hits, hurts everyone nearby, chain-reacts. props.hp=3 |
| `crate_prop` | prop | Breakable wooden crate you can stand on. props.drop = pickup spec, props.size = small\|big |
| `fuel_tank` | prop | Big explosive fuel tank: leaks flame when hurt, huge blast + secondary pops (hits everyone), burning wreck. props.hp=14 |
| `m2_bridge` | prop | Mission 2 rigged timber rail bridge: x = deck center, y = deck surface, props.spans (5 x 66 px). One-way deck drawn by itself, trestle bents on the riverbed 44 px below. arm() (via m2_detonator in a lock wave) -> 2.2 s blinking/beeping telegraph + banner, then the bents blow from the far end: spans fall, vehicles on them are wrecked (pilot thrown clear); blasts hurt enemies only. |
| `sandbag_wall` | prop | Decorative sandbag wall (blocks nothing) that explosions tear down. props.bags=4, rows=3 |
| `sandbags` | prop | Sandbag cover: like sandbag_wall but soaks up enemy bullets. props.bags=4, rows=3 |
| `m6_crusher` | hazard | Hydraulic press (mission 6): x = centre, y = floor; cycles UP -> WARN (0.75 s red lamp, beeps, shudder, glowing floor plate) -> SLAM -> HOLD -> RISE. The head is solid; anything under it when it slams is crushed (players, enemies, props; vehicles lose armour). props.cycle (s, default 3.4), offset (s), clearance (px, default 44), scrap (true = SCRAP PRESS: 48 px head, 58 px clearance, slams on vehicles at once and wrecks them). |
| `m6_ladle` | hazard | Crane ladle (mission 6): x = where the molten stream lands, y = that floor/surface y; cycles IDLE -> TILT (0.9 s, drips + target marker) -> POUR (1.3 s burning column, props.splash globs with landing markers) -> upright. props.cycle (s, default 5), offset (s), height (lip above y, default 120), splash (default 2). |
| `m6_molten` | hazard | Molten metal channel (mission 6): x = pit centre, y = molten surface; props.w (pit width, default 28), floor (ground y at the edges, default y - 12). Burns anything touching the surface (players, enemies, vehicles, props). Put it in a pit (gap in the ground) <= 28 px wide plus a deadly LevelDef.water rect from the surface down; spawn it early (trigger) so the pit never shows empty. |
| `mine` | hazard | Half-buried proximity mine: arms when a player, vehicle or enemy steps on it, beeps, then explodes (hits everyone). Shootable. |
| `gyro` | vehicle | DRAGONFLY gyrocopter: free 8-way flight, nose vulcan (down-tilt), belly bombs (BOMB, props.ammo=20). 80 HP. Use LevelDef.startVehicle="gyro" for flying missions |
| `mech` | vehicle | STRIDER walker: chin cannon, homing missile salvo (BOMB, props.ammo=20), thruster jump + glide, landing stomp. 90 HP |
| `tank` | vehicle | BULLDOG mini-tank: 8-way vulcan turret, mouth cannon (BOMB, props.ammo=30), hop. 100 HP |
| `m1_bog` | misc | Mission 1 river ford mud (invisible trigger): a ground vehicle that rolls into the water inside it sticks fast, sinks into a mud mound for ~1.1 s, then is wrecked (pilot thrown clear, invulnerable). Soldiers just wade. props.w = width (150), centred on x; y omitted = river bed. |
| `m1_gate` | misc | Mission 1 stockade gate (cosmetic): shudders as the GRINDER drives up behind it, then bursts into flying planks when the blade hits it. Not hittable, not solid. Place at bossL + ~352 on the ground. |
| `m2_detonator` | misc | Mission 2 lock-wave helper: arms the nearest m2_bridge and blocks the wave until the bridge has collapsed. |
| `m2_incoming` | misc | Mission 2 lock-wave helper: telegraphs an entity entering from a screen edge (blinking "!" + arrow on that edge, dust, engine rumble), spawns props.type with props.props at x after props.delay (1.3 s) and blocks the wave until it is gone. |
| `m3_cablecar` | misc | FROSTBITE PASS cable car: a gondola riding a sagging cable (props.cable [[x,y],...] supports, sag, to = arrival dock x, stops [{x, lock}] halts until that camera lock is done, speed, ends). Players ride the roof (dynamic solid, railed in over the gorge); it leaves its dock (spawn x) once players board. |
| `m3_weak_bridge` | misc | FROSTBITE PASS plank bridge over a ravine: holds people, collapses under a player vehicle (props.w deck length, props.floor ravine floor y, props.creak); any vehicle that ends up in the ravine is wrecked (its pilot is thrown clear). Spawn at the left end on the deck: x, y = deck. |
| `m4_bridge` | misc | Mission 4 vertical-lift bridge over a slip: lattice towers on both banks, the deck hangs props.raised (130) px above the banks so boats can pass, and comes down (1.25 s, alarm + clang) when the lock at props.lockX reaches wave props.wave (default its last wave) or is cleared; without lockX it lowers after 1.5 s. x = slip left edge, props.w = slip width; the lowered deck is a one-way platform at bank height. |
| `m4_harbor` | misc | Mission 4 water feedback (place once at x 0, persistent, invisible): anything that falls through a deep (deadly) water surface splashes (big for people/vehicles, small for shells/debris) with the splash sound; players who go under leave bubbles. Deep water in m4 is a pit, so falling in loses a life. |
| `m4_magnet` | misc | Mission 4 set piece: gantry crane with an electromagnet over the road (legs at x+-84, place on flat ground, y omitted). When a piloted ground vehicle comes within ~118 px it sounds the alarm ("MAGNET!"), tracks it, slams down, throws the pilot clear (1.8 s invulnerable) and hoists the vehicle off-screen. Acts once; harmless on foot. |
| `m4_pontoon` | misc | Floating pontoon (mission 4): one-way timber deck on drums that bobs on the water and dips under a rider. Spawn over water with y omitted (deck 3 px above the surface). props.w deck width (44), bob (1.5 px), phase (s). |
| `m5_airspace` | misc | Mission 5 flight-control helper (invisible, one at a time): eases player gyros out of airship hulls they were squeezed or respawned into, and flies a spare gyro (props-free) down to a pilot stranded on a deck after being shot down |
| `m6_conveyor` | misc | Conveyor belt (mission 6): x = belt centre, y = the floor/solid top it lies on; props.w (default 96), speed (px/s, + = right, default 36). Carries everything standing on it (players, enemies, vehicles, pickups, crates). Spawn it early (trigger) so it is visible before it scrolls in. |
| `m6_lift` | misc | Reactor-shaft lift (mission 6): x = centre, y = bottom stop (floor y); props.top = upper stop y, speed (46), events [{ at: 0..1, type, dx, dy?, props }] = ambush spawns relative to the camera during the first climb. Starts climbing when a player stands on it, sinks back when left empty with a player below. 88 px wide deck. |

Spawn specs (`SpawnSpec`): `{ type, x, y?, trigger?, props? }`. `x` is the feet/centre x; omit `y`
to stand on the top floor at x. Level `entities` spawn when the camera's right edge reaches
`trigger` (default x - 8) - so things placed just past the right edge walk in naturally. Lock waves
spawn when the previous wave is cleared (`delay`, default 0.5 s).

## Missions

| # | level | name | size (w x h) | vehicle beat | mission mechanics | boss | music / boss music | time |
|---|---|---|---|---|---|---|---|---|
| 1 | `m1` | PALM HARBOR | 6904 x 336 | BULLDOG tank (ends in the river bog) | `m1_bog`, `m1_gate` | GRINDER (`boss_m1`) | m1 / boss | 99 |
| 2 | `m2` | DUSTWIND CANYON | 7344 x 440 | STRIDER mech (lost with the bridge) | `m2_bridge`, `m2_detonator`, `m2_incoming` | HORNET KING (`boss_m2`) | m2 / boss | 80 |
| 3 | `m3` | FROSTBITE PASS | 7904 x 520 | STRIDER mech (lost at the weak bridge) | `m3_weak_bridge`, `m3_cablecar` | FROST BASTION (`boss_m3`) | m3 / boss | 99 |
| 4 | `m4` | RUSTWATER DOCKS | 7400 x 352 | BULLDOG tank (taken by the gantry magnet) | `m4_harbor`, `m4_pontoon`, `m4_magnet`, `m4_bridge` | LEVIATHAN (`boss_m4`) | m4 / boss | 80 |
| 5 | `m5` | STORMFRONT | 7000 x 328 | DRAGONFLY gyro for the whole mission (`startVehicle`) | `m5_airspace`, `m5_supply`, `m5_fuel_zeppelin` | THUNDERHEAD (`boss_m5`) | m5 / boss | 99 |
| 6 | `m6` | IRON CITADEL | 7104 x 456 | STRIDER mech (scrapped by the presses) | `m6_conveyor`, `m6_crusher`, `m6_ladle`, `m6_molten`, `m6_lift` | JUGGERNAUT (`boss_m6`) | m6 / boss_final | 85 |

Each boss has a test arena `bosstest_mN` (mission 0) and `tests/boss_mN.test.ts`. Each mission has
`tests/mission_mN.test.ts`. A boss's `registerEntity` description states its arena contract.

## Placement rules

### Infantry (all `meleeable`, accept `facing` and `drop`)
- `behavior`: `patrol` (default) | `guard` | `idle` | `sleep` (Z bubbles, wakes on noise/whistle) |
  `chat` (place two `chat` soldiers 15-25 px apart; they face each other) | `charge`. Calm soldiers
  notice on-screen players within ~220 px (sleepers ~78, chatters ~150).
- `sniper`: high ledge/platform; range 330 (`props.range`); panics within 44 px. The autopilot only
  shoots up at targets within ~70 px horizontally, so keep snipers reachable.
- `mortar`: flat ground with ~30 px clear on both sides; blocks waves until both crewmen die.
- `paratrooper`: omit y to start just above the screen at x; use `trigger` so x is inside the view.
  `landed: true` starts on the ground.
- `frogman`: needs water >= 20 px deep at x (spawn x inside the water, y omitted). The water must be
  visible inside the arena or he stops blocking the wave after ~6 s. `water: false` = land only.
- `jetpack`: give y to start airborne; omit y to take off when he notices you.
- `officer`: 500 pts; default drop is a random score item (`drop: 'none'` for nothing). Place him
  behind a group; alone he flees and is removed.
- `shield_trooper`: frontal `bullet`/`laser` hits are blocked; explosions, fire, knife, crush go through.
- `robot`: 4 HP armour; `behavior: 'sleep'` = powered down.
- Score: rifleman/grenadier/paratrooper/mortar crewman 100, bazooka/saber/frogman 150,
  shield/sniper/flametrooper/jetpack 200, robot 300, officer 500.

### Machines (category `enemy`, all `blocksProgress`)
- Ground machines (`light_tank`, `jeep`, `truck`, `snowmobile`, `bunker`, `turret`, `gunboat`): spawn
  just off the right edge so they drive in; `facing` defaults toward the player. They stop at
  cliffs/ledges (no jumping) - give them a run of ground.
  - `light_tank`: `behavior` advance|hold. `jeep`: `stopX`, `leave` (default true; never leaves while
    the camera is locked), `bursts`. `truck`: `troops` (3), `troop` ('rifleman'), `stopX`, `leave`;
    the wave stays blocked until the unloaded troops are dead. `bunker`: `maxTroops` 3, `spawnEvery`
    3.5, `troop` (troops it spawns are NOT tracked by the wave). `turret`: `kind` mg|cannon|flak,
    `dir` -1|1 fixes facing.
  - `gunboat`: y omitted over a water body (deep water best, e.g. a pit filled with `deadly` water).
- Flyers (`heli`, `drone`, `fighter`): omit y to use the camera-relative altitude band (`props.alt`
  = screen y: heli 78, drone 76, fighter low pass 112). Spawn off either screen edge to fly in from
  that side; spawned on screen, heli/drone drop in from above. `drone.kind` kamikaze|zap (spawn
  several for a swarm). `fighter.passes` (4), `facing` = first pass direction; always warns first.
- `airship_turret` (sky mission): y = the hull surface it is bolted to; `mount` top|bottom (hanging;
  with y omitted it hangs just under the HUD); `vx` drifts with a moving ship. Ground-level top
  turrets are low: players must crouch-shoot them (the autopilot does).
- Debug level `machine_range` (mission 0): `?level=machine_range&spawn=light_tank@300`.

### Player vehicles (category `vehicle`)
- Park `tank` (BULLDOG), `mech` (STRIDER) or `gyro` (DRAGONFLY) on flat ground as a level entity;
  players enter with DOWN while overlapping (or by landing on the hatch) and eject with DOWN+JUMP.
  `props.ammo` = secondary ammo (cannon shells / missiles / bombs). `fuel` pickups repair.
- `LevelDef.startVehicle: 'gyro'` puts players in a gyro at start and on every respawn (mission 5).
- A destroyed vehicle throws the pilot clear and explodes (damages enemies). The autopilot enters
  empty vehicles near its path and flies gyros (`Vehicle.flying`).
- Follow a vehicle with a stretch that lets it shine (tanks/jeeps/infantry crowds), then something
  that forces you out or wrecks it.

### Props and hazards
- `barrel` (explosive, chain-reacts, hurts everyone; `hp` 3), `fuel_tank` (big blast, `hp` 14),
  `crate_prop` (breakable, can be stood on; `drop`, `size` small|big), `mine` (proximity, beeps,
  hurts everyone, shootable), `sandbags` (cover that soaks enemy bullets; `bags`, `rows`),
  `sandbag_wall` (decorative, explosions tear it down).

### Pickups and hostages
- Pickup spec strings (used by `pickup` `props.item`, hostage/crate/enemy `drop`): weapon letters
  `H R S F L C B`, `bomb` (+10 grenades; in a vehicle +10 shells), `firebomb`, `fuel`, `life`,
  `points`, `points:5000`, `item:<sprite>` (score items: item_coin, item_ration, item_watch,
  item_medal, item_gem, item_goldbar...), `random`.
- `hostage`: `mode` tied (default; shoot or touch) | caged (shoot the cage; `cageHp` 8) | wander
  (touch); `drop` (default random); `look` 0..2; `facing`. +1000 per rescue in the tally; the tally
  rank counts `type: 'hostage'` spawns in `entities` and lock waves (S = all rescued). Hostages
  should drop the good weapons (and bombs before arenas).

## Weapons (player)

| letter | id | ammo | notes |
|---|---|---|---|
| - | pistol | inf | semi-auto |
| H | hmg | 200 | 4-shot bursts, sweeps through diagonals |
| R | rocket | 30 | slow start, light homing, splash |
| S | shotgun | 30 | 96 px cone, pierces |
| F | flame | 30 | rolling fireballs, pierce, burn |
| L | laser | 200 | held beam, pierces, stops at terrain |
| C | homing | 40 | twin chaser missiles |
| B | bouncer | 30 | bouncing explosive balls |

Standing muzzle height is ~22 px above the feet (crouched ~17): targets lower than that need a
crouch. Bombs: grenades (default), `firebomb` crates switch to fire bombs.

## Audio for levels

- Songs: `m1`..`m6` per mission (`music`), `boss` for bosses 1-5 and `boss_final` for mission 6
  (`bossMusic` or a lock's `music`). Others: title, select, briefing, mission_complete, tally,
  gameover, ending, credits.
- Use only canonical SFX names (docs/DESIGN.md; `SFX_NAMES` in src/content/sfx/canonical.ts). Pass
  vol 0.5-1. Looping machinery sounds are one-shots to re-trigger at about their length: tank_tread
  ~0.36 s, heli_rotor 0.42, gyro_rotor 0.3, engine 0.4, drone_buzz 0.3, jetpack 0.32, alarm 0.9.
  Telegraphs: sniper_charge 0.92 s, mortar_whistle 1.1, boss_charge 0.92, warning 1.45 (boss siren).

## UI hooks a level should fill

- `name`, `subtitle`, `briefing` (UPPERCASE reads best; wrapped to 178 px, max 11 lines) and
  `bossName` on the LevelDef feed the briefing card, mission select and boss bar.
- A lock `announce` starting with "WARNING" shows the striped warning banner and plays `alarm`.
- After the last mission (or when the next mission has no level) the tally goes to the ending.

## Boss toolkit (src/content/bosses/common/)

- `kit.ts`: `BigBoss` (Boss base: world-space hurt `zones` with damage multipliers = weak points,
  intro invulnerability until `finishIntro()`, arena bounds from the camera lock (`inArena`),
  `phaseAt` thresholds -> `onPhase`, hit sparks/flash/throttled sounds, `hurtPlayers(rect, kind)`
  contact damage with a per-target cooldown, `target()/targetX()`), `BossPiece` (separately
  hittable part routed through the boss), projectiles `Lobbed` (arcing shell/bomb with a landing
  `GroundMarker`) and `LockMissile` (drops, ignites, steers to a locked point, shootable),
  `FlyingPart` (tumbling debris), `Wreck` (burning remains), art helpers (`BC` palette, `Pen`,
  `plate`, `rivet`, `rivetRow`, `hazardStripes`, `cog`, `charr`), particle helpers (`smoke`,
  `flames`, `sparkBurst`) and `bsfx()/bsfxAt()` typed against canonical boss sounds.
- `fx.ts`: `hurtRect`/`hurtSegment`/`segmentTouchesPlayers` (slams and beams), crisp `pixelLine`,
  `dottedLine` (aim lines), `pixelEllipse`, a floor `GroundMarker` (cross|shadow styles), `Debris`,
  `puffSmoke/puffFire/puffSteam/puffSnow/puffFoam`, `deflectFx`.
- Extend these only additively; boss-specific code lives in `src/content/bosses/mN/`.

## Testing and debugging

- `tests/helpers.ts`: `makeWorld(def, opts)`, `step(world, n, bots?)`, `simulateMission(levelId,
  seconds)` (invincible autopilot; returns `{ completed, ... }`).
- Browser: `npx vite --port <port> --strictPort`, then `GAME_URL=http://localhost:<port>/ node
  scripts/play.mjs "<query>" artifacts/<prefix> <seconds> <shots>`; URL params `level`, `mission`,
  `autoplay`, `invincible`, `seed`, `speed`, `fast`, `2p`, `chars`, `hitboxes`, `mute`,
  `spawn=type@xOffset[@y],...`, `give=<weaponId>`, `warp=<x>`. `window.__game` exposes state(),
  startMission, spawn, warp, give, setInput, step, killEnemies, entityTypes, levels...
- Sprites without a browser: `~/.bun/bin/bun scripts/spritesheet.ts '<name-regex>' artifacts/x.png 3`.
- `GAME_URL=http://localhost:<port>/ node scripts/smoke.mjs --missions=N` (or `--dist` after `npm run
  build`) plays missions with the invincible autopilot in Chromium.
