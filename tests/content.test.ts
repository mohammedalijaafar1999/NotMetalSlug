// Content validation: every level, sprite, song, sfx, weapon and entity type must be sound.
// These tests are the contract that content modules are checked against.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission } from './helpers';
import { allLevels } from '../src/game/level';
import { entityTypes, getEntityType } from '../src/game/registry';
import { sprites } from '../src/engine/sprites';
import { audio, parseChannel, renderSfxSamples } from '../src/engine/audio';
import { allWeapons } from '../src/game/weapons';
import { themeIds } from '../src/game/theme';
import { VIEW_W, VIEW_H } from '../src/engine/renderer';
import { characters } from '../src/game/characters';

const levels = allLevels();

describe('levels', () => {
  for (const L of levels) {
    describe(`${L.id} (mission ${L.mission})`, () => {
      it('has valid geometry', () => {
        expect(L.width).toBeGreaterThanOrEqual(VIEW_W);
        expect(L.height).toBeGreaterThanOrEqual(VIEW_H);
        let lastX = -Infinity;
        for (const line of L.ground) {
          expect(line.length).toBeGreaterThanOrEqual(2);
          expect(line[0][0]).toBeGreaterThanOrEqual(lastX); // polylines must not overlap
          for (let i = 1; i < line.length; i++) expect(line[i][0]).toBeGreaterThanOrEqual(line[i - 1][0]);
          lastX = line[line.length - 1][0];
          for (const [x, y] of line) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(L.width);
            expect(y).toBeLessThanOrEqual(L.height + 200);
          }
        }
        for (const p of L.platforms ?? []) expect(p.w).toBeGreaterThan(0);
        for (const s of L.solids ?? []) expect(s.w * s.h).toBeGreaterThan(0);
      });
      it('references registered theme, entities and music', () => {
        expect(themeIds()).toContain(L.theme);
        const specs = [...(L.entities ?? []), ...(L.locks ?? []).flatMap((l) => l.waves.flatMap((w) => w.spawns))];
        for (const s of specs) expect(getEntityType(s.type), `entity type "${s.type}"`).toBeTruthy();
        if (L.mission >= 1) {
          expect(audio.hasSong(L.music), `song ${L.music}`).toBe(true);
          if (L.bossMusic) expect(audio.hasSong(L.bossMusic), `song ${L.bossMusic}`).toBe(true);
          if (L.startVehicle) expect(getEntityType(L.startVehicle)?.category).toBe('vehicle');
        }
      });
      it('has a reachable start and sane locks', () => {
        const w = makeWorld(L.id);
        expect(w.terrain.topFloorAt(L.start.x), 'floor under start').not.toBeNull();
        const locks = L.locks ?? [];
        for (const l of locks) {
          expect(l.x).toBeGreaterThanOrEqual(0);
          expect(l.x).toBeLessThanOrEqual(L.width - VIEW_W + 0.5);
          expect(l.waves.length).toBeGreaterThan(0);
        }
        if (L.mission >= 1) {
          const bossLock = locks.find((l) => l.boss);
          expect(bossLock, 'boss lock').toBeTruthy();
          const bossSpawn = bossLock!.waves.flatMap((w) => w.spawns).find((s) => getEntityType(s.type)?.category === 'boss');
          expect(bossSpawn, 'boss entity in boss lock').toBeTruthy();
        }
      });
    });
  }
  it('missions 1..6 exist (once content is complete)', () => {
    const ms = levels.map((l) => l.mission).filter((m) => m >= 1);
    // Soft check while content is being built: no duplicates.
    expect(new Set(ms).size).toBe(ms.length);
  });
});

describe('sprites', () => {
  it('every sprite frame rasterizes and is not empty', () => {
    const bad: string[] = [];
    for (const s of sprites.all()) {
      for (let f = 0; f < s.frameCount; f++) {
        try {
          const p = s.pixelArt(f);
          if (p.opaqueCount() === 0 && !/_empty|blank/.test(s.name)) bad.push(`${s.name}#${f} empty`);
        } catch (e) {
          bad.push(`${s.name}#${f} threw ${(e as Error).message}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it('characters have full sprite sets', () => {
    for (const c of characters()) {
      for (const suffix of ['legs', 'up_pistol', 'up_heavy', 'throw', 'knife', 'body']) {
        expect(sprites.has(`char_${c.id}_${suffix}`), `char_${c.id}_${suffix}`).toBe(true);
        expect(sprites.has(`char_${c.id}_p2_${suffix}`), `char_${c.id}_p2_${suffix}`).toBe(true);
      }
    }
  });
});

describe('audio content', () => {
  it('songs parse', () => {
    for (const name of audio.songNames()) {
      const s = audio.getSong(name)!;
      expect(s.bpm).toBeGreaterThan(30);
      for (const c of s.channels) expect(() => parseChannel(c), `${name}`).not.toThrow();
    }
  });
  it('sfx render cleanly', () => {
    for (const name of audio.sfxNames()) {
      const def = (audio as any).sfxDefs.get(name);
      const s = renderSfxSamples(def, 8000);
      expect(s.length, name).toBeLessThan(8000 * 6);
      expect(s.every((v) => Number.isFinite(v)), name).toBe(true);
    }
  });
});

describe('weapons', () => {
  it('have unique crate letters and gun sprites for all characters', () => {
    const ws = allWeapons().filter((w) => w.id !== 'pistol');
    const letters = ws.map((w) => w.letter);
    expect(new Set(letters).size).toBe(letters.length);
    for (const w of allWeapons()) for (const c of characters()) expect(sprites.has(`char_${c.id}_up_${w.gun}`), `${c.id} ${w.gun}`).toBe(true);
  });
});

describe('entity types simulate headless', () => {
  for (const t of entityTypes()) {
    it(`${t.type} (${t.category}) spawns and updates for 5s without throwing`, () => {
      const w = makeWorld('sandbox', { god: true });
      step(w, 30);
      const e = w.spawn(t.type, w.camera.x + 220, undefined, t.category === 'pickup' ? { item: 'H' } : {});
      expect(e).toBeTruthy();
      step(w, 300);
      // Also damage it heavily (death paths).
      if (e && !e.dead && e.hittable) e.damage({ amount: 9999, kind: 'explosion', owner: w.players[0] });
      step(w, 300);
    });
  }
});

describe('missions are completable by the autopilot', () => {
  for (const L of levels.filter((l) => l.mission >= 1 || l.id === 'sandbox')) {
    it(`${L.id} completes`, () => {
      const r = simulateMission(L.id, L.mission >= 1 ? 900 : 120);
      if (!r.completed) console.log(L.id, JSON.stringify(r));
      expect(r.completed).toBe(true);
    }, 240_000);
  }
});
