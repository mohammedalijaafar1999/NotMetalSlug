// UI / front-end tests: menu widget logic, high score ordering, name entry, tally math, HUD
// helpers, key remapping, canonical sound names, and the whole scene flow driven headless
// (every screen updates and renders against a fake 2D context without throwing).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import './helpers';
import { app } from '../src/app';
import { SceneManager, type Scene } from '../src/engine/scene';
import { input, DEFAULT_BINDINGS, type ActionMask } from '../src/engine/input';
import { addHighScore, getHighScores, qualifiesForHighScore, resetHighScores, settings, progress } from '../src/engine/storage';
import { flow, type MissionStats } from '../src/scenes/flow';
import { installUiFlow } from '../src/scenes/install';
import { Menu } from '../src/scenes/menu';
import { UI_SFX_NAMES, ordinal, formatTime, fitText, uiInput } from '../src/scenes/ui';
import { TitleScene, ATTRACT_IDLE } from '../src/scenes/title';
import { CharSelectScene } from '../src/scenes/charselect';
import { BriefingScene } from '../src/scenes/briefing';
import { MissionSelectScene, missionUnlocked } from '../src/scenes/missionselect';
import { OptionsScene, KeyRemapScene, assignKey } from '../src/scenes/options';
import { ControlsScene } from '../src/scenes/controls';
import { HighScoresScene, missionLabel } from '../src/scenes/highscores';
import { SoundTestScene } from '../src/scenes/soundtest';
import { CreditsScene, creditLines, creditsHeight } from '../src/scenes/credits';
import { TallyScene, RESCUE_BONUS, missionRank, accuracy } from '../src/scenes/tally';
import { GameOverScene, NameEntryScene, applyNameCell, finalName, rankFor, GRID_ROWS, NAME_LEN } from '../src/scenes/gameover';
import { EndingScene } from '../src/scenes/ending';
import { PauseScene } from '../src/scenes/pause';
import { GameplayScene, CONTINUE_SECONDS } from '../src/scenes/gameplay';
import { BootScene } from '../src/scenes/core-scenes';
import { GameSession } from '../src/game/session';
import { weaponShortName, continueState, Hud } from '../src/game/hud';
import { MISSIONS, missionInfo, countHostages } from '../src/content/ui/missions';
import { getLevel } from '../src/game/level';
import { sprites } from '../src/engine/sprites';
import { faceSprite } from '../src/content/ui/art';

const DT = 1 / 60;

// ------------------------------------------------------------------ fake canvas / DOM

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

function fakeCanvas(): any {
  const ctx = fakeCtx();
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

const g = fakeCtx() as CanvasRenderingContext2D;
const hadDocument = 'document' in globalThis;

beforeAll(() => {
  if (!hadDocument) (globalThis as any).document = { createElement: () => fakeCanvas(), getElementById: () => null };
  app.scenes = new SceneManager();
  app.scenes.onChange = () => input.flush();
  installUiFlow();
});

afterAll(() => {
  if (!hadDocument) delete (globalThis as any).document;
  input.setVirtual(0, null);
  input.setVirtual(1, null);
});

// ------------------------------------------------------------------ helpers

/** Run the scene manager for `seconds` (polling input, rendering every few frames). */
function run(seconds: number, render = true): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    input.poll(DT);
    app.scenes.update(DT);
    if (render && i % 4 === 0) app.scenes.render(g);
  }
}

/** Press (then release) a player-1 action through virtual input. */
function press(mask: ActionMask, player = 0): void {
  // A scene change flushes input so held buttons don't re-trigger: start from "released".
  input.setVirtual(player, null);
  input.poll(DT);
  input.setVirtual(player, mask);
  input.poll(DT);
  app.scenes.update(DT);
  input.setVirtual(player, null);
  input.poll(DT);
  app.scenes.update(DT);
}

function scene(): string {
  return app.scenes.current?.name ?? '';
}

/** Update + render a standalone scene for a while. */
function exercise(s: Scene, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    s.update(DT);
    if (i % 3 === 0) s.render(g);
  }
}

