import { it } from 'vitest';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('diag', () => {
  const seed = Number(process.env.SEED ?? 1);
  const w = makeWorld('bosstest_m2', { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  for (let i = 0; i < 60 * 300 && w.state !== 'complete'; i++) {
    step(w, 1, bots);
    const b: any = w.boss;
    if (b && i % 60 === 0) {
      const dl = Object.fromEntries(Object.entries(b.dmgLog).map(([k, v]: any) => [k, Math.round(v)]));
      console.log(`${(i / 60).toFixed(0)}s st=${b.state} ph=${b.phase} hp=${b.hp.toFixed(0)}/${b.maxHp} x=${b.x.toFixed(0)} y=${b.y.toFixed(0)} p=${w.players[0].x.toFixed(0)} cam=${w.camera.x.toFixed(0)} dmg=${JSON.stringify(dl)}`);
    }
  }
  console.log('state', w.state, 'time', w.stats.time.toFixed(1), 'attacks', (w as any).bossLog);
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}, 120000);
