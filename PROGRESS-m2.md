# PROGRESS - Mission 2 DUSTWIND CANYON (branch wave2/m2)

## Done
- Branch created, boss merged (wave2/boss_m2 @ 9cecabb).

## Next
1. Theme 'm2' (src/content/themes/m2.ts + themes/m2/*): time-of-day sky (noon -> sunset by camera x),
   panorama parallax layers (far mesas / mid canyon walls / near rocks) with regions read from
   level decor markers (kind 'm2_bg'), terrain textures, platform styles, decor sprites, weather.
2. m2_bridge entity (levels/m2/bridge.ts): demolition rail bridge set piece (deck = owned surfaces,
   charges, collapse destroys vehicles on it). Triggered by 'm2_detonator' in the bridge lock's last wave.
3. Level 'm2' (levels/m2.ts), tests/mission_m2.test.ts, visual passes.

## Decisions
- Level height H = 440, base ground B = 408 (= H - 32; camera bottom y 224). Boss lock L ~ 6800.
- Vehicle: STRIDER 'mech' on the canyon road; lost when the bridge is blown.
- Regions (world x): desert 0, ruins ~760, canyon ~1600, gorge ~3200, mesa ~3700, oil ~5000, salt ~6300.

## Gotchas
- ThemeRenderer skips drawing platforms that have an owner (bridge draws its own deck).
- Vehicle.damage ignores driver godMode -> vehicles can be wrecked in the sim.
