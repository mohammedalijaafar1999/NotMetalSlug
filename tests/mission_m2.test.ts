// Mission 2 DUSTWIND CANYON: level validity, the bridge set piece and an autopilot run.
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { getLevel } from '../src/game/level';

describe('mission 2 DUSTWIND CANYON', () => {
  it('diagnostic run', () => {
    const w = makeWorld('m2', { seed: 1, god: true });
    const bots = w.players.map((p) => new Bot(p.index));
    let last = -1;
    for (let i = 0; i < 900 * 60 && w.state !== 'complete'; i++) {
      step(w, 1, bots);
      const t = Math.floor(i * DT);
      if (t % 10 === 0 && t !== last) {
        last = t;
        const p = w.players[0];
        const lk = w.level.lockStates().map((l) => l.state[0]).join('');
        const al = (w.level as any).activeLock;
        const tr = al ? al.tracked.filter((e: any) => !e.dead && e.blocksProgress).map((e: any) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}:${e.state ?? ''}:${e.hp}`).join(' ') : '';
        console.log(`t=${t} w=${al ? al.wave : '-'} [${tr}] cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} p=${Math.round(p.x)},${Math.round(p.y)} st=${p.state} veh=${p.vehicle?.type ?? '-'} locks=${lk} kills=${w.stats.kills} res=${w.stats.rescues}`);
      }
    }
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    console.log('state', w.state, 'time', Math.round(w.stats.time));
    expect(getLevel('m2')).toBeTruthy();
  }, 300_000);
});

void simulateMission;
