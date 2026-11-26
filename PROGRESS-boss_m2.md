# PROGRESS boss_m2 (HORNET KING)

## Done
- Read docs + kit/fx/boss/bot/level/world.

## Next
- m2/art.ts sprites (hull tilt x damage frames, pod, bay, chin gun, missile, bomb, pylon, wreck)
- boss_m2.ts behaviour (intro, hover, sweep, salvo, carpet run, rotor tear P2, fan P2, burning P3, crash death)
- bosstest_m2 level, tests/boss_m2.test.ts, visual checks

## Decisions
- anchor 'center', (x,y) = fuselage pivot. Lock announce (WARNING!) used, not world.announce.
- Tilt baked in 5 frames (TILTS), damage states baked (D0..D3). Rotors drawn at render time (crisp pixel lines).
- Phases: phaseAt [0.5, 0.2].

## Gotchas
