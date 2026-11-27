# PROGRESS review_m56 (missions 5 + 6 and their bosses)

Branch review/m56 (from claude/metal-slug-game-sogjdj). Worktree-local throwaway tools in artifacts/
(gitignored): artifacts/probe/*.test.ts run with `npx vitest run --config artifacts/probe/vitest.config.ts
artifacts/probe/<x>.test.ts` (env LEVEL, SEEDS, DIFF, BMODE): mortal (deaths + sources + off-screen
shots), bosslen/jugsplit/jugstates (boss fight length), lift (reactor-lift deaths), hostages, sfx,
firstshot, respawn5. Browser: artifacts/lib.mjs, tour.mjs, look.mjs, lift.mjs (dev server port 5504).
NOTE: vitest sets process.env.MODE - use BMODE for probe modes.

## Baseline
- owned tests green (47). Mortal autopilot probe (Normal): m5 4-6 deaths/seed, m6 11-17
  (m1 9-12, m2 9-13, m3 24-25, m4 10-19 for calibration).

## Findings
1. FIXED major: JUGGERNAUT died in ~16 s of autopilot fire (pistol+grenades; HMG 12 s) - the
   shortest boss of the game, phases 2/3 lasted 3-5 s. JUG_HP 300 -> 520 (autopilot 32-34 s,
   pistol only 55-62 s, HMG 21 s). m6 timeLimit 85 -> 99 so the longer finale fits the timer.
   Test: boss_m6 "lasts like a final boss".
2. FIXED major: m6 reactor lift - a MG turret (5420), a sniper (5446) and a robot (5476) stood at the
   shaft lip and shot riders from the top edge while they could not shoot back (shots hit the shaft
   wall); then point-blank at the exit. Removed turret + sniper, robot moved to 5640 (out of view
   during the climb). Probe: climb deaths 21 -> 14 / 20 seeds (rest = designed flying ambush).
   Test: mission_m6 "nobody on the hangar floor shoots down at a rider during the climb".
- checked OK: m5/m6 hostages reachable (m6 11/11 by autopilot; m5 misses are bot behaviour),
  SFX rates, jetpack first shots below the HUD band, missile rain has markers (from above by design).

## Resumed run (2nd attempt)
- re-verified: owned tests 49/49, full suite 620/620, typecheck clean; smoke m5+m6 browser OK (0 errors).
- checked OK: THUNDERHEAD length 46-49 s autopilot (gyro, loadout-independent); m5 boss beam aim-line
  telegraph readable (artifacts/m5/blsheet.png); m5 start/HUD; m6 visual sheets 1-4 (no seams/floating
  decor); gauntlet screenshots (artifacts/m6/gsheet1.png); lift climb after the fix (liftCsheet.png: only
  the flying ambush, hostage reward on the hangar floor); m6 boss kill -> MISSION COMPLETE -> tally ->
  ending in the browser (endsheet.png); Hard/Easy spot checks complete (m6 hard 20 deaths, easy 11,
  m5 hard 10 for the mortal autopilot; all deaths are visible, telegraphed threats).
- first shots (firstshot probe): every m6 shooter fires >= 1.37 s after spawning, from inside the view.

## Next steps
- final gates + commit
- outsideIssues so far: fighter launches its missile 14-16 px outside the left edge (machines/fighter);
  HUD truncates vehicle name "DRAGONFLY" -> "DRAGONFL"
