// boss_m6 (JUGGERNAUT): intro invulnerability, phases, fairness of the telegraphed attacks and a full
// autopilot fight in the test arena.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { Juggernaut, BEAM_HALF, BEAM_HEIGHT, JUG_HP } from '../src/content/bosses/boss_m6';
import { JugShockwave, RainMissile } from '../src/content/bosses/m6/parts';
import { Lobbed } from '../src/content/bosses/common/kit';
import type { World } from '../src/game/world';

function bossOf(w: World): Juggernaut | null {
  return (w.entities.find((e) => e instanceof Juggernaut) as Juggernaut | undefined) ?? null;
}

/** Run the arena with the autopilot until the boss exists (and optionally until intro end). */
function arena(seed = 1): { w: World; bots: Bot[] } {
  const w = makeWorld('bosstest_m6', { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  for (let i = 0; i < 60 * 30 && !bossOf(w); i++) step(w, 1, bots);
  return { w, bots };
}

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

describe('boss_m6 JUGGERNAUT', () => {
  it('is registered as a boss and spawns in the arena lock', () => {
    const { w } = arena();
    const b = bossOf(w);
    release();
    expect(b).toBeTruthy();
    expect(w.boss).toBe(b);
    expect(b!.maxHp).toBe(JUG_HP);
  });

  it('cannot be hurt during its entrance and becomes hittable in under ~3 s', () => {
    const { w, bots } = arena();
    const b = bossOf(w)!;
    let t = 0;
    while (!b.introDone && t < 6) {
      expect(b.hittable).toBe(false);
      const hp = b.hp;
      expect(b.damage({ amount: 50, kind: 'explosion', owner: w.players[0], x: b.x, y: b.y - 60 })).toBe(false);
      expect(b.hp).toBe(hp);
      step(w, 1, bots);
      t += DT;
    }
    release();
    expect(b.introDone).toBe(true);
    expect(t).toBeLessThan(3.2);
    expect(b.hittable).toBe(true);
  });

  it('reaches every phase, blows its armour off and dies into a completed mission', () => {
    const { w, bots } = arena();
    const b = bossOf(w)!;
    for (let i = 0; i < 60 * 4 && !b.introDone; i++) step(w, 1, bots);
    release();
    const seen = new Set<string>();
    const phases = new Set<number>();
    let pod = false;
    for (let i = 0; i < 60 * 200 && w.state !== 'complete'; i++) {
      step(w, 1);
      seen.add(b.state);
      phases.add(b.phase);
      if (w.entities.some((e) => e.constructor.name === 'EscapePod')) pod = true;
      // Chip damage on a timer (6 dps) so the test does not depend on anyone's aim.
      if (!b.dying && i % 30 === 0) b.damage({ amount: 3, kind: 'bullet', owner: w.players[0], x: b.x, y: b.y - 20 });
    }
    expect([...phases].sort()).toEqual([0, 1, 2]);
    expect(b.armorOn).toBe(false);
    for (const s of ['walk', 'laser', 'stagger']) expect(seen.has(s), s).toBe(true);
    expect(pod).toBe(true);
    expect(w.state).toBe('complete');
  });

  it('fires readable, dodgeable projectiles at an idle player', () => {
    const { w, bots } = arena(3);
    const b = bossOf(w)!;
    for (let i = 0; i < 60 * 4 && !b.introDone; i++) step(w, 1, bots);
    release();
    let maxSpeed = 0;
    let waves = 0;
    let rain = 0;
    let shells = 0;
    let markers = 0;
    let beamChecked = false;
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 150 && w.state !== 'complete'; i++) {
      step(w, 1); // nobody shoots: the boss cycles through its whole repertoire
      seen.add(b.state);
      if (b.phase === 0 && i === 60 * 60) b.damage({ amount: JUG_HP * 0.45, kind: 'explosion', owner: w.players[0] });
      for (const e of w.entities) {
        if (e instanceof JugShockwave) {
          waves++;
          maxSpeed = Math.max(maxSpeed, Math.abs(e.vx));
          expect(e.h).toBeLessThanOrEqual(12);
        }
        if (e instanceof RainMissile) {
          rain++;
          expect(e.marker, 'every falling missile has a ground marker').toBeTruthy();
        }
        if (e instanceof Lobbed) {
          shells++;
          expect(Math.abs(e.vx)).toBeLessThan(225);
          if (e.marker) markers++;
        }
      }
      if (b.beamOn && b.beamA === 0) {
        const [, y0] = b.beamLine();
        const floor = b.groundY;
        // The beam's lowest edge clears a crouching player (17 px) and hits a standing one (26 px).
        expect(floor - (y0 + BEAM_HALF)).toBeGreaterThan(17 + 2);
        expect(floor - (y0 - BEAM_HALF)).toBeLessThan(26 + BEAM_HALF + 2);
        expect(Math.round(floor - y0)).toBe(BEAM_HEIGHT);
        beamChecked = true;
      }
    }
    expect(waves).toBeGreaterThan(0);
    expect(rain).toBeGreaterThan(0);
    expect(shells).toBeGreaterThan(0);
    expect(markers).toBe(shells);
    expect(maxSpeed).toBeLessThanOrEqual(220);
    expect(beamChecked).toBe(true);
    for (const s of ['walk', 'cannon', 'stomp', 'missiles', 'laser', 'drones', 'stagger']) expect(seen.has(s), s).toBe(true);
  });

  for (const crouch of [true, false]) {
    it(`core laser: a ${crouch ? 'crouching player survives' : 'standing player is hit'}`, () => {
      const { w, bots } = arena(5);
      const b = bossOf(w)!;
      for (let i = 0; i < 60 * 4 && !b.introDone; i++) step(w, 1, bots);
      release();
      const p = w.players[0];
      p.godMode = false;
      p.invuln = 0;
      b.damage({ amount: JUG_HP * 0.45, kind: 'explosion', owner: p });
      step(w, 1);
      expect(b.phase).toBe(1);
      expect(b.forced).toBe('laser');
      let fired = false;
      for (let i = 0; i < 60 * 12; i++) {
        input.setVirtual(0, crouch ? { down: true } : {});
        step(w, 1);
        if (b.beamOn) fired = true;
        if (fired && !b.beamOn) break;
        if (p.state !== 'play') break;
      }
      release();
      expect(fired).toBe(true);
      if (crouch) expect(p.state).toBe('play');
      else expect(p.state).not.toBe('play');
    });
  }

  it('is defeated by the autopilot in the test arena', () => {
    const r = simulateMission('bosstest_m6', 300);
    console.log('bosstest_m6', JSON.stringify(r));
    expect(r.completed).toBe(true);
  }, 120_000);
});
