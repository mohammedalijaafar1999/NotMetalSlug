// Title screen: the IRON RUCKUS logo slams in over the animated war-night backdrop, PRESS START
// blinks, then the main menu. Idle on PRESS START for 20 s and the attract-mode demo starts.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { fxRng } from '../engine/rng';
import { getHighScores, progress } from '../engine/storage';
import { app } from '../app';
import { flow } from './flow';
import { Menu } from './menu';
import { backdrop } from './backdrop';
import { C, blink, easeOutBack, enterMenu, panel, rect, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';
import { LOGO_SHINE_FRAMES, LOGO_W, RIBBON_W } from '../content/ui/art';
import { Particles } from '../game/effects';
import { MissionSelectScene } from './missionselect';
import { ControlsScene } from './controls';
import { HighScoresScene } from './highscores';
import { SoundTestScene } from './soundtest';
import { CreditsScene } from './credits';
import { startAttractDemo } from './attract';

export const ATTRACT_IDLE = 20;
const LOGO_Y = 16;

type TitleState = 'intro' | 'press' | 'menu';

export class TitleScene implements Scene {
  name = 'title';
  time = 0;
  state: TitleState;
  stateTime = 0;
  idle = 0;
  menu: Menu;
  private logoY = LOGO_Y;
  private sparks = new Particles();
  private sparkleTimer = 0.5;
  private sparkles: { x: number; y: number; t: number }[] = [];
  /** The logo slam plays once per session. */
  static introShown = false;

  constructor(opts: { state?: TitleState } = {}) {
    this.state = opts.state ?? (TitleScene.introShown ? 'press' : 'intro');
    TitleScene.introShown = true;
    this.menu = new Menu([
      { label: 'START 1 PLAYER', action: () => flow.newGame({ twoPlayer: false }), hint: 'TAKE ON THE LEGION SOLO. A FRIEND CAN JOIN ANY TIME.' },
      { label: 'START 2 PLAYERS', action: () => flow.newGame({ twoPlayer: true }), hint: 'TWO-PLAYER CO-OP ON ONE KEYBOARD OR TWO GAMEPADS.' },
      {
        label: 'MISSION SELECT',
        action: () => app.scenes.push(new MissionSelectScene()),
        hint: () => (progress.unlocked > 1 ? `REPLAY ANY UNLOCKED MISSION (${progress.unlocked} OF 6).` : 'CLEAR MISSIONS TO UNLOCK THEM HERE.'),
      },
      { label: 'OPTIONS', action: () => flow.options(), hint: 'VOLUME, DIFFICULTY, LIVES, VIDEO AND KEY BINDINGS.' },
      { label: 'CONTROLS', action: () => app.scenes.push(new ControlsScene()), hint: 'HOW TO PLAY: KEYBOARD, GAMEPAD AND TOUCH.' },
      { label: 'HIGH SCORES', action: () => app.scenes.push(new HighScoresScene()), hint: 'THE RUCKUS SQUAD HALL OF FAME.' },
      { label: 'SOUND TEST', action: () => app.scenes.push(new SoundTestScene()), hint: 'LISTEN TO EVERY TUNE AND SOUND EFFECT.' },
      { label: 'CREDITS', action: () => app.scenes.push(new CreditsScene()), hint: 'WHO MADE ALL THIS RUCKUS.' },
    ]);
    this.menu.onBack = () => this.setState('press');
    if (this.state === 'intro') this.logoY = -60;
  }

  /** Keep the backdrop animating while an overlay (options) sits on top. */
  tickBackground(dt: number): void {
    backdrop().update(dt);
    this.time += dt;
  }

  private setState(s: TitleState): void {
    this.state = s;
    this.stateTime = 0;
    this.idle = 0;
    backdrop().setSquad(true);
  }

  enter(): void {
    enterMenu();
    audio.playMusic('title');
  }

  resume(): void {
    enterMenu();
    this.idle = 0;
    audio.playMusic('title');
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    this.stateTime += dt;
    backdrop().update(dt);
    this.updateFx(dt);
    const m = input.menu;
    if (uiInput.takeActivity() || m.anyPressed()) this.idle = 0;
    else this.idle += dt;

    switch (this.state) {
      case 'intro': {
        const t = this.stateTime;
        const fall = 0.42;
        if (t < fall) this.logoY = -60 + (LOGO_Y + 60) * (t / fall) ** 2;
        else {
          if (t - dt < fall) this.slam();
          const k = t - fall;
          this.logoY = LOGO_Y - Math.abs(Math.sin(k * 14)) * 7 * Math.exp(-k * 7);
        }
        if (t > 1.4 || ((m.pressed('confirm') || m.pressed('start') || uiInput.takeTap()) && t > 0.2)) {
          if (t <= fall) this.slam();
          this.logoY = LOGO_Y;
          this.setState('press');
        }
        break;
      }
      case 'press':
        this.logoY = LOGO_Y;
        if (m.pressed('confirm') || m.pressed('start') || uiInput.takeTap()) {
          uiSfx('start_game');
          this.setState('menu');
          this.menu.index = 0;
          input.flush();
          return;
        }
        if (this.idle > ATTRACT_IDLE && !app.scenes.transitioning) {
          startAttractDemo();
          return;
        }
        break;
      case 'menu':
        this.menu.update(dt);
        if (this.idle > 40) this.setState('press');
        break;
    }
  }

  private slam(): void {
    app.renderer?.shake(5, 0.35);
    uiSfx('explosion', { vol: 0.7 });
    const cx = VIEW_W / 2;
    for (let i = 0; i < 26; i++) {
      const x = cx - LOGO_W / 2 + fxRng.range(0, LOGO_W);
      this.sparks.add({ kind: 'spark', x, y: LOGO_Y + 30, vx: fxRng.range(-80, 80), vy: fxRng.range(-120, -30), life: fxRng.range(0.3, 0.7), color: fxRng.pick(['#ffe080', '#ffffff', '#ff9a2e']), gravity: 300 });
    }
    this.sparks.smokePuffs(cx - 100, LOGO_Y + 34, 4, 6, '#4a3a5a', '#2a1e3a');
    this.sparks.smokePuffs(cx + 100, LOGO_Y + 34, 4, 6, '#4a3a5a', '#2a1e3a');
  }

  private updateFx(dt: number): void {
    this.sparks.update(dt, null);
    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0 && this.state !== 'intro') {
      this.sparkleTimer = fxRng.range(0.4, 1.1);
      this.sparkles.push({ x: VIEW_W / 2 - LOGO_W / 2 + fxRng.range(4, LOGO_W - 8), y: LOGO_Y + fxRng.pick([1, 2, 14, 28]), t: 0 });
    }
    for (const s of this.sparkles) s.t += dt;
    this.sparkles = this.sparkles.filter((s) => s.t < 0.5);
  }

  render(g: CanvasRenderingContext2D): void {
    const bd = backdrop();
    bd.render(g, { dim: this.state === 'menu' ? 0.25 : 0 });
    const cx = VIEW_W / 2;
    // Top score line.
    const hs = getHighScores()[0];
    if (hs) {
      drawText(g, 'HI-SCORE', cx - 4, 4, { align: 'right', color: C.red, outline: C.out });
      drawText(g, `${pad(hs.score, 8)} ${hs.name}`, cx + 4, 4, { color: C.white, outline: C.out });
    }
    // Logo (+ shine sweep every few seconds).
    const cycle = this.time % 3.4;
    const shineF = cycle < 0.55 ? 1 + Math.floor((cycle / 0.55) * LOGO_SHINE_FRAMES) : 0;
    sprites.get('ui_logo').draw(g, Math.round(cx - LOGO_W / 2), Math.round(this.logoY), Math.min(LOGO_SHINE_FRAMES, shineF));
    for (const s of this.sparkles) sprites.get('ui_sparkle').draw(g, s.x, s.y, Math.min(3, Math.floor(s.t * 8)));
    this.sparks.render(g, false);
    this.sparks.render(g, true);
    if (this.state === 'intro') return;

    if (this.state === 'press') {
      // Ribbon unfurls.
      const k = Math.min(1, this.stateTime / 0.35);
      const rw = Math.round(RIBBON_W * easeOutBack(k));
      if (rw > 4) {
        g.save();
        g.beginPath();
        g.rect(cx - rw / 2, 0, rw, VIEW_H);
        g.clip();
        sprites.get('ui_ribbon').draw(g, cx, 57);
        drawText(g, '★ ARCADE RUN & GUN ★', cx, 60, { align: 'center', color: C.cream, outline: '#5a0c10' });
        g.restore();
      }
      const touch = input.lastDevice === 'touch';
      if (blink(this.time, 1.6, 0.62)) {
        twoTone(g, touch ? 'TAP TO START' : 'PRESS START', cx, 128, C.white, C.gold, { scale: 2, align: 'center', split: 3 });
      }
      drawText(g, touch ? '' : 'ENTER / SPACE / GAMEPAD START', cx, 148, { align: 'center', color: C.grey, outline: C.out });
      // Footer.
      drawText(g, '©2026 THE RUCKUS TEAM', cx, VIEW_H - 11, { align: 'center', color: '#8a7aa0', outline: C.out });
      drawText(g, 'FREE PLAY', VIEW_W - 6, VIEW_H - 11, { align: 'right', color: blink(this.time, 1, 0.8) ? C.gold : C.gold2, outline: C.out });
      drawText(g, `V${app.version}`, 6, VIEW_H - 11, { color: '#6a5a80', outline: C.out });
      return;
    }

    // Main menu (hidden while an overlay such as Options sits on top).
    if (app.scenes && app.scenes.current !== this) return;
    const pw = 168;
    const ph = 112;
    const px = Math.round(cx - pw / 2);
    const py = 60;
    const slide = easeOutBack(Math.min(1, this.stateTime / 0.3));
    const oy = Math.round((1 - slide) * 30);
    panel(g, px, py + oy, pw, ph, 'steel', 0.9);
    rect(g, px + 4, py + oy + 4, pw - 8, 1, '#ffffff', 0.06);
    this.menu.render(g, cx, py + oy + 9, { spacing: 12, width: pw - 16 });
    // Hint.
    const hint = this.menu.hint();
    if (hint) {
      panel(g, 20, VIEW_H - 32, VIEW_W - 40, 15, 'dark', 0.82);
      text(g, hint, cx, VIEW_H - 28, { align: 'center', color: C.blue });
    }
    drawText(g, 'FIRE/ENTER: OK   BOMB/ESC: BACK', cx, VIEW_H - 11, { align: 'center', color: '#8a7aa0', outline: C.out });
  }
}