function stats(over: Partial<MissionStats> = {}): MissionStats {
  return { mission: 1, kills: 40, rescues: 3, time: 125, shotsFired: 400, playerRescues: [2, 1], playerKills: [30, 10], ...over };
}

// ------------------------------------------------------------------ pure helpers

describe('ui helpers', () => {
  it('formats ordinals, times and fits text', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1ST', '2ND', '3RD', '4TH', '11TH', '12TH', '13TH', '21ST', '22ND', '101ST']);
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(125.7)).toBe('2:05');
    expect(fitText('SHORT', 100)).toBe('SHORT');
    const long = fitText('A VERY LONG LINE OF TEXT THAT DOES NOT FIT', 60);
    expect(long.endsWith('..')).toBe(true);
    expect(long.length).toBeLessThan(20);
  });
  it('weapon short names fit the HUD', () => {
    expect(weaponShortName('hmg', 'HEAVY MACHINE GUN')).toBe('H.M.G.');
    expect(weaponShortName('pistol', 'PISTOL')).toBe('PISTOL');
    expect(weaponShortName('mystery', 'SUPER LONG NAMED CANNON')).toBe('S.L.N.C.');
    expect(weaponShortName('zap', 'ZAPPER')).toBe('ZAPPER');
  });
  it('mission info falls back to the design table and counts hostages', () => {
    expect(MISSIONS).toHaveLength(6);
    for (let n = 1; n <= 6; n++) {
      const m = missionInfo(n);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.briefing.length).toBeGreaterThan(40);
      expect(m.boss.length).toBeGreaterThan(0);
    }
    expect(missionInfo(0).name).toBe('PROVING GROUNDS');
    expect(countHostages(getLevel('sandbox'))).toBeGreaterThanOrEqual(1);
    expect(countHostages(undefined)).toBe(0);
  });
  it('mission ranks and accuracy', () => {
    expect(missionRank(5, 0)).toBeNull();
    expect(missionRank(8, 8)).toBe('S');
    expect(missionRank(6, 8)).toBe('A');
    expect(missionRank(4, 8)).toBe('B');
    expect(missionRank(1, 8)).toBe('C');
    expect(accuracy(10, 100)).toBe(10);
    expect(accuracy(10, 0)).toBe(100);
    expect(accuracy(500, 100)).toBe(100);
  });
  it('continue state summarises the session', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: true });
    expect(continueState(s, [-1, -1])).toEqual({ allOut: false, counting: false, time: -1 });
    s.players[0].out = true;
    expect(continueState(s, [5, -1]).allOut).toBe(false);
    s.players[1].out = true;
    expect(continueState(s, [5, 3])).toEqual({ allOut: true, counting: true, time: 5 });
    expect(continueState(s, [-1, -1]).counting).toBe(false);
  });
  it('credits roll has content and a positive height', () => {
    const lines = creditLines();
    expect(lines.some((l) => l.logo)).toBe(true);
    expect(lines.some((l) => l.t?.includes('RUCKUS TEAM'))).toBe(true);
    expect(creditsHeight(lines)).toBeGreaterThan(300);
  });
  it('face portraits are defined lazily and draw pixels', () => {
    const name = faceSprite('dex');
    expect(sprites.has(name)).toBe(true);
    expect(sprites.get(name).pixelArt(0).opaqueCount()).toBeGreaterThan(40);
    expect(sprites.get(faceSprite('mika', true)).pixelArt(0).opaqueCount()).toBeGreaterThan(40);
  });
});

// ------------------------------------------------------------------ menu widget

