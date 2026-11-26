# Content reference (levels, bosses, encounters)

Everything a level or boss author can place, with the props and placement rules each piece needs.
Read with docs/DESIGN.md (what the game is), docs/LEVEL_DESIGN.md (how missions are structured) and
docs/ARCHITECTURE.md (engine contracts). Entity descriptions below come from `registerEntity(...)`;
the source file header of each type documents it in more detail.

## Entity catalog

| type | category | description / props |
|---|---|---|
| `pickup` | pickup | Item on the ground. props.item = spec string (H, bomb, firebomb, points:500, item:pineapple, life, fuel, random...) |
| `hostage` | hostage | Captured mechanic. props.drop = pickup spec; props.mode = "tied" (default) \| "caged" (shoot the cage, props.cageHp=8) \| "wander" (touch); props.look 0..2 |
| `bazooka` | enemy | Kneels, aims 0.6 s (launcher glints), fires a slow straight rocket (60 -> 160 px/s, no homing, can be shot down). Keeps ~150 px away. props.behavior, range, facing, drop |
| `flametrooper` | enemy | Gas-masked flamethrower trooper, 2 HP: 0.45 s pilot-light telegraph, ~1 s flame jet (~60 px), ~3 s cycle. Fuel tanks explode on death (hurts nearby enemies, not players). props.behavior, reach, facing, drop |
| `frogman` | enemy | Frogman: hides in deep water (invulnerable, snorkel tip visible), pops up with a splash, 0.45 s wind-up, throws an arcing harpoon, dives again. On land he waddles and throws harpoons. props.water (false = land only), range, behavior, facing, drop |
| `grenadier` | enemy | Lobs arcing grenades after a 0.5 s wind-up, keeps ~130 px away, backs off when you get close. props.behavior: patrol\|guard\|idle\|sleep\|chat\|charge, range (px), facing, drop |
| `jetpack` | enemy | Jetpack trooper, 2 HP: hovers ~65 px up and strafes inside the view; telegraphed 3-round downward bursts and grenade drops from above. Crashes in flames when shot down. No y = starts on the ground and takes off. props.height, facing, drop |
| `mortar` | enemy | 2-man mortar crew that stays put: blinking target marker shows where each shell lands ~1.35 s ahead. Each crewman is a 1-HP soldier; the survivor fires alone (slower). props.facing, drop (gunner), range (default 360), interval (default 3.2 s) |
| `officer` | enemy | Officer (500 pts, 3 HP): whistles to rally troops within ~240 px (they wake, engage and fire faster), points the charge, shoots a pistol; panics when hurt and flees off-screen when left alone. props.drop (default random score item, "none"), rally, behavior (default guard), facing |
| `rifleman` | enemy | Basic rifle infantry: patrols, notices you ("!"), shoots slow straight bullets (sometimes crouched, sometimes 2-round bursts), panics near heavy weapons. props.behavior: patrol\|guard\|idle\|sleep\|chat\|charge, facing, drop |
| `paratrooper` | enemy | Descends under a shootable parachute (tear it and he falls - splat), then fights like a rifleman with an SMG. No y = starts above the screen. props.landed, drift, behavior (after landing, default charge), facing, drop |
| `robot` | enemy | Clockwork Grunt robot, 4 HP armour (bullets clang but hurt, knife max 2 per stab, explosions normal): stomps in, 0.6 s glowing charge, fires 2 slow energy bolts; pops apart on death. props.behavior (sleep = powered down), facing, drop |
| `saber` | enemy | Swordsman: charges (jumps small gaps), 0.38 s wind-up with blade glint, then a slash that only hurts during the swing; sometimes a telegraphed leaping slash. props.behavior, leap (default true), facing, drop |
| `shield_trooper` | enemy | Riot shield blocks frontal bullets (sparks + clang) until it breaks; flank him, jump-shoot over it, knife or bomb him. Pistol peeks over the shield to fire. props.behavior, shield (hp, default 14), facing, drop |
| `sniper` | enemy | Marksman for high ledges: red laser sight tracks you ~0.75 s, locks (blinks) 0.25 s, then a fast 240 px/s shot along the locked line. Panics up close. props.behavior (default guard), range (default 330), facing, drop |
| `airship_turret` | enemy | Airship ball turret (12 HP, no gravity): bolted to a hull plate at y (the hull surface); props.mount 'top' (default, aims up) \| 'bottom' (hanging, aims down); tracks you and fires telegraphed 3-shot bursts; props.vx drift to ride a moving ship; props.drop |
| `bunker` | enemy | Concrete pillbox (40 HP, blocksProgress): MG slit bursts toward props.facing (telegraphed glow) and a door that releases props.troop (default 'rifleman') every props.spawnEvery s (3.5) while fewer than props.maxTroops (3) are alive; collapses to rubble. props.drop |
| `drone` | enemy | Small flying drone (2 HP), swarms (spawn several). props.kind 'kamikaze' (default: telegraphed lock-on then straight dive, explodes on contact) \| 'zap' (slow electric bolts after a crackle); props.alt (swarm screen-y, default 76); props.drop |
| `fighter` | enemy | Jet fighter (8 HP, flying): edge warning, then strafing passes (aimed nose-gun bursts + one dropped homing missile), loops back between passes alternating low/high, leaves after props.passes (4). props.facing = first pass direction, props.alt (low-pass screen-y, default 112), props.drop |
| `gunboat` | enemy | Patrol gunboat (26 HP): floats on the water body it spawns in (patrols it; beached on the ground if there is no water), telegraphed arcing deck-gun shells + bridge-MG bursts; sinks when destroyed. Spawn with y omitted (or on the water surface). props.facing, props.drop |
| `heli` | enemy | HORNET attack helicopter (24 HP, flying): hovers near the top of the screen, telegraphed sweeping chin-gun bursts and bomb runs (whistle + ground marker); crashes when destroyed. props.facing, props.alt (skid screen-y, default 78), props.bombs (default true), props.drop. Spawn off-screen to fly in; y omitted = altitude band. |
| `jeep` | enemy | Gun jeep (16 HP): drives in fast, brakes at range (props.stopX), gunner swivels + telegraphed MG bursts, rams while fast, reverses off-screen after props.bursts (default 3) unless props.leave=false or the camera is locked. props.facing, props.drop |
| `light_tank` | enemy | STOMPER light tank (30 HP): keeps range, telegraphed arcing cannon shells + close hull-MG bursts, treads crush. props.facing 1\|-1, props.behavior advance\|hold, props.drop |
| `snowmobile` | enemy | Snowmobile raider (8 HP): charges and rams (crush), rider raises his pistol then fires 2-shot bursts, skids round after overshooting and charges again. props.facing, props.drop |
| `truck` | enemy | Troop truck (20 HP): drives in, stops on screen (props.stopX), opens the back and unloads props.troops (default 3) of props.troop (default 'rifleman'), then backs out (props.leave, default true); rams while fast. props.facing, props.drop |
| `turret` | enemy | Emplaced gun on a sandbagged pedestal (14 HP): telegraphed (barrel swing + muzzle glow). props.kind 'mg' (bursts) \| 'cannon' (arcing shells) \| 'flak' (air-burst shells, aims at flyers); props.dir -1\|1 fixed facing (else turns to face you slowly); props.drop |
| `barrel` | prop | Explosive red barrel: blows up after a few hits, hurts everyone nearby, chain-reacts. props.hp=3 |
| `crate_prop` | prop | Breakable wooden crate you can stand on. props.drop = pickup spec, props.size = small\|big |
| `fuel_tank` | prop | Big explosive fuel tank: leaks flame when hurt, huge blast + secondary pops (hits everyone), burning wreck. props.hp=14 |
| `mine` | hazard | Half-buried proximity mine: arms when a player, vehicle or enemy steps on it, beeps, then explodes (hits everyone). Shootable. |
| `sandbag_wall` | prop | Decorative sandbag wall (blocks nothing) that explosions tear down. props.bags=4, rows=3 |
| `sandbags` | prop | Sandbag cover: like sandbag_wall but soaks up enemy bullets. props.bags=4, rows=3 |
| `gyro` | vehicle | DRAGONFLY gyrocopter: free 8-way flight, nose vulcan (down-tilt), belly bombs (BOMB, props.ammo=20). 80 HP. Use LevelDef.startVehicle="gyro" for flying missions |
| `mech` | vehicle | STRIDER walker: chin cannon, homing missile salvo (BOMB, props.ammo=20), thruster jump + glide, landing stomp. 90 HP |
| `tank` | vehicle | BULLDOG mini-tank: 8-way vulcan turret, mouth cannon (BOMB, props.ammo=30), hop. 100 HP |

Spawn specs (`SpawnSpec`): `{ type, x, y?, trigger?, props? }`. `x` is the feet/centre x; omit `y`
to stand on the top floor at x. Level `entities` spawn when the camera's right edge reaches
`trigger` (default x - 8) - so things placed just past the right edge walk in naturally. Lock waves
spawn when the previous wave is cleared (`delay`, default 0.5 s).

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
