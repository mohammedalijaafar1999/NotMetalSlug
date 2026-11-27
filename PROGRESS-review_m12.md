# PROGRESS review_m12 (missions 1-2 + GRINDER + HORNET KING)

Branch: review/m12 (from claude/metal-slug-game-sogjdj). Worktree: /home/user/NotMetalSlug/.claude/worktrees/wf_b3688ee7-398-1

## Status
- [x] Setup, docs read, baseline tests green (56 tests in owned files)
- [x] M1 headless mortal analysis (artifacts/mortal.test.ts, sentinel.test.ts, tankbeat/tankhuman.test.ts)
- [x] M1 browser tour (artifacts/tour.mjs, t1_*.png)
- [~] M1 boss GRINDER review (fight census artifacts/grinderfight.test.ts)
- [ ] M2 headless mortal analysis
- [ ] M2 browser visual pass
- [ ] M2 boss HORNET KING review
- [ ] Quality gates (typecheck, test, build)

## Findings
1. FIXED (major, fairness) m1 arenas road/gauntlet: saber wave spawned at L+14 = popped into view next to a
   player backed against the left edge (0.8 s to slash). Now `sneak()` = m2_incoming (rumble:false) at L-18:
   blinking "!" on the left edge for 1 s, then he runs in. incoming.ts got props.rumble. Tests in mission_m1.
2. FIXED (minor, visual) m1 jtree at 5150 floated over the slope (roots in the air) -> y 268 + behindTerrain.
3. FIXED (major, pacing) m1 had 11 bomb sources: bot reached GRINDER with 63-72 grenades; grenade spam kills it
   in 11-14 s. Hostage drops 1480/2384/4528 bomb -> score items, 3164 bomb -> fuel (BULLDOG repair). 7 cases left.
4. FIXED (pacing) GRINDER: blasts/fire on armour plates (blade/hull/turret) x0.6 until armourOff (25%); boiler and
   stack full. Scripted fights (normal): pistol+0 68 s, pistol+10 53->60 s, HMG+10 37->44 s, pistol+40 14->18 s.
5. OUTSIDE (major) BULLDOG vulcan (src/content/vehicles/tank.ts) fires from 35 px above the ground: aimed forward
   it flies over standing infantry (26 px) beyond ~80 px on flat ground (artifacts/vulcan.test.ts, vulcan_fwd.png).
   Riflemen at 60-170 px chip the tank to death; the human-ish driver dies in arena 3 every seed. No crush either.
   Suggested fix: forward vulcan from a lower point or a slight auto-depression toward ground targets.
6. NOTE light_tank death blast with hitAll hurts the player's BULLDOG (45 HP) when killed point-blank (bot data).

## Next steps / gotchas
- Dev server port 5502 (started in background). Throwaway scripts in artifacts/ (gitignored):
  `npx vitest run --config artifacts/vitest.config.mjs artifacts/<x>.test.ts`; browser: artifacts/tour.mjs, at.mjs.
- Next: GRINDER visual/telegraph check in browser, then m2.
