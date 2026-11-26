# IRON RUCKUS — Architecture & Content Contracts

TypeScript + Vite, no runtime dependencies. Canvas 2D at a fixed low resolution
(**384×216**, `VIEW_W`/`VIEW_H`) scaled up with nearest-neighbour. Fixed 60 Hz simulation
(`STEP = 1/60`). All art is procedural pixel art baked at startup; all audio is synthesized.

```
src/
  engine/        loop, input, renderer, scene stack, pixelart rasterizer, sprite registry,
                 bitmap font, audio (sfx synth + music sequencer + voice), storage, math, rng
  art/           humanoid rig (players + infantry), soldier frame sets, texture generators
  game/          world, entity/actor physics, terrain, camera, level runtime, theme renderer,
                 player, weapons, projectiles, effects, enemy/boss/vehicle base classes,
                 pickups, hostages, HUD, session, registry
  scenes/        boot, title, gameplay, pause, tally, game over, menu widget, flow hooks
  content/       EVERYTHING ELSE. Auto-imported (import.meta.glob) - just add a file.
  debug/         window.__game test API, autopilot bot
tests/           vitest: engine unit tests, content validation, headless mission simulation
scripts/         smoke.mjs (browser autoplay), play.mjs/shot.mjs (screenshots), spritesheet.ts
```

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | vitest: unit + content validation + every mission simulated headless with the autopilot |
| `npm run build` | typecheck + production build + `dist/iron-ruckus.html` single-file build |
| `node scripts/smoke.mjs [--dist] [--missions=1,2]` | Plays missions in headless Chromium (autopilot, invincible, 8x) |
| `node scripts/play.mjs "<query>" artifacts/x 10 4` | Screenshots over time for a URL query (dev server must run) |
| `~/.bun/bin/bun scripts/spritesheet.ts '<regex>' artifacts/sheet.png 3` | Render sprites to a PNG contact sheet (no browser) |

Debug URL params: `?mission=N`, `?level=<id>` (e.g. `level=sandbox`), `?autoplay=1`, `?invincible=1`,
`?seed=N`, `?speed=N`, `?fast=1`, `?2p=1`, `?chars=dex,juno`, `?hitboxes=1`, `?mute=1`, `?difficulty=0..2`.

`window.__game` (see `src/debug/api.ts`): `state()`, `startMission(n, opts)`, `spawn(type,x,y,props)`,
`warp(x)`, `give(weaponId)`, `invincible()`, `autopilot()`, `speed(k)`, `step(n)`, `killEnemies()`,
`errors`, `levels()`, `entityTypes()`, `sprites()`, `sfx()`, `songs()`.

## Conventions

- Units: pixels, seconds, px/s. +y is DOWN. `GRAVITY = 900`, player run 84 px/s, jump 300 px/s (≈50 px high, ≈56 px long).
- Entity position `(x, y)` is **bottom-center (feet)** by default (`anchor = 'bottom'`); projectiles and
  effects use `anchor = 'center'`. Hitbox is `w × h` around the anchor (`entity.box`).
- Everything faces RIGHT in art; flip at draw time with `{ flip: facing < 0 }`.
- Gameplay randomness: `world.rng` only (deterministic tests). Cosmetic randomness: `fxRng`.
- Never touch `document`/`window` at module import time (tests import all content in Node).
  Sprite `draw` functions only use `PixelArt` (pure) so they work headless.
- Teams: `'player'` attacks hit `'enemy'` and `'neutral'` hittables (props, hostages); `'enemy'` attacks hit `'player'`.
- Damage kinds: `bullet | explosion | fire | melee | laser | crush | electric`. Players die in one hit
  (unless in a vehicle). Basic infantry has 1 HP; pistol = 1 dmg per bullet, HMG = 1, knife = 5,
  grenade = 9 (radius 26).
- Render layers: `Z` in `src/game/constants.ts`.
- Difficulty: `world.difficulty` → `enemyFireDelay`, `enemyShotSpeed`, `enemyHp`, `aggression`, `score`.
  Use `enemy.fireDelay(base)` and `enemy.shotSpeed(base)` helpers.

## Registries (how content plugs in)

All are populated at import time by files under `src/content/**` (auto-imported, order-independent).

