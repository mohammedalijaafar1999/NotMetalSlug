# IRON RUCKUS

An original arcade run-and-gun shooter for the browser. Six missions across a captured island
chain, hostages to free, vehicles to hijack, screen-filling bosses and drop-in 2-player co-op.
Every sprite is procedural pixel art drawn in code, and every sound effect and song is
synthesized at runtime. There are no image or audio files and no runtime dependencies.

The Rustcoat Legion of Marshal Vortigern Gristle has seized Puerto Pólvora and its mechanics.
The Ruckus Squad is going in.

## Play

```bash
npm install
npm run dev        # then open http://localhost:5173
```

You can also play the single-file build: `npm run build`, then open `dist/iron-ruckus.html`
directly in a browser. It works offline.

### Controls

| Action | Player 1 (solo) | Player 1 (2P keyboard) | Player 2 | Gamepad |
|---|---|---|---|---|
| Move / aim | Arrows or WASD | WASD | Arrows | D-pad / left stick |
| Fire | Z or J | J | Numpad 1 or , | X / Y / RT |
| Jump | X, Space or K | K | Numpad 2 or . | A |
| Bomb | C or L | L | Numpad 3 or / | B / bumpers |
| Start / pause | Enter, Esc or P | Enter | Numpad Enter or Right Shift | Start |

- Aim up with UP. Aim down with DOWN while airborne. Crouch with DOWN on the ground.
- Drop through a platform with DOWN + JUMP.
- When an enemy is close, FIRE turns into a knife attack.
- Climb into a parked vehicle with DOWN. Eject with DOWN + JUMP.
- Player 2 can join at any time by pressing START. When all lives are gone, you have 10 seconds
  to continue.
- Every key can be remapped under Options. Touch controls appear automatically on touch screens.

### Features

- **4 soldiers**, each with a perk: Dex, Juno, Brick and Mika.
- **8 weapons**, each from a lettered crate: pistol, heavy machine gun, rocket launcher, shotgun,
  flame shot, laser, chaser missiles and bouncer. There are also grenades and fire bombs.
- **3 vehicles**: the BULLDOG mini-tank, the STRIDER walker and the DRAGONFLY gyrocopter.
- **Enemies**: 13 infantry types (riflemen, grenadiers, riot shields, bazookas, sabers,
  paratroopers, mortar crews, snipers, flametroopers, jetpacks, frogmen, officers and clockwork
  robots) and 11 war machines (tanks, helicopters, turrets, jeeps, drones, fighters, snowmobiles,
  gunboats, bunkers, troop trucks and airship turrets).
- **6 missions**: Palm Harbor, Dustwind Canyon, Frostbite Pass, Rustwater Docks, Stormfront and
  the Iron Citadel. Each one has its own theme, music and boss: GRINDER, HORNET KING, FROST
  BASTION, LEVIATHAN, THUNDERHEAD and the JUGGERNAUT.
- **Arcade structure**: hostage rescues, score items, a checkpoint timer, an end-of-mission tally
  with ranks, high scores with name entry, mission select and an ending.
- **Options**: separate volumes and an announcer voice, three difficulties, 1-5 lives, timer,
  screen shake, flashes, a CRT filter, pixel-perfect scaling and key remapping.

## Development

```bash
npm run typecheck  # TypeScript strict
npm test           # engine, content validation, and headless autopilot runs of every mission and boss
npm run build      # dist/ plus dist/iron-ruckus.html (one self-contained file)
npm run smoke      # play every mission in Chromium with the autopilot (needs the dev server)
```

Debug URL parameters include `?mission=N`, `?level=<id>`, `?autoplay=1`, `?invincible=1`,
`?2p=1`, `?chars=dex,juno`, `?give=<weapon>`, `?spawn=<type>@<x>`, `?warp=<x>` and `?mute=1`.
`window.__game` exposes a test and debug API.

Documentation:
- `docs/DESIGN.md`: the game design.
- `docs/ARCHITECTURE.md`: engine and content contracts.
- `docs/CONTENT.md`: every placeable entity, with its props and placement rules.
- `docs/LEVEL_DESIGN.md`: how missions are built.

Layout:
- `src/engine`: loop, renderer, input, audio, pixel-art rasterizer, sprites, font and storage.
- `src/game`: world, terrain, camera, entities, player, weapons, vehicles, levels, themes and HUD.
- `src/content`: enemies, machines, vehicles, props, weapons, bosses, themes, levels, SFX and music.
  These modules are auto-registered.
- `src/scenes`: title, menus, character select, briefing, gameplay, tally, game over and ending.

All characters, art, music and story are original.
