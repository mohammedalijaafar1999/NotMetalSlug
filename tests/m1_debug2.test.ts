// Temporary: does walking off a static solid's right edge work? (deleted before the final commit)
import { it } from 'vitest';
import { makeWorld, step } from './helpers';
import { input } from '../src/engine/input';

it('walk off solid', () => {
  const w = makeWorld('m1', { seed: 1, god: true });
  const p = w.players[0];
  step(w, 30);
  (w.level as any).warp(900);
  p.x = 1056;
  p.y = 284;
  p.vy = 0;
  for (let i = 0; i < 40; i++) {
    input.setVirtual(0, { right: true });
    step(w, 1);
    console.log(i, p.x.toFixed(1), p.y.toFixed(1), p.onGround, p.hitWall);
  }
  input.setVirtual(0, null);
});
