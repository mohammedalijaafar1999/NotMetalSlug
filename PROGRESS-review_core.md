# PROGRESS review_core (gameplay core reviewer)

Branch review/core (from claude/metal-slug-game-sogjdj). Commit after each fix: `git add -A && git commit -q -m "WIP review_core: <what>"`.

## Plan
1. tests/fuzz.test.ts chaos harness (every mission, 1P/2P, mortal/god, sticky random masks + autopilot) -> fix findings.
2. Rules/feel review vs DESIGN core rules + weapons (scripted, browser on port 5505).
3. Edge cases list from the brief.
4. Gates: typecheck, test, build. Delete this file, final commit.

## Findings (status)
- (pending) TIME UP does not kill a player inside a vehicle (Player.kill ignores state 'vehicle').

## Gotchas
- Fuzz: FUZZ_LEVEL=m3 FUZZ_SEED=3001 FUZZ_VERBOSE=1 npx vitest run tests/fuzz.test.ts to reproduce one case.

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP review_core: salvaged after interruption'. Review them (git show --stat HEAD), keep what is good, delete throwaway files, and continue.
