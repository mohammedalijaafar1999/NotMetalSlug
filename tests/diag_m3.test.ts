// TEMP diagnostics for boss_m3 tuning (deleted before commit).
import { it } from 'vitest';
import { makeWorld, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { FrostBastion } from '../src/content/bosses/boss_m3';

it('diag', () => {
  const w = makeWorld('bosstest_m3', { seed: 1, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let t = 0;
  let spawnT = -1;
  let last = -1;
  let shots = 0;
  w.on('bossStart', () => (spawnT = t));
  while (t < 300 && w.state !== 'complete') {
    step(w, 1, bots);
    t += DT;
    const b = w.boss as FrostBastion | null;
    if (b && Math.floor(t) !== last) {
      last = Math.floor(t);
      const p = w.players[0];
      let nearest: any = null;
      let nd = Infinity;
      for (const e of w.targets('player')) {
        if (e.team !== 'enemy' || !e.onScreen(-4)) continue;
        const d = Math.hypot(e.cx - p.cx, e.cy - p.cy);
        if (d < nd) {
          nd = d;
          nearest = e;
        }
      }
      if (last % 3 === 0)
        console.log(`  shots=${w.stats.shotsFired} nearest=${nearest?.type}/${nearest?.constructor?.name} at ${nearest ? (nearest.cx - w.camera.x).toFixed(0) + ',' + nearest.cy.toFixed(0) : ''} bullets=${w.query((e: any) => e.constructor.name === 'Bullet').length}`);
      if (last % 3 === 0)
        console.log(
          `t=${t.toFixed(1)} hp=${b.hp.toFixed(1)}/${b.maxHp} ph=${b.phase} mode=${b.mode} core=${b.coreK.toFixed(2)} px=${(p.x - w.camera.x).toFixed(0)} face=${(b.face - w.camera.x).toFixed(0)} facing=${p.facing} crouch=${p.crouching} log=${JSON.stringify(b.dmgLog)} turrets=${b.turrets.map((x) => (x.dead ? 'X' : x.hp)).join(',')}`,
        );
    }
  }
  console.log('spawn', spawnT.toFixed(1), 'end', t.toFixed(1), 'state', w.state, shots);
}, 60_000);
