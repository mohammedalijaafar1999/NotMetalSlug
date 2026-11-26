# PROGRESS boss_m2 (HORNET KING)

## Done
- m2/art.ts: hull (5 tilts x 4 damage states), head-on view (yaw turn), rotors/blur/hub, chin gun,
  pod, bay, missile, bomb, torn pylon, plates, glow, wreck.
- m2/parts.ts: LockMark (marker lives while its missile flies), CarpetBomb (Lobbed), TornRotor.
- boss_m2.ts: intro, hover, turn (yaw w/ head-on sprite), sweep (sight line), salvo, carpet run,
  rain (P2+), reload low-hover window, tear (50%), burn (20%), crash death + Wreck.
- levels/test/bosstest_m2.ts, tests/boss_m2.test.ts (8 tests green), full suite green (422).
- Visual checks done for intro, sweep, salvo, carpet, tear, rain, turn, death.

- fairness: sweep safe zone, rain free slot, bomb spacing + edge pockets, TopMissile (dives at the
  marker), dodging-player survival test (0 deaths on easy/normal/hard x 6 seeds in diag runs).

## Next
- final: delete tests/boss_m2_diag.test.ts (untracked scratch) and this file, final commit.

## Decisions
- anchor 'center', (x,y) = fuselage pivot. Lock announce (WARNING!) used, not world.announce.
- HP 380 (bot kills it in ~20 s; humans est. 60-75 s pistol, ~40 s HMG).
- Contact never hurts. MIN_ALT floor keeps wheels >= ~14 px above a standing player's head.

## Gotchas
- arenaWorld() in tests must warp to exactly LOCK_X (camera won't advance by itself).
- onPhase may jump 0->2: burnAfterTear flag handles it.
