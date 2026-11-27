// Character select: one card per squad member with an animated sprite preview (their real
// player sprite set), name, bio and perk. Player 2 can join here; everyone joined confirms,
// then the session is created and the mission flow begins.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, wrapText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { mixColor } from '../engine/pixelart';
import { progress, saveProgress } from '../engine/storage';
import { flow } from './flow';
import { characters, type CharacterDef } from '../game/characters';
import { GameSession } from '../game/session';
import { LEG, LEG_FRAMES } from '../art/humanoid';
import { backdrop } from './backdrop';
import { C, PLAYER_COLORS, backButton, blink, ctl, easeOutBack, enterMenu, fitText, footer, panel, rect, sharedKeysHint, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';

interface Slot {
  joined: boolean;
  index: number;
  confirmed: boolean;
  /** Time since the last cursor move / confirm (animations). */
  t: number;
}

/** Number of connected gamepads. */
export function gamepadCount(): number {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return 0;
  try {
    return Array.from(navigator.getGamepads()).filter((p) => p && p.connected).length;
  } catch {
    return 0;
  }
}

/** Remember the last picks between games (per page load). */
const lastPick = [0, 1];

export class CharSelectScene implements Scene {
  name = 'charselect';
  time = 0;
  readonly chars: CharacterDef[] = characters();
  slots: Slot[];
  startTimer = -1;
  private leaving = false;

  constructor(readonly opts: { twoPlayer: boolean; mission?: number }) {
    const n = this.chars.length;
    this.slots = [0, 1].map((i) => ({ joined: i === 0 || opts.twoPlayer, index: Math.min(n - 1, lastPick[i] ?? i), confirmed: false, t: 0 }));
    if (this.slots[1].index === this.slots[0].index && n > 1) this.slots[1].index = (this.slots[0].index + 1) % n;
  }

  enter(): void {
    enterMenu();
    audio.playMusic('select');
    input.twoPlayerKeyboard = this.opts.twoPlayer && gamepadCount() < 2;
  }

  private cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const n = this.chars.length;
    const gap = 6;
    const w = Math.min(88, Math.floor((VIEW_W - 16 - gap * (n - 1)) / n));
    const total = n * w + (n - 1) * gap;
    return { x: Math.round((VIEW_W - total) / 2) + i * (w + gap), y: 25, w, h: 104 };
  }

  private moveCursor(s: Slot, d: number): void {
    const n = this.chars.length;
    s.index = (s.index + d + n) % n;
    s.t = 0;
    audio.play('menu_move');
  }

  private confirm(i: number): void {
    const s = this.slots[i];
    if (s.confirmed) return;
    s.confirmed = true;
    s.t = 0;
    audio.play('menu_select');
    audio.say(this.chars[s.index].name.toLowerCase() + '!');
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.play('menu_back');
    input.twoPlayerKeyboard = false;
    flow.title();
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    backdrop().update(dt);
    for (const s of this.slots) s.t += dt;
    if (this.leaving) return;
    if (this.startTimer >= 0) {
      this.startTimer += dt;
      if (this.startTimer > 1.0) this.begin();
      return;
    }
    const p = [input.player(0), input.player(1)];
    // Escape / Backspace (not a player's bomb button) acts as P1 back.
    const escBack = input.menu.pressed('back') && !p[0].pressed('bomb') && !p[1].pressed('bomb');
    if (backButton(null, this.time)) {
      this.back();
      return;
    }
    for (let i = 0; i < 2; i++) {
      const s = this.slots[i];
      const a = p[i];
      if (!s.joined) {
        if (i === 1 && (a.pressed('start') || a.pressed('fire'))) {
          s.joined = true;
          s.t = 0;
          s.confirmed = false;
          if (input.lastDevice !== 'gamepad') input.twoPlayerKeyboard = true;
          audio.play('coin');
        }
        continue;
      }
      const backPressed = a.pressed('bomb') || (i === 0 && escBack);
      if (backPressed) {
        if (s.confirmed) {
          s.confirmed = false;
          audio.play('menu_back');
        } else if (i === 1 && !this.opts.twoPlayer) {
          s.joined = false;
          audio.play('menu_back');
        } else if (i === 0) {
          this.back();
          return;
        }
        continue;
      }
      if (s.confirmed) continue;
      if (a.pressed('left')) this.moveCursor(s, -1);
      if (a.pressed('right')) this.moveCursor(s, 1);
      if (a.pressed('fire') || a.pressed('jump') || (a.pressed('start') && !(i === 0 && escBack))) this.confirm(i);
    }
    // Pointer (drives player 1).
    if (uiInput.hoverMoved && uiInput.hover && !this.slots[0].confirmed) {
      for (let i = 0; i < this.chars.length; i++) {
        const r = this.cardRect(i);
        const h = uiInput.hover;
        if (h.x >= r.x && h.x < r.x + r.w && h.y >= r.y && h.y < r.y + r.h && this.slots[0].index !== i) {
          this.slots[0].index = i;
          this.slots[0].t = 0;
          audio.play('menu_move');
        }
      }
      uiInput.hoverMoved = false;
    }
    const tap = uiInput.takeTap();
    if (tap) {
      for (let i = 0; i < this.chars.length; i++) {
        const r = this.cardRect(i);
        if (tap.x >= r.x && tap.x < r.x + r.w && tap.y >= r.y && tap.y < r.y + r.h) {
          const s = this.slots[0];
          if (s.confirmed) s.confirmed = false;
          else if (s.index === i) this.confirm(0);
          else {
            s.index = i;
            s.t = 0;
            audio.play('menu_move');
          }
        }
      }
    }
    const joined = this.slots.filter((s) => s.joined);
    if (joined.length && joined.every((s) => s.confirmed)) {
      this.startTimer = 0;
      uiSfx('start_game');
    }
  }

  private begin(): void {
    if (this.leaving) return;
    this.leaving = true;
    const [a, b] = this.slots;
    lastPick[0] = a.index;
    lastPick[1] = b.index;
    const s = new GameSession({
      characters: [this.chars[a.index].id, this.chars[b.index].id],
      twoPlayer: b.joined,
      mission: this.opts.mission,
    });
    if (!b.joined) input.twoPlayerKeyboard = false;
    progress.plays++;
    saveProgress();
    flow.mission(s);
  }

  /** Little stat bars derived from the character's perk multipliers. */
  private statBars(g: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number): void {
    const stats: [string, number][] = [
      ['SPEED', (c.runMul * c.jumpMul - 0.85) / 0.4],
      ['FIREPOWER', (1 / c.pistolCooldownMul - 0.8) / 0.9 + (c.heavyAmmoMul - 1) * 0.8],
      ['BOMBS', (c.bombs * c.grenadeRadiusMul - 6) / 16],
    ];
    stats.forEach(([label, v], i) => {
      const yy = y + i * 8;
      drawText(g, label, x, yy, { color: C.grey, outline: C.out });
      const n = Math.max(1, Math.min(6, Math.round(1 + v * 5)));
      for (let k = 0; k < 6; k++) rect(g, x + 62 + k * 10, yy + 1, 8, 5, k < n ? c.color : '#2a2438');
    });
  }

  /** Draw a character's animated preview at feet (x, y), scale 2. */
  private drawPreview(g: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number, mode: 'idle' | 'hover' | 'ready', t: number, p2: boolean): void {
    const base = `char_${c.id}${p2 ? '_p2' : ''}`;
    const S = 2;
    // Shadow.
    rect(g, x - 14, y - 1, 28, 2, '#000000', 0.35);
    if (mode === 'ready') {
      sprites.get(`${base}_body`).draw(g, x, y, Math.floor(t * 4) % 2 === 0 ? 5 : 6, { scale: S });
      return;
    }
    let legF: number = LEG.STAND;
    let upF = 0;
    let flash = false;
    if (mode === 'hover') {
      const cyc = t % 2.6;
      if (cyc < 1.2) legF = LEG.RUN + (Math.floor(t * 12) % LEG.RUN_N);
      else if (cyc < 1.9) {
        const k = Math.floor((cyc - 1.2) * 10);
        upF = k % 2 === 0 ? 5 : 0;
        flash = k % 2 === 0;
      } else {
        const k = Math.floor((cyc - 1.9) * 10);
        upF = k % 2 === 0 ? 7 : 2;
        flash = false;
      }
    } else if ((t + c.id.length) % 5 > 4.2) {
      sprites.get(`${base}_body`).draw(g, x, y, 8, { scale: S });
      return;
    }
    const L = LEG_FRAMES[legF];
    sprites.get(`${base}_legs`).draw(g, x, y, legF, { scale: S });
    const hx = x + Math.round(L.hip[0]) * S;
    const hy = y + Math.round(L.hip[1]) * S;
    const up = sprites.has(`${base}_up_pistol`) ? `${base}_up_pistol` : `${base}_up_heavy`;
    sprites.get(up).draw(g, hx, hy, upF, { scale: S });
    if (flash) sprites.get('muzzle_flash').draw(g, hx + 30, hy - 18, Math.floor(t * 20) % 2, { scale: S });
  }

  render(g: CanvasRenderingContext2D): void {
    backdrop().render(g, { dim: 0.55, squad: false });
    const cx = VIEW_W / 2;
    twoTone(g, 'SELECT YOUR SOLDIER', cx, 7, C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    this.chars.forEach((c, i) => {
      const r = this.cardRect(i);
      const appear = easeOutBack(Math.min(1, (this.time - i * 0.06) / 0.35));
      const oy = Math.round((1 - appear) * 50);
      const hovered = this.slots.filter((s) => s.joined && s.index === i);
      const y = r.y + oy;
      // Card.
      panel(g, r.x, y, r.w, r.h, 'dark', 0.95);
      const top = mixColor(c.color, '#000000', 0.82);
      const bot = mixColor(c.color, '#000000', 0.45);
      for (let k = 0; k < r.h - 4; k += 2) rect(g, r.x + 2, y + 2 + k, r.w - 4, 2, mixColor(top, bot, k / (r.h - 4)), hovered.length ? 0.95 : 0.55);
      // Spotlight.
      if (hovered.length) {
        g.globalAlpha = 0.12 + Math.sin(this.time * 4) * 0.04;
        g.fillStyle = '#fff4d0';
        g.beginPath();
        g.moveTo(r.x + r.w / 2 - 6, y + 2);
        g.lineTo(r.x + r.w / 2 + 6, y + 2);
        g.lineTo(r.x + r.w - 6, y + r.h - 14);
        g.lineTo(r.x + 6, y + r.h - 14);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
      }
      // Name plate.
      twoTone(g, c.name, r.x + r.w / 2, y + 6, C.white, hovered.length ? c.color : C.greyD, { align: 'center', split: 3 });
      // Sprite.
      const s0 = hovered[0];
      const ready = hovered.some((s) => s.confirmed);
      const p2only = hovered.length > 0 && hovered.every((s) => s === this.slots[1]);
      const mode = ready ? 'ready' : hovered.length ? 'hover' : 'idle';
      this.drawPreview(g, c, r.x + r.w / 2, y + r.h - 12, mode, s0 ? s0.t : this.time + i * 1.3, p2only);
      if (!hovered.length) rect(g, r.x + 2, y + 2, r.w - 4, r.h - 4, '#06040c', 0.35);
      // Selection frames + player tags.
      hovered.forEach((s) => {
        const pi = this.slots.indexOf(s);
        const col = PLAYER_COLORS[pi];
        const on = s.confirmed || blink(this.time, 3, 0.7);
        const inset = pi === 0 ? 0 : 2;
        if (on) {
          g.strokeStyle = col;
          g.lineWidth = 1;
          g.strokeRect(r.x + 0.5 + inset, y + 0.5 + inset, r.w - 1 - inset * 2, r.h - 1 - inset * 2);
          g.strokeRect(r.x + 1.5 + inset, y + 1.5 + inset, r.w - 3 - inset * 2, r.h - 3 - inset * 2);
        }
        const tx = pi === 0 ? r.x + 3 : r.x + r.w - 17;
        rect(g, tx, y + r.h - 11, 14, 9, col);
        drawText(g, `${pi + 1}P`, tx + 7, y + r.h - 10, { align: 'center', color: C.white, shadow: C.out });
        if (s.confirmed) {
          const k = easeOutBack(Math.min(1, s.t / 0.25));
          if (k > 0.05) {
            rect(g, r.x + 2, y + 15, r.w - 4, 11, '#000000', 0.45);
            text(g, 'READY!', r.x + r.w / 2, y + 17 - Math.round((1 - k) * 8), { align: 'center', color: C.gold });
          }
        }
      });
    });
    // Info panels.
    const joined = this.slots.map((s, i) => ({ s, i })).filter((x) => x.s.joined);
    const pw = joined.length > 1 ? 182 : 360;
    joined.forEach(({ s, i }, k) => {
      const c = this.chars[s.index];
      const px = joined.length > 1 ? (k === 0 ? 8 : VIEW_W - 8 - pw) : Math.round(cx - pw / 2);
      const py = 132;
      panel(g, px, py, pw, 63, 'steel', 0.92);
      rect(g, px + 2, py + 2, 3, 59, PLAYER_COLORS[i]);
      drawText(g, `${i + 1}P`, px + 9, py + 4, { color: PLAYER_COLORS[i], outline: C.out });
      text(g, fitText(c.full, pw - 36), px + 27, py + 4, { color: C.gold });
      const lines = wrapText(c.bio.toUpperCase(), pw - 18);
      lines.slice(0, 3).forEach((l, j) => drawText(g, l, px + 9, py + 14 + j * 9, { color: C.white, outline: C.out }));
      const perk = `★ ${c.perk}: ${c.perkDesc.toUpperCase()}`;
      const perkLines = wrapText(perk, pw - 18);
      const perkY = py + 14 + Math.min(3, lines.length) * 9 + 2;
      perkLines.slice(0, 2).forEach((l, j) => drawText(g, l, px + 9, perkY + j * 9, { color: c.color, outline: C.out }));
      // Roomy single-player panel: stat bars.
      if (joined.length === 1) this.statBars(g, c, px + pw - 128, py + 36);
    });
    if (!this.slots[1].joined) {
      const msg = '2P: PRESS START TO JOIN';
      if (blink(this.time, 1.2, 0.7)) drawText(g, msg, VIEW_W - 8, VIEW_H - 19, { align: 'right', color: C.p2, outline: C.out });
    }
    if (input.twoPlayerKeyboard && this.slots[1].joined) {
      drawText(g, sharedKeysHint(), cx, VIEW_H - 19, { align: 'center', color: C.blue, outline: C.out });
    }
    backButton(g, this.time);
    if (this.startTimer >= 0) {
      if (blink(this.time, 6)) footer(g, 'GET READY!', VIEW_H - 9, C.gold);
    } else footer(g, ctl('◀ ▶ CHOOSE   FIRE: CONFIRM   BOMB: BACK', 'TAP A SOLDIER, THEN TAP AGAIN TO CONFIRM'), VIEW_H - 9);
  }
}
