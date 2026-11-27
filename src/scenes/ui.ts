// UI kit shared by every front-end screen and the HUD: palette, beveled panels, text effects,
// keycaps, hazard stripes, the UI sound helper, touch-overlay visibility and pointer/tap input
// (so every menu is usable with a mouse or a finger). Nothing here touches the DOM at import time.

import { drawText, textWidth, FONT_H, type TextOpts } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { audio, type PlayOpts } from '../engine/audio';
import { input, keyLabel, type Action, type Bindings } from '../engine/input';
import { app } from '../app';

/** UI palette (matches the game's art: near-black purple outline, brass/gold accents). */
export const C = {
  out: '#140c1c',
  ink: '#0c0814',
  gold: '#ffd040',
  gold2: '#ffb02a',
  brass: '#c8902a',
  brassD: '#7a4a14',
  cream: '#fff6c0',
  blue: '#9ad0ff',
  blueD: '#3a6a9a',
  grey: '#a0a0b8',
  greyD: '#6a6a80',
  dim: '#4a4a5a',
  red: '#ff4040',
  redD: '#a01a1a',
  green: '#70e070',
  white: '#ffffff',
  p1: '#ff6a3a',
  p2: '#3ab0ff',
  panel: '#1c1428',
  panel2: '#261c36',
  panelHi: '#5a4a72',
  panelLo: '#0c0814',
  steel: '#3a3a4e',
  steelHi: '#7a7a98',
  steelLo: '#1e1e2c',
} as const;

export const PLAYER_COLORS = [C.p1, C.p2];

// ------------------------------------------------------------------ sound

/** UI sound names (all from the canonical list in docs/DESIGN.md). */
export const UI_SFX_NAMES = [
  'menu_move',
  'menu_select',
  'menu_back',
  'pause',
  'tally_bonus',
  'tally_tick',
  'banner',
  'start_game',
  'typewriter',
  'countdown_tick',
  'coin',
  'explosion',
  'explosion_big',
  'explosion_small',
  'boss_die',
  'rescue',
  'extra_life',
  'pickup_points',
  'alarm',
] as const;
export type UiSfx = (typeof UI_SFX_NAMES)[number];

/** If the audio module hasn't defined a UI sound yet, use a close relative so screens still click. */
const SFX_FALLBACK: Partial<Record<UiSfx, UiSfx>> = {
  tally_tick: 'menu_move',
  start_game: 'menu_select',
  typewriter: 'menu_move',
  countdown_tick: 'menu_move',
  explosion: 'explosion_small',
  explosion_big: 'explosion',
};

/** Play a UI sound (falls back to a defined relative when the canonical one isn't defined). */
export function uiSfx(name: UiSfx, opts: PlayOpts = {}): void {
  let n: UiSfx | undefined = name;
  let vol = opts.vol ?? 1;
  for (let guard = 0; n && guard < 3; guard++) {
    if (audio.hasSfx(n)) {
      audio.play(n, { ...opts, vol });
      return;
    }
    n = SFX_FALLBACK[n];
    vol *= 0.6;
  }
}

// ------------------------------------------------------------------ touch overlay

let touchRoot: unknown = null;
let touchVisible: boolean | null = null;

/** Show the on-screen touch controls only during gameplay (no-op until they exist). */
export function syncTouch(visible: boolean): void {
  const t = input.touch;
  if (!t.root) return;
  if (t.root === touchRoot && touchVisible === visible) return;
  touchRoot = t.root;
  touchVisible = visible;
  t.setVisible(visible);
}

// ------------------------------------------------------------------ pointer / raw activity

export interface Tap {
  x: number;
  y: number;
  /** performance.now() when it happened (taps nobody claims expire). */
  t?: number;
}

const TAP_TTL = 250;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Mouse/touch taps in view coordinates plus "real" input activity (keys, pointer, gamepad
 * buttons), independent of bot/virtual input (attract mode needs to know a human pressed something).
 */
