// Options overlay (from the title menu or the pause menu): volumes, announcer, difficulty, lives,
// timer, video toggles, key remapping for both players and reset. Changes apply immediately
// and persist via applySettings(true).

import type { Scene } from '../engine/scene';
import { ACTIONS, DEFAULT_BINDINGS, input, keyLabel, type Action } from '../engine/input';
import { audio } from '../engine/audio';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { resetSettings, settings, type Difficulty } from '../engine/storage';
import { app } from '../app';
import { applySettings } from '../settings-apply';
import { DIFFICULTY_NAMES } from '../game/constants';
import { Menu, type MenuItem } from './menu';
import { C, backButton, blink, dimScreen, enterMenu, fitText, keycap, panel, rect, text, titleBar, syncTouch } from './ui';

/** Let the nearest full screen below an overlay keep animating (title backdrop). */
export function tickBelow(self: Scene, dt: number): void {
  const st = app.scenes?.stack ?? [];
  let i = st.indexOf(self) - 1;
  while (i >= 0 && st[i].overlay) i--;
  const s = st[i] as (Scene & { tickBackground?: (dt: number) => void }) | undefined;
  s?.tickBackground?.(dt);
}

/** True when a gameplay scene is underneath (opened from the pause menu). */
function inGame(): boolean {
  return (app.scenes?.stack ?? []).some((s) => s.name === 'gameplay');
}

type VolKey = 'masterVol' | 'musicVol' | 'sfxVol' | 'voiceVol';
type BoolKey = 'voice' | 'timer' | 'shake' | 'flashes' | 'crt' | 'pixelPerfect' | 'showFps';

function volBar(key: VolKey) {
  return (g: CanvasRenderingContext2D, rx: number, y: number, sel: boolean): number => {
    const v = Math.round(settings[key] * 10);
    const w = 10 * 4 + 22;
    const x0 = rx - w;
    for (let i = 0; i < 10; i++) {
      const on = i < v;
      const col = on ? (i >= 8 ? C.red : i >= 5 ? C.gold : '#70e070') : '#2a2438';
      rect(g, x0 + i * 4, y + 1 + (on ? 0 : 2), 3, on ? 6 : 4, col);
      if (on && sel) rect(g, x0 + i * 4, y + 1, 3, 1, '#ffffff', 0.5);
    }
    drawText(g, `${v * 10}%`, rx, y, { align: 'right', color: sel ? C.white : C.grey, outline: C.out });
    return w;
  };
}

function onOff(key: BoolKey) {
  return (g: CanvasRenderingContext2D, rx: number, y: number, sel: boolean): number => {
    const on = settings[key];
    return drawText(g, on ? 'ON' : 'OFF', rx, y, { align: 'right', color: on ? (sel ? '#a0ffa0' : '#70e070') : sel ? '#ff9090' : '#c05050', outline: C.out });
  };
}

export class OptionsScene implements Scene {
  name = 'options';
  overlay = true;
  time = 0;
  menu: Menu;
  private sayTimer = -1;

