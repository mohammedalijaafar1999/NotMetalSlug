# PROGRESS fix_content

Branch fix/content (from claude/metal-slug-game-sogjdj). Dev server: port 5603.

| # | item | status |
|---|---|---|
| 1 | m2 backdrop/sun/pipeline perf | done (sky strip + sun image + static decor bake + cliff cull; fillRect 388->118 @1500, 637->165 @5400) |
| 2 | m6 hangar_door/searchlight, m4 lamp/firebarrel, m5 strut perf | done (door static bake + live alarm, beam baked+rotated, m6 panel walls baked, m4 glow = 3 disc blits, m5 strut staticDecor) |
| 3 | m5 lightning vs settings.flashes (+ audit) | done (m5 soft swell <=0.3, bolt no blink; m4 also unflickered; bosses use world.flash which is gated in gameplay.ts) |
| 4 | m6 ladle offscreen globs | done (launch only when stream in view, targets clamped SPLASH_EDGE inside; tests) |
| 5 | m6 crusher push-out when invulnerable | done (pushOut nearer side unless walled; test) |
| 6 | m3 CABLE CAR sign under HUD | done (terminal frame 1: sign on the facade; arrival uses f:1; screenshot artifacts/m3arr1.png) |
| 7 | FROST BASTION flak shadows darker | done (FloorMark shadow override 0.4->0.75 alpha; screenshot artifacts/flak1_zoom.png; test) |
| 8 | HORNET KING band lower | done (ALT_HIGH 94->84, ALT_MID 86->82, salvo/rain +2, phase-2 wobble capped at ALT_HIGH+2; bar-overlap samples 27%->4%; tilted carpet run still touches bar bottom ~y30-34; test) |
| 9 | m6 lift jetpack below HUD band | todo |
| 10 | HUD screenshot pass per mission | todo |

Next: item 1 measurement.

Gotchas:
