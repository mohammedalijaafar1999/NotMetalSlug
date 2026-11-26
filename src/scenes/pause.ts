// Pause overlay.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { app } from '../app';
import { flow } from './flow';
import { Menu } from './menu';
import type { GameplayScene } from './gameplay';
import { DIFFICULTY_NAMES } from '../game/constants';

export class PauseScene implements Scene {
  name = 'pause';
  overlay = true;
  menu: Menu;
  time = 0;
  private confirmQuit = false;

  constructor(private game: GameplayScene) {
    this.menu = new Menu([
      { label: 'RESUME', action: () => this.close() },
      {
        label: 'RESTART MISSION',
        action: () => {
          app.scenes.pop();
          flow.mission(this.game.session);
        },
      },
      { label: 'OPTIONS', action: () => flow.options() },
      {
        label: () => (this.confirmQuit ? 'REALLY QUIT?' : 'QUIT TO TITLE'),
        action: () => {
          if (!this.confirmQuit) {
            this.confirmQuit = true;
            return;
          }
          audio.stopMusic(0.3);
          flow.title();
        },
      },
    ]);
    this.menu.onBack = () => this.close();
  }

  enter(): void {
    input.flush();
    audio.duck(true);
    audio.play('pause');
  }

  exit(): void {
    audio.duck(false);
  }

  resume(): void {
    input.flush();
  }

  close(): void {
    app.scenes.pop();
  }

  update(dt: number): void {
    this.time += dt;
    if (input.menu.pressed('start') && this.time > 0.15) {
      this.close();
      return;
    }
    const before = this.menu.index;
    this.menu.update(dt);
    if (this.menu.index !== before) this.confirmQuit = false;
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(10,6,20,0.72)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, 'PAUSED', VIEW_W / 2, 44, { align: 'center', scale: 3, color: '#ffd040', outline: '#140c1c' });
    const s = this.game.session;
    drawText(g, `MISSION ${this.game.def.mission}  ${this.game.def.name}`, VIEW_W / 2, 74, { align: 'center', color: '#9ad0ff' });
    drawText(g, `DIFFICULTY ${DIFFICULTY_NAMES[s.difficulty]}`, VIEW_W / 2, 86, { align: 'center', color: '#a0a0b8' });
    this.menu.render(g, VIEW_W / 2, 108, { spacing: 14 });
  }
}