  constructor() {
    const save = () => applySettings(true);
    const vol = (key: VolKey, label: string, hint: string): MenuItem => ({
      label,
      renderValue: volBar(key),
      left: () => {
        settings[key] = Math.max(0, Math.round(settings[key] * 10 - 1) / 10);
        save();
        if (key === 'voiceVol') this.sayTimer = 0.45;
      },
      right: () => {
        settings[key] = Math.min(1, Math.round(settings[key] * 10 + 1) / 10);
        save();
        if (key === 'voiceVol') this.sayTimer = 0.45;
      },
      hint,
    });
    const toggle = (key: BoolKey, label: string, hint: string | (() => string)): MenuItem => {
      const flip = () => {
        settings[key] = !settings[key];
        save();
      };
      return { label, renderValue: onOff(key), left: flip, right: flip, hint };
    };
    this.menu = new Menu([
      { label: 'AUDIO', section: true },
      vol('masterVol', 'MASTER VOLUME', 'OVERALL LOUDNESS.'),
      vol('musicVol', 'MUSIC VOLUME', 'CHIPTUNE SOUNDTRACK LEVEL.'),
      vol('sfxVol', 'SFX VOLUME', 'GUNS, EXPLOSIONS AND EVERYTHING ELSE.'),
      vol('voiceVol', 'VOICE VOLUME', 'ANNOUNCER LOUDNESS.'),
      toggle('voice', 'ANNOUNCER', 'THE VOICE THAT YELLS WEAPON NAMES AT YOU.'),
      { label: 'GAMEPLAY', section: true },
      {
        label: 'DIFFICULTY',
        value: () => DIFFICULTY_NAMES[settings.difficulty],
        left: () => {
          settings.difficulty = Math.max(0, settings.difficulty - 1) as Difficulty;
          save();
        },
        right: () => {
          settings.difficulty = Math.min(2, settings.difficulty + 1) as Difficulty;
          save();
        },
        hint: () => (inGame() ? 'APPLIES FROM THE NEXT GAME.' : ['FEWER, SLOWER BULLETS. FOR RECRUITS.', 'THE INTENDED ARCADE EXPERIENCE.', 'FASTER FIRE, TOUGHER ENEMIES, MORE POINTS.'][settings.difficulty]),
      },
      {
        label: 'LIVES',
        value: () => String(settings.lives),
        left: () => {
          settings.lives = Math.max(1, settings.lives - 1);
          save();
        },
        right: () => {
          settings.lives = Math.min(5, settings.lives + 1);
          save();
        },
        hint: () => (inGame() ? 'APPLIES FROM THE NEXT GAME.' : 'LIVES PER CREDIT. CONTINUES ARE UNLIMITED.'),
      },
      toggle('timer', 'MISSION TIMER', 'A COUNTDOWN PER CHECKPOINT. RUN OUT AND YOU LOSE A LIFE.'),
      { label: 'VIDEO', section: true },
      toggle('shake', 'SCREEN SHAKE', 'RUMBLE ON EXPLOSIONS.'),
      toggle('flashes', 'SCREEN FLASHES', 'BRIGHT FULL-SCREEN FLASHES ON BIG BLASTS.'),
      toggle('crt', 'CRT FILTER', 'SCANLINES AND VIGNETTE (BIG WINDOWS ONLY).'),
      toggle('pixelPerfect', 'PIXEL PERFECT', 'INTEGER SCALING ONLY: SHARPER, MAY ADD BORDERS.'),
      toggle('showFps', 'FPS COUNTER', 'FRAMES PER SECOND IN THE CORNER.'),
      { label: 'CONTROLS', section: true },
      { label: '1P KEYS', value: () => '▶', action: () => app.scenes.push(new KeyRemapScene(0)), hint: 'REMAP PLAYER 1 KEYBOARD CONTROLS.' },
      { label: '2P KEYS', value: () => '▶', action: () => app.scenes.push(new KeyRemapScene(1)), hint: 'REMAP PLAYER 2 KEYBOARD CONTROLS.' },
      {
        label: 'RESET TO DEFAULTS',
        action: () => {
          resetSettings();
          applySettings(true);
        },
        hint: 'RESTORE EVERY OPTION AND KEY TO ITS DEFAULT.',
      },
      { label: 'BACK', action: () => this.close(), hint: 'SETTINGS ARE SAVED AUTOMATICALLY.' },
    ]);
    this.menu.visible = 13;
    this.menu.onBack = () => this.close();
  }

  close(): void {
    applySettings(true);
    app.scenes.pop();
  }

  enter(): void {
    enterMenu();
  }

