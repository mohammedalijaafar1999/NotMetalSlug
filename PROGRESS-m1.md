# PROGRESS m1 (Palm Harbor) — wave2/m1

## Done
- Branch wave2/m1 created, boss merged (wave2/boss_m1 @ 058e65d, fast-forward).

## Next
- Theme 'm1' (src/content/themes/m1.ts + m1/ helpers): sky, parallax, ground, decor, overlay.
- Level 'm1' (src/content/levels/m1.ts): layout, encounters, hostages, tank beat, boss arena.
- tests/mission_m1.test.ts.
- Visual checks (dev server port 5401).

## Decisions

## Gotchas
- content/index.ts globs every .ts under src/content, so helper files are imported in Node tests: no DOM at import.
