// Scrolling credits (main menu) - the same roll is reused by the ending.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { app } from '../app';
import { characters } from '../game/characters';
import { backdrop } from './backdrop';
import { C, backButton, ctl, enterMenu, footer, twoTone, uiInput, syncTouch } from './ui';
import { LOGO_W } from '../content/ui/art';

export interface CreditLine {
  /** Heading (gold). */
  h?: string;
  /** Body line (white). */
  t?: string;
  /** Small grey line. */
  s?: string;
  /** The logo. */
  logo?: boolean;
  /** Extra space after (px). */
  gap?: number;
}

export function creditLines(): CreditLine[] {
  const squad = characters().map((c) => ({ t: c.full }));
  return [
    { logo: true, gap: 10 },
    { s: 'AN ORIGINAL ARCADE RUN-AND-GUN', gap: 2 },
    { t: 'BY THE RUCKUS TEAM', gap: 22 },
    { h: 'DIRECTION' },
    { t: 'THE RUCKUS TEAM', gap: 14 },
    { h: 'GAME DESIGN' },
    { t: 'THE RUCKUS TEAM', gap: 14 },
    { h: 'PROGRAMMING' },
    { t: 'THE RUCKUS TEAM', gap: 14 },
    { h: 'PIXEL ART' },
    { t: 'EVERY SPRITE DRAWN BY CODE' },
    { s: 'PROCEDURAL ART, NO IMAGE FILES', gap: 14 },
    { h: 'MUSIC & SOUND' },
    { t: 'EVERY NOTE AND EVERY BOOM' },
    { s: 'SYNTHESIZED LIVE IN YOUR BROWSER', gap: 14 },
    { h: 'LEVEL DESIGN' },
    { t: 'THE RUCKUS TEAM', gap: 14 },
    { h: 'QUALITY ASSURANCE' },
    { t: 'THE TIRELESS AUTOPILOT', gap: 22 },
    { h: 'STARRING' },
    ...squad,
    { gap: 10 },
    { h: 'AND THE VILLAINS' },
    { t: 'MARSHAL VORTIGERN GRISTLE' },
    { t: 'THE RUSTCOAT LEGION', gap: 14 },
    { h: 'HOSTAGES' },
    { t: 'THE MECHANICS OF PUERTO POLVORA', gap: 22 },
    { s: 'NO SOLDIERS WERE HARMED IN THE MAKING' },
    { s: 'OF THIS GAME. THEY ALL WENT HOME FOR SOUP.', gap: 22 },
    { h: 'BUILT WITH' },
    { t: 'TYPESCRIPT, CANVAS AND WEB AUDIO', gap: 22 },
    { h: 'SPECIAL THANKS' },
    { t: 'YOU, FOR PLAYING!', gap: 30 },
    { t: '©2026 THE RUCKUS TEAM' },
  ];
}

const LINE_H: Record<string, number> = { h: 11, t: 11, s: 10, logo: 40 };

export function creditsHeight(lines: CreditLine[]): number {
  let h = 0;
  for (const l of lines) h += (l.logo ? LINE_H.logo : l.h ? LINE_H.h : l.t ? LINE_H.t : l.s ? LINE_H.s : 0) + (l.gap ?? 0);
  return h;
}

/** Draw the credit roll with its top at y. */
export function renderCredits(g: CanvasRenderingContext2D, lines: CreditLine[], y: number, t: number): void {
  const cx = VIEW_W / 2;
  let yy = y;
  for (const l of lines) {
    const lh = l.logo ? LINE_H.logo : l.h ? LINE_H.h : l.t ? LINE_H.t : l.s ? LINE_H.s : 0;
    if (yy > -48 && yy < VIEW_H + 8) {
      if (l.logo) sprites.get('ui_logo').draw(g, Math.round(cx - LOGO_W / 2), yy, Math.floor(t * 8) % 30 < 13 ? Math.floor(t * 8) % 30 : 0);
      else if (l.h) twoTone(g, l.h, cx, yy, C.cream, C.gold, { align: 'center', split: 3 });
      else if (l.t) drawText(g, l.t, cx, yy, { align: 'center', color: C.white, outline: C.out });
      else if (l.s) drawText(g, l.s, cx, yy, { align: 'center', color: C.grey, outline: C.out });
    }
    yy += lh + (l.gap ?? 0);
  }
}

export class CreditsScene implements Scene {
  name = 'credits';
  time = 0;
  scroll = 0;
  private lines = creditLines();
  private total = 0;

  enter(): void {
    enterMenu();
    this.total = creditsHeight(this.lines);
    audio.playMusic('credits');
  }

  exit(): void {
    audio.playMusic('title');
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    backdrop().update(dt);
    const m = input.menu;
    const fast = m.held('confirm') || m.held('down');
    this.scroll += dt * (fast ? 70 : 16);
    if (m.pressed('back') || backButton(null, this.time) || this.scroll > this.total + VIEW_H + 10) {
      app.scenes.pop();
      return;
    }
    uiInput.takeTap();
  }

  render(g: CanvasRenderingContext2D): void {
    backdrop().render(g, { dim: 0.68, squad: false });
    renderCredits(g, this.lines, VIEW_H - this.scroll, this.time);
    // Fade bands top and bottom.
    for (let i = 0; i < 10; i++) {
      g.globalAlpha = 0.5 - i * 0.05;
      g.fillStyle = '#06040c';
      g.fillRect(0, i * 2, VIEW_W, 2);
      g.fillRect(0, VIEW_H - 2 - i * 2, VIEW_W, 2);
    }
    g.globalAlpha = 1;
    backButton(g, this.time);
    footer(g, ctl('HOLD FIRE: FAST   BACK: RETURN', ''), VIEW_H - 10);
  }
}
