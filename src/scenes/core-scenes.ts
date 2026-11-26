// Core (baseline) scenes: boot/loading, title, mission tally, game over with initials entry,
// and a simple ending. UI content modules may replace these via the `flow` hooks.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { addHighScore, getHighScores, qualifiesForHighScore, progress, saveProgress, unlockMission } from '../engine/storage';
import { app } from '../app';
import { flow, type MissionStats } from './flow';
import { Menu } from './menu';
import type { GameSession } from '../game/session';
import { allLevels } from '../game/level';

export const RESCUE_BONUS = 1000;

/** Bakes all sprites with a progress bar, then goes to the title. */
export class BootScene implements Scene {
  name = 'boot';
  private list = sprites.all();
  private i = 0;
  private done = false;

  update(): void {
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
      const el = document.getElementById('boot');
      if (el) el.remove();
      flow.title();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const f = this.list.length ? this.i / this.list.length : 1;
    drawText(g, 'LOADING', VIEW_W / 2, VIEW_H / 2 - 16, { align: 'center', color: '#ffd040' });
    g.fillStyle = '#2a2a3a';
    g.fillRect(VIEW_W / 2 - 60, VIEW_H / 2, 120, 6);
    g.fillStyle = '#ffd040';
    g.fillRect(VIEW_W / 2 - 60, VIEW_H / 2, Math.round(120 * f), 6);
  }
}

/** Minimal title screen (replaced by the full UI module). */
export class TitleScene implements Scene {
  name = 'title';
  time = 0;
  menu = new Menu([
    { label: '1 PLAYER', action: () => flow.newGame({ twoPlayer: false }) },
    { label: '2 PLAYERS', action: () => flow.newGame({ twoPlayer: true }) },
    { label: 'OPTIONS', action: () => flow.options() },
  ]);

  enter(): void {
    input.flush();
    audio.playMusic('title');
  }

  update(dt: number): void {
    this.time += dt;
    this.menu.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#1a1028';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, 'IRON RUCKUS', VIEW_W / 2, 40, { align: 'center', scale: 4, color: '#ffb02a', outline: '#140c1c' });
    drawText(g, 'AN ARCADE RUN-AND-GUN', VIEW_W / 2, 78, { align: 'center', color: '#9ad0ff' });
    this.menu.render(g, VIEW_W / 2, 120, { spacing: 14 });
    const hs = getHighScores()[0];
    if (hs) drawText(g, `HI ${pad(hs.score, 8)} ${hs.name}`, VIEW_W / 2, VIEW_H - 14, { align: 'center', color: '#a0a0b8' });
  }
}

/** Mission results: rescue bonus counted into each player's score. */
export class TallyScene implements Scene {
  name = 'tally';
  time = 0;
  private bonusApplied = false;

  constructor(
    private session: GameSession,
    private stats: MissionStats,
  ) {}

  enter(): void {
    input.flush();
    audio.playMusic('tally');
  }

  private finish(): void {
    if (!this.bonusApplied) this.applyBonus();
    const s = this.session;
    const last = Math.max(...allLevels().map((l) => l.mission));
    unlockMission(Math.min(6, s.mission + 1));
    progress.totalKills += this.stats.kills;
    progress.totalRescues += this.stats.rescues;
    if (s.mission >= last) {
      progress.cleared = true;
      saveProgress();
      flow.ending(s);
    } else {
      saveProgress();
      s.mission++;
      flow.mission(s);
    }
  }

  private applyBonus(): void {
    this.bonusApplied = true;
    this.session.players.forEach((p, i) => {
      if (p.joined) p.score += (this.stats.playerRescues[i] ?? 0) * RESCUE_BONUS;
    });
  }

  update(dt: number): void {
    this.time += dt;
    if (this.time > 2.2 && !this.bonusApplied) {
      this.applyBonus();
      audio.play('tally_bonus');
    }
    if ((this.time > 1 && input.menu.pressed('confirm')) || this.time > 7) this.finish();
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#10182a';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, `MISSION ${this.stats.mission} COMPLETE`, VIEW_W / 2, 24, { align: 'center', scale: 2, color: '#ffd040', outline: '#140c1c' });
    const t = this.stats.time;
    drawText(g, `TIME ${Math.floor(t / 60)}:${pad(Math.floor(t % 60), 2)}`, VIEW_W / 2, 52, { align: 'center', color: '#ffffff' });
    drawText(g, `ENEMIES DOWN ${this.stats.kills}`, VIEW_W / 2, 64, { align: 'center', color: '#ffffff' });
    this.session.players.forEach((p, i) => {
      if (!p.joined) return;
      const x = this.session.twoPlayer ? (i === 0 ? VIEW_W * 0.3 : VIEW_W * 0.7) : VIEW_W / 2;
      const r = this.stats.playerRescues[i] ?? 0;
      drawText(g, `${i + 1}P`, x, 92, { align: 'center', color: i === 0 ? '#ff6a3a' : '#3ab0ff', scale: 2 });
      drawText(g, `RESCUED ${r}`, x, 116, { align: 'center' });
      drawText(g, `BONUS ${r * RESCUE_BONUS}`, x, 128, { align: 'center', color: this.bonusApplied ? '#ffe060' : '#a0a0a0' });
      drawText(g, `SCORE ${pad(p.score, 8)}`, x, 146, { align: 'center', color: '#ffe060' });
    });
    if (this.time > 1 && Math.floor(this.time * 2) % 2 === 0) drawText(g, 'PRESS FIRE', VIEW_W / 2, VIEW_H - 20, { align: 'center', color: '#a0a0b8' });
  }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!? ';

/** Game over + arcade initials entry. */
export class GameOverScene implements Scene {
  name = 'gameover';
  time = 0;
  entering: number[] = [];
  cur = 0;
  name3 = [0, 0, 0];
  pos = 0;
  done = false;