describe('menu widget', () => {
  it('skips sections/disabled items, wraps, adjusts values and confirms', () => {
    let value = 5;
    let fired = 0;
    let back = 0;
    const m = new Menu([
      { label: 'HEADER', section: true },
      { label: 'VALUE', value: () => String(value), left: () => value--, right: () => value++ },
      { label: 'LOCKED', disabled: true, action: () => (fired += 100) },
      { label: 'GO', action: () => fired++ },
    ]);
    m.onBack = () => back++;
    expect(m.index).toBe(1);
    app.scenes.set({ name: 'menu-test', update: (dt) => m.update(dt), render: () => m.render(g, 192, 40) }, { fade: false });
    press({ right: true });
    expect(value).toBe(6);
    press({ left: true });
    press({ left: true });
    expect(value).toBe(4);
    press({ down: true });
    expect(m.index).toBe(3); // skipped the disabled item
    press({ fire: true });
    expect(fired).toBe(1);
    press({ down: true });
    expect(m.index).toBe(1); // wrapped past the section header
    press({ up: true });
    expect(m.index).toBe(3);
    press({ bomb: true });
    expect(back).toBe(1);
    // Confirm on a value item without an action steps it right.
    press({ down: true });
    press({ fire: true });
    expect(value).toBe(5);
  });
  it('scrolls long lists to keep the selection visible', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ label: `ITEM ${i}`, action: () => {} }));
    const m = new Menu(items);
    m.visible = 8;
    app.scenes.set({ name: 'menu-test', update: (dt) => m.update(dt), render: () => m.render(g, 192, 20) }, { fade: false });
    for (let i = 0; i < 12; i++) press({ down: true });
    expect(m.index).toBe(12);
    m.render(g, 192, 20);
    expect(m.scroll).toBeGreaterThanOrEqual(12 - 7);
    expect(m.scroll).toBeLessThanOrEqual(12);
  });
  it('taps on items activate them', () => {
    let hit = '';
    const m = new Menu([
      { label: 'ONE', action: () => (hit = 'one') },
      { label: 'TWO', action: () => (hit = 'two') },
    ]);
    m.render(g, 192, 50, { spacing: 12, width: 100 });
    uiInput.flush();
    uiInput.injectTap(192, 63);
    m.update(DT);
    expect(hit).toBe('two');
    expect(m.index).toBe(1);
  });
});

// ------------------------------------------------------------------ high scores & name entry

describe('high scores', () => {
  it('stay sorted, capped at 10 and qualify correctly', () => {
    resetHighScores();
    const before = getHighScores();
    expect(before).toHaveLength(10);
    for (let i = 1; i < before.length; i++) expect(before[i - 1].score).toBeGreaterThanOrEqual(before[i].score);
    const low = before[9].score;
    expect(qualifiesForHighScore(low - 1)).toBe(false);
    expect(qualifiesForHighScore(low + 10)).toBe(true);
    expect(qualifiesForHighScore(0)).toBe(false);
    expect(rankFor(before[0].score + 1)).toBe(1);
    const rank = addHighScore({ name: 'ZZZ', score: before[2].score + 5, mission: 4, character: 'brick', date: '2026-01-01' });
    expect(rank).toBe(2);
    const after = getHighScores();
    expect(after).toHaveLength(10);
    expect(after[2].name).toBe('ZZZ');
    for (let i = 1; i < after.length; i++) expect(after[i - 1].score).toBeGreaterThanOrEqual(after[i].score);
    expect(missionLabel(7)).toContain('ALL');
    expect(missionLabel(3)).toBe('M3');
    resetHighScores();
  });
  it('name entry grid logic', () => {
    expect(GRID_ROWS.every((r) => r.length > 0)).toBe(true);
    expect(GRID_ROWS.flat()).toContain('END');
    let r = applyNameCell('', 'A');
    expect(r).toEqual({ name: 'A', done: false });
    r = applyNameCell(r.name, 'SPC');
    expect(r.name).toBe('A ');
    r = applyNameCell(r.name, 'DEL');
    expect(r.name).toBe('A');
    r = applyNameCell('ABC', 'D');
    expect(r.name).toBe('ABC'); // max length
    expect(applyNameCell('AB', 'END')).toEqual({ name: 'AB', done: true });
    expect(finalName('AB', 'dex')).toBe('AB ');
    expect(finalName('', 'juno')).toBe('JUN');
    expect(finalName('   ', 'dex')).toBe('DEX');
    expect(finalName('ABC', 'dex')).toHaveLength(NAME_LEN);
  });
  it('name entry scene records the score and shows the table', () => {
    resetHighScores();
    const s = new GameSession({ characters: ['mika', 'juno'], mission: 4 });
    s.players[0].score = 999999;
    app.scenes.set(new NameEntryScene(s, [0], false), { fade: false });
    // Pick "A", "B" then END.
    press({ fire: true });
    press({ right: true });
    press({ fire: true });
    press({ start: true });
    run(1);
    const top = getHighScores()[0];
    expect(top.score).toBe(999999);
    expect(top.name).toBe('AB ');
    expect(top.mission).toBe(4);
    expect(top.character).toBe('mika');
    expect(scene()).toBe('highscores');
    resetHighScores();
  });
});

