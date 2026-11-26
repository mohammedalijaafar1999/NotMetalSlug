# PROGRESS boss_m3 (FROST BASTION)

Branch wave2/boss_m3. Delete this file when done.

## Decisions
- Wall faces LEFT (sprite authored facing right, flipped). Face F = arenaL + 248 (FACE_X). Boss x = F + (WALL.FACE - WALL.OX).
- Static-height dynamic terrain solid (owner = boss) from F+2 rightwards, G-400..G: blocks players, bullets, grenades.
  Gate frame (F-16..F) and the pushed-out core are blocked by pushOut() at floor level (no solid, so jump shots fly on to the face).
- Zones: 'frame' (header, mul 0) always; 'doors' (mul 0) while coreK <= 0.3; 'core' (mul 1) when pushed out.
  Turrets = BossPiece (mg, flak, mortar), own hp, TURRET_MUL 0.6 forwarded to the bar.
- Phases [0.66, 0.33]: P0 lance (crouch); P1 spikes first then alternate (jump); P2 doors blown off, core always out:
  boulders, lance, spikes back to back.
- Director: heavy core attacks reserve windows; turrets/icicles only start if they resolve outside (tests/boss_m3 fairness test).
- Intro: wall rises out of the snow 2.15 s, turrets pop, boss_roar; hittable at 2.7 s. Lock announce only (no world.announce).
- Bot fix (src/debug/bot.ts): band hysteresis + only tap toward the enemy when facing away (on foot).

## Done
- art.ts (wall reworked: gate frame/recess, smokestack, emblem; door, core, MG 11 angles, flak, spike), parts.ts hazards,
  boss_m3.ts behaviour, bosstest_m3 level, tests/boss_m3.test.ts (7 tests green), screenshots reviewed.

## Next
- Final visual pass (intro rise, P2, death), registerEntity description + integrationNotes, delete tests/diag*_m3.test.ts,
  full npm test + typecheck, final commit.

## Gotchas
- Boss projectiles must spawn LEFT of the wall solid (x < F) or they hit terrain instantly.
- Bullets move ~7 px/step: zones must stick out >= 8 px in front of the solid edge.
- Hit flashes blink (age*30 % 2) so constant fire never hides the art.
