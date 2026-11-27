// FROST BASTION (boss_m3): intro invulnerability, armoured doors vs exposed core, phases,
// fairness of the core attacks and an autopilot kill in the test arena.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import type { World } from '../src/game/world';
import type { Player } from '../src/game/player';
import { FrostBastion, FACE_X, LANCE_H, FLAK_BURST_H, FLAK_FLIGHT, mortarShell } from '../src/content/bosses/boss_m3';
import { Entity } from '../src/game/entity';
import { FrostLance, SPIKE_SPEED, SpikeWave, FlakShell, FloorMark } from '../src/content/bosses/m3/parts';
import { Bullet } from '../src/game/projectile';
import { getLevel, registerLevel } from '../src/game/level';

const LOCK_X = 600;

/** A stand-in owner for boss projectiles fired in isolation. */
class Gunner extends Entity {}

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

  it('flak fragments only hit a player who overlaps one of their landing shadows', () => {
    // A player standing still anywhere around the burst: dying is fair only when the hitbox (12 px)
    // touches a fragment shadow; the gap between two shadows must not be a trap.
    let deaths = 0;
    let gaps = 0;
    for (let d = -60; d <= 60; d += 2) {
      const { w, p, G } = hazardWorld();
      const bx = p.x - d;
      const marks: FloorMark[] = [];
      w.add(new FlakShell(null, bx - 80, G - 150, bx, G - FLAK_BURST_H, FLAK_FLIGHT, G));
      for (let t = 0; t < 2.5 && p.state === 'play'; t += DT) {
        step(w, 1);
        for (const e of w.entities) if (e instanceof FloorMark && e.style === 'shadow' && !marks.includes(e)) marks.push(e);
      }
      const touching = marks.some((m) => Math.abs(m.x - p.x) <= 6 + m.radius + 0.5);
      if (p.state !== 'play') {
        deaths++;
        expect(touching, `killed at ${d} px from the burst, clear of every shadow (${marks.map((m) => Math.round(m.x - p.x)).join(', ')})`).toBe(true);
      } else if (!touching) gaps++;
      expect(marks.length).toBe(3);
    }
    // The flak is still a threat (a band of the floor is deadly) and there is room around it.
    expect(deaths).toBeGreaterThan(8);
    expect(gaps).toBeGreaterThan(8);
  });

  it('a mortar shell only kills a player who touches its floor cross', () => {
    let deaths = 0;
    for (let d = 0; d <= 40; d += 2) {
      const { w, p, G } = hazardWorld();
      const tx = p.x - d;
      mortarShell(w, w.add(new Gunner()), tx + 120, G - 120, tx, G);
      step(w, 1);
      const mark = w.entities.find((e) => e instanceof FloorMark) as FloorMark;
      until(w, () => mark.dead || p.state !== 'play', 3);
      step(w, 2);
      if (p.state === 'play') continue;
      deaths++;
      expect(d, `killed ${d} px from the impact, clear of its cross (radius ${mark.radius})`).toBeLessThanOrEqual(6 + mark.radius + 0.5);
    }
    expect(deaths).toBeGreaterThan(5);
  });
});

describe('boss_m3 fairness director', () => {
  it('keeps turret fire, shells and icicles away from the player while a core attack demands a crouch or a jump', () => {
    const { w, boss } = reachBoss(7);
    release();
    until(w, () => boss.introDone, 5);
    const p = w.players[0] as Player;
    const hazards = new Set(['EnemyBullet', 'Lobbed', 'FlakShell', 'IceFrag', 'FallingIcicle']);
    const spots = [boss.face - 130, boss.face - 40, boss.face - 200, boss.face - 70];
    const violations: string[] = [];
    let heavy = 0;
    let t = 0;
    while (t < 150 && !boss.dying) {
      // Passive player parked at a few spots (god mode: never dies, never shoots).
      p.x = spots[Math.floor(t / 15) % spots.length];
      if (t > 45 && boss.phase === 0) boss.hp = boss.maxHp * 0.6;
      if (t > 95 && boss.phase === 1) boss.hp = boss.maxHp * 0.3;
      step(w, 1);
      t += DT;
      const lance = w.entities.find((e) => e instanceof FrostLance && e.firing);
      const wave = w.entities.find((e) => e instanceof SpikeWave && e.t > 0.2 && Math.abs((e as SpikeWave).front - p.x) < 50);
      const rolling = w.entities.find((e) => e.constructor.name === 'Boulder' && Math.abs(e.x - p.x) < 40);
      if (!lance && !wave && !rolling) continue;
      heavy++;
      for (const e of w.entities) {
        if (e.dead || !hazards.has(e.constructor.name)) continue;
        if (Math.abs(e.x - p.x) < 40 && e.y > p.y - 70) violations.push(`${t.toFixed(2)} ${e.constructor.name} near player during ${lance ? 'lance' : wave ? 'spikes' : 'boulder'}`);
      }
    }
    expect(heavy).toBeGreaterThan(60);
    expect([...new Set(violations)].slice(0, 10)).toEqual([]);
  }, 60_000);
});

describe('boss_m3 autopilot', () => {
  it('the invincible autopilot beats the boss test arena', () => {
    const r = simulateMission('bosstest_m3', 300);
    expect(r.completed).toBe(true);
    expect(r.seconds).toBeLessThan(150);
  }, 120_000);

  it('also works when the arena is the very end of the level (and on hard)', () => {
    const base = getLevel('bosstest_m3')!;
    registerLevel({ ...base, id: 'bosstest_m3_end', width: LOCK_X + 384, ground: [[[0, 184], [LOCK_X + 384, 184]]] });
    const r = simulateMission('bosstest_m3_end', 300, 3);
    expect(r.completed).toBe(true);
    const w = makeWorld('bosstest_m3', { seed: 2, god: true, difficulty: 2 });
    const bots = w.players.map((p) => new Bot(p.index));
    let t = 0;
    while (w.state !== 'complete' && t < 300) {
      step(w, 1, bots);
      t += DT;
    }
    release();
    expect(w.state).toBe('complete');
  }, 120_000);
});
