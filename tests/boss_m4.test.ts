// boss_m4 LEVIATHAN: the autopilot beats it from the dock, the intro is unhittable, every phase is
// reached, the attacks keep their fairness contracts, and a mortal scripted "dodger" that only does
// the intended dodges (jump torpedoes / the laser whip / the rake, step away from shadows and missile
// markers) wins without dying - i.e. there is always a safe way out.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input, type ActionMask } from '../src/engine/input';
import { getEntityType } from '../src/game/registry';
import type { World } from '../src/game/world';
import { Leviathan, LEVIATHAN_HP, DIVE_SINK, CLENCH_TIME, CLAW_LOCK } from '../src/content/bosses/m4/leviathan';
import { Torpedo, PodMissile } from '../src/content/bosses/m4/weapons';
import { GroundMarker as LandingMarker } from '../src/content/bosses/common/kit';
import { GroundMarker as ShadowMarker } from '../src/content/bosses/common/fx';

/** Walk the bot to the arena until the boss exists. */
function toBoss(seed = 1, difficulty: 0 | 1 | 2 = 1): { w: World; bots: Bot[]; boss: Leviathan } {
  const w = makeWorld('bosstest_m4', { seed, god: true, difficulty });
  const bots = w.players.map((p) => new Bot(p.index));
  for (let i = 0; i < 60 * 40 && !w.boss; i++) step(w, 1, bots);
  expect(w.boss, 'boss spawned').toBeTruthy();
  return { w, bots, boss: w.boss as Leviathan };
}

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

/** A mortal player that fights from the dock with the pistol and performs the telegraphed dodges. */
function dodgeFight(seed: number, difficulty: 0 | 1 | 2): { completed: boolean; deaths: string[]; seconds: number } {
  const { w, boss } = toBoss(seed, difficulty);
  const p = w.players[0];
  p.godMode = false;
  const deaths: string[] = [];
  w.on('playerDied', () => deaths.push(`${w.time.toFixed(1)}s ${boss.state}/${boss.step}`));
  let frame = 0;
  let jumpHold = 0;
  let t = 0;
  while (w.state !== 'complete' && t < 240) {
    frame++;
    t += DT;
    const m: ActionMask = { fire: frame % 6 < 3 };
    const lo = boss.arenaL + 12;
    const hi = boss.pierTip - 10;
    // Danger on the dock: missile landing markers and the claw's shadow (and its resting spot).
    const danger: [number, number][] = [];
    for (const e of w.entities) {
      if (e.dead) continue;
      if (e instanceof LandingMarker) danger.push([e.x - 24, e.x + 24]);
      if (e instanceof ShadowMarker) danger.push([e.x - 28, e.x + 28]);
    }
    const st = boss.step;
    if (boss.state === 'claw' && (st === 'rest' || st === 'clench') && p.x < boss.arm.rx) danger.push([boss.arm.rx - 22, boss.arm.rx + 22]);
    const free = (x: number) => danger.every(([a, b]) => x < a || x > b);
    let target = Math.min(Math.max(boss.arenaL + 70, lo), hi);
    if (!free(p.x) || !free(target)) {
      let best = p.x;
      let bd = Infinity;
      for (let x = lo; x <= hi; x += 2) {
        if (free(x) && Math.abs(x - p.x) < bd) {
          bd = Math.abs(x - p.x);
          best = x;
        }
      }
      target = free(p.x) ? p.x : best;
    }
    // Jumps: the laser whip's impact, torpedoes sliding along the deck, the claw raking the planks.
    let wantJump = boss.beam.mode === 'fire' && boss.beam.ix - p.x > -2 && boss.beam.ix - p.x < 46;
    for (const e of w.entities) if (e instanceof Torpedo && !e.dead && e.onDeck && e.x > p.x - 6 && e.x - p.x < 40) wantJump = true;
    if (boss.state === 'claw' && st === 'rake' && p.x > boss.arm.rx - 4 && p.x - boss.arm.rx < 34) wantJump = true;
    if (boss.state === 'claw' && st === 'clench' && Math.abs(p.x - boss.arm.rx) < 20 && boss.stepT > CLENCH_TIME - 0.2) wantJump = true;
    // Like a human, never step into a missile landing zone just before the blast (wait for it instead):
    // a salvo can pin you at the pier tip while the claw's shadow comes for you there.
    const blast = (x: number) => {
      let d = 0;
      for (const e of w.entities) if (!e.dead && e instanceof LandingMarker && e.remaining < 0.6 && Math.abs(x - e.x) < 22) d = Math.max(d, 22 - Math.abs(x - e.x));
      return d;
    };
    if (blast(p.x) === 0 && blast(p.x + Math.sign(target - p.x) * 4) > 0) target = p.x;
    if (target < p.x - 2) m.left = true;
    else if (target > p.x + 2) m.right = true;
    else if (p.facing < 0) m.right = frame % 10 < 1;
    if (wantJump && p.onGround && jumpHold <= 0) jumpHold = 0.32;
    if (jumpHold > 0) {
      jumpHold -= DT;
      m.jump = true;
    }
    if (p.state === 'out') m.start = frame % 20 < 10;
    input.setVirtual(0, m);
    input.poll(DT);
    w.update(DT);
  }
  release();
  return { completed: w.state === 'complete', deaths, seconds: t };
}

