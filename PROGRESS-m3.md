# PROGRESS m3 (FROSTBITE PASS) - delete when done

Branch wave2/m3 (boss wave2/boss_m3 merged). Dev server port 5403.

## Plan (level 'm3', width 7904, height 520)
- Ground levels: G=488 (low sections, camera pinned top=304), S=456 (station shelf/terminals),
  P=184 plateau (camera pinned top=0). Climb ~5840-6180 with camera keys.
- 0-760 pine forest opening | 760-1720 slopes + snowmobile intro + LOCK1 @1240 |
  1770-3060 Legion alpine station (S): mech @~2060, LOCK2 station yard @2520 |
  3060-3220 creek ravine + m3_weak_bridge (collapses under vehicles -> wrecks the mech) |
  3220-3444 cable car terminal | 3444-4590 gorge: m3_cablecar ride, stop @4000 + LOCK3 @3800 |
  4590-4760 arrival | 4800-5780 frozen lake + LOCK4 @5140 | 5840-6180 cliff climb |
  6180+ plateau: LOCK5 gauntlet @6560, calm, BOSS lock @7520.

## Mechanics (src/content/levels/m3/)
- m3_cablecar: dynamic solid cabin roof riding a sagging cable; waits at dock until a player
  boards; stops at props.stops until a lock cycle passed; invisible railing clamps riders
  (players) to the roof while moving; air-carry for airborne players; unshifts itself to the
  front of world.entities in spawned() so riders are carried by terrain dx in the same step.
- m3_weak_bridge: one-way dynamic deck; collapses when a player vehicle stands on it; any player
  vehicle in the creek below is wrecked (startDestruction ejects the pilot safely).

## Done
- (nothing yet)

## Next
- theme m3 (sky, layers, ground, platforms, decor sprites, snowfall overlay)
- level skeleton, mechanics, encounters, tests, visual passes

## Gotchas
- warp() drops pending spawns whose trigger <= x+384 (warp before the cable car trigger).
- Player.clampToCamera: never let a camera lock carry a rider off-screen (cabin halts at stops).

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP m3: salvaged after interruption'. Review them (`git show --stat HEAD`), keep what is good, delete throwaway debug tests, and continue.
