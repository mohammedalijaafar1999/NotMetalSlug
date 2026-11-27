// Game over screen (GAME OVER slams in letter by letter, final scores) and the arcade name
// entry (3 letters picked from a grid; keyboard, gamepad or touch), then the high score table.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, textWidth } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { fxRng } from '../engine/rng';
import { addHighScore, getHighScores, qualifiesForHighScore, type HighScore } from '../engine/storage';
import { app } from '../app';
import { flow } from './flow';
import { getCharacter } from '../game/characters';
import type { GameSession } from '../game/session';
import { Particles } from '../game/effects';
import { HighScoresScene } from './highscores';
import { C, PLAYER_COLORS, blink, ctl, easeOutBack, enterMenu, fitText, footer, ordinal, panel, rect, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';
import { faceSprite } from '../content/ui/art';
import { missionInfo } from '../content/ui/missions';

// ------------------------------------------------------------------ name entry logic (pure)

export const NAME_LEN = 3;
export const GRID_ROWS: string[][] = [
  [...'ABCDEFGHIJKLM'],
  [...'NOPQRSTUVWXYZ'],
  [...'0123456789.!?'],
  ['♥', '★', '-', 'SPC', 'DEL', 'END'],
];

/** Apply a grid cell to a name. Returns the new name and whether entry is finished. */
export function applyNameCell(name: string, cell: string): { name: string; done: boolean } {
  if (cell === 'END') return { name, done: true };
  if (cell === 'DEL') return { name: name.slice(0, -1), done: false };
  if (name.length >= NAME_LEN) return { name, done: false };
  return { name: name + (cell === 'SPC' ? ' ' : cell), done: false };
}

/** Final name for the table (fallback: the character's name prefix). */
export function finalName(name: string, character: string): string {
  const n = name.trimEnd();
  if (n.trim().length) return n.padEnd(NAME_LEN, ' ').slice(0, NAME_LEN);
  return (getCharacter(character).name.replace(/[^A-Z0-9]/g, '') + '???').slice(0, NAME_LEN);
}

/** 1-based rank a score would get in the current table. */
export function rankFor(score: number): number {
  return getHighScores().filter((h) => h.score >= score).length + 1;
}

// ------------------------------------------------------------------ game over

export class GameOverScene implements Scene {
  name = 'gameover';
  time = 0;
  private parts = new Particles();
  private leaving = false;
  private thuds = 0;
  readonly qualifying: number[];

  constructor(
    readonly session: GameSession,
    readonly cleared = false,
  ) {
    this.qualifying = session.players.filter((p) => p.joined && qualifiesForHighScore(p.score)).map((p) => p.index);
  }

  enter(): void {
    enterMenu();
    input.twoPlayerKeyboard = false;
    audio.playMusic(this.cleared ? 'ending' : 'gameover');
    if (!this.cleared) audio.say('Game over');
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.qualifying.length) app.scenes.set(new NameEntryScene(this.session, this.qualifying, this.cleared));
    else app.scenes.set(new HighScoresScene({ onDone: () => flow.title() }));
  }

  get label(): string {
    return this.cleared ? 'CONGRATULATIONS!' : 'GAME OVER';
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    // Ash.
    if (fxRng.chance(0.5)) this.parts.add({ kind: 'px', x: fxRng.range(0, VIEW_W), y: -2, vx: fxRng.range(-8, 4), vy: fxRng.range(10, 24), life: 12, color: fxRng.pick(['#5a4a5a', '#7a5a5a', '#3a2a3a']), drag: 0 });
    this.parts.update(dt, null);
    const letters = this.label.replace(/ /g, '').length;
    const landed = Math.min(letters, Math.floor(Math.max(0, this.time - 0.4) / 0.11) + (this.time >= 0.4 ? 1 : 0));
    while (this.thuds < landed) {
      this.thuds++;
      if (!this.cleared) {
        uiSfx('explosion_small', { vol: 0.35, pitch: 0.7 + this.thuds * 0.03 });
        app.renderer?.shake(2, 0.12);
      } else uiSfx('pickup_points', { vol: 0.5 });
    }
    const m = input.menu;
    if (this.time > 2.2 && (m.pressed('confirm') || m.pressed('start') || uiInput.takeTap())) this.next();
    if (this.time > 10) this.next();
  }

  render(g: CanvasRenderingContext2D): void {
    for (let y = 0; y < VIEW_H; y += 4) {
      const t = y / VIEW_H;
      g.fillStyle = this.cleared ? `rgb(${10 + t * 20},${8 + t * 16},${30 + t * 20})` : `rgb(${8 + t * 50},${4 + t * 6},${10 + t * 10})`;
      g.fillRect(0, y, VIEW_W, 4);
    }
    this.parts.render(g, false);
    const cx = VIEW_W / 2;
    const s = this.label;
    const sc = this.cleared ? 3 : 4;
    const w = textWidth(s, sc);
    let x = cx - w / 2;
    let i = 0;
    for (const ch of s) {
      const cw = textWidth(ch, sc);
      if (ch !== ' ') {
        const t0 = 0.4 + i * 0.11;
        const k = (this.time - t0) / 0.22;
        if (k > 0) {
          const y = 34 - Math.round((1 - Math.min(1, easeOutBack(k))) * 60);
          twoTone(g, ch, Math.round(x), y, this.cleared ? C.cream : '#ff8a7a', this.cleared ? C.gold : C.red, { scale: sc, split: 3 });
        }
        i++;
      }
      x += cw + sc;
    }
    if (this.time > 1.6) {
      const joined = this.session.players.filter((p) => p.joined);
      joined.forEach((p, j) => {
        const two = joined.length > 1;
        const px = two ? (j === 0 ? cx - 96 : cx + 96) : cx;
        const c = getCharacter(p.character);
        const appear = easeOutBack((this.time - 1.6 - j * 0.15) / 0.3);
        const y = 92 + Math.round((1 - Math.min(1, appear)) * 30);
        panel(g, px - 84, y, 168, 52, 'dark', 0.85);
        sprites.get(faceSprite(c.id, p.index === 1)).draw(g, px - 66, y + 22);
        drawText(g, `${p.index + 1}P ${c.name}`, px - 52, y + 6, { color: PLAYER_COLORS[p.index], outline: C.out });
        twoTone(g, pad(p.score, 8), px + 76, y + 20, C.white, C.gold, { scale: 2, align: 'right', split: 3 });
        const reached = this.cleared ? 'ALL MISSIONS CLEARED' : `MISSION ${this.session.mission}: ${missionInfo(this.session.mission).name}`;
        drawText(g, fitText(reached, 160), px, y + 39, { align: 'center', color: C.grey, outline: C.out });
        if (this.qualifying.includes(p.index) && blink(this.time, 3)) drawText(g, 'NEW HIGH SCORE!', px + 76, y + 6, { align: 'right', color: C.gold, outline: C.out });
      });
      if (!this.cleared) drawText(g, `CONTINUES USED: ${this.session.players.reduce((a, p) => a + (p.joined ? p.continues : 0), 0)}`, cx, 160, { align: 'center', color: C.greyD, outline: C.out });
    }
    if (this.time > 2.2 && blink(this.time, 1.5, 0.7)) footer(g, ctl('PRESS FIRE', 'TAP TO CONTINUE'), VIEW_H - 16, C.gold);
  }
}