// ------------------------------------------------------------------ options / key remap

describe('options', () => {
  it('key remap swaps conflicts within a player and steals from the other', () => {
    const saved = JSON.parse(JSON.stringify(settings.bindings));
    settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    assignKey(0, 'fire', 'KeyK'); // K was P1 jump
    expect(settings.bindings.p1.fire).toEqual(['KeyK']);
    expect(settings.bindings.p1.jump).toEqual(['KeyJ']); // swapped
    assignKey(0, 'bomb', 'Comma'); // Comma was a P2 fire key
    expect(settings.bindings.p1.bomb).toEqual(['Comma']);
    expect(settings.bindings.p2.fire).not.toContain('Comma');
    expect(input.bindings).toBe(settings.bindings);
    settings.bindings = saved;
  });
  it('options overlay adjusts settings and closes', () => {
    const vol = settings.masterVol;
    app.scenes.set(new TitleScene({ state: 'menu' }), { fade: false });
    flow.options();
    expect(scene()).toBe('options');
    expect(app.scenes.stack.map((s) => s.name)).toEqual(['title', 'options']);
    press({ right: true }); // master volume up
    expect(settings.masterVol).toBeCloseTo(Math.min(1, Math.round(vol * 10 + 1) / 10));
    press({ left: true });
    expect(settings.masterVol).toBeCloseTo(Math.round(vol * 10) / 10);
    run(0.3);
    press({ bomb: true });
    expect(scene()).toBe('title');
  });
});

// ------------------------------------------------------------------ the scene flow

