# PROGRESS review_av (audio, rendering, performance)

Branch review/av. Tools in artifacts/ (gitignored): perf.mjs (fps/step/render at 4x throttle, --prof=1
writes .cpuprofile), profsum.mjs / profcallers.mjs (profile summaries), count_calls.mjs + survey.sh
(canvas calls per frame by bucket), exp_frame.mjs, verify_platforms.mjs, verify_text.mjs.
Dev server: npx vite --port 5506 --strictPort.

## Baseline (4x CPU throttle, headless SwiftShader, 2P autopilot, boss fights)
m1 56.2 fps, m2 54.7, m3 58, m4 54.4, m5 58.3, m6 48.7 (p95 frame 33 ms). Render ~9-14 ms avg,
steps ~1 ms. Present (buffer flush) 39% of main thread; HUD text 10%.

## Findings
1. [fixed] HUD text: ~440 drawImage/frame (outlined text = 9 blits per glyph). font.ts whole-string
   cache (baked on 2nd request, LRU 320). Now ~20/frame. Pixel-identical (verify_text.mjs) except
   alpha-faded outlined text, which now fades uniformly (old: 8 stacked outline copies stayed dark).
2. [fixed] Particles: debris used save/translate/rotate/restore per particle; sparks/rings were
   anti-aliased strokes; list.shift() at cap; new array every step. effects.ts: rect-based crisp
   debris/sparks, cached pixel rings, in-place compaction.
3. [fixed] Sprites: flipped draws used save/translate/scale/restore; now cached mirrored canvases.
4. [fixed] Platforms drawn pixel-by-pixel by themes every frame (m2 up to 932 fillRect/frame, m5 292).
   theme.ts bakes static platforms once (crop by alpha bbox; falls back to live drawing if art may be
   clipped). Pixel-identical (verify_platforms.mjs).

## Next
- re-measure perf; renderer present (skip per-frame full clear; prebake CRT overlay)
- loop: fixed-step jitter (0/2 steps per frame)
- audio: offline analysis of SFX + songs; pause duck vs tab visibility bug (main.ts duck(false) on
  visible un-ducks the pause menu)
- rendering: seams/sub-pixel, CRT alignment with non-integer scale, shake/flash options
- outsideIssues: m6 decor hangar_door ~700-2600 fillRect/frame, searchlight 172; m4 lamp 194-291

## Gotchas
- headless canvas is GPU (SwiftShader); drawImage calls are deferred, the flush shows up in present().

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP review_av: salvaged after interruption'. Review them (git show --stat HEAD), keep what is good, delete throwaway files, and continue.
