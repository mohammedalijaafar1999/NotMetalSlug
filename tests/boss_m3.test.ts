// FROST BASTION (boss_m3): intro invulnerability, armoured doors vs exposed core, phases,
// fairness of the core attacks and an autopilot kill in the test arena.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import type { World } from '../src/game/world';
import type { Player } from '../src/game/player';
import { FrostBastion, FACE_X, LANCE_H } from '../src/content/bosses/boss_m3';
import { FrostLance, SPIKE_SPEED, SpikeWave } from '../src/content/bosses/m3/parts';
import { Bullet } from '../src/game/projectile';

const LOCK_X = 600;

/** Walk the autopilot into the arena until the boss exists. */
function reachBoss(seed = 1): { w: World; boss: FrostBastion; bots: Bot[]; t: number } {
  const w = makeWorld('bosstest_m3', { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let t = 0;
  while (!w.boss && t < 60) {
    step(w, 1, bots);
    t += DT;
  }
  expect(w.boss, 'boss spawned').toBeInstanceOf(FrostBastion);
  return { w, boss: w.boss as FrostBastion, bots, t };
}

/** A quiet world (no boss yet) with a mortal player standing on flat ground at y 184. */
function hazardWorld(): { w: World; p: Player; G: number } {
  const w = makeWorld('bosstest_m3', { god: false });
  const p = w.players[0] as Player;
  step(w, 90);
  p.invuln = 0;
  expect(p.state).toBe('play');
  return { w, p, G: 184 };
}

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

/** Step without bots until the boss satisfies `pred` (or timeout). */
function until(w: World, pred: () => boolean, max = 30): number {
  let t = 0;
  while (!pred() && t < max) {
    step(w, 1);
    t += DT;
  }
  return t;
}

describe('boss_m3 FROST BASTION', () => {
  it('aligns its wall to the arena and blocks the way', () => {
    const { w, boss } = reachBoss();
    release();
    expect(boss.face).toBe(LOCK_X + FACE_X);
    expect(w.terrain.isSolidPoint(boss.face + 6, boss.groundY - 10)).toBe(true);
    expect(w.terrain.isSolidPoint(boss.face - 20, boss.groundY - 10)).toBe(false);
    // A player cannot walk into the wall.
    const p = w.players[0] as Player;
    p.x = boss.face - 30;
    input.setVirtual(0, { right: true });
    step(w, 120);
    release();
    expect(p.x + p.w / 2).toBeLessThanOrEqual(boss.face + 3);
  });

  it('is not hittable during its intro (< 3 s), then the doors clang and the open core takes damage', () => {
    const { w, boss } = reachBoss();
    release();
    const p = w.players[0];
    let t = 0;
    while (!boss.introDone && t < 5) {
      expect(boss.hittable).toBe(false);
      expect(boss.damage({ amount: 5, kind: 'bullet', owner: p, x: boss.face - 5, y: boss.groundY - 20 })).toBe(false);
      for (const tr of boss.turrets) expect(tr.hittable).toBe(false);
      step(w, 1);
      t += DT;
    }
    expect(boss.introDone).toBe(true);
    expect(t).toBeLessThan(3);
    expect(boss.hittable).toBe(true);
    for (const tr of boss.turrets) expect(tr.hittable).toBe(true);
    // Doors shut: a bullet at the gate connects but does no damage.
    expect(boss.mode).toBe('closed');
    const hp0 = boss.hp;
    w.add(new Bullet(p, boss.face - 60, boss.groundY - 22, 0));
    step(w, 20);
    expect(boss.hp).toBe(hp0);
    expect(boss.dmgLog.doors).toBeDefined();
    // Core open: bullets hurt.
    until(w, () => boss.mode === 'open' && boss.coreK >= 1, 12);
    expect(boss.mode).toBe('open');
    w.add(new Bullet(p, boss.face - 90, boss.groundY - 22, 0));
    step(w, 20);
    expect(boss.hp).toBeLessThan(hp0);
    expect(boss.dmgLog.core).toBeGreaterThan(0);
  });

  it('reaches every phase: rage at 66%, doors blown off at 33%', () => {
    const { w, boss } = reachBoss();
    release();
    until(w, () => boss.introDone, 5);
    const p = w.players[0];
    const phases: number[] = [];
    let t = 0;
    while (!boss.dying && t < 120) {
      if (boss.zones.some((z) => z.id === 'core')) boss.damage({ amount: 1, kind: 'bullet', owner: p, x: boss.tipX() + 2, y: boss.groundY - 22 });
      if (!phases.includes(boss.phase)) phases.push(boss.phase);
      if (boss.phase === 2) expect(boss.broken).toBe(true);
      step(w, 4);
      t += 4 * DT;
    }
    expect(phases).toEqual([0, 1, 2]);
    expect(boss.dying).toBe(true);
    // The death sequence completes the mission.
    until(w, () => w.state === 'complete', 10);
    expect(w.state).toBe('complete');
    expect(w.terrain.isSolidPoint(boss.face + 6, boss.groundY - 10)).toBe(false);
  });

  it('frost lance spares a crouching player and hits a standing one', () => {
    const { w, p, G } = hazardWorld();
    input.setVirtual(0, { down: true });
    step(w, 10);
    expect(p.crouching).toBe(true);
    const lance = w.add(new FrostLance(p, p.x + 150, G - LANCE_H, p.x - 150, 0.2, 0.6));
    until(w, () => lance.dead, 3);
    expect(p.state).toBe('play');
    release();
    step(w, 10);
    expect(p.crouching).toBe(false);
    const lance2 = w.add(new FrostLance(p, p.x + 150, G - LANCE_H, p.x - 150, 0.2, 0.6));
    until(w, () => lance2.dead || p.state !== 'play', 3);
    expect(p.state).toBe('dying');
  });

  it('spike wave can be jumped (a ~0.3 s window around the frost crack), not stood in', () => {
    for (const delay of [-0.15, 0, 0.1]) {
      const { w, p, G } = hazardWorld();
      const x0 = p.x + 140;
      const wave = w.add(new SpikeWave(p, x0, p.x - 100, G));
      let jumped = false;
      let held = 0;
      while (!wave.dead && p.state === 'play') {
        if (!jumped && wave.t >= (x0 - p.x) / SPIKE_SPEED + delay) {
          jumped = true;
          held = 0.3;
        }
        input.setVirtual(0, held > 0 ? { jump: true } : {});
        held -= DT;
        step(w, 1);
      }
      release();
      expect(jumped).toBe(true);
      expect(p.state, `jump ${delay}s after the crack passes`).toBe('play');
    }
    const { w, p, G } = hazardWorld();
    const wave = w.add(new SpikeWave(p, p.x + 140, p.x - 100, G));
    until(w, () => wave.dead || p.state !== 'play', 4);
    expect(p.state).toBe('dying');
  });
});

describe('boss_m3 autopilot', () => {
  it('the invincible autopilot beats the boss test arena', () => {
    const r = simulateMission('bosstest_m3', 300);
    console.log('bosstest_m3', JSON.stringify(r));
    expect(r.completed).toBe(true);
  }, 120_000);
});