| Registry | API | Used by |
|---|---|---|
| Sprites | `sprites.define({ name, w, h, ox?, oy?, frames?, outline?, draw(p, frame) })` | everything |
| Entities | `registerEntity(type, category, (world, spec) => new X(spec.props), description)` | level spawns |
| Levels | `registerLevel(def: LevelDef)` | missions |
| Themes | `registerTheme(def: ThemeDef)` | level look |
| Weapons | `registerWeapon(def: WeaponDef)` | pickups / player |
| Characters | `registerCharacter(def)` | char select |
| SFX | `audio.defineSfx(name, layers)` | `world.sfx(name, x)` / `audio.play(name)` |
| Songs | `audio.defineSong(name, song)` | `audio.playMusic(name)` |
| Scene flow | assign `flow.title / newGame / mission / missionComplete / gameOver / ending / options` inside a function pushed to `startupHooks` (`src/hooks.ts`) | UI |
| Bomb types | `bombThrowers[kind] = (player, x, y, vx, vy) => void` (`src/game/player.ts`) | firebomb |

Entity categories: `enemy | boss | vehicle | pickup | prop | hostage | hazard | misc`.

## Sprites & pixel art

`PixelArt` (`src/engine/pixelart.ts`) is a software rasterizer with crisp, non-antialiased primitives:
`rect, box, line(thick), circle, ring, ellipse, poly, tri, capsule, rotRect, dither, px, replace, outline, blit`.
Pixel-center sampling: fractional coordinates are fine. Colors are `'#rrggbb'`.
A 1px dark outline (`#140c1c`) is added automatically (`outline: null` disables).
Frames are baked lazily (BootScene bakes everything with a progress bar).

`sprite.draw(g, x, y, frame, { flip, flash, alpha, rot, scale })` - (x,y) is where the origin lands.
`flash: true` draws a white silhouette (hit flash): use `{ flash: this.flash > 0 }`.

### Humanoid rig (`src/art/humanoid.ts`)
`drawHuman(p, originX, originY, pose, style)` draws a soldier from a pose (hip, feet, aim, hands, rotation…)
and a style (skin, hair, shirt, pants, boots, vest, headgear, beard, backpack, gun color…). Use it for every
human so the cast is consistent. `defineSoldier(name, style, gun)` (`src/art/soldier.ts`) bakes the standard
enemy frame set (`SF.IDLE, WALK, AIM, FIRE, CROUCH_*, THROW, DIE..DIE+4, PANIC, ALERT, BURNT, AIM_UP, FIDGET`).
`RUSTCOAT` is the enemy army's base style; vary it with `styleVariant`.

## Entities

```ts
class Entity  { x,y,vx,vy,w,h,anchor,facing,z,team,hittable,hp,maxHp,dead,age,flash,invuln,
                persistent,blocksProgress,scoreValue,meleeable,owner,props;
                update(dt); render(g); damage(d): boolean; die(d); remove(); onScreen(margin); hurtboxes() }
class Actor extends Entity { onGround, onPlatform, hitWall, landed, inWater, moveAndCollide(dt),
                jump(v), dropThrough(), floorAhead(dir, ahead, maxDrop), onFallOut() }
class Enemy extends Actor  { state, stateTime, setState, think(dt) [abstract], target(), faceTarget(),
                canAttack(), fireDelay(base), shotSpeed(base), shoot(x,y,{angle,speed,spread}),
                lob(x,y,tx,ty), dying, deathTime, deathKind, deathBlinkHidden, onDeath() }
class Boss extends Entity  { bossName, phase, hpFrac, state/setState, think(dt) [abstract],
                dying → deathSequence() (explosions) → world.level.bossDefeated(); deathArea() }
class BossPart extends Entity { parent, forward, destructible, ox, oy, sync(), onDestroyed }
class Vehicle extends Actor { driver, vehicleName, secondaryAmmo, drive(inp, dt) [abstract], idle(dt),
                entryBox(), repair(), startDestruction(), warningBlink }
```

- `world.spawn(type, x, y?, props)` - y omitted ⇒ placed on the top-most floor at x.
- Enemies only attack while on screen (`canAttack()`), and set `blocksProgress = true` so arena waves
  wait for them. `scoreValue` is awarded to the killer automatically.
