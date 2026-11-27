// Throwaway probe (deleted before commit): run the m6 autopilot and log progress.
import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('probe m6', () => {
  const seed = Number(process.env.SEED ?? 1);
  const players = Number(process.env.PLAYERS ?? 1);
  const w = makeWorld('m6', { seed, god: true, players, difficulty: Number(process.env.DIFF ?? 1) as 0 | 1 | 2 });
  const bots = w.players.map((p) => new Bot(p.index));
  const max = Number(process.env.SECS ?? 600);
  let last = '';
  const events: string[] = [];
  w.on('lock', (e) => events.push(`${(w.time).toFixed(1)}s lock ${e.x}`));
  w.on('unlock', () => events.push(`${(w.time).toFixed(1)}s unlock`));
  w.on('bossStart', () => events.push(`${(w.time).toFixed(1)}s bossStart`));
  w.on('missionComplete', () => events.push(`${(w.time).toFixed(1)}s COMPLETE`));
  w.on('hostageRescued', () => events.push(`${(w.time).toFixed(1)}s rescue`));
  let i = 0;
  for (; i < max / DT && w.state !== 'complete'; i++) {
    step(w, 1, bots);
    if (i % (60 * 5) === 0) {
      const p = w.players[0];
      const v = p.vehicle ? `in ${p.vehicle.type} hp${Math.round(p.vehicle.hp)}` : '';
      const lk = w.level.activeLock ? `LOCK ${(w.level as any).activeLock.def.x} wave ${(w.level as any).activeLock.wave}` : '';
      const ens = w.entities.filter((e) => e.team === 'enemy' && !e.dead && e.blocksProgress).map((e) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}`).slice(0, 6).join(' ');
      const line = `t=${(i * DT).toFixed(0)} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} p=${Math.round(p.x)},${Math.round(p.y)} ${p.state} ${v} ${lk} | ${ens}`;
      if (line !== last) console.log(line);
      last = line;
    }
  }
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  console.log(events.join('\n'));
  console.log(`END t=${(i * DT).toFixed(1)} state=${w.state} kills=${w.stats.kills} rescues=${w.stats.rescues}`);
}, 600_000);
