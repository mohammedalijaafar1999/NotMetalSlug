# Level design guide

## Scale & physics

- Screen: 384×216. A standard ground line sits around **y = 180-190** in a 216-tall level (the HUD
  covers y < 34, keep action below ~y = 40).
- Player: 12×26 hitbox, runs 84 px/s, jump apex ≈ 50 px, running jump ≈ 56 px long. One-way
  platforms 30-45 px above the ground are comfortable; stack tiers ~40 px apart.
- Slopes walkable up to ~45°. Vertical steps in ground polylines are cliffs (walls) — use steps of
  ≤ 6 px for "stairs" the player walks up, ≥ 30 px for ledges the player must jump.
- Pits: rare, ≤ 40 px wide, never right after a camera lock or under a respawn point.
- Deep water (`deadly: true`) kills players; shallow water (default) slows them — prefer shallow.

## Structure of a mission (4500-8000 px)

1. **Opening (0-600)**: a breather to drop in; a hostage or crate early; a few idle riflemen.
2. **Section A**: introduce the mission's signature enemy, a small arena (lock) with 2-3 waves.
3. **Vehicle beat**: a vehicle parked on flat ground followed by a stretch that lets it shine
   (enemy tanks/jeeps/trucks, lots of infantry), then something that forces you out or wrecks it.
4. **Section B**: terrain variety — platforms, a vertical climb (camera keys), water, a bunker or
   turret nest, destructible scenery (barrels, crates, mines with telegraphs).
5. **Gauntlet arena**: the hardest non-boss lock (3-4 waves, mixed infantry + machines).
6. **Boss approach (≥ 1 screen of calm)**, then the **boss lock** (`boss: true`), arena built to the
   boss's documented requirements.

Per mission: 6-12 hostages (rescue bonus + item drops — drop the good weapons from hostages),
2+ weapon crates in the open, bomb crates before arenas, 3-6 locks, checkpoints at least every
~1200 px (they reset the timer), `timeLimit` 60-99.

## Encounters

- Spawns trigger when the camera's right edge reaches `trigger` (default x-8): enemies placed just
  off the right edge walk in naturally. Use `props.behavior` (`patrol`, `guard`, `charge`, `idle`).
- Mix: 60% infantry fodder, 25% specialists, 15% machines. Never put a sniper and a mortar on the
  player at the same time as a tank in mission 1.
- Arena waves: 3-6 enemies per wave, entering from both sides/above (paratroopers, jetpacks, trucks).
- Fairness: no enemies spawning on top of the player, no shots from off-screen, telegraphs on
  everything heavy. Difficulty ramps across missions (m1 forgiving → m6 intense).

## Theme checklist

Sky gradient, 3-4 parallax layers (far silhouettes → near detail; some animated: clouds drifting,
smoke, birds), ground fill + edge textures, solid block texture, platform style, water colors,
6+ decor kinds unique to the mission (props of the place: architecture, vegetation, wrecks, signs,
lights), a weather/atmosphere overlay (rain, sand, snow, embers, haze) that stays subtle enough to
read the action.

## Verification

- `npm test` runs the autopilot (invincible) through every mission headless; it must reach the end.
- `node scripts/smoke.mjs --missions=N` (dev server running) plays it in Chromium with screenshots.
- Look at screenshots of every section; make sure enemies are visible against backgrounds,
  platforms read clearly, and nothing important hides behind the HUD.
