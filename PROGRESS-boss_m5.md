# PROGRESS boss_m5 (THUNDERHEAD)

## Plan
- src/content/bosses/m5/art.ts: sprites (hull 4 dmg frames, gondola, engines, props, turrets, hatch, bay, ports, nose core, mines, shells, debris) + layout constants.
- src/content/bosses/m5/projectiles.ts: SkyMine (parachute mine), BroadsideShell, LightningStrike, WreckHalf (falling wreck), sfx helper.
- src/content/bosses/m5/thunderhead.ts: Thunderhead (BigBoss) + SkyTurret (BossPiece).
- src/content/bosses/boss_m5.ts: registerEntity('boss_m5').
- src/content/levels/test/bosstest_m5.ts: sky test arena (+ tiny test theme), startVehicle gyro.
- tests/boss_m5.test.ts.

## Decisions
- Ship faces LEFT (facing -1), holds a station relative to the camera: ship origin (envelope centre) at screen (270, 92).
- All part sprites use the ship origin as sprite origin (drawn at the same point, flip handles facing).
- Phases: 0 (>60%) turrets + drones + mines; 1 (60-30%) + broadside fan; 2 (<30%) nose cap blows off -> storm core (x2) + lightning.
- Boss x/y = targeting focus (gondola, then nose core) so the flying autopilot lines up with it; art uses shipX/shipY.
- Lock announce 'WARNING!' (not world.announce).

## Done
- (nothing yet)

## Next
- art.ts
