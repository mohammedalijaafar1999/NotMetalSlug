# PROGRESS qa_play (first-time player playtest of the release build)

Status: playtest done, running gates. Branch qa/play from claude/metal-slug-game-sogjdj.

## Plan
1. Cold start: loading, title, menu, char select, briefing, m1 first minutes by hand
2. Spot-check m2-m6 starts + an arena each; vehicle beat; m5 gyro
3. Boss fight GRINDER with dodging; final boss + ending glance
4. Pause/resume, die/continue, game over, name entry
5. 2P drop-in
6. Mobile touch (iPhone 13 landscape)

## Findings / fixes
- FIXED (b8c38a4) m4 opening: standing on the promenade (12 px up) your straight shots fly over the
  street guard's helmet while his rifle aims up and kills you (13 deaths in 75 s scripted). Infantry
  hurtboxes get 8 px head-room (INFANTRY_HEAD_ROOM). tests/qa_play.test.ts.
- FIXED onboarding: nothing in game says which key is FIRE/JUMP/BOMB (menus say "PRESS FIRE"). Mission 1
  shows a 9 s keycap strip at the bottom (live bindings; pad buttons; none on touch). tests/qa_play.test.ts.
- FIXED (0831b5d) the controls strip drew under the pause menu and collided with its footer.
- Checked OK: m2-m6 starts + first arenas (mortal), m5 gyro keys, BULLDOG board/drive/vulcan/
  cannon/jump/eject/re-board/destroyed, GRINDER killed mortal in ~70 s (4 deaths, fair telegraphs),
  JUGGERNAUT look + ending + name entry + high scores, pause (Esc/P/Enter/blur) + resume, continue,
  game over, 2P drop-in (RShift, shared keys banner, strip updates), iPhone 13 landscape touch
  (start by taps, stick + buttons, pause button).
- Checked OK: cold start 0.5 s to title, menu, char select, briefing, m1 first 2 min by keyboard
  (HMG from hostage, bomb crate, arenas 1-3, BULLDOG boarded, knife+grenades used).

## Known issues (unconfirmed)
