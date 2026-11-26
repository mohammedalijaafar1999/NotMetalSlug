// TEMP diagnostics: who hits the turrets?
import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { FrostBastion } from '../src/content/bosses/boss_m3';

it('diag3', () => {
  const w = makeWorld('bosstest_m3', { seed: 1, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let t = 0;
  let hooked = false;
  const hits: Record<string, number> = {};
  while (t < 30 && w.state !== 'complete') {
    step(w, 1, bots);
    t += DT;
    const b = w.boss as FrostBastion | null;
    if (b && !hooked && b.turrets.length) {
      hooked = true;
      for (const tr of b.turrets) {
        const orig = tr.damage.bind(tr);
        tr.damage = (d) => {
          const k = `${tr.kind} ${d.kind} owner=${d.owner?.constructor?.name} y=${Math.round((d.y ?? 0) - b.groundY)} x=${Math.round((d.x ?? 0) - b.face)}`;
          hits[k] = (hits[k] ?? 0) + 1;
          return orig(d);
        };
      }
    }
  }
  console.log(Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 30));
}, 60_000);
