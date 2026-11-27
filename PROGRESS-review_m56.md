# PROGRESS review_m56 (missions 5 + 6 and their bosses)

Branch review/m56 (from claude/metal-slug-game-sogjdj). Worktree-local throwaway tools in artifacts/
(gitignored): artifacts/probe (mortal autopilot probe: `LEVEL=m6 SEEDS=1,2 npx vitest run --config
artifacts/probe/vitest.config.ts`), artifacts/lib.mjs + tour.mjs (Playwright, dev server port 5504).

## Baseline
- owned tests green (47). Mortal autopilot probe: m5 completes with 4-6 deaths/seed (Normal),
  m6 completes with 11-14 deaths/seed.

## Findings (status)
- (in progress) see below

## Next steps
- m5: respawn placement, boss telegraphs, HUD band, hostages reachability
- m6: lift arrival (turret/robot/sniper at the top), molten globs telegraph, JUGGERNAUT rain
  missiles from above the view, ending flow
