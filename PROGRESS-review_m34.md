# PROGRESS review_m34 (missions 3 + 4 and their bosses)

Branch review/m34 (from claude/metal-slug-game-sogjdj). Owned: m3/m4 levels, themes, bosses, test levels, tests.

## Status
- [ ] Read docs + code (in progress)
- [ ] Headless mortal-player analysis m3 / m4 (deaths, off-screen shots, spawn-on-player)
- [ ] Browser visual pass m3 / m4
- [ ] Boss m3 / m4 fairness + length
- [ ] Quality gates

## Findings
1. [major, FIXED] m3 climb: tier-6 sniper and tier-3 grenadier attacked from under the HUD band (camera keeps feet 138 px below top -> 3 tiers up = y 30). Fix: grenadier to tier 2, sniper range 40. Test: mission_m3 'climb: no ledge enemy attacks from under the HUD band'.

## Gotchas

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP review_m34: salvaged after interruption'. Review them (git show --stat HEAD), keep what is good, delete throwaway files, and continue.
