// Reusable vertical menu widget for title/pause/options screens.

import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { drawText } from '../engine/font';

export interface MenuItem {
  label: string | (() => string);
  /** Value shown right-aligned (options). */
  value?: () => string;
  action?: () => void;
  left?: () => void;
  right?: () => void;
  disabled?: boolean | (() => boolean);
}

export class Menu {
  items: MenuItem[];
  index = 0;
  time = 0;
  /** Called when 'back' is pressed. */
  onBack: (() => void) | null = null;

  constructor(items: MenuItem[]) {
    this.items = items;
  }

  private isDisabled(i: MenuItem): boolean {
    return typeof i.disabled === 'function' ? i.disabled() : !!i.disabled;
  }

  update(dt: number): void {
    this.time += dt;
    const m = input.menu;
    const n = this.items.length;
    if (!n) return;
    const move = (d: number) => {
      for (let k = 0; k < n; k++) {
        this.index = (this.index + d + n) % n;
        if (!this.isDisabled(this.items[this.index])) break;
      }
      audio.play('menu_move');
    };
    if (m.pressed('up')) move(-1);
    if (m.pressed('down')) move(1);
    const it = this.items[this.index];
    if (m.pressed('left') && it.left) {
      it.left();
      audio.play('menu_move');
    }
    if (m.pressed('right') && it.right) {
      it.right();
      audio.play('menu_move');
    }
    if (m.pressed('confirm') && !this.isDisabled(it)) {
      if (it.action) {
        audio.play('menu_select');
        it.action();
      } else if (it.right) {
        it.right();
        audio.play('menu_move');
      }
    } else if (m.pressed('back') && this.onBack) {
      audio.play('menu_back');
      this.onBack();
    }
  }

  render(g: CanvasRenderingContext2D, x: number, y: number, opts: { width?: number; spacing?: number; align?: 'center' | 'left'; color?: string } = {}): void {
    const sp = opts.spacing ?? 12;
    const w = opts.width ?? 160;
    this.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const sel = i === this.index;
      const dis = this.isDisabled(it);
      const col = dis ? '#5a5a6a' : sel ? '#ffd040' : (opts.color ?? '#ffffff');
      const yy = y + i * sp;
      if (it.value) {
        const lx = x - w / 2;
        drawText(g, label, lx, yy, { color: col, outline: '#140c1c' });
        const v = it.value();
        drawText(g, sel ? `< ${v} >` : v, x + w / 2, yy, { color: sel ? '#ffffff' : '#a0a0b8', align: 'right', outline: '#140c1c' });
        if (sel) drawText(g, '→', lx - 10 + (Math.floor(this.time * 4) % 2), yy, { color: '#ffd040', outline: '#140c1c' });
      } else if (opts.align === 'left') {
        drawText(g, label, x, yy, { color: col, outline: '#140c1c' });
        if (sel) drawText(g, '→', x - 10 + (Math.floor(this.time * 4) % 2), yy, { color: '#ffd040', outline: '#140c1c' });
      } else {
        const tw = drawText(g, label, x, yy, { color: col, align: 'center', outline: '#140c1c' });
        if (sel) {
          const bounce = Math.floor(this.time * 4) % 2;
          drawText(g, '→', x - tw / 2 - 11 + bounce, yy, { color: '#ffd040', outline: '#140c1c' });
          drawText(g, '←', x + tw / 2 + 5 - bounce, yy, { color: '#ffd040', outline: '#140c1c' });
        }
      }
    });
  }
}
