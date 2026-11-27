# PROGRESS m3 (FROSTBITE PASS) - delete when done

Branch wave2/m3 (boss wave2/boss_m3 merged). Dev server port 5403.
Scratch tools (not committed): /tmp/claude-0/-home-user-NotMetalSlug/c5b6cecd-83ca-5fbf-b52b-e3a132caa3fc/scratchpad/m3/
(trace.test.ts + vitest.config.ts headless trace; shots.mjs warp screenshots; run.mjs autopilot screenshots).

## Layout (level 'm3', width 7904, height 520) - see header of src/content/levels/m3.ts
- G=488 low ground, S=456 station, D=420 cable decks, P=184 plateau (camera top 0 = boss contract).
- forest 0-760 | slopes 760-1140 | LOCK1 @1300 | station 1760-3090 (mech 2070, LOCK2 @2560) |
  ravine + m3_weak_bridge 3090-3250 | terminal ramp/deck -3472 | gorge ride DOCK_A 3508 -> PYLON 4016
  (jam stop, LOCK3 x=PYLON-154 trigger PYLON-214) -> DOCK_B 4524 | arrival | lake 4900-5800 (LOCK4 @5160) |
  climb ledges on cliff x=6200 (488->184) | plateau LOCK5 @6560, calm, BOSS @7520.

## Done
- theme 'm3' (themes/m3.ts + salvaged art in themes/m3/), new decor: gorge (redone), cliff, scaffold, drift.
- m3_cablecar (levels/m3/cablecar.ts, art in levels/m3/art.ts), m3_weak_bridge (levels/m3/bridge.ts).
- level m3 with encounters; autopilot completes headless (~230 s game time).
- tests/mission_m3.test.ts (6 tests) green.

## Next
- visual polish passes (cabin trolley wheels, bridge collapse in browser, arenas readability),
  full npm test, smoke run in browser, final commit (delete this file).

## Gotchas
- warp() drops pending spawns whose trigger <= x+384: bridge trigger 3000, cable car 3040 -> warp <= 2600 keeps them.
- Rifleman AI holds 56-170 px from the player: left-side lock spawns must be ON screen (lockX+10) or they idle off-screen.
- Player max walkable slope ~39 deg (stepUp 6 / (6+1.4)); vehicles ~29 deg.
- Sprite pixelArt() buffers have a 1 px padding border (skip it when tiling).
- Keep enemies off the plateau rim during the climb (HUD covers y<34).
