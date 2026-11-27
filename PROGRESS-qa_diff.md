# PROGRESS qa_diff

Adversarial regression review of src changes since 6d01179.

## Status
- [x] heavy fuzz run 1: 1 violation (m5 seed 5044, gyro dragged through a hull) -> FIXED (efff7e3)
- [x] input.ts (reset/flush, focus loss, pad seats, offer, touch layout) - no bug confirmed
- [x] loop.ts accumulator (negative/zero dt, 120 Hz, 59 Hz) - OK
- [x] font.ts caches (bounded, key complete) - OK
- [x] renderer.ts (safe-area fit, CRT overlay, bars) - OK
- [x] player.ts (respawn, dropIn, safeX, kill, finishDeath) - OK in browser + headless
- [x] projectile.ts sweep (measured: no enemy shots newly stopped) - OK
- [x] hostage.ts / infantry.ts / machines common / tank - read, no bug confirmed
- [x] effects/theme/bake caches - bounded, keyed correctly
- [x] scenes: drop-in m5 (one gyro each), blur during boss -> pause, visibility -> pause
- [ ] heavy fuzz run 2 (artifacts/fuzz-heavy2.log)
- [ ] gates: typecheck, test, build, smoke --dist

## Findings
1. FIXED: flying vehicle squeezed between the rising/diving view edge and a hull was nudged
   through the hull by m5 Airspace.unstick and could get trapped on a floor inside it
   (tests/qa_diff.test.ts).
