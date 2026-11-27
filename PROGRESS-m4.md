# PROGRESS m4 - delete when done

## Done
- Branch wave2/m4, boss merged (wave2/boss_m4).
- Theme 'm4' registered (src/content/themes/m4.ts): art.ts (palette, textures, parallax incl. openArt),
  weather.ts (background w/ BASE_CAM_Y=0, near-layer underfill, 'openharbour' zones; rain overlay),
  decor.ts (16 kinds: lamp bollard tires fender net wreck firebarrel crates sign crane container
  warehouse canal ship fence drydock keelblocks deepwater openharbour).
- Mission entities (src/content/levels/m4/): m4_harbor (deep-water splashes), m4_pontoon (bobbing
  one-way deck), m4_magnet (gantry magnet takes the tank at x 3420), m4_bridge (lift bridge over the
  slip in lock 4, lowers on the last wave).
- Level 'm4' (src/content/levels/m4.ts): 7400 x 352, 5 locks (canal ambush, warehouse yard, dry
  dock, slip gauntlet, boss), 11 hostages, dry dock vertical section with camera keys.
- Headless autopilot completes in ~200 s (tests/m4_debug.test.ts = TEMPORARY, delete before final).
- Browser checks done: all sections, magnet, bridge, lock 1, boss fight. Pontoons brightened,
  dry dock hull reshaped, underwater canal wall.

## Next
- tests/mission_m4.test.ts (level validity + contract, autopilot completes, mechanics).
- Full npm test + typecheck; smoke.mjs --missions=4; final polish; delete PROGRESS + debug test.

## Gotchas
- Scratchpad is shared with other agents: prefix helper files with m4_ (png.ts is shared; keep its
  API: writePng(out,img,W,H,scale), blend(dst,src,alpha)). Scripts: m4_shots.mjs, m4_scn.mjs,
  m4_montage.py, m4_sheet.ts, m4_preview.ts.
- Debug warp skips spawns whose trigger is inside the warped view (pontoons/magnet!): warp earlier.
- Riflemen only advance while > 170 px away: left-side wave entrants must spawn inside the view.
- Enemies don't step down ledges > 24 px; frogmen in water are only hittable by knife/grenades/
  jump-shots (bot uses knife when they surface within ~30 px: wave frogmen use range 28).
- Gunboats need water <= 4 px below the street to be hit by crouch shots (canals at y 182).
