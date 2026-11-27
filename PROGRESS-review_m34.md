# PROGRESS review_m34 (missions 3 + 4 and their bosses)

Branch review/m34 (from claude/metal-slug-game-sogjdj). Owned: m3/m4 levels, themes, bosses, test levels, tests.
Probes (gitignored, restored from /home/user/review-artifacts/review_m34): artifacts/probe/*.test.ts
(run: npx vitest run --config artifacts/probe/vitest.config.ts artifacts/probe/<file>), artifacts/tour.mjs, artifacts/scene.mjs.

## Status
- [x] Read docs + code
- [ ] Headless mortal-player analysis m3 / m4 (mortal.test.ts: no off-screen shots, no HUD-band shots; deaths being classified)
- [ ] Browser visual pass m3 / m4 (tours m3t_*/m4t_* exist from attempt 1)
- [x] Boss length re-verified (resumed run): FROST BASTION 230 hp -> typical (hold fire + 10 grenades) 60-96 s Normal;
      LEVIATHAN 300 hp -> typical 68-102 s Normal, mashing dodger 55-65 s.
- [ ] Quality gates

## Findings
1. [major, FIXED] m3 climb: tier-6 sniper and tier-3 grenadier attacked from under the HUD band (camera keeps feet 138 px below top -> 3 tiers up = y 30). Fix: grenadier to tier 2, sniper range 40. Test: mission_m3 'climb: no ledge enemy attacks from under the HUD band'.
2. [major, FIXED] Boss fights too long for pistol + grenades: FROST BASTION 260 -> 230 hp with longer core-open windows (4.8/5.0 s); LEVIATHAN 360 -> 300 hp. Measured with the probe bots (see Status).
   docs/CONTENT.md still says 260 / 360 (not my file -> outsideIssues).
3. [test, FIXED] boss_m4 'mortal dodger' (seed 2, Hard) died after the HP change: bot walked into a live missile landing zone to dodge the claw. Not unfair (1 s to wait for the blast, then cross); bot now never steps into a zone that is about to blast.

## Gotchas
- m3 boss deaths of the probe bot are 'crush' by flak IceFrags: the side fragments fly diagonally over the gap between two shadows (the gap between marks is NOT safe). Consider larger shadow radius / steeper fragments.
