// Front-end / game-flow regression tests (review pass): input layouts and remaps, focus loss,
// drop-in co-op, the ending squad, tally rows and mission presentation data.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import './helpers';
import { app } from '../src/app';
import { SceneManager } from '../src/engine/scene';
import { input, InputManager, DEFAULT_BINDINGS, type ActionMask } from '../src/engine/input';
import { settings } from '../src/engine/storage';
import { installUiFlow } from '../src/scenes/install';
import { GameplayScene } from '../src/scenes/gameplay';
import { EndingScene, endingSquad } from '../src/scenes/ending';
import { TallyScene } from '../src/scenes/tally';
import { GameSession } from '../src/game/session';
import { characters } from '../src/game/characters';
import { missionInfo, countHostages } from '../src/content/ui/missions';
import { getLevel } from '../src/game/level';
import { RESPAWN_INVULN } from '../src/game/player';
import { joinKey } from '../src/game/hud';
import { layoutLabel, sharedKeysHint } from '../src/scenes/ui';
import { KeyRemapScene, assignKey } from '../src/scenes/options';

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

const g = fakeCtx() as CanvasRenderingContext2D;
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
  input.setVirtual(1, null);
  input.twoPlayerKeyboard = false;
  input.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
});

function run(seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    input.poll(DT);
    app.scenes.update(DT);
    if (i % 4 === 0) app.scenes.render(g);
  }
}

function press(mask: ActionMask, player = 0): void {
  input.setVirtual(player, null);
  input.poll(DT);
  input.setVirtual(player, mask);
  input.poll(DT);
  app.scenes.update(DT);
  input.setVirtual(player, null);
  input.poll(DT);
  app.scenes.update(DT);
}

/** A private input manager with keys held down (no DOM needed). */
function keyboard(): { im: InputManager; down: (...codes: string[]) => void; up: () => void } {
  const im = new InputManager();
  const held: Set<string> = (im as any).keysDown;
  return {
    im,
    down: (...codes) => {
      for (const c of codes) held.add(c);
      im.poll(DT);
    },
    up: () => {
      held.clear();
      im.poll(DT);
    },
  };
}

describe('keyboard layouts', () => {
  it('solo extras give player 1 the arrows and Z/X/C', () => {
    const k = keyboard();
    k.down('ArrowRight', 'KeyZ');
    expect(k.im.player(0).held('right')).toBe(true);
    expect(k.im.player(0).held('fire')).toBe(true);
    k.up();
    k.down('KeyX');
    expect(k.im.player(0).held('jump')).toBe(true);
  });

  it('a remapped key wins over the solo extra (fire=X, jump=Z does not do both)', () => {
    const k = keyboard();
    k.im.bindings.p1.fire = ['KeyX'];
    k.im.bindings.p1.jump = ['KeyZ'];
    k.down('KeyX');
    expect(k.im.player(0).held('fire')).toBe(true);
    expect(k.im.player(0).held('jump')).toBe(false);
    k.up();
    k.down('KeyZ');
    expect(k.im.player(0).held('jump')).toBe(true);
    expect(k.im.player(0).held('fire')).toBe(false);
  });

  it('in the solo layout player 2 ignores keys player 1 is using', () => {
    const k = keyboard();
    // Player 2 remapped FIRE onto Z, which is player 1's solo fire key: firing must not join P2.
    k.im.bindings.p2.fire = ['KeyZ'];
    k.down('KeyZ');
    expect(k.im.player(0).held('fire')).toBe(true);
    expect(k.im.player(1).held('fire')).toBe(false);
    k.up();
    // Arrows belong to player 1 in the solo layout...
    k.down('ArrowLeft');
    expect(k.im.player(0).held('left')).toBe(true);
    expect(k.im.player(1).held('left')).toBe(false);
    k.up();
    // ...but player 2's own keys still join.
    k.down('ShiftRight');
    expect(k.im.player(1).held('start')).toBe(true);
    k.up();
    // Sharing the keyboard: arrows go to player 2 only.
    k.im.twoPlayerKeyboard = true;
    k.down('ArrowLeft');
    expect(k.im.player(0).held('left')).toBe(false);
    expect(k.im.player(1).held('left')).toBe(true);
  });

  it('labels the shared-keyboard layout from the live bindings', () => {
    expect(layoutLabel(DEFAULT_BINDINGS.p1)).toBe('WASD + J K L');
    expect(layoutLabel(DEFAULT_BINDINGS.p2)).toBe('ARROWS + , . /');
    expect(sharedKeysHint()).toContain('1P: WASD + J K L');
  });
});

