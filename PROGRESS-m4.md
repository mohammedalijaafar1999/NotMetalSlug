# PROGRESS m4 - delete when done

## Done
- Branch wave2/m4 created, boss merged (wave2/boss_m4).
- Salvaged theme art kept: src/content/themes/m4/art.ts (palette P4, quay/curb/brick/coping textures,
  cloud/skyline/harbour/near parallax art, m4Platform 'pier'/'catwalk'), weather.ts (background
  renderer with lightning + blinking lights, rain/splash/ripple overlay).

## Plan
- Level height 352 (216 + 136): normal ground y=180 with camera top 0; the vertical section goes DOWN
  into a dry dock (floor y~320) with camera keys. Boss arena at the end keeps the literal contract
  (dock y=180, camera top 0). Background base camera y must be 0 (not level.height-216).
- Deep water = pits (no ground) with deadly water drawn over them (the engine does not kill in
  deadly water; falling below killY does). Canal backdrop decor drawn behindTerrain.
- Mission entities (src/content/levels/m4/): m4_harbor (splash FX when actors fall into deep water),
  m4_pontoon (bobbing floating platform), m4_magnet (crane magnet that snatches the tank at the end
  of the warehouse district - the bot never ejects, so the vehicle must be taken from it).
- Sections: promenade (0-760) -> canal + frogmen lock -> tank beat in warehouses (lock) -> magnet ->
  dry dock (vertical) + canals/pontoons + container stacks -> gauntlet lock (basin: gunboats, heli)
  -> calm pier -> boss lock (L = width-440).

## Gotchas
- Scratchpad is shared with other agents: prefix helper files with m4_ (png.ts is shared; keep its
  API: writePng(out,img,W,H,scale), blend(dst,src,alpha)).
- Bot: jumps on wall/stuck/gap (floorAhead 14px, 60 drop); lock zone centre = cam.x+0.4*384 (boss
  0.25) - must be solid ground in every arena. Never ejects from vehicles.