class UiInput {
  private attached = false;
  private taps: Tap[] = [];
  private down: { id: number; x: number; y: number; t: number } | null = null;
  private activity = false;
  /** Mouse hover position (view coords) and whether it moved since the last flush. */
  hover: Tap | null = null;
  hoverMoved = false;

  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    const view = (e: PointerEvent): Tap | null => {
      const r = app.renderer;
      if (!r) return null;
      return r.clientToView(e.clientX, e.clientY);
    };
    window.addEventListener('keydown', () => {
      this.activity = true;
    });
    window.addEventListener('pointerdown', (e) => {
      this.activity = true;
      const v = view(e);
      if (!v) return;
      this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24 || performance.now() - d.t > 900) return;
      const v = view(e);
      if (v && v.x >= 0 && v.y >= 0 && v.x < VIEW_W && v.y < VIEW_H) this.taps.push({ x: v.x, y: v.y, t: now() });
      if (this.taps.length > 4) this.taps.shift();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const v = view(e);
      if (!v) return;
      this.hover = v;
      this.hoverMoved = true;
    });
  }

  /** Drop taps nobody claimed in time (so they can't block or fire later). */
  private purge(): void {
    const n = now();
    this.taps = this.taps.filter((t) => t.t === undefined || n - t.t < TAP_TTL);
  }

  /** Oldest pending tap (not consumed). */
  peekTap(): Tap | null {
    this.purge();
    return this.taps[0] ?? null;
  }

  takeTap(): Tap | null {
    this.purge();
    return this.taps.shift() ?? null;
  }

  /** Consume the first pending tap matching `pred`. */
  findTap(pred: (t: Tap) => boolean): Tap | null {
    this.purge();
    const i = this.taps.findIndex(pred);
    if (i < 0) return null;
    return this.taps.splice(i, 1)[0];
  }

  /** Consume a pending tap if it lies inside the rect. */
  takeTapIn(x: number, y: number, w: number, h: number): boolean {
    return !!this.findTap((t) => t.x >= x && t.x < x + w && t.y >= y && t.y < y + h);
  }

  /** Test/automation hook: inject a tap in view coordinates. */
  injectTap(x: number, y: number): void {
    this.taps.push({ x, y, t: now() });
  }

  /** True if a human pressed a key / touched / pressed a gamepad button since the last call. */
  takeActivity(): boolean {
    let a = this.activity;
    this.activity = false;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      try {
        for (const gp of navigator.getGamepads()) {
          if (gp && gp.connected && gp.buttons.some((b) => b.pressed)) a = true;
        }
      } catch {
        /* ignore */
      }
    }
    return a;
  }

  /** Mark activity (tests). */
  poke(): void {
    this.activity = true;
  }

  flush(): void {
    this.taps = [];
    this.hoverMoved = false;
    this.activity = false;
  }
}

export const uiInput = new UiInput();

/** Prompt for the device in use: `keys` normally, `touch` after the player last touched the screen. */
export function ctl(keys: string, touch: string): string {
  return input.lastDevice === 'touch' ? touch : keys;
}

/** Short key summary of a keyboard layout, e.g. "WASD + J K L" (prefers non-numpad keys). */
export function layoutLabel(b: Bindings): string {
  const pick = (a: Action) => {
    const ks = b[a] ?? [];
    return keyLabel(ks.find((k) => !k.startsWith('Numpad')) ?? ks[0] ?? '?');
  };
  const arrows = b.up?.[0] === 'ArrowUp' && b.left?.[0] === 'ArrowLeft' && b.down?.[0] === 'ArrowDown' && b.right?.[0] === 'ArrowRight';
  const move = arrows ? 'ARROWS' : (['up', 'left', 'down', 'right'] as Action[]).map(pick).join('');
  return `${move} + ${pick('fire')} ${pick('jump')} ${pick('bomb')}`;
}

/** Who uses which keys while two players share the keyboard. */
export function sharedKeysHint(): string {
  return `1P: ${layoutLabel(input.bindings.p1)}    2P: ${layoutLabel(input.bindings.p2)}`;
}

/** Common per-scene "enter" housekeeping for menu screens. */
export function enterMenu(): void {
  uiInput.attach();
  uiInput.flush();
  input.flush();
  syncTouch(false);
}

// ------------------------------------------------------------------ timing helpers

export const blink = (t: number, hz = 2, duty = 0.5): boolean => (t * hz) % 1 < duty;

export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const easeIn = (t: number): number => Math.min(1, Math.max(0, t)) ** 3;
export function easeOutBack(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/** Ordinal rank label: 1 -> 1ST. */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH');
  return `${n}${n % 10 > 3 ? 'TH' : s}`;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

// ------------------------------------------------------------------ text

/** Text with the standard dark outline. Returns the width. */
export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, opts: TextOpts = {}): number {
  return drawText(g, s, x, y, { outline: C.out, ...opts });
}