// ------------------------------------------------------------------ name entry

export class NameEntryScene implements Scene {
  name = 'nameentry';
  time = 0;
  cur = 0;
  entry = '';
  row = 0;
  col = 0;
  timeLeft = 30;
  readonly added: HighScore[] = [];
  private done = false;
  private flash = 0;

  constructor(
    readonly session: GameSession,
    readonly queue: number[],
    readonly cleared = false,
  ) {}

  enter(): void {
    enterMenu();
    audio.playMusic(this.cleared ? 'ending' : 'gameover');
  }

  get player(): number {
    return this.queue[this.cur];
  }

  private cellAt(r: number, c: number): string {
    const row = GRID_ROWS[r];
    return row[Math.min(c, row.length - 1)];
  }

  private cellRect(r: number, c: number): { x: number; y: number; w: number; h: number } {
    const row = GRID_ROWS[r];
    if (r < 3) {
      const cw = 20;
      const x0 = Math.round(VIEW_W / 2 - (row.length * cw) / 2);
      return { x: x0 + c * cw, y: 104 + r * 18, w: cw - 2, h: 15 };
    }
    // Special row: wider cells.
    const widths = row.map((s) => (s.length > 1 ? 34 : 20));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.round(VIEW_W / 2 - total / 2);
    for (let i = 0; i < c; i++) x += widths[i];
    return { x, y: 104 + 3 * 18, w: widths[c] - 2, h: 15 };
  }

  private press(cell: string): void {
    const res = applyNameCell(this.entry, cell);
    this.entry = res.name;
    if (cell === 'DEL') audio.play('menu_back');
    else audio.play('menu_select');
    if (this.entry.length >= NAME_LEN && cell !== 'DEL' && !res.done) {
      // Jump to END.
      this.row = 3;
      this.col = GRID_ROWS[3].indexOf('END');
    }
    if (res.done) this.commit();
  }

