// Temporary: robustness across seeds / difficulty / 2 players (deleted before the final commit).
import { it } from 'vitest';
import { makeWorld, simulateMission, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('seeds', () => {
  for (let seed = 1; seed <= Number(process.env.SEEDS ?? 0); seed++) {
    const r = simulateMission('m1', 900, seed);
    console.log(seed, r.completed, r.seconds, 'kills', r.kills, 'rescues', r.rescues, r.completed ? '' : JSON.stringify(r));
  }
}, 600_000);

it('2 players and difficulties', () => {
  for (const [players, difficulty] of [
    [2, 1],
    [1, 2],
    [1, 0],
    [2, 2],
  ] as const) {
    const w = makeWorld('m1', { players, difficulty, seed: 4, god: true });
    const bots = w.players.map((p) => new Bot(p.index));
    let i = 0;
    for (; i < 900 * 60 && w.state !== 'complete'; i++) step(w, 1, bots);
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    console.log(`players=${players} diff=${difficulty} complete=${w.state === 'complete'} t=${Math.round(i / 60)} cam=${Math.round(w.camera.x)} locks=${JSON.stringify(w.level.lockStates().map((l) => l.state))}`);
  }
}, 600_000);