/** Arcade two-tone text: `top` color on the upper rows, `bottom` color on the lower rows. */
export function twoTone(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  top: string,
  bottom: string,
  opts: { scale?: number; align?: 'left' | 'center' | 'right'; outline?: string | null; split?: number; alpha?: number } = {},
): number {
  const scale = opts.scale ?? 1;
  const w = textWidth(s, scale);
  const left = opts.align === 'center' ? Math.round(x - w / 2) : opts.align === 'right' ? Math.round(x - w) : Math.round(x);
  drawText(g, s, left, y, { color: bottom, scale, outline: opts.outline === undefined ? C.out : opts.outline, alpha: opts.alpha });
  const split = Math.round((opts.split ?? 3) * scale);
  g.save();
  g.beginPath();
  g.rect(left - 2, Math.round(y) - 2, w + 4, split + 2);
  g.clip();
  drawText(g, s, left, y, { color: top, scale, shadow: null, alpha: opts.alpha });
  g.restore();
  return w;
}

/** Per-character wavy text (title prompts, celebrations). */
export function waveText(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  t: number,
  opts: TextOpts & { amp?: number; speed?: number; phase?: number } = {},
): number {
  const scale = opts.scale ?? 1;
  const w = textWidth(s, scale);
  let cx = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
  const amp = opts.amp ?? 2;
  const sp = opts.speed ?? 6;
  let i = 0;
  for (const ch of s) {
    const cw = textWidth(ch, scale);
    const dy = Math.round(Math.sin(t * sp - i * (opts.phase ?? 0.55)) * amp);
    drawText(g, ch, cx, y + dy, { ...opts, align: 'left', outline: opts.outline === undefined ? C.out : opts.outline });
    cx += cw + scale;
    i++;
  }
  return w;
}

/** Truncate to a pixel width (adds '..'). */
export function fitText(s: string, maxW: number, scale = 1): string {
  if (textWidth(s, scale) <= maxW) return s;
  let out = s;
  while (out.length > 1 && textWidth(out + '..', scale) > maxW) out = out.slice(0, -1);
  return out.trimEnd() + '..';
}

// ------------------------------------------------------------------ shapes

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  if (w <= 0 || h <= 0) return;
  const prev = g.globalAlpha;
  if (alpha !== 1) g.globalAlpha = prev * alpha;
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = prev;
}

export type PanelStyle = 'steel' | 'dark' | 'brass' | 'glass' | 'paper';

const PANEL: Record<PanelStyle, { fill: string; hi: string; lo: string; rivet?: string; edge: string }> = {
  steel: { fill: '#262236', hi: '#6a6488', lo: '#14101e', rivet: '#9a94b8', edge: C.out },
  dark: { fill: '#140e1e', hi: '#3e3256', lo: '#08060c', edge: C.out },
  brass: { fill: '#3a2410', hi: '#ffd070', lo: '#5a3008', rivet: '#ffe8a0', edge: C.out },
  glass: { fill: '#0c0a18', hi: '#4a5a8a', lo: '#06040c', edge: '#2a3050' },
  paper: { fill: '#d8c8a0', hi: '#f4ead0', lo: '#9a8a62', rivet: '#7a6a48', edge: '#3a2a1a' },
};

/** Beveled riveted panel. */
export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: PanelStyle = 'steel', alpha = 0.94): void {
  const s = PANEL[style];
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  // Outer edge (corners clipped for a chunky look).
  rect(g, x + 1, y, w - 2, 1, s.edge);
  rect(g, x + 1, y + h - 1, w - 2, 1, s.edge);
  rect(g, x, y + 1, 1, h - 2, s.edge);
  rect(g, x + w - 1, y + 1, 1, h - 2, s.edge);
  rect(g, x + 1, y + 1, w - 2, h - 2, s.fill, alpha);
  // Bevel.
  rect(g, x + 1, y + 1, w - 2, 1, s.hi, 0.9);
  rect(g, x + 1, y + 2, 1, h - 3, s.hi, 0.55);
  rect(g, x + 1, y + h - 2, w - 2, 1, s.lo);
  rect(g, x + w - 2, y + 2, 1, h - 4, s.lo);
  if (s.rivet && w >= 24 && h >= 14) {
    for (const [rx, ry] of [
      [x + 3, y + 3],
      [x + w - 5, y + 3],
      [x + 3, y + h - 5],
      [x + w - 5, y + h - 5],
    ]) {
      rect(g, rx, ry, 2, 2, s.lo);
      rect(g, rx, ry, 1, 1, s.rivet);
    }
  }
}

/** Brass title strip with centered text. */
export function titleBar(g: CanvasRenderingContext2D, label: string, cx: number, y: number, w: number, opts: { color?: string } = {}): void {
  const x = Math.round(cx - w / 2);
  panel(g, x, y, w, 13, 'brass', 1);
  rect(g, x + 2, y + 2, w - 4, 4, '#a86a1c', 0.55);
  twoTone(g, label, cx, y + 3, opts.color ?? C.white, C.cream, { align: 'center', outline: C.brassD, split: 4 });
}

