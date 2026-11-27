# PROGRESS fix_core (branch fix/core)

Items (from task list):
1. tank vulcan - DONE (Tank.levelDip auto-depression, tests/vehicles.test.ts)
2. wreck blasts - DONE: wrecks never hurt (team player); real cause = light_tank tread crush capped 45 on vehicles -> Machine.touch crush on vehicles = 1 unit (22). test machines.test.ts
3. officer rally - DONE (Officer.troops filters Infantry|MortarCrew; infantry.test.ts)
4. jetpack off-screen fire - TODO
5. rear telegraph - DONE (Machine.rearWarn/entryHold + RearEntryWarning in machines/common.ts; not hittable while holding; LightTank rolls into view when off-screen; machines.test.ts rear entries)
6. hostage run into water/pits, chute over water - TODO
7. mortar marker radius - TODO
8. co-op respawn offset - TODO
9. arenaLeash gap/water aware - TODO
10. autopilot cages / canal jump (optional) - TODO

Next: item 4 jetpack, then 6,7,8,9
Gotchas:
- probes live in artifacts/*.probe.ts, run: npx vitest run --config artifacts/vitest.probe.config.ts artifacts/X.probe.ts
- mission_m4 'truck from behind' test is timing sensitive: holding machines must be unhittable (else bot kills it off-screen)
