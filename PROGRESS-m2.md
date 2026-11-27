# PROGRESS - Mission 2 DUSTWIND CANYON (branch wave2/m2)

## Done
- Branch created, boss merged (wave2/boss_m2 @ 9cecabb).
- Theme 'm2' (themes/m2.ts + m2/{palette,backdrop,terrain,decor,sprites,weather}.ts): sky/backdrop
  by region markers (decor kind 'm2_bg'), terrain, platform styles, decor sprites, weather.
- m2_bridge + m2_detonator (levels/m2/bridge.ts): demolition rail bridge set piece.
- Level 'm2' full layout (levels/m2.ts); autopilot completes in ~198 s sim (seed 1).
- tests/mission_m2.test.ts is still only a diagnostic run (needs real tests).

## Next (attempt 2)
1. Visual pass in-game (every section, every arena), fix issues.
2. Real tests: registered/valid, simulateMission('m2', 900).completed, bridge mechanics.
3. npm test all green, typecheck, final commit.

## Decisions
- Level height H = 440, base ground B = 408 (= H - 32; camera bottom y 224). Boss lock L = 6800.
- Vehicle: STRIDER 'mech' on the canyon road; lost when the bridge is blown.
- Regions (world x): desert 0, ruins ~760, canyon ~1640, gorge ~3260, mesa ~3700, oil ~5020, salt ~6280.

## Gotchas
- ThemeRenderer skips drawing platforms that have an owner (bridge draws its own deck).
- Vehicle.damage ignores driver godMode -> vehicles can be wrecked in the sim.
