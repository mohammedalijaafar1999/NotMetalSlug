// Camera-lock arenas must always be clearable: wave enemies never idle out of view.
import { describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import type { LevelDef } from '../src/game/level';
import { LOCK_AWAY_GIVEUP } from '../src/game/level';

const base = (id: string, spawns: { type: string; x: number; props?: Record<string, any> }[]): LevelDef => ({
  id,
  mission: 0,
  name: 'ARENA TEST',
  theme: 'default',
  music: 'm1',
  width: 2000,
  height: 216,
  start: { x: 560 },
  ground: [[[0, 180], [2000, 180]]],
  locks: [{ x: 400, trigger: 0, waves: [{ spawns }] }],
});

describe('arena locks', () => {
  it('a soldier who would hold his range just past the screen edge walks back into view', () => {
    const w = makeWorld(base('arena_leash', [{ type: 'rifleman', x: 388, props: { behavior: 'guard', facing: 1 } }]), { god: true });
    step(w, 60 * 5);
    const r = w.query((e) => e.type === 'rifleman')[0];
    expect(r).toBeTruthy();
    expect(w.level.locked).toBe(true);
    expect(r.onScreen(-8)).toBe(true);
  });

  it('the leash walks an off-screen soldier in briskly, hopping a small gap on the way', () => {
    // A 32 px pit between the far quay (where the flametrooper spawns) and the arena.
    const def: LevelDef = {
      ...base('arena_leash_gap', [{ type: 'flametrooper', x: 880, props: { behavior: 'charge', facing: -1 } }]),
      ground: [[[0, 180], [800, 180]], [[832, 180], [2000, 180]]],
    };
    const w = makeWorld(def, { god: true });
    let seen = -1;
    for (let i = 0; i < 60 * 8 && seen < 0; i++) {
      step(w, 1);
      const f = w.query((e) => e.type === 'flametrooper')[0];
      if (f && f.onScreen(-8)) seen = i;
    }
    const f = w.query((e) => e.type === 'flametrooper')[0];
    expect(f, 'he made it across the gap').toBeTruthy();
    expect(seen).toBeGreaterThan(0);
    expect(seen / 60, 'walked in briskly').toBeLessThan(6);
  });

  it('the leash never walks a soldier into deadly water: he waits at the edge (e.g. for a bridge)', () => {
    const def: LevelDef = {
      ...base('arena_leash_water', [
        { type: 'rifleman', x: 900, props: { behavior: 'charge', facing: -1 } },
        { type: 'flametrooper', x: 930, props: { behavior: 'charge', facing: -1 } },
      ]),
      height: 300,
      ground: [[[0, 180], [790, 180]], [[860, 180], [2000, 180]]],
      water: [{ x: 790, y: 182, w: 70, h: 118, deadly: true }],
    };
    const w = makeWorld(def, { god: true });
    step(w, 60 * 6);
    const soldiers = w.query((e) => (e.type === 'rifleman' || e.type === 'flametrooper') && !(e as any).dying);
    expect(soldiers.length, 'nobody drowned').toBe(2);
    for (const s of soldiers) {
      expect(s.x).toBeGreaterThanOrEqual(860);
      expect(s.y).toBeLessThanOrEqual(180.5);
    }
  });

  it('a wave enemy that can never come into view stops blocking the arena', () => {
    const w = makeWorld(base('arena_giveup', [{ type: 'turret', x: 300 }]), { god: true });
    step(w, 60 * 3);
    expect(w.level.locked).toBe(true);
    step(w, 60 * (LOCK_AWAY_GIVEUP + 2));
    expect(w.level.locked).toBe(false);
    expect(w.level.lockStates()[0].state).toBe('done');
  });
});