describe('scene flow', () => {
  it('title -> char select -> briefing -> gameplay', () => {
    flow.title();
    run(0.6);
    expect(scene()).toBe('title');
    flow.newGame({ twoPlayer: false });
    run(0.6);
    expect(scene()).toBe('charselect');
    const cs = app.scenes.current as CharSelectScene;
    press({ right: true });
    expect(cs.slots[0].index).toBe(1);
    // Player 2 drops in, then both confirm.
    press({ start: true }, 1);
    expect(cs.slots[1].joined).toBe(true);
    press({ fire: true });
    press({ fire: true }, 1);
    run(1.8);
    expect(scene()).toBe('briefing');
    const br = app.scenes.current as BriefingScene;
    expect(br.session.twoPlayer).toBe(true);
    expect(br.session.players[0].character).toBe(cs.chars[1].id);
    run(0.5);
    press({ fire: true }); // finish typing
    expect(br.typed).toBe(true);
    press({ fire: true }); // deploy
    run(0.8);
    expect(scene()).toBe('gameplay');
    input.twoPlayerKeyboard = false;
  });

  it('mission complete -> tally -> next mission or the ending', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: true });
    s.players[0].score = 1000;
    s.players[1].score = 500;
    flow.missionComplete(s, stats());
    run(0.6);
    expect(scene()).toBe('tally');
    const t = app.scenes.current as TallyScene;
    run(1.5);
    press({ fire: true }); // skip the count-up
    expect(t.bonusApplied).toBe(true);
    expect(s.players[0].score).toBe(1000 + 2 * RESCUE_BONUS);
    expect(s.players[1].score).toBe(500 + 1 * RESCUE_BONUS);
    press({ fire: true }); // skipping again must not double the bonus
    expect(s.players[0].score).toBe(1000 + 2 * RESCUE_BONUS);
    run(0.8);
    // No mission 2 level registered in a bare build -> ending; otherwise the next briefing.
    expect(['ending', 'briefing']).toContain(scene());
    expect(progress.unlocked).toBeGreaterThanOrEqual(2);
  });

  it('game over -> name entry -> high scores -> title', () => {
    resetHighScores();
    const s = new GameSession({ characters: ['brick', 'juno'], mission: 2 });
    s.players[0].score = 400000;
    flow.gameOver(s);
    run(0.6);
    expect(scene()).toBe('gameover');
    const go = app.scenes.current as GameOverScene;
    expect(go.qualifying).toEqual([0]);
    run(2.4);
    press({ fire: true });
    run(0.6);
    expect(scene()).toBe('nameentry');
    press({ start: true }); // empty name: START does nothing
    press({ fire: true });
    press({ start: true });
    run(0.8);
    expect(scene()).toBe('highscores');
    expect(getHighScores()[0].score).toBe(400000);
    run(0.4);
    press({ fire: true });
    run(0.8);
    expect(scene()).toBe('title');
    resetHighScores();
  });

  it('ending plays all phases, marks the game cleared and returns to the title', () => {
    resetHighScores();
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: true, mission: 6 });
    s.players[0].score = 10;
    s.players[1].score = 20;
    flow.ending(s);
    run(1);
    expect(scene()).toBe('ending');
    expect(progress.cleared).toBe(true);
    const e = app.scenes.current as EndingScene;
    run(8, true);
    expect(e.phase).toBe(0);
    run(4, true);
    expect(e.phase).toBe(1);
    run(14, true);
    expect(e.phase).toBe(2);
    // Skip the roll, then continue.
    press({ start: true });
    expect(e.creditsDone).toBe(true);
    press({ fire: true });
    run(1);
    expect(scene()).toBe('highscores');
    progress.cleared = false;
  });

  it('options from pause, restart from pause and quit to title', () => {
    const s = new GameSession({ characters: ['dex', 'juno'] });
    s.players[0].score = 777;
    const gp = new GameplayScene(s, 'sandbox');
    app.scenes.set(gp, { fade: false });
    run(0.5);
    s.players[0].score = 5000; // scored during the mission
    press({ start: true });
    expect(scene()).toBe('pause');
    const pause = app.scenes.current as PauseScene;
    // OPTIONS
    pause.menu.index = 2;
    press({ fire: true });
    expect(scene()).toBe('options');
    run(0.2);
    press({ bomb: true });
    expect(scene()).toBe('pause');
    // RESTART (needs confirmation)
    pause.menu.index = 1;
    press({ fire: true });
    expect(scene()).toBe('pause');
    press({ fire: true });
    run(0.7);
    expect(scene()).toBe('gameplay');
    expect(app.scenes.current).not.toBe(gp);
    expect(s.players[0].score).toBe(777); // restored to the mission-start snapshot
    press({ start: true });
    const p2 = app.scenes.current as PauseScene;
    p2.menu.index = 4;
    press({ fire: true });
    press({ fire: true });
    run(0.7);
    expect(scene()).toBe('title');
  });

  it('mission select only deploys unlocked missions', () => {
    const prev = progress.unlocked;
    progress.unlocked = 2;
    expect(missionUnlocked(1)).toBe(true);
    expect(missionUnlocked(2)).toBe(true);
    expect(missionUnlocked(3)).toBe(false);
    app.scenes.set(new MissionSelectScene(), { fade: false });
    const ms = app.scenes.current as MissionSelectScene;
    expect(ms.index).toBe(1);
    press({ down: true });
    expect(ms.index).toBe(2);
    press({ fire: true }); // locked: stays
    run(0.5);
    expect(scene()).toBe('missionselect');
    press({ up: true });
    press({ fire: true });
    run(0.6);
    expect(scene()).toBe('charselect');
    expect((app.scenes.current as CharSelectScene).opts.mission).toBe(2);
    progress.unlocked = prev;
  });
});

