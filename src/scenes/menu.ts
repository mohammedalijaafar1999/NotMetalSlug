// Reusable vertical menu widget for title/pause/options screens.
// Keyboard/gamepad via input.menu, mouse hover + tap/click via uiInput (hit rects from the last render).

import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { drawText, textWidth } from '../engine/font';
import { C, cursor, selBar, uiInput, rect } from './ui';

export interface MenuItem {
  label: string | (() => string);
  /** Value shown right-aligned (options). */
  value?: () => string;
  action?: () => void;
  left?: () => void;
  right?: () => void;
  disabled?: boolean | (() => boolean);
  /** Non-selectable section header row. */
  section?: boolean;
  /** Help text for the selected item (screens show it in their footer). */
  hint?: string | (() => string);
  /** Custom value renderer, right-aligned at x (replaces value text). Returns drawn width. */
  renderValue?: (g: CanvasRenderingContext2D, rightX: number, y: number, selected: boolean) => number;
  /** Label color override. */
  color?: string;
}

export interface MenuRenderOpts {
  width?: number;
  spacing?: number;
  align?: 'center' | 'left';
  color?: string;
  /** Draw the animated highlight bar behind the selected row. */
  bar?: boolean;
  /** Highlight color. */
  accent?: string;
}

interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** x where the value area starts (value items). */
  vx?: number;
}

export class Menu {
  items: MenuItem[];
  index = 0;
  time = 0;
  /** Called when 'back' is pressed. */
  onBack: (() => void) | null = null;
  /** Max rows visible at once (scrolls beyond). */
  visible = Infinity;
  scroll = 0;
  /** Accept pointer input (tap to activate, hover to select). */
  pointer = true;
  /** Set when the selection changed this step (screens may react). */
  changed = false;
  private rects: (HitRect | null)[] = [];

  constructor(items: MenuItem[]) {
    this.items = items;
    this.index = Math.max(0, this.items.findIndex((it) => this.selectable(it)));
  }

  isDisabled(i: MenuItem): boolean {
    return typeof i.disabled === 'function' ? i.disabled() : !!i.disabled;
  }

  selectable(i: MenuItem): boolean {
    return !i.section && !this.isDisabled(i);
  }

  get current(): MenuItem | undefined {
    return this.items[this.index];
  }

  labelOf(i: MenuItem): string {
    return typeof i.label === 'function' ? i.label() : i.label;
  }

  hint(): string {
    const it = this.current;
    if (!it || !it.hint) return '';
    return typeof it.hint === 'function' ? it.hint() : it.hint;
  }

