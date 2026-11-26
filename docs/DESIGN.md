# IRON RUCKUS — Game Design

An original arcade run-and-gun for the browser: chunky pixel art, one-hit deaths, tons of
explosions, hostages to free, vehicles to hijack, six missions with screen-filling bosses,
1-2 player drop-in co-op. Humor is slapstick (cartoon deaths, panicking soldiers), never gory.

## Story

The **Rustcoat Legion** — a mercenary army of the brass-obsessed tyrant **Marshal Vortigern Gristle** —
has seized the island chain of **Puerto Pólvora**, kidnapped its mechanics to build war machines, and
is assembling a doomsday walker in the **Iron Citadel**. The four-person **Ruckus Squad** is sent in.

## Characters (player)

| id | name | perk |
|---|---|---|
| dex | DEX CALLOWAY — squad leader, red bandana | STEADY HAND: pistol 35% faster |
| juno | JUNO VEGA — demolitions, beret + shades | DEMOLITIONS: +5 bombs, +30% blast radius |
| brick | BRUNO "BRICK" OKAFOR — big heavy gunner, goggles | HEAVY LIFTER: +50% heavy ammo, stronger knife |
| mika | MIKA SATO — scout, cap + scarf | QUICK FEET: faster run, higher jump, 2x knife |

Player 2 uses a palette swap (`char_<id>_p2`).

## Core rules

- Move, jump, crouch (crouch-walk), aim up; aim down only while airborne. Fire / Jump / Bomb buttons.
- Knife automatically replaces shooting when a `meleeable` enemy is adjacent.
- One hit kills on foot. Lives (default 3, option 1-5), unlimited continues (10 s countdown), respawn by
  dropping in from the top of the screen with 2.6 s invulnerability, pistol and bombs.
- Forward-only scrolling, camera-lock arenas, a per-checkpoint timer (option), mission end tally
  (+1000 per rescued hostage).
- Drop-in co-op: player 2 presses START (or fire) at any time.
- Difficulty Easy/Normal/Hard scales enemy fire rate, bullet speed, HP and score.

## Weapons (crate letter → id)

| Letter | id | Name | Notes |
|---|---|---|---|
| — | pistol | PISTOL | infinite, semi-auto (hold = slow auto) |
| H | hmg | HEAVY MACHINE GUN | 200 ammo, rapid, sweeps through diagonals when changing aim |
| R | rocket | ROCKET LAUNCHER | 30, slow-start rockets that slightly home, splash |
| S | shotgun | SHOTGUN | 30, short-range wide blast, pierces, big damage |
| F | flame | FLAME SHOT | 30, rolling fireball stream that pierces and burns |
| L | laser | LASER | 200 (drains while held), instant piercing beam |
| C | homing | CHASER MISSILES | 40, twin missiles with strong homing |
| B | bouncer | BOUNCER | 30, explosive balls that bounce along the ground |
Bombs: grenades (default, 10), FIRE BOMB crate switches to fire bombs (burning pillar of flame).

## Enemy roster (entity type names are a CONTRACT — levels use them)

Infantry (`src/content/enemies/`), all `meleeable`, 1 HP unless noted:
| type | behaviour |
|---|---|
| rifleman | (done) patrol/guard/charge/idle; shoots straight slow bullets; crouch shots |
| grenadier | lobs grenades in arcs; retreats when close |
| shield_trooper | riot shield blocks frontal bullets (sparks + metal_hit); pistol shots; dies to knife/explosives/from behind; 1 HP but shield absorbs |
| bazooka | kneels and fires slow rockets (dodgeable) |
| saber | charges at the player and slashes (melee contact attack), jumps small gaps |
| paratrooper | descends with a parachute (shootable chute), then acts as a rifleman |
| mortar | 2-man mortar crew, lobs shells with a blinking target marker, stays put |
| sniper | on high ledges; red laser sight 1 s telegraph, then fast bullet (240 px/s) |
| flametrooper | short-range flamethrower jets; backpack tank explodes on death; 2 HP |
| jetpack | hovers in the air, drops grenades / shoots downward; 2 HP |
| frogman | pops out of water, throws harpoons, dives back |
| officer | blows a whistle (summons/buffs nearby troops), panics and runs; 500 pts; often `drop` |
| robot | Clockwork Grunt: armored robot soldier, 4 HP, fires energy bolts, not meleeable-instakill (knife dmg still applies) |

Machines (`src/content/machines/`):
| type | behaviour |
|---|---|
| light_tank | "Stomper" tracked tank, 30 HP, cannon shells (arc) + MG, crushes on contact |
| heli | "Hornet" attack helicopter, 24 HP, hovers, strafes with MG, drops bombs; crashes on death |
| turret | emplaced gun (props.kind 'mg'\|'cannon'\|'flak', props.dir), 14 HP |
| jeep | gun jeep driving in from the right, gunner fires bursts, 16 HP |
| drone | small flying drone, swarms, kamikaze or zaps, 2 HP |
| fighter | jet fighter (sky mission) strafing pass + missiles, 8 HP |
| snowmobile | rams and shoots, 8 HP |
| gunboat | patrol boat on water with deck gun, 26 HP |
| bunker | fortified pillbox: MG slit + spawns riflemen until destroyed, 40 HP, blocksProgress |
| truck | troop truck drives in and unloads `props.troops` riflemen, 20 HP |
| airship_turret | turret mounted on airship hull (sky mission), 12 HP |

