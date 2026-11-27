# PROGRESS review_core (gameplay core reviewer)

Branch review/core (from claude/metal-slug-game-sogjdj). Commit after each fix: `git add -A && git commit -q -m "WIP review_core: <what>"`.

## Plan
1. tests/fuzz.test.ts chaos harness (every mission, 1P/2P, mortal/god, sticky random masks + autopilot) -> fix findings. DONE (default + heavy green on re-checked cases).
2. Rules/feel review vs DESIGN core rules + weapons (scripted, browser on port 5505).
3. Edge cases list from the brief.
4. Gates: typecheck, test, build. Delete this file, final commit.

## Findings (status)
- FIXED screen edge buried players/vehicles in terrain (climb / drop-in next to partner; flyers slide clear). tests/core.test.ts
- FIXED respawn drop into cliffs rising above the screen top; safe drop points. tests/core.test.ts
- FIXED stepping off a box edge left the body inside it (unstickSides); ledge assist. tests/core.test.ts
- FIXED TIME UP did not kill a player inside a vehicle (Player.kill wrecks the vehicle first). tests/core.test.ts
- FIXED respawn drop point at the lip of a pit (drift during the drop fell in): SAFE_DROP_MARGIN. tests/core.test.ts
- HARNESS: warp dropped set pieces (cable car, pontoons, lift) -> harness re-spawns misc/hazard spawns ahead; dead-linger check skipped on frozen frames; invulnerable players under crusher heads exempt.

## Gotchas
- Fuzz: FUZZ_LEVEL=m3 FUZZ_SEED=3001 FUZZ_VERBOSE=1 npx vitest run tests/fuzz.test.ts to reproduce one case. FUZZ_HEAVY=1 for the heavy set.
- Probes: npx vitest run --config artifacts/vitest.probe.config.ts artifacts/<x>.probe.ts (trace.probe.ts takes PROBE_CASE json).
