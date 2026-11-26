// TEMP diagnostics: where do the autopilot's bullets end?
import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { FrostBastion } from '../src/content/bosses/boss_m3';

it('diag2', () => {
  const w = makeWorld('bosstest_m3', { seed: 1, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let t = 0;
  const last = new Map<any, { x: number; y: number; vx: number; vy: number }>();
  const ends: Record<string, number> = {};
  while (t < 60 && w.state !== 'complete') {
    step(w, 1, bots);
    t += DT;
    const b = w.boss as FrostBastion | null;
    for (const [e, pos] of last) {
      if (e.dead) {
        if (b && b.mode === 'open' && t > 15) {
          const key = `x=${Math.round((pos.x - b.face) / 4) * 4} y=${Math.round(pos.y - b.groundY)} v=${Math.round(pos.vx)},${Math.round(pos.vy)}`;
          ends[key] = (ends[key] ?? 0) + 1;
        }
        last.delete(e);
      }
    }
    for (const e of w.query((q: any) => q.constructor.name === 'Bullet')) last.set(e, { x: e.x, y: e.y, vx: e.vx, vy: e.vy });
  }
  console.log(Object.entries(ends).sort((a, b) => b[1] - a[1]).slice(0, 30));
}, 60_000);
