// Mission briefing card: tactical map of Puerto Polvora with the target marked, mission number,
// name, operation codename and the briefing typed out like a teletype. FIRE starts the mission.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, textWidth, wrapText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { app } from '../app';
import { GameplayScene } from './gameplay';
import { C, PLAYER_COLORS, blink, divider, enterMenu, fitText, footer, panel, rect, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';
import { MAP_H, MAP_POINTS, MAP_W, faceSprite } from '../content/ui/art';
import { MISSION_COUNT, missionInfo } from '../content/ui/missions';
import { getCharacter } from '../game/characters';
import type { GameSession } from '../game/session';

/** Draw the tactical map with the route and markers. `current` = mission being briefed / selected. */
export function renderMap(g: CanvasRenderingContext2D, x: number, y: number, t: number, current: number, opts: { reached?: number; showAll?: boolean } = {}): void {
  sprites.get('ui_map').draw(g, x, y);
  // Grid overlay.
  g.fillStyle = '#7ad0ff';
  g.globalAlpha = 0.09;
  for (let gx = 11; gx < MAP_W; gx += 22) g.fillRect(x + gx, y + 2, 1, MAP_H - 4);
  for (let gy = 10; gy < MAP_H; gy += 20) g.fillRect(x + 2, y + gy, MAP_W - 4, 1);
  // Radar sweep.
  const sx = ((t * 60) % (MAP_W + 40)) - 20;
  for (let k = 0; k < 14; k++) {
    const xx = Math.round(sx - k);
    if (xx < 2 || xx >= MAP_W - 2) continue;
    g.globalAlpha = 0.18 * (1 - k / 14);
    g.fillRect(x + xx, y + 2, 1, MAP_H - 4);
  }
  g.globalAlpha = 1;
  const reached = Math.max(current, opts.reached ?? current);
  // Route.
  for (let i = 0; i < MISSION_COUNT - 1; i++) {
    const [ax, ay] = MAP_POINTS[i];
    const [bx, by] = MAP_POINTS[i + 1];
    const done = i + 2 <= reached;
    if (!done && !opts.showAll) continue;
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let s = 0; s <= steps; s++) {
      if (!done && (s + Math.floor(t * 8)) % 4 > 1) continue;
      if (done && s % 2 === 1) continue;
      g.fillStyle = done ? '#ffd040' : '#8aa0b8';
      g.fillRect(Math.round(x + ax + ((bx - ax) * s) / steps), Math.round(y + ay + ((by - ay) * s) / steps), 1, 1);
    }
  }
  // Markers.
  for (let i = 0; i < MISSION_COUNT; i++) {
    const n = i + 1;
    const [mx, my] = MAP_POINTS[i];
    const px = x + mx;
    const py = y + my;
    if (n === current) {
      const r = 6 + ((t * 10) % 8);
      g.strokeStyle = '#ff4a3a';
      g.globalAlpha = Math.max(0, 1 - (r - 6) / 8);
      g.beginPath();
      g.arc(px + 0.5, py + 0.5, r, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      sprites.get('ui_reticle').draw(g, px, py, Math.floor(t * 4) % 2);
      drawText(g, `M${n}`, px + 9, py - 11, { color: '#ffffff', outline: C.out });
    } else if (n < reached || (opts.showAll && n < reached)) {
      rect(g, px - 3, py - 3, 7, 7, C.out);
      rect(g, px - 2, py - 2, 5, 5, '#3ac04a');
      drawText(g, '✓', px - 2, py - 3, { color: '#ffffff', shadow: null });
    } else if (opts.showAll || n === reached) {
      rect(g, px - 2, py - 2, 5, 5, C.out);
      rect(g, px - 1, py - 1, 3, 3, n <= reached ? '#ffd040' : '#6a7a8a');
    }
  }
}

export class BriefingScene implements Scene {
  name = 'briefing';
  time = 0;
  private chars = 0;
  private lines: string[] = [];
  private total = 0;
  private started = false;
  private tick = 0;
  readonly mission: number;

  constructor(
    readonly session: GameSession,
    private opts: { levelId?: string } = {},
  ) {
    this.mission = session.mission;
    const info = missionInfo(this.mission);
    // Room for 11 lines between the divider and the TARGET line.
    this.lines = wrapText(info.briefing, 178);
    if (this.lines.length > 11) {
      this.lines = this.lines.slice(0, 11);
      this.lines[10] = fitText(this.lines[10] + '...', 170);
    }
    this.total = this.lines.reduce((a, l) => a + l.length, 0);
  }

  enter(): void {
    enterMenu();
    audio.playMusic('briefing');
  }

  get typed(): boolean {
    return this.chars >= this.total;
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    uiSfx('start_game');
    app.scenes.set(new GameplayScene(this.session, this.opts.levelId));
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    if (this.time > 0.45 && !this.typed) {
      const before = Math.floor(this.chars);
      this.chars = Math.min(this.total, this.chars + dt * 42);
      if (Math.floor(this.chars) !== before) {
        this.tick++;
        if (this.tick % 3 === 0) uiSfx('typewriter', { vol: 0.45, pitchVar: 0.08 });
      }
    }
    const m = input.menu;
    const go = m.pressed('confirm') || m.pressed('start') || !!uiInput.takeTap();
    if (go && this.time > 0.3) {
      if (!this.typed) this.chars = this.total;
      else this.start();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    const info = missionInfo(this.mission);
    // Tactical screen background.
    g.fillStyle = '#081420';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = '#0e2234';
    for (let x = 0; x < VIEW_W; x += 12) g.fillRect(x, 0, 1, VIEW_H);
    for (let y = 0; y < VIEW_H; y += 12) g.fillRect(0, y, VIEW_W, 1);
    g.fillStyle = '#000000';
    g.globalAlpha = 0.25;
    for (let y = (Math.floor(this.time * 30) % 3); y < VIEW_H; y += 3) g.fillRect(0, y, VIEW_W, 1);
    g.globalAlpha = 1;
    // Header bar.
    rect(g, 0, 0, VIEW_W, 20, '#120a18', 0.9);
    rect(g, 0, 20, VIEW_W, 1, C.brass);
    drawText(g, '◆ CLASSIFIED BRIEFING ◆', 8, 7, { color: blink(this.time, 1.2, 0.8) ? C.red : C.redD, outline: C.out });
    drawText(g, 'PUERTO POLVORA  0600 HRS', VIEW_W - 8, 7, { align: 'right', color: C.grey, outline: C.out });
    // Map.
    panel(g, 6, 26, MAP_W + 10, MAP_H + 10, 'steel', 1);
    renderMap(g, 11, 31, this.time, this.mission, { reached: this.mission });
    sprites.get('ui_stamp_secret').draw(g, 84, 46, 0, { alpha: 0.9 * Math.min(1, Math.max(0, (this.time - 0.6) * 4)) });
    // Squad.
    const joined = this.session.players.filter((p) => p.joined);
    panel(g, 6, 160, MAP_W + 10, 34, 'dark', 0.9);
    drawText(g, 'SQUAD', 12, 164, { color: C.brass, outline: C.out });
    joined.forEach((p, i) => {
      const c = getCharacter(p.character);
      const fx = 22 + i * 90;
      sprites.get(faceSprite(c.id, p.index === 1)).draw(g, fx, 191);
      drawText(g, `${p.index + 1}P`, fx + 11, 175, { color: PLAYER_COLORS[p.index], outline: C.out });
      drawText(g, c.name, fx + 11, 184, { color: C.white, outline: C.out });
    });
    // Mission text.
    const rx = 196;
    const rw = VIEW_W - rx - 8;
    const appear = Math.min(1, this.time / 0.35);
    const ox = Math.round((1 - appear) * 40);
    twoTone(g, `MISSION ${this.mission || '-'}`, rx + ox, 28, C.cream, C.gold, { scale: 2, split: 3 });
    const nameScale = textWidth(info.name, 2) <= rw ? 2 : 1;
    text(g, fitText(info.name, rw), rx + ox, 47, { scale: nameScale, color: info.color });
    drawText(g, fitText(info.subtitle, rw), rx + ox, 47 + 7 * nameScale + 4, { color: C.blue, outline: C.out });
    divider(g, rx + rw / 2, 80, rw, C.brass);
    const lh = this.lines.length > 10 ? 8 : 9;
    let left = Math.floor(this.chars);
    this.lines.forEach((l, i) => {
      if (left <= 0) return;
      const s = l.slice(0, left);
      left -= l.length;
      drawText(g, s, rx, 86 + i * lh, { color: '#c8f0c8', outline: C.out });
      if (left < 0 && blink(this.time, 4)) rect(g, rx + textWidth(s) + 1, 86 + i * lh, 4, 7, '#c8f0c8');
    });
    if (this.typed) {
      sprites.get('ui_reticle').draw(g, rx + 6, 186, Math.floor(this.time * 4) % 2);
      drawText(g, 'TARGET:', rx + 16, 183, { color: C.grey, outline: C.out });
      text(g, fitText(info.boss, rw - 62), rx + 62, 183, { color: C.red });
      if (blink(this.time, 1.6, 0.7)) footer(g, input.lastDevice === 'touch' ? 'TAP TO DEPLOY' : 'PRESS FIRE TO DEPLOY', VIEW_H - 12, C.gold);
    } else {
      footer(g, 'FIRE: SKIP', VIEW_H - 12, C.greyD);
    }
    // Power-on flash.
    if (this.time < 0.25) {
      const k = this.time / 0.25;
      rect(g, 0, 0, VIEW_W, VIEW_H, '#000000', 1 - k);
      rect(g, 0, VIEW_H / 2 - 1, VIEW_W * k, 2, '#c8f0ff', 1 - k);
    }
  }
}
