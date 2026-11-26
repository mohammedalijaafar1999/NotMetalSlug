# boss_m4 LEVIATHAN - progress

## Design (decided)
- Sub faces the pier (facing -1, art authored bow-right). Ref point (x, y) = tower centre at the hull waterline;
  the hull rides FLOAT=6 px below the water surface (low profile: standing shots clear the armoured head).
- Arena (relative to lock x L): pier deck y=180 up to tip L+148 (vertical face), deep deadly water L+148..end,
  surface y=190, depth >= 70. Spawn boss_m4 at x=L+300, y omitted. Lock trigger L-40 (player must be on the pier).
- Phases (phaseAt [0.66, 0.33]): 0 SURFACED (torpedoes, missile salvos, periscope laser whip),
  1 CLAW (hatch on the head blows, claw arm: shadow slam + rake), 2 DIVE (sinks 40 px, only tower hittable,
  laser x2, claw from the water, torpedoes from underwater).
- Laser = whip sweep from the water near the bow across the pier to L+24 at ~400 px/s then OFF: jumpable.
- Pod missiles (own PodMissile class) go straight up off-screen and drop vertically on their marker
  (LockMissile's shallow approach hit players far from the marker).
- Zones: tower 1.25 (1.6 submerged), pods 1.25 (own hp 24, destructible), hull/bow 0.35, mouth 1.5 while jaw open,
  claw 0.7 (phase 1) / 0 armoured (phase 2). HP 360.
- Intro: rises from the depths ~2.7 s, not hittable; lock announce 'WARNING!' (boss never calls world.announce).

## Done
- art.ts sprites, weapons.ts (Torpedo, PodMissile, LaserBeam), arm.ts (IK claw), leviathan.ts, boss_m4.ts,
  bosstest_m4 level, tests/boss_m4.test.ts (12 tests incl. a mortal scripted dodger that wins without dying).
- Bot fix (src/debug/bot.ts): zone hysteresis + only tap toward nearest enemy when facing away
  (it used to face away 84% of a boss fight when entering the zone from the right).
- Autopilot wins in ~40 s total; dodger 55-80 s.

## Next
- Visual polish pass (screenshots): pod missiles, laser guide, intro, death; maybe searchlight cone.
- Full npm test, then finalize (delete this file, final commit).

## Gotchas
- Water overlay is drawn in front of entities (tints submerged parts automatically).
- Camera leads the player at 0.42 of the view: lock trigger must be < lock x or the player walks into the water.
- Two GroundMarker classes: kit (landing marker, watch) vs fx (shadow/cross, track).
- artifacts/compose_m4.ts + artifacts/shots_m4.mjs = handy preview scripts (gitignored).