/** Animated selection highlight bar. */
export function selBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, color: string = C.gold): void {
  const a = 0.22 + Math.sin(t * 6) * 0.06;
  rect(g, x, y, w, h, color, a);
  rect(g, x, y, w, 1, color, 0.6);
  rect(g, x, y + h - 1, w, 1, color, 0.35);
  // Moving glint.
  const gx = Math.round(x + ((t * 140) % (w + 80)) - 40);
  for (let i = 0; i < 3; i++) {
    const xx = gx + i;
    if (xx >= x && xx < x + w) rect(g, xx, y + 1, 1, h - 2, '#fff4c8', i === 1 ? 0.3 : 0.15);
  }
}

/** Diagonal hazard stripes (scrolling with t). */
export function stripes(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, a: string = C.gold, b: string = C.ink): void {
  rect(g, x, y, w, h, b);
  g.fillStyle = a;
  const off = Math.floor(t * 24) % 12;
  for (let yy = 0; yy < h; yy++) {
    for (let k = -12; k < w + 12; k += 12) {
      const sx = x + k + off - yy;
      const x0 = Math.max(x, sx);
      const x1 = Math.min(x + w, sx + 6);
      if (x1 > x0) g.fillRect(x0, y + yy, x1 - x0, 1);
    }
  }
}

/** Keyboard keycap; returns its width. */
export function keycap(g: CanvasRenderingContext2D, label: string, x: number, y: number, opts: { color?: string; face?: string; minW?: number; pressed?: boolean } = {}): number {
  const tw = textWidth(label);
  const w = Math.max(opts.minW ?? 11, tw + 6);
  const h = 11;
  const dy = opts.pressed ? 1 : 0;
  rect(g, x + 1, y + h - 1, w - 2, 2, '#4a4458');
  rect(g, x, y + 1 + dy, w, h - 2, C.out);
  rect(g, x + 1, y + dy, w - 2, h, C.out);
  rect(g, x + 1, y + 1 + dy, w - 2, h - 2, opts.face ?? '#e8e4da');
  rect(g, x + 1, y + 1 + dy, w - 2, 1, '#ffffff');
  rect(g, x + 1, y + h - 2 + dy, w - 2, 1, '#b0aaa0');
  drawText(g, label, x + Math.round(w / 2), y + 2 + dy, { align: 'center', color: opts.color ?? '#2a2030', shadow: null });
  return w;
}

/** Chunky "▶" cursor that bobs. */
export function cursor(g: CanvasRenderingContext2D, x: number, y: number, t: number, color: string = C.gold, dir: 1 | -1 = 1): void {
  const bob = Math.floor(t * 5) % 2;
  drawText(g, dir > 0 ? '▶' : '◀', x + bob * dir, y, { color, outline: C.out });
}

/** Thin horizontal divider with a center diamond. */
export function divider(g: CanvasRenderingContext2D, cx: number, y: number, w: number, color: string = C.brass): void {
  rect(g, cx - w / 2, y, w, 1, color, 0.8);
  rect(g, cx - w / 2, y + 1, w, 1, C.out, 0.6);
  drawText(g, '◆', cx, y - 3, { align: 'center', color, outline: C.out });
}

/** Footer hint line (bottom of the screen, centered). */
export function footer(g: CanvasRenderingContext2D, s: string, y = VIEW_H - 10, color: string = C.grey): void {
  drawText(g, s, VIEW_W / 2, y, { align: 'center', color, outline: C.out });
}

/** Small "BACK" button (top-left) for touch users; returns true if tapped. */
export function backButton(g: CanvasRenderingContext2D | null, t: number): boolean {
  const x = 4;
  const y = 4;
  const w = 34;
  const h = 13;
  if (g) {
    panel(g, x, y, w, h, 'dark', 0.85);
    drawText(g, '◀ BACK', x + w / 2, y + 3, { align: 'center', color: blink(t, 0.5, 0.9) ? C.grey : C.white, shadow: null });
    return false;
  }
  return uiInput.takeTapIn(x, y, w, h);
}

/** Dim the whole screen. */
export function dimScreen(g: CanvasRenderingContext2D, alpha: number, color = '#06040c'): void {
  rect(g, 0, 0, VIEW_W, VIEW_H, color, alpha);
}

/** Text block height for n lines at a line height. */
export function linesHeight(n: number, lh = FONT_H + 3): number {
  return n * lh;
}
