# PROGRESS boss_m5 (THUNDERHEAD)

## Done
- m5/art.ts: all sprites (envelope 4 dmg frames incl. charred, gondola 4, engine 2, prop 5, ball 17, mount 2,
  tube 3, bay 3, port 3, core 5, mine 2, chute 4, shell 2, debris 5). Ship-origin shared sprite origins.
- m5/projectiles.ts: SkyMine, BroadsideShell, LightningStrike (track/lock/bolt), WreckHalf, s5() sfx helper.
- m5/thunderhead.ts: Thunderhead (BigBoss) + SkyTurret (BossPiece). Intro 2.6 s, 3 phases, death plunge.
- boss_m5.ts registration with arena description.
- levels/test/bosstest_m5.ts (+ test theme 'bosstest_m5_sky').
- tests/boss_m5.test.ts (10 tests) green; full npm test green; typecheck clean.
- Browser screenshots checked (intro, mines, drones, phase1, broadside, phase2, lightning track/lock/bolt, death, wreck).

## Tuning (current)
- HP 400 (x difficulty), phases at 0.62 / 0.33. Zones: hull 0.35, gondola 1, bridge 1.25, engines 0.5, tubes 0.8,
  core 1.35 (phase 2). Turrets 16 HP (x difficulty) forward 0.8.
- Autopilot wins in ~58-68 s from boss spawn (fight ~50-60 s).

## Next
- Final polish / review, delete tests/tmp_m5_probe.test.ts, final commit.

## Gotchas
- Files may be reformatted on disk after writes: Read before Edit.
- Boss x/y/w/h = autopilot focus (gondola, then core). Art uses shipX/shipY.
- Hit flash throttled per part (hitFx) — full-ship flashes looked washed out.