describe('focus loss', () => {
  it('releases held keys and touch controls and notifies the game', () => {
    const k = keyboard();
    let lost = 0;
    k.im.onFocusLost = () => lost++;
    k.down('KeyD', 'KeyJ');
    expect(k.im.player(0).held('right')).toBe(true);
    k.im.touch.state.fire = true;
    k.im.touch.enabled = true;
    k.im.focusLost();
    k.im.poll(DT);
    expect(lost).toBe(1);
    expect(k.im.player(0).held('right')).toBe(false);
    expect(k.im.player(0).held('fire')).toBe(false);
    expect(k.im.touch.state.fire).toBe(false);
  });

  it('gameplay pauses itself, but not in the demo or once the mission is over', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 1 });
    const gp = new GameplayScene(s);
    app.scenes.set(gp, { fade: false });
    run(0.5);
    expect(gp.autoPause()).toBe(true);
    expect(app.scenes.current?.name).toBe('pause');
    // Already paused: nothing more is pushed.
    expect(gp.autoPause()).toBe(false);
    app.scenes.pop();
    expect(app.scenes.current).toBe(gp);
    gp.phase = 'complete';
    expect(gp.autoPause()).toBe(false);
    const demo = new GameplayScene(new GameSession({ characters: ['dex', 'juno'], mission: 1 }), undefined, { demo: true, onDemoEnd: () => {} });
    app.scenes.set(demo, { fade: false });
    expect(demo.autoPause()).toBe(false);
    expect(app.scenes.current).toBe(demo);
  });
});

describe('pause menu with real key presses', () => {
  /** Hold a key for a few frames like a human does (keydown latch + held), then release. */
  const holdKey = (code: string, frames = 6) => {
    const held: Set<string> = (input as any).keysDown;
    const latch: Set<string> = (input as any).keyTapLatch;
    held.add(code);
    latch.add(code);
    for (let i = 0; i < frames; i++) {
      input.poll(DT);
      app.scenes.update(DT);
    }
    held.delete(code);
    for (let i = 0; i < 3; i++) {
      input.poll(DT);
      app.scenes.update(DT);
    }
  };
  it('ESC / P / ENTER held for several frames pause and resume cleanly (no instant re-pause)', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], mission: 1 });
    const gp = new GameplayScene(s);
    app.scenes.set(gp, { fade: false });
    run(1);
    holdKey('Escape');
    expect(app.scenes.stack.map((x) => x.name)).toEqual(['gameplay', 'pause']);
    run(0.3);
    holdKey('Escape');
    expect(app.scenes.stack.map((x) => x.name)).toEqual(['gameplay']);
    holdKey('KeyP');
    expect(app.scenes.current?.name).toBe('pause');
    run(0.3);
    holdKey('KeyP');
    expect(app.scenes.current?.name).toBe('gameplay');
    // ENTER on RESUME (ENTER is also player 1's START).
    holdKey('Escape');
    run(0.3);
    holdKey('Enter');
    expect(app.scenes.current?.name).toBe('gameplay');
    // A fire button held through the pause does not count as a new press afterwards.
    expect(input.player(0).pressed('start')).toBe(false);
  });

  it('a pause key remapped to a game action (JUMP on ENTER, FIRE on P) does not pause', () => {
    // Through the remap screen's own logic (ENTER moves from START to JUMP, START gets K).
    const saved = JSON.parse(JSON.stringify(settings.bindings));
    settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    assignKey(0, 'jump', 'Enter');
    assignKey(0, 'fire', 'KeyP');
    expect(input.bindings.p1.start).toEqual(['KeyK']);
    const s = new GameSession({ characters: ['dex', 'juno'], mission: 1 });
    const gp = new GameplayScene(s);
    app.scenes.set(gp, { fade: false });
    run(1.5);
    const p1 = gp.world.players[0];
    const y0 = p1.y;
    const shots0 = gp.world.stats.shotsFired;
    holdKey('Enter', 4);
    expect(app.scenes.current?.name).toBe('gameplay');
    expect(p1.y).toBeLessThan(y0);
    run(1);
    holdKey('KeyP', 2);
    expect(app.scenes.current?.name).toBe('gameplay');
    expect(gp.world.stats.shotsFired).toBeGreaterThan(shots0);
    // ESC still pauses.
    holdKey('Escape');
    expect(app.scenes.current?.name).toBe('pause');
    settings.bindings = saved;
    input.bindings = settings.bindings;
  });
});

describe('drop-in co-op', () => {
  it('player 2 dropping into the gyro mission gets the respawn invulnerability', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 5 });
    const gp = new GameplayScene(s);
    app.scenes.set(gp, { fade: false });
    run(3);
    press({ start: true }, 1);
    expect(s.players[1].joined).toBe(true);
    run(0.1);
    const p2 = gp.world.players.find((p) => p.index === 1)!;
    expect(p2).toBeTruthy();
    expect(p2.vehicle).toBeTruthy();
    expect(p2.vehicle!.invuln).toBeGreaterThan(RESPAWN_INVULN - 0.5);
    // Exactly one gyro per player.
    const gyros = gp.world.entities.filter((e) => e.type === 'gyro' && !e.dead);
    expect(gyros.length).toBe(2);
  });

  it('player 2 dropping in on foot lands near player 1 with invulnerability', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 1 });
    const gp = new GameplayScene(s);
    app.scenes.set(gp, { fade: false });
    run(3);
    const p1 = gp.world.players[0];
    press({ fire: true }, 1);
    run(0.1);
    const p2 = gp.world.players.find((p) => p.index === 1)!;
    expect(p2.invuln).toBeGreaterThan(RESPAWN_INVULN - 0.5);
    expect(Math.abs(p2.x - p1.x)).toBeLessThan(80);
    // ...beside player 1, not hidden on top of them.
    expect(Math.abs(p2.x - p1.x)).toBeGreaterThanOrEqual(16);
  });
});

