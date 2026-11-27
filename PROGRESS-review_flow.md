# review/flow progress (front-end, game flow, meta)

Branch review/flow from claude/metal-slug-game-sogjdj. Dev server: port 5501. Throwaway scripts in artifacts/
(artifacts/lib.mjs helpers, s1_title, s2_start, s3_chain = whole m1-m6 chain at 10x).

Baseline: typecheck clean, 618 tests green.

## Findings
| # | sev | status | finding |
|---|---|---|---|
| F1 | major | open | Focus loss: blur clears keys but does not pause; touch stick/buttons stay held; visibility handler un-ducks music under the pause menu |
| F2 | major | open | Solo-layout extras override remapped P1 keys (remap fire=X, jump=Z -> both keys do both) |
| F3 | minor | open | Ending squad drops a member when P2 picks a different character (P2 char shown twice) |
| F4 | minor | open | Drop-in during the gyro mission: no spawn invulnerability (vehicle entered directly) |
| F5 | minor | open | P2 keyboard drop-in mid-mission silently moves P1 from arrows/ZXC to WASD/JKL (no hint) |

## Next steps
- chain run results (artifacts/chain.log), then fixes + tests/flow.test.ts
- touch (iPhone 13), gamepad stub, storage throwing, dist file://, options persistence

## Interrupted (usage limit)
- The previous attempt was cut off; its uncommitted files were committed as 'WIP review_flow: salvaged after interruption'. Review them (git show --stat HEAD), keep what is good, delete throwaway files, and continue.
