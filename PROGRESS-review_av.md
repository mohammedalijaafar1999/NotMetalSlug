# PROGRESS review_av (audio, rendering, performance)

Branch review/av. Tools in artifacts/ (gitignored; copy kept in /home/user/review-artifacts/review_av/):
perf.mjs (fps at 4x throttle, --prof=1), profsum.mjs, count_calls.mjs, stepjitter.mjs, sfx_analyze.ts
(bun), song_analyze.mjs, music_flow.mjs, render_check.mjs, mem_check.mjs, load_check.mjs, boot_prof.mjs.
Dev server: npx vite --port 5506 --strictPort. NOTE: after editing a src file the app imports it as
`/src/...ts?t=NNN`; scripts must import that URL (see music_flow.mjs) or they get a separate instance.

## Done (all committed)
1. HUD text cache (font.ts), particles (effects.ts), mirrored sprite cache (sprites.ts), baked
   static platforms (theme.ts) - previous attempt, re-verified: tests green.
2. Renderer present: no per-frame letterbox clear, CRT overlay baked per display size, scanlines
   aligned to low-res rows at non-integer scales (render_check.mjs: runs 1px+2/3px per row, no moire).
3. Nested music ducking (audio.ts): tab hidden/visible no longer un-ducks an open pause menu.
   Verified in browser (music_flow.mjs) + tests/audio.test.ts.
4. Loop: centred accumulator (loop.ts accumulate()): 0/2-step judder frames 39/721 -> 0/721.
   tests/loop.test.ts.

## Measurements (4x CPU throttle, headless SwiftShader, 2P autopilot)
Boss fights: m1 53, m2 57, m3 56, m4 56, m5 58, m6 49.6 fps. Arena: m2 51, m4 57, m6 59.5.
Spam (2P HMG+flame, explosions every 250 ms): m2 42.9 (bg fillRects of m2 backdrop dominate),
m4 52, m6 58. Memory: heap plateaus ~15 MB over 2 rounds of m1-m6, listeners stable.
First load (single file): 1.8 s unthrottled, 7.5-8.5 s at 4x (sprite baking 72%: art generation 51%,
toCanvas 20%). Music flow title>select>briefing>m1>boss>mission_complete>tally correct.
Songs: peaks <=1.2 pre-bus, loudness within ~3.6 dB (m4 quietest, boss loudest). SFX: no clipping
(soft clip), DC up to -0.06 in pulse-wave blips (duty<0.5), tails fine.

## Next
- font style atlas for uncached strings (n blits instead of 9n), particle off-screen culling
- outsideIssues: m2 backdrop ~175-300 fillRect/frame + decor.pipeline 130; m6 hangar_door/searchlight;
  m4 lamp; m5 sky lightning ignores settings.flashes; boot bakes every sprite before the title.
