# PROGRESS m6 (IRON CITADEL) - delete when done

Branch wave2/m6 (boss merged from wave2/boss_m6). Dev server port 5406.

## Files
- Theme 'm6': src/content/themes/m6.ts + m6/{palette,tiles,layers,decor,overlay}.ts
- Mechanics: src/content/levels/m6/{molten,conveyor,crusher,ladle,lift}.ts (m6_molten, m6_conveyor,
  m6_crusher (+scrap press), m6_ladle, m6_lift)
- Level: src/content/levels/m6.ts (H=456: lower floor GL=426, hangar floor GU=198; shaft lift at 5340;
  boss lock 6720, width 7104)
- tests/_m6_probe.test.ts = throwaway probe (DELETE before final commit)

## Done
- theme (layers/tiles + 20 decor kinds incl. wall panels, hangar door, truss, pit + overlay), mechanics,
  full level; tests/mission_m6.test.ts (12 tests) green; full suite green; smoke + play.mjs run reach
  the ending; mortal-autopilot probe (99 lives) completes 6/6 seeds.
- core fix: src/content/enemies/infantry.ts sees(): off-screen wave members always notice (they used to
  idle off-screen forever after losing the target during a player respawn -> lock stalled).

## Next
- final review, delete tests/_m6_probe.test.ts + tests/_m6_deaths.test.ts + PROGRESS, final commit

## Decisions / gotchas
- Deadly water does NOT kill in the engine: molten pits = gaps in the ground + LevelDef.water (deadly,
  front overlay) + m6_molten entity (kills, walls, glow).
- Spawns with y omitted land on the TOP floor: keep spawns away from press columns (solid from the
  housing down to the head so nothing can stand on a press head).
- Left-side wave entries: only types that close in (saber/flametrooper/shield_trooper); riflemen stop
  at dx<=170 and grenadiers keep range -> they would stay off-screen forever. Wave officers need
  behavior 'charge' (guard officers off-screen never notice).
- The lift counts a player hopping above the deck as aboard (the bot jumps against the shaft wall).
