// Mission select: replay any unlocked mission (progress.unlocked). Shows the island map with the
// chosen target, then goes to character select.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { progress } from '../engine/storage';
import { app } from '../app';
import { flow } from './flow';
import { backdrop } from './backdrop';
import { C, backButton, blink, enterMenu, fitText, footer, panel, rect, selBar, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';
import { MISSION_COUNT, missionInfo } from '../content/ui/missions';
import { renderMap } from './briefing';

export function missionUnlocked(n: number): boolean {
  return n <= Math.max(1, progress.unlocked) || progress.cleared;
}

export class MissionSelectScene implements Scene {
  name = 'missionselect';
  time = 0;
  index = 0;
  private picked = false;

  constructor() {
    this.index = Math.max(0, Math.min(MISSION_COUNT - 1, progress.unlocked - 1));
  }

  enter(): void {
    enterMenu();
    audio.playMusic('select');
  }

  exit(): void {
    if (!this.picked) audio.playMusic('title');
  }

  private rowY(i: number): number {
    return 34 + i * 26;
  }

  private choose(): void {
    const n = this.index + 1;
    if (!missionUnlocked(n)) {
      audio.play('menu_back');
      return;
    }
    this.picked = true;
    uiSfx('start_game');
    flow.newGame({ twoPlayer: false, mission: n });
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    backdrop().update(dt);
    if (this.picked) return;
    const m = input.menu;
    const move = (d: number) => {
      this.index = (this.index + d + MISSION_COUNT) % MISSION_COUNT;
      audio.play('menu_move');
    };
    if (m.pressed('up')) move(-1);
    if (m.pressed('down')) move(1);
    if (m.pressed('back') || backButton(null, this.time)) {
      audio.play('menu_back');
      app.scenes.pop();
      return;
    }
    if (m.pressed('confirm') || m.pressed('start')) {
      this.choose();
      return;
    }
    // Pointer: hover / tap rows.
    const hit = (x: number, y: number) => {
      for (let i = 0; i < MISSION_COUNT; i++) {
        const ry = this.rowY(i);
        if (x >= 12 && x < 168 && y >= ry - 2 && y < ry + 24) return i;
      }
      return -1;
    };
    if (uiInput.hoverMoved && uiInput.hover) {
      const i = hit(uiInput.hover.x, uiInput.hover.y);
      if (i >= 0 && i !== this.index) {
        this.index = i;
        audio.play('menu_move');
      }
      uiInput.hoverMoved = false;
    }
    const tap = uiInput.takeTap();
    if (tap) {
      const i = hit(tap.x, tap.y);
      if (i >= 0) {
        if (i === this.index) this.choose();
        else {
          this.index = i;
          audio.play('menu_move');
        }
      }
    }
  }

  render(g: CanvasRenderingContext2D): void {
    backdrop().render(g, { dim: 0.6, squad: false });
    const cx = VIEW_W / 2;
    twoTone(g, 'MISSION SELECT', cx, 8, C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    panel(g, 8, 28, 164, 162, 'steel', 0.92);
    for (let i = 0; i < MISSION_COUNT; i++) {
      const n = i + 1;
      const info = missionInfo(n);
      const y = this.rowY(i);
      const open = missionUnlocked(n);
      const sel = i === this.index;
      if (sel) selBar(g, 12, y - 2, 156, 24, this.time, open ? C.gold : C.greyD);
      rect(g, 16, y + 1, 18, 18, open ? info.color : '#3a3448');
      rect(g, 16, y + 1, 18, 1, '#ffffff', 0.4);
      rect(g, 16, y + 18, 18, 1, '#000000', 0.4);
      drawText(g, String(n), 25, y + 5, { align: 'center', scale: 1, color: open ? C.white : C.greyD, outline: C.out });
      drawText(g, `MISSION ${n}`, 40, y + 1, { color: open ? C.grey : C.dim, outline: C.out });
      if (open) {
        text(g, fitText(info.name, 124), 40, y + 11, { color: sel ? C.gold : C.white });
        if (n < progress.unlocked || progress.cleared) sprites.get('ui_stamp_cleared').draw(g, 140, y + 3, 0, { alpha: 0.9 });
      } else {
        sprites.get('ui_lock').draw(g, 44, y + 20);
        drawText(g, 'LOCKED', 52, y + 11, { color: C.dim, outline: C.out });
      }
    }
    // Map + details.
    panel(g, 178, 28, 198, 162, 'steel', 0.92);
    const n = this.index + 1;
    const open = missionUnlocked(n);
    renderMap(g, 189, 34, this.time, n, { reached: Math.max(1, progress.unlocked), showAll: true });
    const info = missionInfo(n);
    if (open) {
      text(g, info.name, 277, 158, { align: 'center', color: info.color });
      drawText(g, info.subtitle, 277, 168, { align: 'center', color: C.grey, outline: C.out });
      drawText(g, info.teaser, 277, 178, { align: 'center', color: C.blue, outline: C.out });
    } else {
      text(g, '? ? ?', 277, 162, { align: 'center', color: C.greyD });
      drawText(g, `CLEAR MISSION ${n - 1} TO UNLOCK`, 277, 174, { align: 'center', color: C.grey, outline: C.out });
    }
    backButton(g, this.time);
    footer(g, open ? (blink(this.time, 1.2, 0.75) ? 'FIRE: DEPLOY   BACK: RETURN' : '') : 'BACK: RETURN', VIEW_H - 12, C.gold);
  }
}
