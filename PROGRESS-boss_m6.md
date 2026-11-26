# PROGRESS boss_m6 (JUGGERNAUT, final boss)

## Files (owned)
- src/content/bosses/boss_m6.ts      - Juggernaut entity (BigBoss), AI, zones, render, registerEntity
- src/content/bosses/m6/art.ts       - all bm6_* sprites + geometry constants
- src/content/bosses/m6/parts.ts     - shockwave, rain missile, launch missile, eject pod, beam overlay
- src/content/levels/test/bosstest_m6.ts - test arena
- tests/boss_m6.test.ts

## Design (decided)
- Crimson/brass boiler-hull walker, reverse-jointed legs (IK, thigh 36 / shin 38, ankle 12), hip 80 above ground
  standing, 24 when squatting (laser). Legs drawn from angle-baked segment sprites (near/far palettes).
- Local coords: origin = hip pivot, facing right; world x = x + lx*facing. Entity y = ground (feet).
- Zones: legs x0.7, hull x1, chest armor (p1) x0.8, core (p2+) x2.2, dome x1.4.
- Phases (kit phase index): 0 = >60%, 1 = <=60% (armor blows off, core, laser, drones), 2 = <=25% desperation.
- Attacks: cannon volley (Lobbed + markers), stomp shockwave (jump), missile rain (markers, gap pattern),
  laser (squat, core at ground-25, crouch under), drones (spawn 'drone'), belly vent if camping under.
- Intro: walks in from off-screen right ~2.3 s + roar; world.announce('WARNING!') by the boss itself (lock: no announce).
- Death: chain explosions, pod ejects (rocket + parachute), collapse, final blast, Wreck.

## Done
- (nothing yet)

## Next
- art.ts sprites, then boss_m6.ts, then test level + tests, then visual checks.

## Gotchas
- content test spawns every type in 'sandbox' (no lock) and kills it: must work without a lock.