  constructor(
    private session: GameSession,
    private cleared = false,
  ) {
    this.entering = session.players.filter((p) => p.joined && qualifiesForHighScore(p.score)).map((p) => p.index);
  }

  enter(): void {
    input.flush();
    audio.playMusic(this.cleared ? 'ending' : 'gameover');
    if (!this.cleared) audio.say('Game over');
  }

  update(dt: number): void {
    this.time += dt;
    if (this.time < 1.5) return;
    const m = input.menu;
    if (this.cur < this.entering.length) {
      if (m.pressed('up')) this.name3[this.pos] = (this.name3[this.pos] + 1) % LETTERS.length;
      if (m.pressed('down')) this.name3[this.pos] = (this.name3[this.pos] - 1 + LETTERS.length) % LETTERS.length;
      if (m.pressed('right') || m.pressed('confirm')) {
        audio.play('menu_select');
        this.pos++;
        if (this.pos >= 3) {
          const idx = this.entering[this.cur];
          const p = this.session.players[idx];
          addHighScore({
            name: this.name3.map((i) => LETTERS[i]).join(''),
            score: p.score,
            mission: this.cleared ? 7 : this.session.mission,
            character: p.character,
            date: new Date().toISOString().slice(0, 10),
          });
          this.cur++;
          this.pos = 0;
          this.name3 = [0, 0, 0];
        }
      }
      if (m.pressed('left') || m.pressed('back')) this.pos = Math.max(0, this.pos - 1);
      return;
    }
    if (m.pressed('confirm') || this.time > 12) flow.title();
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, this.cleared ? 'CONGRATULATIONS!' : 'GAME OVER', VIEW_W / 2, 30, { align: 'center', scale: 3, color: this.cleared ? '#ffd040' : '#ff4040', outline: '#140c1c' });
    if (this.cur < this.entering.length) {
      const idx = this.entering[this.cur];
      drawText(g, `${idx + 1}P NEW HIGH SCORE!`, VIEW_W / 2, 74, { align: 'center', color: '#ffd040' });
      drawText(g, pad(this.session.players[idx].score, 8), VIEW_W / 2, 88, { align: 'center', scale: 2 });
      for (let i = 0; i < 3; i++) {
        const ch = LETTERS[this.name3[i]];
        const sel = i === this.pos && Math.floor(this.time * 4) % 2 === 0;
        drawText(g, ch === ' ' ? '_' : ch, VIEW_W / 2 - 24 + i * 24, 116, { align: 'center', scale: 3, color: sel ? '#ffd040' : '#ffffff' });
      }
      drawText(g, 'UP/DOWN: LETTER   FIRE: NEXT', VIEW_W / 2, 150, { align: 'center', color: '#a0a0b8' });
    } else {
      const list = getHighScores().slice(0, 5);
      list.forEach((h, i) => drawText(g, `${i + 1}. ${h.name}  ${pad(h.score, 8)}`, VIEW_W / 2, 80 + i * 12, { align: 'center', color: i === 0 ? '#ffd040' : '#ffffff' }));
    }
  }
}

/** Placeholder options (the UI module provides the full screen). */
export class SimpleOptionsScene implements Scene {
  name = 'options';
  overlay = true;
  menu = new Menu([{ label: 'BACK', action: () => app.scenes.pop() }]);
  constructor() {
    this.menu.onBack = () => app.scenes.pop();
  }
  enter(): void {
    input.flush();
  }
  update(dt: number): void {
    this.menu.update(dt);
  }
  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, 'OPTIONS', VIEW_W / 2, 40, { align: 'center', scale: 2, color: '#ffd040' });
    this.menu.render(g, VIEW_W / 2, 100);
  }
}
