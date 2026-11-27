# review/flow progress (front-end, game flow, meta)

Branch review/flow from claude/metal-slug-game-sogjdj. Dev server: port 5501. Throwaway scripts in artifacts/
(artifacts/lib.mjs helpers, s1_title, s2_start, s3_chain = whole m1-m6 chain at 10x, s4_pause, s5_options, s6_touch).
Artifacts are backed up in /home/user/review-artifacts/review_flow/ (copy back with cp -rn).

Baseline: typecheck clean, 618 tests green. Now 634 (tests/flow.test.ts).

## Findings
| # | sev | status | finding |
|---|---|---|---|
| F1 | major | fixed | Focus loss: blur clears keys but did not pause; touch stick/buttons stayed held; visibility handler un-ducked music under the pause menu |
| F2 | major | fixed | Solo-layout extras overrode remapped P1 keys (remap fire=X, jump=Z -> both keys did both) |
| F3 | minor | fixed | Ending squad dropped a member when P2 picked a different character |
| F4 | minor | fixed | Drop-in during the gyro mission: no spawn invulnerability |
| F5 | minor | fixed | P2 keyboard drop-in silently moved P1 to WASD/JKL (now a banner hint) |
| F6 | major | fixed | Keys held across a scene change re-triggered (pause could not be closed with ESC) |
| F7 | minor | fixed | Ending: Enter skipped everything, smoke left over, flash option ignored, roll overlapped squad |
| F8 | minor | fixed | Tally hostage row graded against the wrong total |
| F9 | minor | fixed | FPS counter overlapped menu footers; remap gave no warning when stealing P2's key |
| F10 | minor | fixed (salvaged, re-verified on iPhone 13 both orientations) | Touch: taps shorter than a frame were lost; buttons ignored safe areas; prompts said FIRE/START on touch |
| F11 | minor | fixed | Drop-in: P2 landed exactly on top of P1 (same x), hidden behind P1 |
| F12 | polish | fixed | Join prompt said 2P PRESS START on keyboard; now names P2's START key (RSHIFT) |
| F13 | major | fixed | A pause key (Enter/P) remapped to a game action (JUMP on Enter) paused the game on every press |

## Verified OK this session
gamepad stub (menus, A/X/Y/B/Start, P2 drop-in with 2nd pad), localStorage throwing (boot->options->play->
game over->name entry->title, no errors), dist file:// to the first lock, odd window sizes (crisp, no scroll),
mouse hover/click/value click, drop-in during the m1 boss + P2 out + P2 continue.

## Chain
m1->m6->ending->name entry->high scores->title at 10x: no errors (artifacts/chain2.log).

## Next steps
- chain3 (dist file://) result, gates, final commit