describe('boss_m4 LEVIATHAN', () => {
  it('is registered as a boss', () => {
    expect(getEntityType('boss_m4')?.category).toBe('boss');
  });

  it('is not hittable during its intro, then becomes hittable', () => {
    const { w, bots, boss } = toBoss();
    expect(boss.introDone).toBe(false);
    const hp0 = boss.hp;
    let t = 0;
    while (!boss.introDone && t < 5) {
      // Direct hits and blasts on every zone must do nothing while it rises.
      for (const z of boss.zones) {
        expect(boss.damage({ amount: 50, kind: 'explosion', owner: w.players[0], x: z.x + z.w / 2, y: z.y + z.h / 2 })).toBe(false);
      }
      expect(boss.hittable).toBe(false);
      step(w, 1, bots);
      t += DT;
    }
    release();
    expect(boss.hp).toBe(hp0);
    expect(t).toBeLessThan(3.05);
    expect(boss.introDone).toBe(true);
    expect(boss.hittable).toBe(true);
    const tower = boss.zones.find((z) => z.id === 'tower')!;
    expect(boss.damage({ amount: 4, kind: 'bullet', owner: w.players[0], x: tower.x + tower.w / 2, y: tower.y + tower.h / 2 })).toBe(true);
    expect(boss.hp).toBeLessThan(hp0);
  });

  it('is beaten by the autopilot on foot from the dock, reaching every phase', () => {
    const { w, bots, boss } = toBoss();
    const phases = new Set<number>();
    let t = 0;
    let maxSink = 0;
    let towerOnlyWhileDiving = true;
    while (w.state !== 'complete' && t < 300) {
      step(w, 1, bots);
      t += DT;
      if (!boss.dead && !boss.dying) {
        phases.add(boss.phase);
        maxSink = Math.max(maxSink, boss.sink);
        if (boss.phase >= 2 && boss.sink >= DIVE_SINK - 0.5 && boss.zones.some((z) => z.id !== 'tower' && z.mul > 0)) towerOnlyWhileDiving = false;
      }
    }
    release();
    expect(w.state).toBe('complete');
    expect(t).toBeLessThan(150);
    expect([...phases].sort()).toEqual([0, 1, 2]);
    expect([...boss.phasesSeen].sort()).toEqual([0, 1, 2]);
    expect(maxSink).toBeGreaterThanOrEqual(DIVE_SINK - 0.5);
    expect(towerOnlyWhileDiving).toBe(true);
    // Every attack was used.
    for (const k of ['torpedo', 'missiles', 'laser', 'claw']) expect(boss.attacks[k] ?? 0, k).toBeGreaterThan(0);
    // Most of the damage came through the weak points.
    const total = Object.values(boss.dmgLog).reduce((a, b) => a + b, 0);
    const weak = (boss.dmgLog.tower ?? 0) + (boss.dmgLog.podF ?? 0) + (boss.dmgLog.podA ?? 0) + (boss.dmgLog.mouth ?? 0);
    expect(weak / total).toBeGreaterThan(0.6);
  }, 120_000);

  it('completes the test mission with simulateMission', () => {
    const r = simulateMission('bosstest_m4', 300);
    expect(r.completed).toBe(true);
    expect(r.seconds).toBeLessThan(150);
  }, 120_000);

  it('scales HP with difficulty', () => {
    for (const [d, k] of [
      [0, 0.8],
      [1, 1],
      [2, 1.3],
    ] as const) {
      const w = makeWorld('bosstest_m4', { difficulty: d });
      const b = w.spawn('boss_m4', 820) as Leviathan;
      step(w, 2);
      expect(b.maxHp).toBe(Math.round(LEVIATHAN_HP * k));
    }
  });

  it('telegraphs: torpedoes ride low enough to jump, the laser aims >= 0.75 s, the claw shadow >= 1 s', () => {
    const { w, bots, boss } = toBoss();
    let deckTorpedo: Torpedo | null = null;
    let aimSeen = -1;
    let fireSeen = -1;
    let shadowAt = -1;
    let slamAt = -1;
    let missileDown = false;
    let t = 0;
    while (t < 120 && (!deckTorpedo || fireSeen < 0 || slamAt < 0 || !missileDown)) {
      step(w, 1, bots);
      t += DT;
      for (const e of w.entities) {
        if (e instanceof Torpedo && e.onDeck && !deckTorpedo) deckTorpedo = e;
        // Pod missiles come straight down onto their marker.
        if (e instanceof PodMissile && e.phase === 'down') {
          expect(Math.abs(e.x - e.tx)).toBeLessThan(0.01);
          missileDown = true;
        }
      }
      if (boss.beam.mode === 'aim' && aimSeen < 0) aimSeen = t;
      if (boss.beam.mode === 'fire' && aimSeen >= 0 && fireSeen < 0) fireSeen = t;
      if (boss.beam.mode === 'off' && fireSeen < 0) aimSeen = -1;
      if (boss.shadow && shadowAt < 0) shadowAt = t;
      if (boss.state === 'claw' && boss.step === 'rest' && shadowAt >= 0 && slamAt < 0) slamAt = t;
    }
    release();
    expect(deckTorpedo, 'a torpedo reached the dock').toBeTruthy();
    // Sits on the deck, at most 8 px tall: a standing jump (~50 px) clears it.
    expect(deckTorpedo!.bottom).toBeGreaterThan(boss.deckY - 1);
    expect(deckTorpedo!.h).toBeLessThanOrEqual(8);
    expect(fireSeen - aimSeen).toBeGreaterThanOrEqual(0.75);
    expect(slamAt - shadowAt).toBeGreaterThanOrEqual(1);
    expect(CLAW_LOCK).toBeGreaterThanOrEqual(0.35);
    expect(missileDown).toBe(true);
  }, 60_000);

  it('the laser whip is jumpable from the dock and never reaches the far corner', () => {
    const { w, boss } = toBoss();
    for (let i = 0; i < 60 * 4; i++) step(w, 1);
    boss.scopeExt = 1;
    const lens = boss.lensPos();
    const endX = boss.facing < 0 ? boss.arenaL + 24 : boss.arenaR - 24;
    // Beam height over a player at the left quarter when the sweep ends: well under the jump apex (~50).
    const px = boss.arenaL + 96;
    const h = ((boss.deckY - lens.y) * (px - endX)) / (lens.x - endX);
    expect(h).toBeLessThan(34);
    expect(endX).toBeGreaterThan(boss.arenaL + 16);
  });

  for (const [seed, diff] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
    [2, 2],
  ] as const) {
    it(`a mortal dodger wins without dying (seed ${seed}, difficulty ${diff})`, () => {
      const r = dodgeFight(seed, diff);
      expect(r.deaths).toEqual([]);
      expect(r.completed).toBe(true);
    }, 60_000);
  }
});
