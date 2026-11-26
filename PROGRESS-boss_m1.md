# PROGRESS boss_m1 (GRINDER)

## Done
- Branch wave2/boss_m1 (from wip/boss_m1). Test arena src/content/levels/test/bosstest_m1.ts (L=420, ground 184,
  boss spawn x L+282, no lock announce).
- Art (m1/grinder_art.ts): separate turret sprite (recoil, blows off at death), grinder drum (6 spin frames),
  engine pistons, firebox glow overlay, rust streaks, new flame-jet strip, extra debris frames (track links, wheel).
- Logic (boss_m1.ts): parks against the right edge; SOLID hull (players pushed to the front, flyers hover);
  scripted first cycle volley -> deploy -> charge; charge lane telegraph (chevrons + hazard post at the stop
  line, pocket 74/60/50); charge clamped at the stop line, crushes own troops; flame vents phase 2+ with
  stronger vent telegraph; first attack after a phase change is forced (flame, then charge); damage beats
  75% (skirt), 50% (stack + turret fire), 25% (armour off, x1.3, steam, shells while reversing); localized
  round hot-spot hit flash; death: crew bails out, stack/hatch/barrel/turret blow off, blade drops, sinks, wreck.
- HP 380 base. Bot fight ~55 s (Normal), 72 s (Hard).
- tests/boss_m1.test.ts: 13 tests green (autopilot win <150 s for 3 seeds, simulateMission, intro invulnerable,
  phases + beats, charge pocket safe/lane deadly per phase, reachable pocket from the blade, solid hull, flame
  safe zone, shell markers + hatch troops, death -> complete + wreck). Full suite green (426).

## Next
- Optional polish only. Final: delete tests/boss_m1_probe.test.ts (throwaway), delete this file, final commit.

## Decisions
- Announce: the boss calls world.announce('WARNING!') itself -> the lock must NOT have `announce`.
- crossed(at, dt) helper: first think() after setState sees stateTime == dt (events at 0 need the epsilon).

## Gotchas
- Bash: keep commands simple (no `cd` chains with heredocs) - the worktree guard refuses complex ones.
- Capture script: scratchpad cap.mjs (manual stepping via __game.manual/step, screenshots by boss state,
  CLIP=x,y,w,h env for zoomed crops, 'dying' pseudo-state).
