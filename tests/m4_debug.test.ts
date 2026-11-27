// TEMPORARY debug sim for mission 4 (delete before the final commit).
import { it } from 'vitest';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';

it('m4 debug timeline', () => {
  const seed = Number(process.env.M4SEED ?? 1);
  const w = makeWorld('m4', { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let respawns = 0;
  const p = w.players[0];
  let lastState = p.state;
  const log: string[] = [];
  let lastCam = -1;
  let lastProg = 0;
  let lockLog = '';
  const T = Number(process.env.M4T ?? 900);
  let i = 0;
  for (; i < T * 60 && w.state !== 'complete'; i++) {
    step(w, 1, bots);
    if (p.state === 'respawn' && lastState !== 'respawn') {
      respawns++;
      log.push(`t=${(i / 60).toFixed(1)} respawn #${respawns} at x=${Math.round(p.x)} cam=${Math.round(w.camera.x)}`);
    }
    lastState = p.state;
    if (w.camera.x > lastCam + 1) {
      lastCam = w.camera.x;
      lastProg = i;
    }
    const ls = w.level.lockStates().map((l) => `${l.x}:${l.state[0]}`).join(' ');
    if (ls !== lockLog) {
      lockLog = ls;
      log.push(`t=${(i / 60).toFixed(1)} cam=${Math.round(w.camera.x)} locks ${ls} veh=${p.vehicle ? p.vehicle.type : '-'}`);
    }
    if (i % (60 * 20) === 0) log.push(`t=${(i / 60).toFixed(0)} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} p=${Math.round(p.x)},${Math.round(p.y)} st=${p.state} veh=${p.vehicle ? p.vehicle.type : '-'} kills=${w.stats.kills} rescues=${w.stats.rescues} ents=${w.entities.length}`);
    if (i - lastProg > 60 * 60) {
      const a = w.level.activeLock as any;
      const alive = a ? a.tracked.filter((e: any) => !e.dead && e.blocksProgress).map((e: any) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)} st=${e.state} hit=${e.hittable}`) : [];
      const c: any = p.vehicle ?? p;
      log.push(`STUCK t=${(i / 60).toFixed(0)} cam=${Math.round(w.camera.x)} p=${Math.round(p.x)},${Math.round(p.y)} veh=${p.vehicle?.type} ctrl=${Math.round(c.x)},${Math.round(c.y)} onG=${c.onGround} wall=${c.hitWall} vx=${Math.round(c.vx)} vy=${Math.round(c.vy)} lock=${a?.def.x} wave=${a?.wave} alive=${alive.join(' | ')}`);
      const near = w.entities.filter((e: any) => Math.abs(e.x - c.x) < 120 && !e.dead).map((e: any) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}`);
      log.push('near: ' + near.join(' '));
      break;
    }
  }
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  log.push(`END t=${(i / 60).toFixed(0)} state=${w.state} cam=${Math.round(w.camera.x)} kills=${w.stats.kills} rescues=${w.stats.rescues} respawns=${respawns}`);
  console.log(log.join('\n'));
}, 600_000);
