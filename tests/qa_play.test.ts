// Regression tests for problems found in the first-time-player playtest of the release build.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import { input, DEFAULT_BINDINGS } from '../src/engine/input';
import { VIEW_W } from '../src/engine/renderer';
import { SceneManager } from '../src/engine/scene';
import { app } from '../src/app';
import { installUiFlow } from '../src/scenes/install';
import { GameplayScene } from '../src/scenes/gameplay';
import { PauseScene } from '../src/scenes/pause';
import { GameSession } from '../src/game/session';
import { CONTROLS_HINT_SECONDS, Hud } from '../src/game/hud';
import type { LevelDef } from '../src/game/level';
import type { Enemy } from '../src/game/enemy';

const DT = 1 / 60;

function fakeCtx(): any {
  const store: Record<string | symbol, any> = { globalAlpha: 1 };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'createPattern') return () => ({});
      if (k === 'measureText') return () => ({ width: 0 });
      return () => undefined;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}
const hadDocument = 'document' in globalThis;

beforeAll(() => {
  if (!hadDocument) (globalThis as any).document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => fakeCtx() }), getElementById: () => null };
  app.scenes = new SceneManager();
  app.scenes.onChange = () => input.flush();
  installUiFlow();
});

afterAll(() => {
  if (!hadDocument) delete (globalThis as any).document;
});

afterEach(() => {
  input.setVirtual(0, null);
  input.twoPlayerKeyboard = false;
  input.p1Device = null;
  input.lastDevice = 'keyboard';
  input.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
});

/** Flat ground with a 12 px step down at x 300-312 (m4's promenade above the street). */
const STEP: LevelDef = {
  id: 'qa_step',
  mission: 0,
  name: 'STEP',
  theme: 'default',
  music: 'm1',
  width: 900,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 168],
      [300, 168],
      [312, 180],
      [900, 180],
    ],
  ],
};

/** Player standing at x on the upper step, firing the pistol straight ahead for `frames`. */
function shootFromStep(type: string, ex: number, crouch: boolean, frames = 240): { killed: boolean; py: number; ey: number } {
  const w = makeWorld(STEP, { god: true });
  const p = w.players[0];
  p.x = 250;
  step(w, 90);
  p.invuln = 0;
  const e = w.spawn(type, ex, undefined, { behavior: 'guard', facing: -1 }) as Enemy;
  step(w, 2);
  let fire = false;
  for (let i = 0; i < frames && !e.dying && !e.dead; i++) {
    fire = !fire;
    input.setVirtual(0, { fire, down: crouch });
    p.facing = 1;
    step(w, 1);
  }
  input.setVirtual(0, null);
  return { killed: e.dying || e.dead, py: p.y, ey: e.y };
}

describe('straight shots reach a soldier one step below', () => {
  for (const crouch of [false, true]) {
    it(`pistol from a 12 px higher ledge kills a guard on the street (crouch=${crouch})`, () => {
      const r = shootFromStep('rifleman', 420, crouch);
      expect(r.ey - r.py).toBe(12);
      expect(r.killed).toBe(true);
    });
  }

  it('the same holds for other infantry on the street (bazooka, officer)', () => {
    for (const t of ['bazooka', 'officer']) expect(shootFromStep(t, 430, false).killed, t).toBe(true);
  });
});

describe('mission 1 shows which key does what', () => {
  const labels = () => Hud.controlsItems().map((i) => `${i.keys.join('')} ${i.label}`);

  it('keyboard, solo: the classic arrows + Z X C layout, read from the live bindings', () => {
    expect(labels()).toEqual(['←→ MOVE', '↑ AIM', 'Z FIRE', 'X JUMP', 'C BOMB']);
    // A remap is reflected: FIRE moved to X, so the solo extra X no longer jumps (SPACE still does).
    input.bindings.p1.fire = ['KeyX'];
    expect(labels()).toEqual(['←→ MOVE', '↑ AIM', 'Z FIRE', 'SPACE JUMP', 'C BOMB']);
    expect(Hud.controlsWidth(Hud.controlsItems()) + 12).toBeLessThanOrEqual(VIEW_W - 16);
  });

  it('keyboard shared by two players: player 1 own keys; gamepad: pad buttons; touch: nothing', () => {
    input.twoPlayerKeyboard = true;
    expect(labels()).toEqual(['AD MOVE', 'W AIM', 'J FIRE', 'K JUMP', 'L BOMB']);
    input.twoPlayerKeyboard = false;
    input.p1Device = 'gamepad';
    expect(labels()).toEqual(['X FIRE', 'A JUMP', 'B BOMB']);
    input.p1Device = 'touch';
    expect(labels()).toEqual([]);
  });

  it('the strip fits the screen', () => {
    for (const dev of ['keyboard', 'gamepad'] as const) {
      input.p1Device = dev;
      expect(Hud.controlsWidth(Hud.controlsItems()) + 12, dev).toBeLessThanOrEqual(VIEW_W - 16);
    }
  });

  it('shows for the first seconds of mission 1 only (not later missions, not the demo)', () => {
    const gp = new GameplayScene(new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 1 }));
    app.scenes.set(gp, { fade: false });
    expect(gp.hud.controlsHint).toBe(CONTROLS_HINT_SECONDS);
    // Drawn while playing, not under the pause menu (its footer sits on the same line).
    let drawn = 0;
    (gp.hud as any).controlsStrip = () => drawn++;
    const g = fakeCtx() as CanvasRenderingContext2D;
    app.scenes.render(g);
    expect(drawn).toBe(1);
    app.scenes.push(new PauseScene(gp));
    app.scenes.render(g);
    expect(gp.hud.covered).toBe(true);
    expect(drawn).toBe(1);
    app.scenes.pop();
    app.scenes.render(g);
    expect(drawn).toBe(2);
    for (let i = 0; i < Math.round((CONTROLS_HINT_SECONDS + 0.5) / DT); i++) {
      input.poll(DT);
      app.scenes.update(DT);
    }
    expect(gp.hud.controlsHint).toBe(0);
    const m2 = new GameplayScene(new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 2 }));
    app.scenes.set(m2, { fade: false });
    expect(m2.hud.controlsHint).toBe(0);
    const demo = new GameplayScene(new GameSession({ characters: ['dex', 'juno'], mission: 1 }), undefined, { demo: true, onDemoEnd: () => {} });
    app.scenes.set(demo, { fade: false });
    expect(demo.hud.controlsHint).toBe(0);
  });
});
