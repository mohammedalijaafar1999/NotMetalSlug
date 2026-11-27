# PROGRESS m5 (STORMFRONT) - working notes (delete when done)

## Done
- Branch wave2/m5, boss merged (wave2/boss_m5). Salvaged theme/level/entities reviewed and kept.
- Bot fix (src/debug/bot.ts, generic): a flying bot holding position turns to face the nearest
  enemy (it used to keep facing left after overshooting when a lock stopped the scroll).
- m5_airspace: hull push-out + spare gyro for pilots stranded on a deck (SPARE_AMMO 6 bombs, no
  life lost) + take-off glide (starting gyro eased from under the HUD to screen y 104).
- Backdrop rework: src/content/themes/m5/clouds.ts (volumetric blob clouds: dome lambert +
  volume light + self-shadow + warm underside glow + rim), new towers / mid banks / cloud sea.
- Girder platform restyled (hazard edge, truss under sloped ramps).
- Level: start x 120, hostage modes mixed (tied/caged/wander), drops rebalanced, 2 weapon cases
  (crate_prop H/R on decks), jetpacks moved off the calm approach, new briefing (<= 11 lines).
- tests/mission_m5.test.ts: 14 tests green (structure, boss arena, theme, mechanics, autopilot).

## Next
- Visual pass: girder ramp in game, wisps overlay, spare gyro arrival, hostage chute, zeppelin.
- Full npm test, smoke run in browser (scripts/smoke.mjs --missions=5), 2P check.
- Delete tests/tmp_m5_sim.test.ts (throwaway, untracked), PROGRESS file; final commit.

## Decisions / gotchas
- Weapon pickups in a vehicle turn into points -> hostages drop fuel/bomb/life.
- Pickups have gravity -> sky supplies use m5_supply (parachute).
- Respawn: gyro spawns at (safeX, cam.y+60) -> may overlap solids -> m5_airspace pushes out.
- Vehicle.clampToView squeezes a blocked gyro into solids -> m5_airspace pushes out.
- hostage.ts (shared, additive): freed hostage running off a bottomless deck edge parachutes away.
- Level.warp drops pending spawns with trigger <= x + 384 (tests spawn things directly).
- Take-off glide moves the gyro during world.time < 1.6 s: tests step past it first.
