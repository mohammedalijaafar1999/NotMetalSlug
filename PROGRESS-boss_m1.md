# PROGRESS boss_m1 (GRINDER)

## Done
- Branch wave2/boss_m1 created from wip/boss_m1 (earlier interrupted attempt: boss_m1.ts + m1/grinder_art.ts).
- Test arena src/content/levels/test/bosstest_m1.ts (L=420, flat ground y=184, width L+384).
- Baseline review: bot wins in ~86 s of fight (320 HP). Issues found: whole-body white flash makes
  the boss look pale under fire; players can walk inside/behind the hull (cheese: shells clamp to
  the front, charge passes them); charge stop point not telegraphed; pocket timing tight in phase 2.

## Next (plan)
1. Logic: home at arena right edge (rear ~L+378), solid hull push, charge crush hitbox on the whole
   front + crushes own troops, stop-line ground telegraph, pocket 72/56/44, rev 1.4/1.15/0.95.
2. Art: separate turret sprite (recoil, blows off at death), grinder drum (spinning teeth on blade),
   pumping pistons + furnace glow, rust streaks, localized clipped hit flash, better flame jet.
3. Damage beats at 75% (skirt plate off), 50% (stack off, phase 2), 25% (armour off, phase 3).
4. tests/boss_m1.test.ts (complete in sim, intro invulnerable, phases reached, fairness checks).
5. Screenshots, polish, docs in registerEntity description, final commit.

## Decisions
- Announce: the boss calls world.announce('WARNING!') itself -> the lock must NOT have `announce`.

## Gotchas
- Bash: keep commands simple (no `cd` chains with heredocs) - the worktree guard refuses complex ones.
- Capture script: scratchpad cap.mjs (manual stepping via __game.manual/step, screenshots by boss state).
