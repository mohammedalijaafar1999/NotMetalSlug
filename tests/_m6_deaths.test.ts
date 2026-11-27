// Throwaway probe (deleted before commit): mortal autopilot - where does it die?
import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('deaths m6', () => {
  for (const seed of (process.env.SEEDS ?? '2').split(',').map(Number)) {
    const w = makeWorld('m6', { seed, god: false, difficulty: 1 });
    const bots = w.players.map((p) => new Bot(p.index));
    for (const p of w.players) p.profile.lives = 99;
    const deaths: number[] = [];
    w.on('playerDied', (e) => {
      deaths.push(Math.round(e.player.x));
    });
    let i = 0;
    for (; i < 1200 / DT && w.state !== 'complete'; i++) {
      step(w, 1, bots);
      if (i % (60 * 60) === 0 && i > 60 * 300) {
        const p = w.players[0];
        const lk = w.level.activeLock ? `LOCK ${(w.level as any).activeLock.def.x} wave ${(w.level as any).activeLock.wave}` : '';
        const ens = w.entities.filter((e) => e.team === 'enemy' && !e.dead && e.blocksProgress).map((e) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)} st=${(e as any).state}`).join(' ');
        console.log(`t=${(i * DT).toFixed(0)} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} p=${Math.round(p.x)},${Math.round(p.y)} ${p.state} veh=${p.vehicle?.type ?? ''} ${lk} | ${ens}`);
      }
    }
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    const buckets: Record<string, number> = {};
    for (const x of deaths) {
      const b = x < 1560 ? 'A gate' : x < 2960 ? 'B foundry' : x < 4090 ? 'C conveyor' : x < 5290 ? 'D assembly' : x < 5400 ? 'E shaft' : x < 6720 ? 'F hangar' : 'BOSS';
      buckets[b] = (buckets[b] ?? 0) + 1;
    }
    console.log(`seed ${seed}: ${w.state} t=${(i * DT).toFixed(0)} deaths=${deaths.length}`, JSON.stringify(buckets), deaths.join(','));
  }
}, 600_000);
