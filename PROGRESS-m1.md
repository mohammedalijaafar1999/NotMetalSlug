# PROGRESS m1 (Palm Harbor) — wave2/m1

## Done
- Branch wave2/m1 created, boss merged (wave2/boss_m1 @ 058e65d).
- Theme 'm1' (themes/m1.ts + m1/: layout+palette, backdrop panoramas, ground, platforms, decor_art, overlay) - looks good in screenshots.
- Level geometry (levels/m1/geometry.ts), decor placements (levels/m1/decor.ts), encounters (levels/m1/encounters.ts), stockade gate entity m1_gate (levels/m1/gate.ts).
- Attempt 2: reviewed screenshots of all sections (good). Left-side wave spawns moved inside the arena (L+12).

## Next
- Fix encounter blockers (officer off-screen in gauntlet wave 3; left spawns drifting off-screen).
- River bog mechanic (vehicles get stuck in the river and are wrecked = end of the tank beat)?
- Briefing text, hostages 8-10, verify boss arena + gate in game.
- tests/mission_m1.test.ts, delete tests/m1_debug*.ts, full npm test, smoke.

## Decisions
- Level is 336 tall (camera at bottom = y 120) for the cliff climb to the depot plateau (camera keys).
- src/game/entity.ts: bug fix kept (walking/falling off a static solid's far edge teleported the actor back across the box). Report in coreChanges.

## Gotchas
- content/index.ts globs every .ts under src/content, so helper files are imported in Node tests: no DOM at import.
- Infantry only approach when > 170 px away: anything spawned/knocked off-screen while the bot stands within 170 px blocks the wave forever. Spawn left-side entries inside the view, keep officers on screen.
- Bash: python heredocs are refused by the sandbox checker; use sed or the Edit tool.