Props & hazards (`src/content/props/`): `barrel` (explosive, hits everyone), `crate_prop` (breakable,
`props.drop`), `mine` (proximity landmine), `sandbags` (cover: blocks enemy bullets, breakable), `fuel_tank`.

Player vehicles (`src/content/vehicles/`): `tank` "BULLDOG" mini-tank (rotating vulcan turret aimed with
the stick, cannon on BOMB with 30 shells, can jump, 100 HP), `mech` "STRIDER" walker (high jump, vulcan +
missile salvo, stomp, 90 HP), `gyro` "DRAGONFLY" gyrocopter (free flight, vulcan forward/down, bombs, 80 HP).

Bosses (`src/content/bosses/`), entity category `boss`, type `boss_m<N>`:
| Mission | Boss | Concept |
|---|---|---|
| 1 | GRINDER | armored bulldozer-tank: blade charges, cannon volleys, hatch deploys soldiers, smoke stack weak point |
| 2 | HORNET KING | twin-rotor gunship: chin-gun sweeps, missile salvos, carpet bombs; phase 2 loses a rotor, erratic |
| 3 | FROST BASTION | fortress wall: 3 turrets + mortar nest + giant cannon core that opens; ice shards rain |
| 4 | LEVIATHAN | submarine in the harbor: surfaces, torpedoes, missile pods, periscope laser; mech claw phase |
| 5 | THUNDERHEAD | flagship airship (player in gyro): broadside turrets, bomb bays, drone launchers, core |
| 6 | JUGGERNAUT | Marshal Gristle's giant walker: cannons, stomp shockwaves, missile rain; phase 2 exposes core + laser sweep; phase 3 desperation |

## Missions

| # | id | Name | Theme | Highlights |
|---|---|---|---|---|
| 1 | m1 | PALM HARBOR | beach → jungle village, palms, huts, river | tutorial pacing, tank pickup |
| 2 | m2 | DUSTWIND CANYON | desert canyon, ruins, oil derricks, sandstorm | trucks, bazookas, gunship |
| 3 | m3 | FROSTBITE PASS | snowy peaks, cable cars, frozen lake, snowfall | mech pickup, vertical climb |
| 4 | m4 | RUSTWATER DOCKS | ruined harbor city at dusk, cranes, rain | frogmen, gunboats, tank |
| 5 | m5 | STORMFRONT | sky battle above the clouds (auto-scroll) | whole mission in the gyrocopter |
| 6 | m6 | IRON CITADEL | the Legion fortress-factory: furnaces, conveyors | robots, everything, final boss |

Each mission: 4500-8000 px wide, 3-6 arenas, 6-12 hostages, 2+ weapon crates, a checkpointed timer,
unique theme (sky, 2-4 parallax layers, ground textures, platforms, decor kinds, weather overlay) and
its own music (`m<N>`), boss music `boss` (`boss_final` for mission 6).

## Audio contract

SFX names (define all of these; use only these in code):
```
weapons:   pistol hmg rocket_fire shotgun flame laser homing_fire bouncer_fire bouncer_bounce knife throw
           firebomb_burst out_of_ammo grenade_bounce shell_casing
player:    jump land player_die respawn
explosive: explosion_small explosion explosion_big fire_burst
pickups:   pickup pickup_weapon pickup_points extra_life rescue coin fuel
enemies:   enemy_die enemy_die2 enemy_rifle enemy_alert enemy_throw enemy_rocket enemy_flame mortar_fire
           mortar_whistle sniper_charge sniper_shot saber_swing whistle robot_shot robot_die jetpack parachute
           harpoon splash
machines:  tank_cannon tank_tread heli_rotor heli_gun turret_fire drone_buzz jet_flyby metal_hit ricochet
           mine_beep crate_break glass_break engine
vehicles:  vehicle_enter vehicle_exit vehicle_hit vehicle_cannon vehicle_vulcan mech_step mech_missile gyro_rotor alarm
boss:      boss_roar boss_die warning boss_charge boss_laser boss_hit
ui:        menu_move menu_select menu_back pause tally_bonus tally_tick banner start_game typewriter countdown_tick
```
Songs: `title select briefing m1 m2 m3 m4 m5 m6 boss boss_final mission_complete tally gameover ending credits`.
Voice lines via `audio.say()` (weapon names, "Mission N. Start!", "Mission complete!", "Thank you!", "Game over").

## Screens

Boot/loading → Title (animated logo, attract mode, PRESS START) → Main menu (1P, 2P, Mission Select,
Options, Controls, High Scores, Credits) → Character select (per player) → Mission briefing card →
Gameplay (pause: resume / restart / options / quit) → Tally → … → Ending + credits → Name entry →
High scores. Options: master/music/sfx/voice volume, voice on/off, difficulty, lives, timer,
screen shake, flashes, CRT filter, pixel-perfect scaling, FPS counter, key remapping P1/P2, reset.
Touch controls appear automatically on touch devices; gamepads supported (A jump, X/Y fire, B bomb, Start).
