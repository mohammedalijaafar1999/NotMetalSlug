# PROGRESS fix_flow

Branch fix/flow (from claude/metal-slug-game-sogjdj). Worktree: /home/user/NotMetalSlug/.claude/worktrees/wf_94063c7d-585-2

| # | item | status |
|---|---|---|
| 1 | HUD vehicle name DRAGONFLY clipped | done (vehicleRow in hud.ts + flow test, screenshot ok) |
| 2 | WARNING banner behind boss hull | done: HUD already drew after world (pixel check), band was 60% translucent -> 86%; NEW long WARNING texts clipped (HORNET KING) -> subject on sub line + scale fit; tests |
| 3 | out player at next mission start | done: countdown again at mission start, PRESS <key> names START key, rejoin drops in beside partner (invuln), win-time out restores 1 life, safety net; tests 'out between missions' |
| 4 | charselect 2P dead end (P2 back / touch confirm) | done: P2 BOMB leaves in 2P mode, touch-only opens P2 slot + says KEYBOARD OR GAMEPAD, title hint; tests |
| 5 | lone gamepad joins as P2 when P1 on keyboard | done: InputManager.offerPadToPlayer2/p1Device/hasPadFor/resetPadSeats (title); tests 'couch setup' |
| 6 | boot: bake title/menu sprites first, rest time-sliced | done: src/scenes/preload.ts; boot->title 4x: ~6.5s -> ~0.5s (title at ~1.8s vs ~7.5s after nav); 1x: ~1.5s -> ~0.25s; background done ~4s (1x) / ~14s (4x) after title; briefing DEPLOYING bar if rushed; GameplayScene.enter finish() safety net; test 'boot' |
| 7 | touch JUMP button in side bars on wide phones | todo |
| 8 | main.ts visibilitychange duck | likely already done (main.ts has no duck) - verify |
| 9 | options persist / remap conflicts / controls+highscores layout pass | todo |

Next: item 7 (touch JUMP), 8 (verify), 9 (scripted pass), gates, final commit.
Gotchas:
