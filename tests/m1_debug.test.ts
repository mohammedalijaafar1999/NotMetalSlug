// Temporary debugging harness for mission m1 (deleted before the final commit).
import { it } from 'vitest';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';

it('debug m1 bot trace', () => {
  const w = makeWorld('m1', { seed: Number(process.env.SEED ?? 1), god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  const p = w.players[0];
  if (process.env.WARP) {
    step(w, 30, bots);
    (w.level as any).warp(Number(process.env.WARP));
    p.x = Number(process.env.WARP) + 60;
    p.y = 0;
    if (process.env.TANK) {
      step(w, 60, bots);
      const v = w.spawn('tank', p.x + 4) as any;
      step(w, 2);
      v.enter(p);
    }
  }
  let last = -1;
  const every = Number(process.env.EVERY ?? 1);
  for (let i = 0; i < 60 * Number(process.env.SECS ?? 40); i++) {
    step(w, 1, bots);
    const t = Math.floor(i / (60 * every));
    if (t !== last) {
      last = t;
      const near = w.entities
        .filter((e) => e.team === 'enemy' && e.hittable && (process.env.ALL ? true : e.onScreen(40)))
        .map((e) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}${(e as any).state ? ':' + (e as any).state : ''}${e.blocksProgress ? 'B' : ''}`)
        .join(' ');
      console.log(
        `t=${(i / 60).toFixed(2)} p=${p.x.toFixed(0)},${p.y.toFixed(0)} g=${p.onGround} st=${p.state} veh=${p.vehicle?.type ?? '-'}${p.vehicle ? ':' + p.vehicle.hp : ''} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} lock=${w.level.locked} k=${w.stats.kills} | ${near}`,
      );
    }
  }
}, 120_000);