// ------------------------------------------------------------------ gameplay integration

describe('gameplay scene', () => {
  it('full-screen continue freezes the world; fire continues', () => {
    const s = new GameSession({ characters: ['dex', 'juno'] });
    const gp = new GameplayScene(s, 'sandbox');
    app.scenes.set(gp, { fade: false });
    run(1.5);
    const p = gp.world.players[0];
    p.profile.lives = 1;
    p.kill();
    run(2.2);
    expect(s.players[0].out).toBe(true);
    expect(gp.continueScreen).toBe(true);
    const t0 = gp.world.time;
    run(1);
    expect(gp.world.time).toBe(t0); // frozen
    expect(gp.hud.continueTimers[0]).toBeLessThan(CONTINUE_SECONDS);
    press({ fire: true });
    expect(s.players[0].out).toBe(false);
    expect(s.players[0].continues).toBe(1);
    expect(gp.continueScreen).toBe(false);
    run(0.5);
    expect(gp.world.time).toBeGreaterThan(t0);
  });

  it('continue countdown running out leads to game over', () => {
    const s = new GameSession({ characters: ['dex', 'juno'] });
    const gp = new GameplayScene(s, 'sandbox');
    app.scenes.set(gp, { fade: false });
    run(1.5);
    gp.world.players[0].profile.lives = 1;
    gp.world.players[0].kill();
    run(2 + CONTINUE_SECONDS + 2.5);
    expect(scene()).toBe('gameover');
  });

  it('player 2 can drop in during play', () => {
    const s = new GameSession({ characters: ['dex', 'juno'] });
    const gp = new GameplayScene(s, 'sandbox');
    app.scenes.set(gp, { fade: false });
    run(1);
    press({ fire: true }, 1);
    expect(s.twoPlayer).toBe(true);
    expect(gp.world.players.length).toBe(2);
    input.twoPlayerKeyboard = false;
  });

  it('attract mode: idle title -> demo -> any input -> title', () => {
    app.scenes.set(new TitleScene({ state: 'press' }), { fade: false });
    uiInput.flush();
    run(ATTRACT_IDLE + 1.5, false);
    expect(scene()).toBe('demo');
    const demo = app.scenes.current as GameplayScene;
    expect(demo.demo).toBe(true);
    expect(demo.bots[0]).toBeTruthy();
    expect(app.debug.autopilot).toBe(false);
    run(2);
    uiInput.poke();
    run(0.8);
    expect(scene()).toBe('title');
  });

  it('HUD renders every state headless', () => {
    const s = new GameSession({ characters: ['brick', 'mika'], twoPlayer: true });
    const gp = new GameplayScene(s, 'sandbox');
    app.scenes.set(gp, { fade: false });
    run(1);
    const w = gp.world;
    const e = w.spawn('rifleman', w.camera.x + 300)!;
    e.hp = e.maxHp = 50;
    w.boss = e;
    w.bossName = 'TEST BOSS';
    w.level.goTimer = 2;
    s.players[0].missionRescues = 20;
    gp.hud.banner('WARNING!', { color: '#ff4040' });
    gp.hud.banner('SMALL', { scale: 1 });
    gp.hud.banner('SLIDE', { scale: 2 });
    expect(gp.hud.banners.map((b) => b.style)).toEqual(expect.arrayContaining(['warning', 'small', 'slide']));
    run(1);
    e.hp = 5;
    run(1);
    // Vehicle gauge (both panels, with and without secondary ammo).
    const fakeVehicle = { hp: 30, maxHp: 100, vehicleName: 'BULLDOG', secondaryAmmo: 12 };
    (w.players[0] as any).vehicle = fakeVehicle;
    (w.players[1] as any).vehicle = { ...fakeVehicle, secondaryAmmo: -1, hp: 5 };
    gp.hud.render(g, w);
    (w.players[0] as any).vehicle = null;
    (w.players[1] as any).vehicle = null;
    // Low ammo + fire bombs.
    w.players[1].giveWeapon('hmg');
    w.players[1].ammo = 3;
    w.players[1].bombKind = 'firebomb';
    gp.hud.update(DT, w);
    gp.hud.render(g, w);
    const h = new Hud();
    h.update(DT);
    h.render(g, w);
  });
});