describe('ending', () => {
  const ids = characters().map((c) => c.id);
  const squadOf = (a: string, b?: string) => {
    const s = new GameSession({ characters: [a, b], twoPlayer: !!b });
    return endingSquad(s);
  };
  it('the whole squad celebrates, whoever was picked', () => {
    for (const a of ids)
      for (const b of [undefined, ...ids]) {
        const sq = squadOf(a, b);
        for (const id of ids) expect(sq.some((m) => m.id === id)).toBe(true);
        expect(sq.length).toBe(a === b ? ids.length + 1 : ids.length);
      }
  });
  it("player 2's soldier wears player 2's colors; a shared pick shows both", () => {
    const sq = squadOf('juno', 'dex');
    expect(sq.find((m) => m.id === 'dex')!.p2).toBe(true);
    expect(sq.find((m) => m.id === 'juno')!.p2).toBe(false);
    const twin = squadOf('mika', 'mika');
    expect(twin.filter((m) => m.id === 'mika').map((m) => m.p2)).toEqual([false, true]);
  });
  it('the ending scene uses it', () => {
    const s = new GameSession({ characters: ['juno', 'dex'], twoPlayer: true });
    const e = new EndingScene(s) as any;
    expect(e.squad.length).toBe(ids.length);
  });
  it('ENTER (confirm + start) skips one phase at a time, START skips to the credits', () => {
    const s = new GameSession({ characters: ['dex', 'juno'] });
    const e = new EndingScene(s);
    app.scenes.set(e, { fade: false });
    run(1);
    expect(e.phase).toBe(0);
    const held: Set<string> = (input as any).keysDown;
    const tapKey = (code: string) => {
      held.add(code);
      input.poll(DT);
      app.scenes.update(DT);
      held.delete(code);
      input.poll(DT);
      app.scenes.update(DT);
    };
    tapKey('Enter');
    expect(e.phase).toBe(1);
    tapKey('Enter');
    expect(e.phase).toBe(2);
    expect(e.creditsDone).toBe(false);
    tapKey('Enter'); // not settled yet: no skipping the roll
    expect(e.creditsDone).toBe(false);
    expect(app.scenes.current).toBe(e);
    const e2 = new EndingScene(s);
    app.scenes.set(e2, { fade: false });
    run(1);
    tapKey('KeyP'); // a pure START key
    expect(e2.phase).toBe(2);
  });
});

describe('tally and mission data', () => {
  it('the tally grades hostages freed out of the level total', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], mission: 1 });
    const t = new TallyScene(s, { mission: 1, kills: 10, rescues: 4, time: 100, shotsFired: 300, playerRescues: [4, 0], levelId: 'm1' });
    expect(t.hostageTotal).toBe(countHostages(getLevel('m1')));
    expect(t.hostageTotal).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) {
      t.update(DT);
      if (i % 10 === 0) t.render(g);
    }
  });
  it('every mission shows an operation codename', () => {
    for (let n = 1; n <= 6; n++) expect(missionInfo(n).subtitle).toMatch(/^OPERATION [A-Z ]+$/);
  });
});

describe('key remapping', () => {
  it('reports the other player actions a steal leaves without a key', () => {
    const saved = JSON.parse(JSON.stringify(settings.bindings));
    settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    expect(assignKey(0, 'bomb', 'ArrowUp')).toEqual(['up']); // P2's only AIM UP key
    expect(settings.bindings.p2.up).toEqual([]);
    expect(assignKey(0, 'fire', 'Comma')).toEqual([]); // P2 still has Numpad1 for FIRE
    const r = new KeyRemapScene(0) as any;
    r.capturing = 'jump';
    r.captureT = 1;
    r.onKey('ArrowDown');
    expect(r.notice?.text).toContain("2P'S CROUCH / DOWN");
    for (let i = 0; i < 10; i++) {
      r.update(DT);
      r.render(g);
    }
    settings.bindings = saved;
    input.bindings = settings.bindings;
  });
});

describe('join prompt', () => {
  it("names player 2's real START key on the keyboard, START on a gamepad", () => {
    const savedDev = input.lastDevice;
    const saved = input.bindings.p2.start;
    input.lastDevice = 'keyboard';
    expect(joinKey()).toBe('RSHIFT');
    input.bindings.p2.start = ['KeyQ'];
    expect(joinKey()).toBe('Q');
    input.bindings.p2.start = [];
    expect(joinKey()).toBe('START');
    input.lastDevice = 'gamepad';
    input.bindings.p2.start = saved;
    expect(joinKey()).toBe('START');
    input.lastDevice = savedDev;
  });
});
