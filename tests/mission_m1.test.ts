// Mission 1 (PALM HARBOR) checks - placeholder, filled in below.
import { describe, expect, it } from 'vitest';
import { simulateMission } from './helpers';

describe('mission m1', () => {
  it('autopilot completes', () => {
    const r = simulateMission('m1', 900);
    console.log(JSON.stringify(r));
    expect(r.completed).toBe(true);
  }, 300_000);
});
