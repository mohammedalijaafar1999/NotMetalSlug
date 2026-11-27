# PROGRESS m3 (FROSTBITE PASS) - delete when done

Branch wave2/m3 (boss wave2/boss_m3 merged). Dev server port 5403.

## Plan (level 'm3', width 7904, height 520)
- G=488 low ground (camera top 304), S=456 station shelf, decks 420 (cable docks), P=184 plateau (camera top 0).
- 0-760 forest | 760-1240 slopes (snowmobile intro) | 1240-1720 LOCK1 @1300 (flat 456) |
  1720-3090 Legion station (456): mech @2060, LOCK2 @2560 |
  3090-3250 creek ravine + m3_weak_bridge (collapses under player vehicles, ravine wrecks them) |
  3250-3472 terminal (ramp up to deck 420) | 3472-4560 gorge: m3_cablecar dock A centre 3508,
  pylon 4016 (stop + LOCK3 @3824), dock B centre 4524 | 4560-4800 arrival (deck 420 -> 456) |
  4800-5800 frozen lake (488), LOCK4 @5160 | 5800-6200 climb: rock ledges stacked on the cliff
  at x 6200 (488 -> 184), camera keys [0,304] | 6200-7904 plateau: LOCK5 gauntlet @6560, calm, BOSS @7520.
- Camera keys: [304,304] default; ride [290,304]; climb [0,304]; plateau [0,0].

## Mechanics (src/content/levels/m3/)
- m3_cablecar: dynamic solid cabin riding piecewise-parabolic cable (supports props.cable);
  waits at dock until players board; stops at props.stops until that lock is done; clamps
  riders over the roof while away from the docks; carries airborne riders by dx; unshifts itself to
  the front of world.entities in spawned() so riders are carried in the same step.
- m3_weak_bridge: one-way dynamic deck; collapses under a player vehicle; vehicles in the ravine wrecked.

## Done
- theme 'm3' registered (src/content/themes/m3.ts) on top of the salvaged art in themes/m3/.

## Next
- level skeleton + visual pass of the theme; mechanics; encounters; tests.

## Gotchas
- warp() drops pending spawns whose trigger <= x+384 (warp before the cable car trigger).
- Every entity type is spawned headless in the sandbox with props {} by the content tests.
