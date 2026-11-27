# PROGRESS m1 (Palm Harbor) — wave2/m1

## Done
- Branch wave2/m1 created, boss merged (wave2/boss_m1 @ 058e65d).
- Theme 'm1' (themes/m1.ts + m1/: layout+palette, backdrop panoramas, ground, platforms, decor_art, overlay).
- Level: geometry, decor, encounters (reworked: fair wave entries, officer on the watchtower, 10 hostages),
  m1_gate (stockade gate the boss smashes), m1_bog (river ford mud wrecks vehicles = end of tank beat),
  sign v4 (NO VEHICLES / MUD), new buttressed jtree art, briefing.
- tests/mission_m1.test.ts (14 tests) green; full npm test green (448).
- Browser autoplay run completes (~236 s), screenshots reviewed (all sections + boss).

## Next
- Visual pass at 2x: bog moment, each arena, HUD overlap, decor on ground; overlay subtlety.
- Delete tests/m1_debug.test.ts before the final commit. Run smoke.mjs --missions=1.

## Decisions
- Level is 336 tall (camera at bottom = y 120) for the cliff climb to the depot plateau (camera keys).
- src/game/entity.ts: bug fix kept (walking/falling off a static solid's far edge teleported the actor
  back across the box) - verified by the 'basalt outcrop' test (fails without it). Report in coreChanges.
- River bank slopes must be < 45 deg (the lead-edge check makes exactly 45 deg a wall).

## Gotchas
- content/index.ts globs every .ts under src/content, so helper files are imported in Node tests: no DOM at import.
- Infantry only approach when > 170 px away: anything spawned/knocked off-screen while the bot stands within
  170 px blocks the wave forever. Spawn left-side entries inside the view (L+22..30), keep officers on screen.
- Bash: python heredocs / multi-file shell pipelines are refused by the sandbox checker; use sed or Edit.
- Scratch scripts: /tmp/claude-0/-home-user-NotMetalSlug/c5b6cecd-83ca-5fbf-b52b-e3a132caa3fc/scratchpad/{tour,capture}.mjs
