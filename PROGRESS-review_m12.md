# PROGRESS review_m12 (missions 1-2 + GRINDER + HORNET KING)

Branch: review/m12 (from claude/metal-slug-game-sogjdj). Worktree: /home/user/NotMetalSlug/.claude/worktrees/wf_b3688ee7-398-1

## Status
- [x] Setup, docs read, baseline tests green (56 tests in owned files)
- [x] M1 headless mortal analysis (artifacts/mortal.test.ts, sentinel.test.ts, tankbeat/tankhuman.test.ts)
- [x] M1 browser tour (artifacts/tour.mjs, t1_*.png)
- [x] M1 boss GRINDER review (fight census artifacts/grinderfight.test.ts; screenshots gr_*.png: telegraphs OK)
- [x] M2 headless mortal analysis (artifacts/mortal.test.ts LEVEL=m2, prints killer screen pos)
- [x] M2 browser visual pass (artifacts/t2_*.png, montages m2tour_*.png): no visual bugs found
- [x] M2 boss HORNET KING review (artifacts/hornetfight.test.ts: pistol+0 60 s, pistol+10 42-47 s, hmg+10 33-40 s normal; hard pistol+10 70-76 s)
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
7. FIXED (major, design) m2 bridge: a STRIDER that hopped/glided through the collapse or waited on the far
   abutment survived and carried on to the mesa (autopilot kept it to the gauntlet). bridge.ts wreckStranded(). Test.
8. FIXED (major, fairness) m2 timer 80 -> 99: HORNET KING on Hard took a tidy pistol+10 player 70-76 s of 96 s
   (TIME UP = death). Test 'leaves time to spare on Hard'. NOTE docs/CONTENT.md mission table still says 80.
9. FIXED (minor) m2 fuel tank 5590 -> 5724 (autopilot blew itself up next to it 4/4 seeds on the way to the
   hostage at 5640; now 1/4). Gauntlet jeep-from-behind stopX 5960 -> 5928 (rammed mid-screen players: 2/4 -> 0/4).
6. NOTE light_tank death blast with hitAll hurts the player's BULLDOG (45 HP) when killed point-blank (bot data).

## Next steps / gotchas
- Dev server port 5502 (started in background). Throwaway scripts in artifacts/ (gitignored):
  `npx vitest run --config artifacts/vitest.config.mjs artifacts/<x>.test.ts`; browser: artifacts/tour.mjs, at.mjs.
- Next: quality gates, final commit. Gauntlet (lock 5880) is the deadliest arena for the autopilot (~5 deaths/run, heli top killer) - known issue.
