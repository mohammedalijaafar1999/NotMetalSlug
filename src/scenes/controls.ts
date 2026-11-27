// Controls / how-to-play help: pages for the rules, keyboard (P1, P2 and the solo layout, read
// from the live key bindings), gamepad and touch. Opened from the main menu or the pause menu.

import type { Scene } from '../engine/scene';
import { input, SOLO_EXTRA, keyLabel, type Action, type Bindings } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, textWidth, wrapText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { settings } from '../engine/storage';
import { app } from '../app';
import { allWeapons } from '../game/weapons';
import { backdrop } from './backdrop';
import { C, backButton, blink, ctl, dimScreen, enterMenu, footer, keycap, panel, rect, text, twoTone, uiInput, syncTouch } from './ui';

const PAGES = ['HOW TO PLAY', 'KEYBOARD', 'GAMEPAD', 'TOUCH'] as const;

export class ControlsScene implements Scene {
  name = 'controls';
  time = 0;
  page = 0;
  overlay: boolean;
  private slide = 0;

  constructor(opts: { overlay?: boolean; page?: number } = {}) {
    this.overlay = !!opts.overlay;
    this.page = opts.page ?? 0;
  }

  enter(): void {
    enterMenu();
  }

  private turn(d: number): void {
    this.page = (this.page + d + PAGES.length) % PAGES.length;
    this.slide = d * 1;
    audio.play('menu_move');
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    if (!this.overlay) backdrop().update(dt);
    this.slide *= Math.pow(0.0001, dt);
    const m = input.menu;
    if (m.pressed('left')) this.turn(-1);
    if (m.pressed('right') || m.pressed('confirm')) this.turn(1);
    if (m.pressed('back') || backButton(null, this.time)) {
      audio.play('menu_back');
      app.scenes.pop();
      return;
    }
    const tap = uiInput.takeTap();
    if (tap) this.turn(tap.x < VIEW_W / 2 ? -1 : 1);
  }