  /** Select the first selectable item at or after i. */
  select(i: number): void {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const j = (i + k) % n;
      if (this.selectable(this.items[j])) {
        this.index = j;
        return;
      }
    }
  }

  private move(d: number): void {
    const n = this.items.length;
    const start = this.index;
    for (let k = 0; k < n; k++) {
      this.index = (this.index + d + n) % n;
      if (this.selectable(this.items[this.index])) break;
    }
    if (this.index !== start) {
      this.changed = true;
      audio.play('menu_move');
    }
  }

  private activate(it: MenuItem): void {
    if (it.action) {
      audio.play('menu_select');
      it.action();
    } else if (it.right) {
      it.right();
      audio.play('menu_move');
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.changed = false;
    const m = input.menu;
    const n = this.items.length;
    if (!n) return;
    if (!this.selectable(this.items[this.index] ?? { label: '', section: true })) this.select(this.index);
    if (m.pressed('up')) this.move(-1);
    if (m.pressed('down')) this.move(1);
    const it = this.items[this.index];
    if (!it) return;
    if (m.pressed('left') && it.left && !this.isDisabled(it)) {
      it.left();
      audio.play('menu_move');
    }
    if (m.pressed('right') && it.right && !this.isDisabled(it)) {
      it.right();
      audio.play('menu_move');
    }
    if (m.pressed('confirm') && this.selectable(it)) {
      this.activate(it);
    } else if (m.pressed('back') && this.onBack) {
      audio.play('menu_back');
      this.onBack();
    }
    if (this.pointer) this.updatePointer();
    this.clampScroll();
  }

  private hitIndex(x: number, y: number): number {
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  private updatePointer(): void {
    // Mouse hover selects.
    if (uiInput.hoverMoved && uiInput.hover) {
      const i = this.hitIndex(uiInput.hover.x, uiInput.hover.y);
      if (i >= 0 && i !== this.index && this.selectable(this.items[i])) {
        this.index = i;
        this.changed = true;
        audio.play('menu_move');
      }
      // Only a real mouse move re-selects (keyboard navigation keeps working).
      uiInput.hoverMoved = false;
    }
    const tap = uiInput.findTap((t) => this.hitIndex(t.x, t.y) >= 0);
    if (!tap) return;
    const i = this.hitIndex(tap.x, tap.y);
    const it = this.items[i];
    if (!this.selectable(it)) return;
    if (i !== this.index) {
      this.index = i;
      this.changed = true;
    }
    const r = this.rects[i]!;
    if ((it.left || it.right) && r.vx !== undefined && tap.x >= r.vx) {
      // Tap on the value: left half decreases, right half increases.
      const mid = r.vx + (r.x + r.w - r.vx) / 2;
      if (tap.x < mid && it.left) it.left();
      else if (it.right) it.right();
      else if (it.left) it.left();
      audio.play('menu_move');
      return;
    }
    this.activate(it);
  }

  private clampScroll(): void {
    const n = this.items.length;
    if (!isFinite(this.visible) || n <= this.visible) {
      this.scroll = 0;
      return;
    }
    // Keep the selection (and its section header) in view.
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index > 0 && this.items[this.index - 1]?.section && this.index - 1 < this.scroll) this.scroll = this.index - 1;
    if (this.index >= this.scroll + this.visible) this.scroll = this.index - this.visible + 1;
    this.scroll = Math.max(0, Math.min(n - this.visible, this.scroll));
  }

  render(g: CanvasRenderingContext2D, x: number, y: number, opts: MenuRenderOpts = {}): void {
    const sp = opts.spacing ?? 12;
    const w = opts.width ?? 160;
    const accent = opts.accent ?? C.gold;
    this.clampScroll();
    this.rects = this.items.map(() => null);
    const n = this.items.length;
    const first = this.scroll;
    const last = isFinite(this.visible) ? Math.min(n, first + this.visible) : n;
    for (let i = first; i < last; i++) {
      const it = this.items[i];
      const label = this.labelOf(it);
      const yy = y + (i - first) * sp;
      if (it.section) {
        // Section header: label with rules on both sides.
        const tw = drawText(g, label, x, yy, { color: C.brass, outline: C.out, align: 'center' });
        const half = Math.round(w / 2);
        rect(g, x - half, yy + 3, half - tw / 2 - 5, 1, C.brassD);
        rect(g, x + tw / 2 + 4, yy + 3, half - tw / 2 - 4, 1, C.brassD);
        continue;
      }
      const sel = i === this.index;
      const dis = this.isDisabled(it);
      const col = dis ? C.dim : sel ? accent : (it.color ?? opts.color ?? C.white);
      const hasValue = !!(it.value || it.renderValue);
      if (hasValue) {
        const lx = Math.round(x - w / 2);
        if (sel && opts.bar !== false) selBar(g, lx - 6, yy - 2, w + 12, sp - 1, this.time, accent);
        drawText(g, label, lx, yy, { color: col, outline: C.out });
        const rx = Math.round(x + w / 2);
        let vw = 0;
        if (it.renderValue) {
          vw = it.renderValue(g, sel ? rx - 8 : rx, yy, sel);
        } else {
          const v = it.value!();
          vw = drawText(g, v, sel ? rx - 8 : rx, yy, { color: sel ? C.white : C.grey, align: 'right', outline: C.out });
        }
        if (sel && (it.left || it.right)) {
          const bob = Math.floor(this.time * 4) % 2;
          drawText(g, '◀', rx - 8 - vw - 8 - bob, yy, { color: accent, outline: C.out });
          drawText(g, '▶', rx - 4 + bob, yy, { color: accent, outline: C.out });
        }
        this.rects[i] = { x: lx - 6, y: yy - 2, w: w + 12, h: sp, vx: rx - Math.max(vw, 30) - 16 };
      } else if (opts.align === 'left') {
        if (sel && opts.bar !== false) selBar(g, x - 12, yy - 2, w, sp - 1, this.time, accent);
        drawText(g, label, x, yy, { color: col, outline: C.out });
        if (sel) cursor(g, x - 10, yy, this.time, accent);
        this.rects[i] = { x: x - 12, y: yy - 2, w, h: sp };
      } else {
        const tw = textWidth(label);
        if (sel && opts.bar !== false) selBar(g, x - w / 2, yy - 2, w, sp - 1, this.time, accent);
        drawText(g, label, x, yy, { color: col, align: 'center', outline: C.out });
        if (sel) {
          const bob = Math.floor(this.time * 4) % 2;
          drawText(g, '▶', x - tw / 2 - 10 + bob, yy, { color: accent, outline: C.out });
          drawText(g, '◀', x + tw / 2 + 5 - bob, yy, { color: accent, outline: C.out });
        }
        this.rects[i] = { x: x - w / 2, y: yy - 2, w, h: sp };
      }
    }
    // Scroll hints.
    if (isFinite(this.visible) && n > this.visible) {
      const bob = Math.floor(this.time * 3) % 2;
      if (first > 0) drawText(g, '▲', x, y - sp + 2 - bob, { align: 'center', color: accent, outline: C.out });
      if (last < n) drawText(g, '▼', x, y + (last - first) * sp - 3 + bob, { align: 'center', color: accent, outline: C.out });
    }
  }
}