  resume(): void {
    enterMenu();
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    tickBelow(this, dt);
    if (this.sayTimer > 0) {
      this.sayTimer -= dt;
      if (this.sayTimer <= 0) audio.say('Voice check!');
    }
    if (backButton(null, this.time)) {
      audio.play('menu_back');
      this.close();
      return;
    }
    this.menu.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    dimScreen(g, inGame() ? 0.55 : 0.5);
    // Covered by the key remap screen: just the dim.
    if (app.scenes && app.scenes.current !== this) return;
    const cx = VIEW_W / 2;
    const pw = 252;
    const px = Math.round(cx - pw / 2);
    panel(g, px, 8, pw, 186, 'steel', 1);
    titleBar(g, 'OPTIONS', cx, 4, 110);
    this.menu.render(g, cx, 28, { spacing: 12, width: pw - 36 });
    const hint = this.menu.hint();
    panel(g, 14, VIEW_H - 21, VIEW_W - 28, 15, 'dark', 0.9);
    if (hint) text(g, hint, cx, VIEW_H - 17, { align: 'center', color: C.blue });
    backButton(g, this.time);
  }
}

const ACTION_LABELS: Record<Action, string> = {
  left: 'MOVE LEFT',
  right: 'MOVE RIGHT',
  up: 'AIM UP',
  down: 'CROUCH / DOWN',
  fire: 'FIRE',
  jump: 'JUMP',
  bomb: 'BOMB',
  start: 'START / PAUSE',
};

/**
 * Rebind one key; swaps with an action of the same player that already used it, and takes the
 * key away from the other player. Returns the other player's actions left without any key.
 */
export function assignKey(player: 0 | 1, action: Action, code: string): Action[] {
  const b = settings.bindings;
  const mine = player === 0 ? b.p1 : b.p2;
  const other = player === 0 ? b.p2 : b.p1;
  const old = mine[action].slice();
  for (const a of ACTIONS) {
    if (a !== action && mine[a].includes(code)) {
      mine[a] = mine[a].filter((k) => k !== code);
      if (!mine[a].length && old[0] && old[0] !== code) mine[a] = [old[0]];
    }
  }
  const orphaned: Action[] = [];
  for (const a of ACTIONS)
    if (other[a].includes(code)) {
      other[a] = other[a].filter((k) => k !== code);
      if (!other[a].length) orphaned.push(a);
    }
  mine[action] = [code];
  applySettings(true);
  return orphaned;
}

export class KeyRemapScene implements Scene {
  name = 'keyremap';
  overlay = true;
  time = 0;
  menu: Menu;
  capturing: Action | null = null;
  private captureT = 0;
  private flash: { a: Action; t: number } | null = null;
  /** Warning after a key was taken from the other player ("2P AIM UP HAS NO KEY NOW"). */
  private notice: { text: string; t: number } | null = null;

  constructor(readonly player: 0 | 1) {
    const items: MenuItem[] = ACTIONS.map((a) => ({
      label: ACTION_LABELS[a],
      renderValue: (g, rx, y, sel) => this.keysValue(g, rx, y, a, sel),
      action: () => this.startCapture(a),
      hint: 'FIRE: PRESS A NEW KEY FOR THIS ACTION',
    }));
    items.push({
      label: 'RESET THESE KEYS',
      action: () => {
        const def = JSON.parse(JSON.stringify(player === 0 ? DEFAULT_BINDINGS.p1 : DEFAULT_BINDINGS.p2));
        if (player === 0) settings.bindings.p1 = def;
        else settings.bindings.p2 = def;
        applySettings(true);
      },
      hint: 'BACK TO THE DEFAULT LAYOUT.',
    });
    items.push({ label: 'BACK', action: () => this.close(), hint: player === 0 ? 'IN 1P GAMES ARROWS + Z X C ALSO WORK.' : 'GAMEPAD BUTTONS ARE FIXED (SEE CONTROLS).' });
    this.menu = new Menu(items);
    this.menu.onBack = () => this.close();
  }

