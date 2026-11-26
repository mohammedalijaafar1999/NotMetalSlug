# boss_m4 LEVIATHAN - progress

## Design (decided)
- Sub faces the pier (facing -1, art authored bow-right). Ref point (x, y) = tower centre at the hull waterline.
- Arena (relative to lock x L): pier deck y=180 up to tip L+148 (vertical face), deep deadly water L+148..end,
  surface y=190, depth >= 70. Spawn boss_m4 at x=L+300, y omitted. Lock trigger L-40 (player must be on the pier).
- Phases (phaseAt [0.66, 0.33]): 0 SURFACED (torpedoes, missile salvos, periscope laser whip),
  1 CLAW (hatch on the head blows, claw arm: shadow slam + rake), 2 DIVE (sinks 40 px, only tower hittable,
  laser x2, claw from the water, torpedoes from underwater).
- Laser = whip sweep from the water near the bow across the pier to L+28 at ~400 px/s then OFF: jumpable
  (analysed: a fixed-emitter ray sweep is only dodgeable if it shuts off; never sweep toward the sub).
- Zones: tower 1.25 (1.6 submerged), pods 1.25 (own hp, destructible), hull/bow 0.35, mouth 1.5 while jaw open,
  claw 0.7 (phase 1) / 0 armoured (phase 2).
- Intro: rises from the depths ~2.8 s, not hittable; lock announce 'WARNING!' (boss never calls world.announce).

## Files
- src/content/bosses/m4/art.ts (sprites), weapons.ts (Torpedo, beam fx), arm.ts (claw arm), leviathan.ts (boss)
- src/content/bosses/boss_m4.ts (register), src/content/levels/test/bosstest_m4.ts, tests/boss_m4.test.ts

## Done
- (nothing yet)

## Next
- art.ts sprites -> spritesheet check

## Gotchas
- Water overlay is drawn in front of entities (tints submerged parts automatically).
- Camera leads the player at 0.42 of the view: lock trigger must be < lock x or the player walks into the water.