// ------------------------------------------------------------------ every screen renders

describe('every screen updates and renders headless', () => {
  const session = () => {
    const s = new GameSession({ characters: ['juno', 'brick'], twoPlayer: true, mission: 3 });
    s.players[0].score = 12345;
    return s;
  };
  const cases: [string, () => Scene, number][] = [
    ['boot', () => new BootScene(), 0.2],
    ['title intro', () => new TitleScene({ state: 'intro' }), 2.5],
    ['title menu', () => new TitleScene({ state: 'menu' }), 1],
    ['char select 1P', () => new CharSelectScene({ twoPlayer: false }), 3],
    ['char select 2P', () => new CharSelectScene({ twoPlayer: true, mission: 2 }), 3],
    ['briefing', () => new BriefingScene(session()), 7],
    ['mission select', () => new MissionSelectScene(), 1],
    ['options', () => new OptionsScene(), 1],
    ['key remap', () => new KeyRemapScene(1), 1],
    ['controls p1', () => new ControlsScene({ page: 0 }), 0.5],
    ['controls p2', () => new ControlsScene({ page: 1 }), 0.5],
    ['controls p3', () => new ControlsScene({ page: 2 }), 0.5],
    ['controls p4', () => new ControlsScene({ page: 3, overlay: true }), 0.5],
    ['high scores', () => new HighScoresScene({ attract: true, onDone: () => {} }), 2],
    ['sound test', () => new SoundTestScene(), 1],
    ['credits', () => new CreditsScene(), 3],
    ['tally', () => new TallyScene(session(), stats({ levelId: 'sandbox' })), 8],
    ['game over', () => new GameOverScene(session()), 3],
    ['congratulations', () => new GameOverScene(session(), true), 3],
    ['name entry', () => new NameEntryScene(session(), [0, 1]), 2],
    ['ending', () => new EndingScene(session()), 30],
  ];
  for (const [label, make, secs] of cases) {
    it(label, () => {
      const s = make();
      app.scenes.set(s, { fade: false });
      exercise(s, secs);
    });
  }
});

// ------------------------------------------------------------------ audio names

describe('ui audio names are canonical', () => {
  const design = readFileSync('docs/DESIGN.md', 'utf8');
  const block = design.slice(design.indexOf('SFX names'), design.indexOf('Songs:'));
  const canonicalSfx = new Set(block.split(/\s+/).filter((w) => /^[a-z][a-z0-9_]+$/.test(w)));
  const songLine = design.slice(design.indexOf('Songs:'), design.indexOf('Voice lines'));
  const canonicalSongs = new Set([...songLine.matchAll(/\b([a-z][a-z0-9_]*)\b/g)].map((m) => m[1]));
  const files = [...readdirSync('src/scenes').map((f) => `src/scenes/${f}`), 'src/game/hud.ts'];
  const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');

  it('UI_SFX_NAMES are all in the design contract', () => {
    for (const n of UI_SFX_NAMES) expect(canonicalSfx.has(n), n).toBe(true);
  });
  it('every uiSfx / audio.play name used by the UI is canonical', () => {
    const used = new Set([...src.matchAll(/(?:uiSfx|audio\.play)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(5);
    for (const n of used) expect(canonicalSfx.has(n), n).toBe(true);
  });
  it('every song the UI plays is canonical', () => {
    const used = new Set([...src.matchAll(/playMusic\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1])));
    for (const n of ['title', 'select', 'briefing', 'tally', 'gameover', 'ending', 'credits', 'mission_complete']) expect(used.has(n), n).toBe(true);
    for (const n of used) expect(canonicalSongs.has(n), n).toBe(true);
  });
});
