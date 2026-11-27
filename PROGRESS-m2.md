# PROGRESS - Mission 2 DUSTWIND CANYON (branch wave2/m2)

## Done
- Branch created, boss merged (wave2/boss_m2 @ 9cecabb).
- Theme 'm2' (themes/m2.ts + m2/{palette,backdrop,terrain,decor,sprites,weather}.ts): sky/backdrop
  by region markers (decor kind 'm2_bg'), terrain, platform styles, decor sprites, weather.
- Attempt 2: ground texture is 128x512 with rows = world y: red sandstone above SAND_LINE 386, sand
  below (mesa/cliffs read as rock). 'cliffs' decor draws lit/shadow rims on every vertical step.
  Climb: last cliff is 62 px with a rock ledge (LEDGE_Y). FAR backdrop yf 0.03 (mesas peek above
  the mesa top).
- m2_bridge + m2_detonator (levels/m2/bridge.ts): demolition rail bridge set piece.
- Level 'm2' full layout; autopilot completes (~190 s sim). 32 perturbed seed runs all complete.
- tests/mission_m2.test.ts: contract, boss arena, bridge, climb, autopilot (seeds 1,2,3 + hard).

## Next
1. More visual checks (briefing card, salt flat, boss fight in browser), smoke run.
2. Delete tests/tmp_m2diag.test.ts (untracked diagnostic), npm test full, final commit.

## Decisions
- Level height H = 440, base ground B = 408 (= H - 32; camera bottom y 224). Boss lock L = 6800.
- Vehicle: STRIDER 'mech' on the canyon road; lost when the bridge is blown.
- Regions (world x): desert 0, ruins ~760, canyon ~1640, gorge ~3260, mesa ~3700, oil ~5020, salt ~6280.

## Gotchas
- ThemeRenderer skips drawing platforms that have an owner (bridge draws its own deck).
- Vehicle.damage ignores driver godMode -> vehicles can be wrecked in the sim.
- Global state (entity ids, fxRng) differs between test orders: sim outcomes vary; keep locks
  robust (no lock enemy may spawn on a floor it cannot leave, e.g. a mesa step off-screen).
- The shared scratchpad is used by other agents: keep tools in artifacts/tools/ (gitignored).