  private commit(): void {
    const idx = this.player;
    const p = this.session.players[idx];
    const h: HighScore = {
      name: finalName(this.entry, p.character),
      score: p.score,
      mission: this.cleared ? 7 : this.session.mission,
      character: p.character,
      date: new Date().toISOString().slice(0, 10),
    };
    addHighScore(h);
    this.added.push(h);
    uiSfx('tally_bonus');
    this.flash = 0.5;
    this.cur++;
    // Player 1's new entry can push player 2's score off the table: don't ask for a name
    // that would not be listed.
    while (this.cur < this.queue.length && !qualifiesForHighScore(this.session.players[this.queue[this.cur]].score)) this.cur++;
    this.entry = '';
    this.row = 0;
    this.col = 0;
    this.timeLeft = 30;
    if (this.cur >= this.queue.length) this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    const added = this.added;
    app.scenes.set(new HighScoresScene({ highlight: added, onDone: () => flow.title() }));
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.done || this.cur >= this.queue.length) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.commit();
      return;
    }
    const m = input.menu;
    const move = (dr: number, dc: number) => {
      if (dr) {
        const prevLen = GRID_ROWS[this.row].length;
        this.row = (this.row + dr + GRID_ROWS.length) % GRID_ROWS.length;
        // Keep the column roughly aligned between the letter rows and the special row.
        const len = GRID_ROWS[this.row].length;
        this.col = Math.min(len - 1, Math.round((this.col / Math.max(1, prevLen - 1)) * (len - 1)));
      }
      if (dc) this.col = (this.col + dc + GRID_ROWS[this.row].length) % GRID_ROWS[this.row].length;
      audio.play('menu_move');
    };
    if (m.pressed('up')) move(-1, 0);
    if (m.pressed('down')) move(1, 0);
    if (m.pressed('left')) move(0, -1);
    if (m.pressed('right')) move(0, 1);
    if (m.pressed('back')) this.press('DEL');
    else if (m.pressed('confirm')) this.press(this.cellAt(this.row, this.col));
    else if (m.pressed('start') && this.entry.length > 0) this.press('END');
    const tap = uiInput.takeTap();
    if (tap) {
      for (let r = 0; r < GRID_ROWS.length; r++)
        for (let c = 0; c < GRID_ROWS[r].length; c++) {
          const rc = this.cellRect(r, c);
          if (tap.x >= rc.x && tap.x < rc.x + rc.w && tap.y >= rc.y && tap.y < rc.y + rc.h) {
            this.row = r;
            this.col = c;
            this.press(GRID_ROWS[r][c]);
            return;
          }
        }
    }
  }

  render(g: CanvasRenderingContext2D): void {
    for (let y = 0; y < VIEW_H; y += 4) {
      const t = y / VIEW_H;
      g.fillStyle = `rgb(${12 + t * 18},${8 + t * 10},${32 + t * 18})`;
      g.fillRect(0, y, VIEW_W, 4);
    }
    const cx = VIEW_W / 2;
    if (this.cur >= this.queue.length) return;
    const idx = this.player;
    const p = this.session.players[idx];
    const c = getCharacter(p.character);
    twoTone(g, 'NEW HIGH SCORE!', cx, 6, blink(this.time, 4) ? C.white : C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    sprites.get(faceSprite(c.id, idx === 1)).draw(g, cx - 92, 44);
    drawText(g, `${idx + 1}P ${c.name}`, cx - 80, 28, { color: PLAYER_COLORS[idx], outline: C.out });
    twoTone(g, pad(p.score, 8), cx - 80, 38, C.white, C.gold, { scale: 1, split: 3 });
    const rank = rankFor(p.score);
    text(g, `YOU PLACED ${ordinal(rank)}!`, cx + 96, 33, { align: 'center', color: rank === 1 ? C.gold : C.white });
    // Name slots.
    for (let i = 0; i < NAME_LEN; i++) {
      const x = cx - 36 + i * 26;
      const ch = this.entry[i];
      rect(g, x, 82, 20, 2, i === this.entry.length && blink(this.time, 3) ? C.gold : C.greyD);
      if (ch && ch !== ' ') twoTone(g, ch, x + 10, 60, C.white, C.gold, { scale: 3, align: 'center', split: 3 });
    }
    drawText(g, 'ENTER YOUR INITIALS', cx, 90, { align: 'center', color: C.blue, outline: C.out });
    // Grid.
    panel(g, 40, 98, VIEW_W - 80, 80, 'steel', 0.9);
    for (let r = 0; r < GRID_ROWS.length; r++)
      for (let col = 0; col < GRID_ROWS[r].length; col++) {
        const rc = this.cellRect(r, col);
        const sel = r === this.row && col === this.col;
        const cell = GRID_ROWS[r][col];
        if (sel) {
          rect(g, rc.x, rc.y, rc.w, rc.h, C.gold, 0.85);
          rect(g, rc.x, rc.y, rc.w, 1, '#ffffff', 0.7);
        } else rect(g, rc.x, rc.y, rc.w, rc.h, '#ffffff', 0.06);
        const label = cell === 'SPC' ? 'SPC' : cell;
        drawText(g, label, rc.x + rc.w / 2, rc.y + 4, { align: 'center', color: sel ? C.out : cell === 'END' ? C.gold : cell === 'DEL' ? '#ff9090' : C.white, shadow: sel ? null : C.out });
      }
    // Timer.
    const tl = Math.ceil(this.timeLeft);
    drawText(g, `TIME ${pad(tl, 2)}`, VIEW_W - 44, 186, { align: 'right', color: tl <= 5 && blink(this.time, 4) ? C.red : C.grey, outline: C.out });
    footer(g, ctl('FIRE: PICK   BOMB: DELETE   START: DONE', 'TAP THE LETTERS, THEN END'), VIEW_H - 12);
    if (this.flash > 0) rect(g, 0, 0, VIEW_W, VIEW_H, '#ffffff', this.flash * 0.5);
  }
}