  render(g: CanvasRenderingContext2D): void {
    if (this.overlay) dimScreen(g, 0.82);
    else backdrop().render(g, { dim: 0.62, squad: false });
    const cx = VIEW_W / 2;
    twoTone(g, 'CONTROLS', cx, 6, C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    // Page tabs.
    const tabW = 78;
    const tx0 = Math.round(cx - (tabW * PAGES.length) / 2);
    PAGES.forEach((p, i) => {
      const sel = i === this.page;
      const x = tx0 + i * tabW;
      panel(g, x + 1, 24, tabW - 2, 13, sel ? 'brass' : 'dark', sel ? 1 : 0.8);
      drawText(g, p, x + tabW / 2, 27, { align: 'center', color: sel ? C.white : C.greyD, outline: sel ? C.brassD : C.out });
    });
    const ox = Math.round(this.slide * 40);
    panel(g, 10, 40, VIEW_W - 20, 152, 'steel', 0.92);
    g.save();
    g.beginPath();
    g.rect(12, 42, VIEW_W - 24, 148);
    g.clip();
    g.translate(ox, 0);
    switch (this.page) {
      case 0:
        this.howToPlay(g);
        break;
      case 1:
        this.keyboard(g);
        break;
      case 2:
        this.gamepad(g);
        break;
      default:
        this.touch(g);
    }
    g.restore();
    const bob = Math.floor(this.time * 3) % 2;
    drawText(g, '◀', 3 - bob, 112, { color: C.gold, outline: C.out });
    drawText(g, '▶', VIEW_W - 8 + bob, 112, { color: C.gold, outline: C.out });
    backButton(g, this.time);
    footer(g, ctl('◀ ▶ PAGE   BACK: RETURN', 'TAP LEFT / RIGHT SIDE: PAGE'), VIEW_H - 12);
  }

  private bullet(g: CanvasRenderingContext2D, y: number, s: string, icon?: (x: number, y: number) => void, color: string = C.white): number {
    const lines = wrapText(s, 316);
    if (icon) icon(30, y);
    else sprites.get('ui_star').draw(g, 30, y + 3);
    lines.forEach((l, i) => drawText(g, l, 42, y + i * 9, { color, outline: C.out }));
    return lines.length * 9 + 4;
  }

  private howToPlay(g: CanvasRenderingContext2D): void {
    let y = 47;
    y += this.bullet(g, y, "ONE HIT AND YOU'RE DOWN! DODGE AND SHOOT FIRST.", undefined, C.gold);
    y += this.bullet(g, y, 'FREE TIED-UP HOSTAGES: SHOOT OR TOUCH THEM. THEY DROP GOODIES AND PAY +1000 EACH AT THE TALLY.', (x, yy) => sprites.get('ui_hostage').draw(g, x, yy + 8));
    const ws = allWeapons().filter((w) => w.id !== 'pistol');
    y += this.bullet(g, y, 'SMASH CRATES FOR WEAPONS. THE LETTER SAYS WHICH:', (x, yy) => miniCrate(g, x - 5, yy - 1, ws[0]?.letter ?? 'H', ws[0]?.color ?? '#ffcf3a'));
    let wx = 42;
    for (const w of ws) {
      const short = w.name.length > 10 ? w.name.split(' ').map((s) => s[0]).join('') : w.name;
      const need = 14 + textWidth(short) + 8;
      if (wx + need > VIEW_W - 24) {
        wx = 42;
        y += 12;
      }
      miniCrate(g, wx, y - 2, w.letter, w.color);
      wx += 13 + drawText(g, short, wx + 13, y, { color: C.grey, outline: C.out }) + 8;
    }
    y += 14;
    y += this.bullet(g, y, 'GET CLOSE TO A SOLDIER AND FIRE TO USE YOUR KNIFE.');
    y += this.bullet(g, y, 'BOMBS ARE GRENADES. THE RED CRATE GIVES FIRE BOMBS.', (x, yy) => sprites.get('ui_icon_grenade').draw(g, x, yy + 8));
    y += this.bullet(g, y, 'VEHICLES: PRESS DOWN BESIDE AN EMPTY ONE TO HOP IN. DOWN + JUMP BAILS OUT.');
    this.bullet(g, y, 'PLAYER 2: PRESS START TO JOIN AT ANY TIME.', undefined, C.blue);
  }

  private keyRow(g: CanvasRenderingContext2D, x: number, y: number, label: string, codes: string[], max = 3, color: string = C.white): void {
    drawText(g, label, x, y + 2, { color, outline: C.out });
    let kx = x + 38;
    for (const c of codes.slice(0, max)) kx += keycap(g, keyLabel(c), kx, y) + 2;
  }

  private keyboard(g: CanvasRenderingContext2D): void {
    const b = settings.bindings ?? input.bindings;
    const col = (x: number, title: string, bb: Bindings, color: string) => {
      twoTone(g, title, x + 70, 47, C.white, color, { align: 'center' });
      const mv: Action[] = ['up', 'left', 'down', 'right'];
      this.keyRow(g, x, 60, 'MOVE', mv.map((a) => bb[a][0] ?? '?'), 4);
      this.keyRow(g, x, 74, 'FIRE', bb.fire);
      this.keyRow(g, x, 88, 'JUMP', bb.jump);
      this.keyRow(g, x, 102, 'BOMB', bb.bomb);
      this.keyRow(g, x, 116, 'START', bb.start);
    };
    col(24, '1 PLAYER', b.p1, C.p1);
    col(206, '2 PLAYER', b.p2, C.p2);
    rect(g, 22, 133, VIEW_W - 44, 1, C.brassD);
    drawText(g, 'SOLO LAYOUT (WHILE NOBODY USES THE P2 KEYS):', VIEW_W / 2, 138, { align: 'center', color: C.gold, outline: C.out });
    let x = 34;
    const y = 151;
    const item = (label: string, codes: string[]) => {
      for (const c of codes) x += keycap(g, keyLabel(c), x, y) + 2;
      x += drawText(g, label, x + 2, y + 2, { color: C.grey, outline: C.out }) + 12;
    };
    item('MOVE', [SOLO_EXTRA.left[0], SOLO_EXTRA.right[0]]);
    item('FIRE', SOLO_EXTRA.fire);
    item('JUMP', SOLO_EXTRA.jump);
    item('BOMB', SOLO_EXTRA.bomb);
    x = 34;
    const y2 = 167;
    for (const c of SOLO_EXTRA.start) x += keycap(g, keyLabel(c), x, y2) + 2;
    drawText(g, 'PAUSE', x + 2, y2 + 2, { color: C.grey, outline: C.out });
    drawText(g, 'REMAP KEYS IN OPTIONS', VIEW_W - 30, y2 + 2, { align: 'right', color: blink(this.time, 1, 0.7) ? C.blue : C.blueD, outline: C.out });
  }

  private gamepad(g: CanvasRenderingContext2D): void {
    const cx = VIEW_W / 2;
    const cy = 112;
    sprites.get('ui_gamepad').draw(g, cx, cy);
    const lbl = (x0: number, y0: number, x1: number, y1: number, s: string, color: string, align: 'left' | 'right') => {
      g.fillStyle = color;
      // Leader line (horizontal then to the label).
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i += 2) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), 1, 1);
      drawText(g, s, align === 'right' ? x1 - 3 : x1 + 3, y1 - 3, { align, color, outline: C.out });
    };
    const L = cx - 46;
    const T = cy - 23;
    lbl(L + 18, T + 29, 118, 92, 'MOVE + AIM', C.white, 'right');
    lbl(L + 17, T + 8, 118, 62, 'BUMPERS: BOMB', C.grey, 'right');
    lbl(L + 67, T + 26, 118, 150, 'X / RT: FIRE', C.blue, 'right');
    lbl(L + 74, T + 19, 268, 66, 'Y: FIRE', C.gold, 'left');
    lbl(L + 50, T + 21, 268, 90, 'START: PAUSE', C.white, 'left');
    lbl(L + 81, T + 26, 268, 136, 'B: BOMB', '#ff7a6a', 'left');
    lbl(L + 74, T + 33, 268, 156, 'A: JUMP', '#70e070', 'left');
    drawText(g, 'EACH PAD IS ONE PLAYER (1ST PAD = 1P). START ALSO JOINS 2P.', cx, 172, { align: 'center', color: C.grey, outline: C.out });
    drawText(g, '1P ON THE KEYBOARD? A LONE PAD\'S START JOINS AS 2P.', cx, 181, { align: 'center', color: C.grey, outline: C.out });
  }

  private touch(g: CanvasRenderingContext2D): void {
    const x = 92;
    const y = 52;
    const w = 200;
    const h = 104;
    // Phone body.
    rect(g, x - 6, y - 6, w + 12, h + 12, '#1e1e28');
    rect(g, x - 5, y - 5, w + 10, 1, '#4a4a5a');
    rect(g, x, y, w, h, '#2a4a6a');
    rect(g, x, y + h - 22, w, 22, '#3a5a2a');
    rect(g, x + w + 2, y + h / 2 - 8, 2, 16, '#4a4a5a');
    // Stick.
    g.globalAlpha = 0.5;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x + 32, y + h - 32, 20, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(x + 32 + Math.sin(this.time * 2) * 7, y + h - 32, 8, 0, Math.PI * 2);
    g.fill();
    // Buttons.
    const btn = (bx: number, by: number, r: number, label: string, col: string) => {
      g.globalAlpha = 0.45;
      g.fillStyle = col;
      g.beginPath();
      g.arc(bx, by, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      drawText(g, label, bx, by - 3, { align: 'center', color: C.white, outline: C.out });
    };
    btn(x + w - 26, y + h - 52, 15, 'FIRE', '#ff8a5a');
    btn(x + w - 60, y + h - 22, 12, 'JUMP', '#70e070');
    btn(x + w - 22, y + h - 16, 10, 'BOMB', '#ffd040');
    g.globalAlpha = 0.5;
    rect(g, x + w - 18, y + 6, 12, 12, '#ffffff');
    g.globalAlpha = 1;
    drawText(g, 'II', x + w - 12, y + 9, { align: 'center', color: C.white, outline: C.out });
    g.globalAlpha = 1;
    text(g, 'MOVE + AIM', x + 32, y + h - 62, { align: 'center', color: C.white });
    text(g, 'PAUSE', x + w - 24, y + 22, { align: 'right', color: C.white });
    drawText(g, 'CONTROLS APPEAR WHEN YOU TOUCH THE SCREEN.', VIEW_W / 2, 167, { align: 'center', color: C.grey, outline: C.out });
    drawText(g, 'IN MENUS, JUST TAP WHAT YOU WANT.', VIEW_W / 2, 177, { align: 'center', color: C.grey, outline: C.out });
  }
}

/** Little weapon crate icon with its letter. */
export function miniCrate(g: CanvasRenderingContext2D, x: number, y: number, letter: string, color: string): void {
  rect(g, x, y, 11, 10, C.out);
  rect(g, x + 1, y + 1, 9, 8, '#8a5a2a');
  rect(g, x + 1, y + 1, 9, 1, '#b07a3a');
  rect(g, x + 1, y + 8, 9, 1, '#5a3a1a');
  drawText(g, letter, x + 6, y + 2, { align: 'center', color, shadow: '#3a2010' });
}
