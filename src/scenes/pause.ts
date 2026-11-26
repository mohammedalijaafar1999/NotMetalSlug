// Pause overlay: resume / restart mission / options / controls / quit (with confirmation).

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { app } from '../app';
import { flow } from './flow';
import { Menu } from './menu';
import type { GameplayScene } from './gameplay';
import { DIFFICULTY_NAMES } from '../game/constants';
import { ControlsScene } from './controls';
import { C, PLAYER_COLORS, blink, dimScreen, enterMenu, formatTime, panel, stripes, syncTouch, text, twoTone } from './ui';

export class PauseScene implements Scene {
  name = 'pause';
  overlay = true;
  menu: Menu;
  time = 0;
  private confirm: 'quit' | 'restart' | null = null;

  constructor(private game: GameplayScene) {
    this.menu = new Menu([
      { label: 'RESUME', action: () => this.close(), hint: 'BACK TO THE FIGHT.' },
      {
        label: () => (this.confirm === 'restart' ? 'REALLY RESTART?' : 'RESTART MISSION'),
        action: () => {
          if (this.confirm !== 'restart') {
            this.confirm = 'restart';
            return;
          }
          app.scenes.pop();
          this.game.restart();
        },
        hint: 'START THIS MISSION OVER WITH THE SCORE YOU HAD WHEN IT BEGAN.',
      },
      { label: 'OPTIONS', action: () => flow.options(), hint: 'VOLUME, VIDEO AND CONTROLS.' },
      { label: 'CONTROLS', action: () => app.scenes.push(new ControlsScene({ overlay: true, page: 1 })), hint: 'WHICH BUTTON DOES WHAT.' },
      {
        label: () => (this.confirm === 'quit' ? 'REALLY QUIT?' : 'QUIT TO TITLE'),
        action: () => {
          if (this.confirm !== 'quit') {
            this.confirm = 'quit';
            return;
          }
          audio.stopMusic(0.3);
          input.twoPlayerKeyboard = false;
          flow.title();
        },
        hint: 'ABANDON THE MISSION. PROGRESS SO FAR IS KEPT.',
      },
    ]);
    this.menu.onBack = () => this.close();
  }

  enter(): void {
    enterMenu();
    audio.duck(true);
    audio.play('pause');
  }

  exit(): void {
    audio.duck(false);
  }

  resume(): void {
    enterMenu();
  }

  close(): void {
    app.scenes.pop();
  }

  update(dt: number): void {
    this.time += dt;
    syncTouch(false);
    if (input.menu.pressed('start') && this.time > 0.15 && !input.menu.pressed('confirm')) {
      this.close();
      return;
    }
    const before = this.menu.index;
    this.menu.update(dt);
    if (this.menu.index !== before) this.confirm = null;
  }

  render(g: CanvasRenderingContext2D): void {
    dimScreen(g, 0.62, '#0a0614');
    // Options / controls opened on top: only keep the dim.
    if (app.scenes && app.scenes.current !== this) return;
    const cx = VIEW_W / 2;
    stripes(g, 0, 0, VIEW_W, 4, this.time * 0.5, '#3a2a10', '#140c08');
    stripes(g, 0, VIEW_H - 4, VIEW_W, 4, -this.time * 0.5, '#3a2a10', '#140c08');
    twoTone(g, 'PAUSED', cx, 32, C.white, C.gold, { scale: 3, align: 'center', split: 3 });
    const def = this.game.def;
    const s = this.game.session;
    drawText(g, `MISSION ${def.mission || '-'}  ${def.name.toUpperCase()}`, cx, 58, { align: 'center', color: C.blue, outline: C.out });
    drawText(g, `${DIFFICULTY_NAMES[s.difficulty]}   TIME ${formatTime(this.game.world.stats.time)}`, cx, 68, { align: 'center', color: C.grey, outline: C.out });
    const pw = 176;
    panel(g, cx - pw / 2, 80, pw, 76, 'steel', 0.94);
    this.menu.render(g, cx, 88, { spacing: 13, width: pw - 20 });
    // Player status.
    s.players.forEach((p, i) => {
      if (!p.joined) return;
      const x = s.twoPlayer ? (i === 0 ? cx - 80 : cx + 80) : cx;
      drawText(g, `${i + 1}P  ${pad(p.score, 8)}  ×${p.lives}`, x, 164, { align: 'center', color: PLAYER_COLORS[i], outline: C.out });
    });
    const hint = this.confirm ? 'PRESS FIRE AGAIN TO CONFIRM' : this.menu.hint();
    text(g, hint, cx, 178, { align: 'center', color: this.confirm ? (blink(this.time, 3) ? C.red : C.gold) : C.grey });
    drawText(g, 'START: RESUME', cx, VIEW_H - 18, { align: 'center', color: '#8a7aa0', outline: C.out });
  }
}
