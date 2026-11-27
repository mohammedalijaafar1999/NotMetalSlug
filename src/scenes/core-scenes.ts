// Core scenes: the boot/loading screen plus re-exports of the front-end scenes under the names
// main.ts's default flow uses (the full flow is installed by src/scenes/install.ts via
// startupHooks, see src/content/ui/install.ts).

import type { Scene } from '../engine/scene';
import type { Sprite } from '../engine/sprites';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { flow } from './flow';
import { C, rect, stripes, twoTone, syncTouch } from './ui';
import { preload } from './preload';

export { TitleScene } from './title';
export { TallyScene, RESCUE_BONUS } from './tally';
export { GameOverScene, NameEntryScene } from './gameover';
export { OptionsScene as SimpleOptionsScene, OptionsScene } from './options';
export { EndingScene } from './ending';

const TIPS = [
  'TIP: SHOOT TIED-UP HOSTAGES TO FREE THEM.',
  'TIP: GET CLOSE TO SOLDIERS TO USE YOUR KNIFE.',
  'TIP: PRESS DOWN NEXT TO AN EMPTY TANK TO HOP IN.',
  'TIP: PLAYER 2 CAN JOIN AT ANY TIME.',
  'TIP: CRATE LETTERS TELL YOU WHICH WEAPON IS INSIDE.',
];

/**
 * Bakes the sprites the title and menus draw, with a progress bar, then goes to the title; the
 * rest bake in the background (see preload.ts) and are all baked before gameplay starts.
 */
export class BootScene implements Scene {
  name = 'boot';
  private list: Sprite[] = preload.start();
  private i = 0;
  private done = false;
  private time = 0;
  private tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  update(dt: number): void {
    syncTouch(false);
    // The canvas loading screen replaces the HTML placeholder from index.html.
    if (this.time === 0) this.removePlaceholder();
    this.time += dt;
    const t0 = performance.now();
    while (this.i < this.list.length && performance.now() - t0 < 12) {
      try {
        this.list[this.i].bake();
      } catch (e) {
        console.error('[boot] failed to bake sprite', this.list[this.i].name, e);
      }
      this.i++;
    }
    if (this.i >= this.list.length && !this.done) {
      this.done = true;
      this.removePlaceholder();
      preload.running = true;
      flow.title();
    }
  }

  private removePlaceholder(): void {
    const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('boot') : null;
    if (el) el.remove();
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07051a';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const cx = VIEW_W / 2;
    const f = this.list.length ? this.i / this.list.length : 1;
    twoTone(g, 'IRON RUCKUS', cx, VIEW_H / 2 - 40, '#e8f0ff', C.gold, { scale: 3, align: 'center', split: 3 });
    const bw = 160;
    const bx = Math.round(cx - bw / 2);
    const by = VIEW_H / 2;
    rect(g, bx - 2, by - 2, bw + 4, 12, C.out);
    rect(g, bx - 1, by - 1, bw + 2, 10, '#3a2a4a');
    rect(g, bx, by, bw, 8, '#140c1c');
    const fw = Math.round(bw * f);
    if (fw > 0) {
      g.save();
      g.beginPath();
      g.rect(bx, by, fw, 8);
      g.clip();
      stripes(g, bx, by, bw, 8, this.time * 2, C.gold, C.gold2);
      g.restore();
      rect(g, bx, by, fw, 1, '#ffffff', 0.5);
    }
    drawText(g, `LOADING ${Math.round(f * 100)}%`, cx, by + 14, { align: 'center', color: C.grey, outline: C.out });
    drawText(g, this.tip, cx, VIEW_H - 24, { align: 'center', color: C.blue, outline: C.out });
  }
}
