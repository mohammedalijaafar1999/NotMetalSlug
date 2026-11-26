# PROGRESS m5 (STORMFRONT) - working notes (delete when done)

## Done
- Branch wave2/m5 created, boss merged (wave2/boss_m5).

## Plan
- Theme 'm5' (src/content/themes/m5.ts + themes/m5/*): dusk storm sky, custom renderBackground
  (far storm towers w/ lightning flashes, far fleet silhouettes, mid clouds, cloud sea), rain +
  near wisps overlay (fade out before boss lock), hull solid texture + deck edge, catwalk platforms,
  decor: envelope, hullcap, cabin, mast/pennant, searchlight, lamp, engine pod, rigging, cargo.
- Level 'm5' (src/content/levels/m5.ts + levels/m5/*): H = 216+112, camera y 112 (low) except a
  vertical section; autoScroll everywhere except locks; boss lock at width-384.
- Mission entities: m5_supply (parachute crate pickup), m5_fuel_zeppelin (set piece),
  m5_airspace (anti-trap helper: pushes player gyros out of solids).
- hostage.ts minimal fix: freed hostages running off a bottomless edge parachute away.
- tests/mission_m5.test.ts

## Decisions / gotchas
- Weapon pickups in a vehicle turn into points -> hostages drop fuel/bomb/life/points.
- Pickups have gravity -> sky supplies need m5_supply.
- Respawn: gyro spawns at (safeX, cam.y+60) -> may overlap solids -> m5_airspace pushes out.
- Vehicle.clampToView squeezes a blocked gyro into solids -> m5_airspace pushes out.