  private keysValue(g: CanvasRenderingContext2D, rx: number, y: number, a: Action, sel: boolean): number {
    const b = this.player === 0 ? settings.bindings.p1 : settings.bindings.p2;
    const keys = b[a];
    if (this.capturing === a) {
      return drawText(g, blink(this.time, 3) ? '? ? ?' : '', rx, y, { align: 'right', color: C.gold, outline: C.out }) || 30;
    }
    if (!keys.length) return drawText(g, '---', rx, y, { align: 'right', color: C.red, outline: C.out });
    // Keycaps right-aligned.
    const labels = keys.slice(0, 2).map(keyLabel);
    let w = 0;
    for (const l of labels) w += Math.max(11, l.length * 6 + 5) + 2;
    let x = rx - w + 2;
    const fl = this.flash && this.flash.a === a && this.flash.t > 0;
    for (const l of labels) x += keycap(g, l, x, y - 2, { face: fl ? '#fff2a0' : sel ? '#ffffff' : '#d8d4ca' }) + 2;
    return w;
  }

  private startCapture(a: Action): void {
    this.capturing = a;
    this.captureT = 0;
    input.captureKey((code) => this.onKey(code));
  }

  private onKey(code: string): void {
    const a = this.capturing;
    if (!a) return;
    if (code === 'Escape') {
      this.capturing = null;
      audio.play('menu_back');
      input.flush();
      return;
    }
    // Ignore auto-repeat of the key that opened the prompt.
    if (this.captureT < 0.2) {
      input.captureKey((c) => this.onKey(c));
      return;
    }
    const orphaned = assignKey(this.player, a, code);
    if (orphaned.length) {
      const who = this.player === 0 ? '2P' : '1P';
      this.notice = { text: `${keyLabel(code)} WAS ${who}'S ${orphaned.map((x) => ACTION_LABELS[x]).join(' + ')}: ${who} NEEDS A NEW KEY`, t: 4 };
    }
    this.capturing = null;
    this.flash = { a, t: 0.6 };
    audio.play('menu_select');
    input.flush();
  }

  close(): void {
    input.cancelCapture();
    app.scenes.pop();
  }

  enter(): void {
    enterMenu();
  }

  exit(): void {
    input.cancelCapture();
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    tickBelow(this, dt);
    if (this.flash) this.flash.t -= dt;
    if (this.notice && (this.notice.t -= dt) <= 0) this.notice = null;
    if (this.capturing) {
      this.captureT += dt;
      // Gamepad B cancels.
      if (input.menu.pressed('back') || backButton(null, this.time)) {
        input.cancelCapture();
        this.capturing = null;
        audio.play('menu_back');
      }
      return;
    }
    if (backButton(null, this.time)) {
      audio.play('menu_back');
      this.close();
      return;
    }
    this.menu.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    dimScreen(g, 0.55);
    const cx = VIEW_W / 2;
    const pw = 260;
    const px = Math.round(cx - pw / 2);
    panel(g, px, 14, pw, 168, 'steel', 1);
    titleBar(g, this.player === 0 ? '1P KEYS' : '2P KEYS', cx, 10, 110, { color: this.player === 0 ? '#ffd0c0' : '#c0e8ff' });
    this.menu.render(g, cx, 34, { spacing: 14, width: pw - 40, accent: this.player === 0 ? C.gold : C.blue });
    panel(g, 14, VIEW_H - 21, VIEW_W - 28, 15, 'dark', 0.9);
    if (this.notice) text(g, fitText(this.notice.text, VIEW_W - 36), cx, VIEW_H - 17, { align: 'center', color: blink(this.time, 3, 0.8) ? C.red : C.gold });
    else text(g, this.menu.hint(), cx, VIEW_H - 17, { align: 'center', color: C.blue });
    if (this.capturing) {
      dimScreen(g, 0.5);
      panel(g, cx - 100, 80, 200, 50, 'brass', 1);
      text(g, 'PRESS A KEY FOR', cx, 88, { align: 'center', color: C.cream });
      text(g, ACTION_LABELS[this.capturing], cx, 100, { align: 'center', color: C.white, scale: 1 });
      drawText(g, 'ESC: CANCEL', cx, 116, { align: 'center', color: blink(this.time, 2) ? C.gold : C.cream, outline: C.brassD });
    }
    backButton(g, this.time);
  }
}
