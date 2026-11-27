// Regression tests for mission-content fixes: lightning vs the SCREEN FLASHES option, and
// mechanics/boss polish (ladle globs, crusher push-out, HUD clearances).
import { describe, expect, it } from 'vitest';
import '../src/content/index';
import { flashAt, SOFT_FLASH } from '../src/content/themes/m5/sky';
import { lightning, strikeAmount } from '../src/content/themes/m4/weather';
import { Ladle, MoltenGlob, SPLASH_EDGE } from '../src/content/levels/m6/ladle';
import { GroundMarker } from '../src/content/bosses/common/fx';
import { Crusher } from '../src/content/levels/m6/crusher';
import { FloorMark, SHADOW_ALPHA } from '../src/content/bosses/m3/parts';
import { VIEW_W } from '../src/engine/renderer';
import type { LevelDef } from '../src/game/level';
import type { World } from '../src/game/world';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import type { Entity } from '../src/game/entity';

/** Brightness samples of every flash event in [0, seconds) at 1/240 s. */
function events(sample: (t: number) => number, seconds: number): number[][] {
  const out: number[][] = [];
  let cur: number[] | null = null;
  for (let t = 0; t < seconds; t += 1 / 240) {
    const k = sample(t);
    if (k > 0) (cur ??= []).push(k);
    else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

/** Rises then falls: no dip followed by a second rise (a flicker). */
function singleSwell(ks: number[]): boolean {
  let falling = false;
  for (let i = 1; i < ks.length; i++) {
    if (ks[i] < ks[i - 1] - 1e-9) falling = true;
    else if (falling && ks[i] > ks[i - 1] + 1e-9) return false;
  }
  return true;
}

describe('lightning honors the SCREEN FLASHES option', () => {
  it('m5 storm clouds: full double flicker when on, a soft single swell when off', () => {
    const on = events((t) => flashAt(t, 1, true)?.k ?? 0, 120);
    const off = events((t) => flashAt(t, 1, false)?.k ?? 0, 120);
    expect(on.length).toBeGreaterThan(20);
    expect(off.length).toBe(on.length);
    expect(Math.max(...on.flat())).toBe(1);
    expect(on.some((e) => !singleSwell(e))).toBe(true);
    expect(Math.max(...off.flat())).toBeLessThanOrEqual(SOFT_FLASH + 1e-9);
    for (const e of off) expect(singleSwell(e)).toBe(true);
  });

  it('m5 bolts do not blink when flashes are off', () => {
    const bolts = events((t) => (flashAt(t, 1, false)?.bolt ? 1 : 0), 120);
    const boltsOn = events((t) => (flashAt(t, 1, true)?.bolt ? 1 : 0), 120);
    expect(bolts.length).toBeGreaterThan(3);
    // Each bolt is one continuous showing (when on, each blinks: twice as many showings).
    expect(boltsOn.length).toBeGreaterThan(bolts.length * 1.5);
  });

  it('m4 harbour strikes: a soft single swell when off', () => {
    const off = events((t) => strikeAmount(lightning(t), false), 300);
    const on = events((t) => strikeAmount(lightning(t), true), 300);
    expect(off.length).toBeGreaterThan(3);
    expect(on.some((e) => !singleSwell(e))).toBe(true);
    for (const e of off) expect(singleSwell(e)).toBe(true);
    expect(Math.max(...off.flat())).toBeLessThanOrEqual(0.6 + 1e-9);
  });
});

// ------------------------------------------------------------------ m6 mechanics

function bench(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'fix_bench',
    mission: 0,
    name: 'BENCH',
    theme: 'm6',
    music: 'm6',
    width: 1600,
    height: 216,
    start: { x: 60 },
    ground: [
      [
        [0, 180],
        [1600, 180],
      ],
    ],
    ...extra,
  };
}

/** Run until the ladle starts pouring; returns the markers and globs it made. */
function pour(w: World, la: Ladle): { markers: GroundMarker[]; globs: MoltenGlob[] } {
  const before = new Set(w.entities);
  for (let i = 0; i < 60 * 8 && la.state !== 'pour'; i++) step(w, 1);
  expect(la.state).toBe('pour');
  step(w, 1);
  const fresh = w.entities.filter((e) => !before.has(e));
  return {
    markers: fresh.filter((e): e is GroundMarker => e instanceof GroundMarker),
    globs: fresh.filter((e): e is MoltenGlob => e instanceof MoltenGlob),
  };
}

/** A context that records the globalAlpha of every fill. */
function alphaRecorder(): { g: CanvasRenderingContext2D; alphas: number[] } {
  const alphas: number[] = [];
  const store: Record<string, unknown> = { globalAlpha: 1 };
  const g = new Proxy(store, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'fillRect' || k === 'fill') return () => alphas.push(store.globalAlpha as number);
      return () => undefined;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { g, alphas };
}

describe('FROST BASTION floor shadows read on snow', () => {
  it('start at SHADOW_ALPHA (not a faint grey) and darken toward impact', () => {
    const mark = new FloorMark(100, 180, 1, 'shadow', 9);
    const a = alphaRecorder();
    mark.render(a.g);
    expect(a.alphas.length).toBeGreaterThan(0);
    expect(Math.min(...a.alphas)).toBeGreaterThanOrEqual(SHADOW_ALPHA - 1e-9);
    expect(SHADOW_ALPHA).toBeGreaterThanOrEqual(0.4);
    mark.life = 0.1; // progress 0.9
    const b = alphaRecorder();
    mark.render(b.g);
    expect(Math.max(...b.alphas)).toBeGreaterThan(0.7);
  });
});

describe('HORNET KING keeps its rotors under the boss HP bar', () => {
  it('never climbs above the top of its flight band after the entrance (phase 2 wobble included)', () => {
    const w = makeWorld('bosstest_m2', { god: true, seed: 4 });
    const bots = w.players.map((p) => new Bot(p.index));
    let maxAlt = 0;
    let fought = 0;
    let hurt = false;
    for (let i = 0; i < 60 * 80; i++) {
      step(w, 1, bots);
      const b = w.boss as (Entity & { groundY: number; state: string; introDone: boolean; dying: boolean }) | null;
      if (!b || b.dying || !b.introDone || b.state === 'intro') continue;
      fought++;
      if (!hurt && fought > 60 * 15) {
        hurt = true;
        b.damage({ amount: b.hp - b.maxHp * 0.4, kind: 'explosion', owner: w.players[0], x: b.x, y: b.y });
      }
      maxAlt = Math.max(maxAlt, b.groundY - b.y);
    }
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    expect(hurt).toBe(true);
    expect(fought).toBeGreaterThan(60 * 18);
    // Pivot <= 88 px above the floor: the rotor discs (~57 px above it) stay under y ~43.
    expect(maxAlt).toBeLessThanOrEqual(88);
    expect(maxAlt).toBeGreaterThan(70);
  }, 60_000);
});

describe('m6 crusher', () => {
  for (const [label, dx] of [
    ['left of center', -5],
    ['right of center', 6],
  ] as const) {
    it(`squeezes an invulnerable player (${label}) out of the head to the nearer side`, () => {
      const w = makeWorld(bench(), { god: false });
      step(w, 90);
      const cr = w.spawn('m6_crusher', 200, 180, { cycle: 3.4 }) as Crusher;
      const p = w.players[0];
      p.x = 200 + dx;
      p.y = 180;
      p.invuln = 5; // respawn blink: the hit cannot connect
      let inside = 0;
      for (let i = 0; i < 60 * 4; i++) {
        p.vx = 0;
        step(w, 1);
        if ((cr.state === 'slam' || cr.state === 'hold') && Math.abs(p.x - cr.x) < cr.headW / 2 + p.w / 2 - 1 && cr.headBottom > p.y - p.h + 1) inside++;
      }
      expect(p.state).toBe('play');
      expect(inside).toBeLessThanOrEqual(1);
      expect(Math.sign(p.x - cr.x)).toBe(Math.sign(dx));
    });
  }
});

describe('m6 ladle splashes stay in view', () => {
  it('a ladle hanging just off screen pours without lobbing globs in', () => {
    const w = makeWorld(bench(), { god: true });
    step(w, 60);
    const cam = w.camera.x;
    const la = w.spawn('m6_ladle', cam + VIEW_W + 20, 180, { cycle: 3.2, splash: 4 }) as Ladle;
    const { globs } = pour(w, la);
    expect(w.camera.x).toBe(cam);
    expect(globs.length).toBe(0);
  });

  it('a ladle at the edge of the view lands every glob (and its marker) inside the view', () => {
    for (const side of [-1, 1]) {
      const w = makeWorld(bench(), { god: true });
      step(w, 60);
      const cam = w.camera.x;
      const x = side < 0 ? cam + 6 : cam + VIEW_W - 6;
      const la = w.spawn('m6_ladle', x, 180, { cycle: 3.2, splash: 4 }) as Ladle;
      const { markers, globs } = pour(w, la);
      expect(w.camera.x).toBe(cam);
      expect(globs.length).toBe(4);
      const splashMarks = markers.filter((m) => m.radius === 6);
      expect(splashMarks.length).toBe(4);
      for (const m of splashMarks) {
        expect(m.x).toBeGreaterThanOrEqual(cam + SPLASH_EDGE);
        expect(m.x).toBeLessThanOrEqual(cam + VIEW_W - SPLASH_EDGE);
      }
    }
  });
});
