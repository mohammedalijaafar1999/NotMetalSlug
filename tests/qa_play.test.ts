// Regression tests for problems found in the first-time-player playtest of the release build.
import { describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import { input } from '../src/engine/input';
import type { LevelDef } from '../src/game/level';
import type { Enemy } from '../src/game/enemy';

/** Flat ground with a 12 px step down at x 300-312 (m4's promenade above the street). */
const STEP: LevelDef = {
  id: 'qa_step',
  mission: 0,
  name: 'STEP',
  theme: 'default',
  music: 'm1',
  width: 900,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 168],
      [300, 168],
      [312, 180],
      [900, 180],
    ],
  ],
};

/** Player standing at x on the upper step, firing the pistol straight ahead for `frames`. */
function shootFromStep(type: string, ex: number, crouch: boolean, frames = 240): { killed: boolean; py: number; ey: number } {
  const w = makeWorld(STEP, { god: true });
  const p = w.players[0];
  p.x = 250;
  step(w, 90);
  p.invuln = 0;
  const e = w.spawn(type, ex, undefined, { behavior: 'guard', facing: -1 }) as Enemy;
  step(w, 2);
  let fire = false;
  for (let i = 0; i < frames && !e.dying && !e.dead; i++) {
    fire = !fire;
    input.setVirtual(0, { fire, down: crouch });
    p.facing = 1;
    step(w, 1);
  }
  input.setVirtual(0, null);
  return { killed: e.dying || e.dead, py: p.y, ey: e.y };
}

describe('straight shots reach a soldier one step below', () => {
  for (const crouch of [false, true]) {
    it(`pistol from a 12 px higher ledge kills a guard on the street (crouch=${crouch})`, () => {
      const r = shootFromStep('rifleman', 420, crouch);
      expect(r.ey - r.py).toBe(12);
      expect(r.killed).toBe(true);
    });
  }

  it('the same holds for other infantry on the street (bazooka, officer)', () => {
    for (const t of ['bazooka', 'officer']) expect(shootFromStep(t, 430, false).killed, t).toBe(true);
  });
});
