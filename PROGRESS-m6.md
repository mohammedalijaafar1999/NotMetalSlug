# PROGRESS m6 (IRON CITADEL) - delete when done

Branch wave2/m6 (boss merged from wave2/boss_m6). Dev server port 5406.

## Plan
- Theme 'm6': src/content/themes/m6.ts + src/content/themes/m6/* (palette, tiles, layers, decor, overlay)
- Mechanics (src/content/levels/m6/*): m6_conveyor, m6_crusher, m6_ladle, m6_molten, m6_gate
- Level 'm6': src/content/levels/m6.ts. H=456 (lower floor ~426, camera bottom top=240), reactor shaft
  climb to the upper level (floor 198, camera top 0), boss arena = last screen (lockX = W-384, ground 198)
- Tests: tests/mission_m6.test.ts

## Done
- (nothing yet)

## Next
- theme skeleton -> level skeleton -> sim -> mechanics -> encounters -> art polish -> verify

## Decisions / gotchas
- Deadly water does NOT kill in the engine (only respawn avoids it): molten pools = pits (<=32 px so the
  bot clears them) + LevelDef.water (deadly, molten colours) + m6_molten entity (kills, glow, bubbles).
- Bot never ejects from vehicles: scrap presses (clearance 34 px) crush the STRIDER (crush zone padded
  for vehicles) so it is forced out.

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP m6: salvaged after interruption'. Review them (`git show --stat HEAD`), keep what is good, delete throwaway debug tests, and continue.
