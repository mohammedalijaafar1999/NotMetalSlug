// Temporary debugging harness for mission m1 (deleted before the final commit).
import { it } from 'vitest';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';

it('debug m1 bot trace', () => {
  const w = makeWorld('m1', { seed: 1, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  const p = w.players[0];
  let last = -1;
  for (let i = 0; i < 60 * Number(process.env.SECS ?? 40); i++) {
    step(w, 1, bots);
    const fine = process.env.FINE ? i / 60 >= Number(process.env.FINE) && i / 60 < Number(process.env.FINE) + 1.2 : false;
    const t = fine ? i : Math.floor(i / 30);
    if (t !== last) {
      last = t;
      const near = w.entities
        .filter((e) => e.team === 'enemy' && e.hittable && e.onScreen(-4))
        .map((e) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}${e.dead ? 'X' : ''}`)
        .join(' ');
      console.log(`t=${(i / 60).toFixed(2)} p=${p.x.toFixed(1)},${p.y.toFixed(1)} v=${p.vx.toFixed(0)},${p.vy.toFixed(0)} g=${p.onGround} wall=${p.hitWall} st=${p.state} veh=${p.vehicle?.type ?? '-'} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} lock=${w.level.locked} near: ${near}`);
    }
  }
}, 120_000);
