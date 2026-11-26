# PROGRESS boss_m3 (FROST BASTION)

Branch wave2/boss_m3. Delete this file when done.

## Plan / decisions
- Wall faces LEFT (sprite authored facing right, flipped). Face F = arenaL + 262 (FACE_X). Boss x = F + (WALL.FACE - WALL.OX).
- Dynamic terrain solid (owner = boss) from F+2 to far right, G-400..G: blocks players, vehicles, bullets, grenades.
  Extended core pushes its left edge out (moveSolid) and shoves players.
- Zones: 'doors' (mul 0, clang) while closed; 'core' (mul 1) while open. Turrets = BossPiece (mg, flak, mortar), hp own, mul 0.6 forwarded.
- Phases by hpFrac [0.66, 0.33]: P0 lance (crouch) per opening; P1 + spike wave (jump) alternate + faster turrets;
  P2 doors blown off, core permanently exposed, lance / spikes / boulders.
- Director: heavy core attacks reserve a window; turrets/icicles do not resolve inside it (fairness).
- Intro: wall rises out of the snow (~2.6 s), turrets deploy, boss_roar; hittable after. Lock announce 'WARNING! ...' (not world.announce).
- Bot: doors zone keeps the lowest hurtbox low -> bot stays left quarter, fires forward at the core when open.

## Done
- (prev attempt) art.ts: wall, core, shutters, emitter, beacon, mg, flak, mortar, wrecks, icicle, shard, shells, boulder, crystal, plate, rubble.

## Next
- boss_m3.ts behaviour, test arena, tests, visual passes.

## Gotchas
- Boss projectiles must spawn LEFT of the wall solid (x < F) or they hit terrain instantly.
- Bullets move ~7 px/step: zones must stick out >= 8 px in front of the solid edge.