- Death: `Enemy.die()` sets `dying`, disables hit, applies knockback by damage kind, drops `props.drop`,
  then removes after `deathDuration`. Render death frames from `deathKind`/`deathTime`/`onGround`
  (`'fire'` ⇒ burnt frame).
- Projectiles (`src/game/projectile.ts`): `Projectile` base (swept hit tests, terrain hits, explode option),
  `Bullet` (player), `EnemyBullet` (slow, dodgeable), `Grenade` (bouncing), `Rocket` (accelerating,
  optional homing), `Shell` (arcing). Enemy projectiles must be dodgeable: typical speeds 120-200 px/s.
- `world.explode(x, y, { radius, damage, team, owner, size, shake, sfx, hitAll })` - area damage + fx.
- FX: `world.particles.dust/sparks/debris/smokePuffs/splash`, `world.effect(spriteName, x, y, opts)`,
  `world.floatText(text, x, y, color)`, `world.shake(mag, dur)`, `world.flash(color, alpha)`, `world.hitstop(s)`.
  Explosion sprites: `explosion_tiny|small|medium|large|huge`; also `muzzle_flash`, `impact_spark`.
- Sound: `world.sfx(name, x?, { vol, pitch })` (positional pan/attenuation). Only use names from the
  canonical list in DESIGN.md (a test checks every referenced name is defined).
- Events: `world.on(type, fn)` / `world.emit(e)`: `enemyKilled, hostageRescued, playerDied, playerOut,
  bossStart, bossDefeated, missionComplete, checkpoint, lock, unlock, pickup, announce`.
  `world.announce(text, { color, time, sub })` shows a banner.

## Levels (`src/game/level.ts`)

A `LevelDef` is pure data:
- `ground`: polylines `[[x,y],...]` (ascending x; equal consecutive x = vertical cliff; gaps = pits). Everything
  below a ground line is solid. Keep pits ≤ 40 px wide (a running jump covers ~56 px).
- `platforms` (one-way, may slope with `y2`), `solids` (boxes), `water` (`deadly` for deep water).
- `camera`: `[cameraLeftX, minTopY, maxTopY]` keys - vertical camera bounds (vertical sections). Default: bottom.
- `autoScroll`: `[{ x1, x2, speed }]`.
- `entities`: one-off spawns, triggered when the camera's right edge reaches `trigger` (default `x - 8`).
- `locks`: arenas. The camera locks at `x` when it reaches `trigger ?? x`; waves spawn in order, each when
  the previous wave's `blocksProgress` entities are dead. Non-boss locks release with a "GO →" prompt.
  The boss lock has `boss: true`; the boss entity's death sequence completes the mission.
- `decor`: theme-rendered scenery `{ kind, x, y, layer: 'back'|'front', props }`.
- `checkpoints` (camera-left x): reset the timer. `startVehicle`: players start/respawn inside this vehicle.
- `music`, `bossMusic`, `theme`, `bossName`, `timeLimit`.

The level runtime handles spawns, locks, checkpoints and the HUD timer; the theme renders it.

## Themes (`src/game/theme.ts`)

`ThemeDef`: `sky` (gradient stops), `layers` (parallax: `art()` returns a PixelArt period, `factor`, `y`,
`speed`), `groundTile()`, `groundEdge()` + `groundEdgeUp`, `solidTile()`, `solidEdge()`, `depthShade`,
`platform(g, x1,y1,x2,y2, style)`, `water`, `decor: { kind: (g, d, time) => void }`, optional
`renderBackground` / `renderOverlay` (weather). Terrain is baked into cached 256 px tiles.
Texture helpers in `src/art/textures.ts`: `dirtTile, brickTile, metalTile, speckleTile, grassEdge,
bandEdge, mountainLayer, hillsLayer, cloudLayer, skylineLayer, bandedGradient, darken`.

## Testing your content

1. `npm run typecheck` - must be clean.
2. `npm test` - content validation: sprite frames non-empty, levels valid & reference registered
   types/themes/songs, every entity type simulates 10 s headless (incl. death), every mission is
   completed by the autopilot headless (invincible). Must pass.
3. Visual check: `bun scripts/spritesheet.ts` for art; `node scripts/play.mjs` / `scripts/smoke.mjs` for
   in-game screenshots (start the dev server first: `npx vite --port 5173 &`). Look at the PNGs.
