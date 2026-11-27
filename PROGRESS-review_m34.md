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

4. [major, FIXED] FROST BASTION flak: the side ice fragments clip a standing player's head up to 14 px from their shadow (radius 5 drawn), so the 'gap' between two shadows killed (probe bot died there 2-5x per fight). Shadows now radius 9 (FlakShell.FRAG_SHADOW). Test boss_m3 'flak fragments only hit a player who overlaps one of their landing shadows' (failed before: killed at -16 px).
5. [minor, FIXED] m4 slip gauntlet: wave-3 truck from behind drove ~95 px into the screen before stopping and ran the player down (mortal bot death). stopX 5626: nose parks <= 62 px in. Test mission_m4 'a lock-wave truck from behind parks at the left edge'.
6. [checked, OK] m4 hostages: autopilot misses the cages at 2120 (tank section) and 5086 (between containers): scripted human route drops through the catwalk, shoots the cage, climbs out -> reachable (bot limitation).
7. [checked, OK] mortal bot runs (seeds 1-3): no off-screen-origin enemy shots, no HUD-band shots in m3/m4; deaths mostly bot artefacts (stands still vs jetpacks/gunboats). Canal A pit deaths = bot jumps 50 px early.

## Gotchas
- m3 boss deaths of the probe bot are 'crush' by flak IceFrags: the side fragments fly diagonally over the gap between two shadows (the gap between marks is NOT safe). Consider larger shadow radius / steeper fragments.
