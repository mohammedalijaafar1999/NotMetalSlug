// Fixed-step game loop: frame timing jitter must not make frames run 0 or 2 steps at 60 Hz
// (a visible judder), and the game speed must follow real time at other refresh rates.
import { describe, expect, it } from 'vitest';
import { accumulate, STEP } from '../src/engine/loop';

/**
 * Frame deltas of a display refreshing every `period` s whose frame timestamps are each off by
 * up to +-jitter s (deterministic pseudo-random): a late frame is followed by a short one.
 */
function deltas(n: number, period: number, jitter: number): number[] {
  let s = 12345;
  const noise = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return ((s / 4294967296) * 2 - 1) * jitter;
  };
  const out: number[] = [];
  let prev = noise();
  for (let i = 0; i < n; i++) {
    const e = noise();
    out.push(period + e - prev);
    prev = e;
  }
  return out;
}

function run(ds: number[], acc0 = STEP / 2): { hist: Record<number, number>; steps: number } {
  let acc = acc0;
  const hist: Record<number, number> = {};
  let steps = 0;
  for (const d of ds) {
    const r = accumulate(acc, d);
    acc = r.acc;
    hist[r.steps] = (hist[r.steps] ?? 0) + 1;
    steps += r.steps;
  }
  return { hist, steps };
}

describe('game loop accumulator', () => {
  it('runs exactly one step per frame on a jittery 60 Hz display', () => {
    const ds = deltas(3600, STEP, 0.004);
    // The naive accumulator (no centring) judders on the same input.
    let acc = 0;
    let judder = 0;
    for (const d of ds) {
      acc += d;
      let n = 0;
      while (acc >= STEP) {
        acc -= STEP;
        n++;
      }
      if (n !== 1) judder++;
    }
    expect(judder).toBeGreaterThan(100);
    expect(run(ds).hist).toEqual({ 1: 3600 });
    // Also from a leftover right on a step boundary (it converges within a second or so).
    const late = run(ds.slice(0, 600), 0.0001);
    expect((late.hist[0] ?? 0) + (late.hist[2] ?? 0)).toBeLessThan(12);
  });

  it('keeps game time in step with real time at other refresh rates', () => {
    for (const hz of [30, 50, 75, 120, 144]) {
      const ds = deltas(hz * 20, 1 / hz, 0.0008);
      const real = ds.reduce((a, b) => a + b, 0);
      const { steps } = run(ds);
      expect(Math.abs(steps * STEP - real), `${hz} Hz`).toBeLessThan(STEP);
    }
  });

  it('caps catch-up steps after a long stall and runs extra steps when fast-forwarded', () => {
    expect(accumulate(0, 0.2).steps).toBe(5);
    expect(accumulate(0, 0.2).acc).toBe(0);
    expect(accumulate(0, STEP * 1.01, 4).steps).toBe(4);
  });
});
