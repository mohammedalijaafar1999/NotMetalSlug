# PROGRESS fix_content

Branch fix/content (from claude/metal-slug-game-sogjdj). Dev server: port 5603.

| # | item | status |
|---|---|---|
| 1 | m2 backdrop/sun/pipeline perf | done (sky strip + sun image + static decor bake + cliff cull; fillRect 388->118 @1500, 637->165 @5400) |
| 2 | m6 hangar_door/searchlight, m4 lamp/firebarrel, m5 strut perf | done (door static bake + live alarm, beam baked+rotated, m6 panel walls baked, m4 glow = 3 disc blits, m5 strut staticDecor) |
| 3 | m5 lightning vs settings.flashes (+ audit) | todo |
| 4 | m6 ladle offscreen globs | todo |
| 5 | m6 crusher push-out when invulnerable | todo |
| 6 | m3 CABLE CAR sign under HUD | todo |
| 7 | FROST BASTION flak shadows darker | todo |
| 8 | HORNET KING band lower | todo |
| 9 | m6 lift jetpack below HUD band | todo |
| 10 | HUD screenshot pass per mission | todo |

Next: item 1 measurement.

Gotchas:
