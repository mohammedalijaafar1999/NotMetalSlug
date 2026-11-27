// High score table ("hall of fame"): pushed from the main menu, shown after name entry (with the
// new entries highlighted) and as part of the attract loop.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { sprites } from '../engine/sprites';
import { getHighScores, type HighScore } from '../engine/storage';
import { app } from '../app';
import { characters } from '../game/characters';
import { backdrop } from './backdrop';
import { C, backButton, blink, ctl, easeOut, enterMenu, footer, ordinal, panel, rect, text, twoTone, uiInput, syncTouch } from './ui';

export interface HighScoresOpts {
  /** Entries to highlight (object identity or name+score match). */
  highlight?: HighScore[];
  /** Attract mode: returns by itself after a while. */
  attract?: boolean;
  /** Called when the screen is dismissed (default: pop). */
  onDone?: () => void;
}

export function missionLabel(m: number): string {
  return m >= 7 ? 'ALL ★' : `M${Math.max(1, m)}`;
}

export function charName(id: string): string {
  const c = characters().find((x) => x.id === id);
  return c ? c.name : id.toUpperCase().slice(0, 5);
}

export function charColor(id: string): string {
  return characters().find((x) => x.id === id)?.color ?? C.grey;
}

export class HighScoresScene implements Scene {
  name = 'highscores';
  time = 0;
  private done = false;

  constructor(private opts: HighScoresOpts = {}) {}

  enter(): void {
    enterMenu();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    if (this.opts.onDone) this.opts.onDone();
    else app.scenes.pop();
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    backdrop().update(dt);
    const m = input.menu;
    if (this.opts.attract) {
      if (this.time > 10 || ((uiInput.takeActivity() || m.anyPressed()) && this.time > 0.3)) this.finish();
      return;
    }
    if (this.time > 0.25 && (m.pressed('confirm') || m.pressed('back') || m.pressed('start') || backButton(null, this.time) || uiInput.takeTap())) this.finish();
  }

  private isHighlighted(h: HighScore): boolean {
    return !!this.opts.highlight?.some((x) => x === h || (x.name === h.name && x.score === h.score && x.date === h.date));
  }

  render(g: CanvasRenderingContext2D): void {
    backdrop().render(g, { dim: 0.6, squad: false });
    const cx = VIEW_W / 2;
    twoTone(g, 'HIGH SCORES', cx, 8, C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    const list = getHighScores();
    const pw = 312;
    const px = Math.round(cx - pw / 2);
    const py = 28;
    panel(g, px, py, pw, 166, 'steel', 0.9);
    const cols = { rank: px + 12, name: px + 52, score: px + 154, mis: px + 212, chr: px + 252 };
    const hy = py + 7;
    drawText(g, 'RANK', cols.rank, hy, { color: C.brass, outline: C.out });
    drawText(g, 'NAME', cols.name, hy, { color: C.brass, outline: C.out });
    drawText(g, 'SCORE', cols.score, hy, { color: C.brass, outline: C.out, align: 'right' });
    drawText(g, 'REACHED', cols.mis, hy, { color: C.brass, outline: C.out, align: 'center' });
    drawText(g, 'SOLDIER', cols.chr, hy, { color: C.brass, outline: C.out });
    rect(g, px + 8, hy + 10, pw - 16, 1, C.brassD);
    list.forEach((h, i) => {
      const y = py + 23 + i * 14;
      const appear = easeOut((this.time - 0.08 * i) / 0.35);
      if (appear <= 0) return;
      const ox = Math.round((1 - appear) * 160);
      const hl = this.isHighlighted(h);
      if (hl) rect(g, px + 6, y - 3, pw - 12, 13, C.gold, blink(this.time, 3) ? 0.28 : 0.14);
      else if (i % 2 === 0) rect(g, px + 6, y - 3, pw - 12, 13, '#ffffff', 0.04);
      const col = hl ? C.white : i === 0 ? C.gold : i < 3 ? C.cream : C.white;
      if (i === 0) sprites.get('ui_star').draw(g, cols.rank - 6 + ox, y + 3);
      drawText(g, ordinal(i + 1), cols.rank + ox, y, { color: i === 0 ? C.gold : C.grey, outline: C.out });
      text(g, h.name, cols.name + ox, y, { color: col, scale: 1 });
      drawText(g, pad(h.score, 8), cols.score + ox, y, { color: col, outline: C.out, align: 'right' });
      drawText(g, missionLabel(h.mission), cols.mis + ox, y, { color: h.mission >= 7 ? C.gold : C.blue, outline: C.out, align: 'center' });
      drawText(g, charName(h.character), cols.chr + ox, y, { color: charColor(h.character), outline: C.out });
    });
    if (!this.opts.attract) backButton(g, this.time);
    footer(g, this.opts.attract ? ctl('PRESS START', 'TAP TO PLAY') : ctl('FIRE / BACK: RETURN', 'TAP TO RETURN'), VIEW_H - 14, this.opts.attract && blink(this.time, 1.5) ? C.gold : C.grey);
  }
}
