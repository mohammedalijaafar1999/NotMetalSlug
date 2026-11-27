# PROGRESS fix_core (branch fix/core)

Items (from task list):
1. tank vulcan - DONE (Tank.levelDip auto-depression, tests/vehicles.test.ts)
2. wreck blasts - DONE: wrecks never hurt (team player); real cause = light_tank tread crush capped 45 on vehicles -> Machine.touch crush on vehicles = 1 unit (22). test machines.test.ts
3. officer rally - DONE (Officer.troops filters Infantry|MortarCrew; infantry.test.ts)
4. jetpack off-screen fire - DONE (canAttack rechecked at first burst shot + grenade release; infantry.test.ts)
5. rear telegraph - DONE (Machine.rearWarn/entryHold + RearEntryWarning in machines/common.ts; not hittable while holding; LightTank rolls into view when off-screen; machines.test.ts rear entries)
6. hostage - DONE (Hostage.ahead(): stop/turn at pits + deadly water, chute only off a solid deck over open sky; vehicles.test.ts)
7. mortar marker - DONE (MORTAR_RADIUS=22 marker ring as wide as blast; infantry.test.ts)
8. co-op respawn - DONE (player.ts dropIn offset; core.test.ts)
9. arena leash - DONE (brisk 40px/s, hop small gaps, stop at deadly water; arena.test.ts). Exact 6073 stall not reproduced (seeds 1-4 Easy)
10. autopilot (optional) - TODO

Next: full suite (artifacts/full3.log), browser screenshots (rear warning, tank dip, mortar marker), item 10 if time
Gotchas:
- probes live in artifacts/*.probe.ts, run: npx vitest run --config artifacts/vitest.probe.config.ts artifacts/X.probe.ts
- mission_m4 'truck from behind' test is timing sensitive: holding machines must be unhittable (else bot kills it off-screen)
