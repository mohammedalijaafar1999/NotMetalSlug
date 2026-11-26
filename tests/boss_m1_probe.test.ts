import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('probe', () => {
  const w = makeWorld('bosstest_m1', { seed: 1, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let boss: any = null;
  let t = 0;
  let lastPh = -1;
  const log: string[] = [];
  let lastState = '';
  for (let i = 0; i < 300 / DT && w.state !== 'complete'; i++) {
    step(w, 1, bots);
    t += DT;
    if (!boss && w.boss) {
      boss = w.boss;
      log.push(`boss spawned t=${t.toFixed(1)}`);
    }
    if (boss) {
      if (boss.phase !== lastPh) {
        lastPh = boss.phase;
        log.push(`phase ${boss.phase} t=${t.toFixed(1)} hp=${boss.hp.toFixed(0)}/${boss.maxHp}`);
      }
      if (boss.state !== lastState) {
        lastState = boss.state;
        if (log.length < 200) log.push(`  ${t.toFixed(1)} ${boss.state} hp=${boss.hp.toFixed(0)} px=${w.players[0].x.toFixed(0)}`);
      }
    }
  }
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  log.push(`done t=${t.toFixed(1)} state=${w.state} dmg=${JSON.stringify(boss?.dmgLog)}`);
  console.log(log.join('\n'));
}, 120000);
