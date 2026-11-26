# PROGRESS boss_m6 (JUGGERNAUT, final boss)

## Files (owned)
- src/content/bosses/boss_m6.ts      - Juggernaut entity (BigBoss), AI, zones, drawOps/render, registerEntity
- src/content/bosses/m6/art.ts       - palette/geometry + hull, dome+Gristle, cannon, pod, hatch, armor, core sprites
- src/content/bosses/m6/legs.ts      - angle-baked thigh/shin/foot/joint sprites (near/far)
- src/content/bosses/m6/fxart.ts     - wave, shell, missile, flame, eject pod, chute, debris, wreck sprites
- src/content/bosses/m6/parts.ts     - JugShockwave, RainMissile, LaunchTrail, EscapePod, JugOverlay
- src/content/levels/test/bosstest_m6.ts - test arena (lock 520, ground 198, width 904)
- tests/boss_m6.test.ts              - 7 tests (intro invuln, phases+death, projectile fairness, laser crouch, autopilot)

## Shared-file change (report in coreChanges)
- src/debug/bot.ts: band hysteresis in locked arenas (bot used to sit at the band edge, its tap toward the enemy
  pushed it out, walking back left it facing AWAY ~87% of boss fights). Generic bug fix, additive.

## Done
- All art, rig (IK legs, squat stance, knee-floor safety), AI (cannon, stomp+waves, missile rain, laser, drones,
  vent, turn, stagger/stumbles), phases, death (pod + parachute, collapse, wreck), overlay beam/targeting line.
- Tests green (7). Autopilot wins ~32 s fight (pistol). Screenshots reviewed (scratchpad shots.mjs).

## Next
- polish pass: walk-cycle check, targeting line visibility, HP tuning, full npm test, final commit.

## Decisions / gotchas
- Hit flash only for heavy hits (>=3 dmg) or core/dome hits; flicker; decayed in update() (think() not run while dying).
- Steam under the belly uses this.steam() (translucent, behind near leg) - fx.puffSteam is front + opaque.
- Boss announces itself (world.announce WARNING) -> boss lock must not have announce.
- content test spawns every type in 'sandbox' (no lock) and kills it: works.
