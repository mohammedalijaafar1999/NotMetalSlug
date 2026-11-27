// Ending after the final mission: the Iron Citadel goes up in a chain of explosions, the squad
// and the freed mechanics celebrate on the hill at sunrise, then the credits roll with the final
// stats. Afterwards: name entry (if the score qualifies) -> high scores -> title.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, wrapText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { fxRng, Rng } from '../engine/rng';
import { progress, qualifiesForHighScore, saveProgress, settings, unlockMission } from '../engine/storage';
import { mixColor } from '../engine/pixelart';
import { app } from '../app';
import { flow } from './flow';
import { characters, getCharacter } from '../game/characters';
import type { GameSession } from '../game/session';
import { Particles } from '../game/effects';
import { HF } from '../game/hostage';
import { NameEntryScene } from './gameover';
import { HighScoresScene } from './highscores';
import { creditLines, creditsHeight, renderCredits } from './credits';
import { C, PLAYER_COLORS, blink, enterMenu, footer, formatTime, panel, rect, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';

const T_BOOM = 6.2;
const T_CELEBRATE = 9.5;
const T_CREDITS = 23;

const EPILOGUE =
  'THE RUSTCOAT LEGION IS FINISHED. MARSHAL GRISTLE WAS LAST SEEN PADDLING A RUBBER DINGHY TOWARD THE HORIZON, SHAKING HIS FIST. THE MECHANICS OF PUERTO POLVORA ARE FREE AND ALREADY FIXING EVERYTHING. THE RUCKUS SQUAD HAS EARNED A VACATION.';

/**
 * Who celebrates on the hill: the whole squad in roster order. A soldier only player 2 played
 * wears player 2's colors; if both players picked the same soldier, player 2's twin joins too.
 */
export function endingSquad(session: GameSession): { id: string; p2: boolean }[] {
  const pick = (i: number) => (session.players[i]?.joined ? session.players[i].character : null);
  const p1 = pick(0);
  const p2 = pick(1);
  const out: { id: string; p2: boolean }[] = [];
  for (const c of characters()) {
    out.push({ id: c.id, p2: c.id === p2 && c.id !== p1 });
    if (c.id === p2 && c.id === p1) out.push({ id: c.id, p2: true });
  }
  return out;
}

export class EndingScene implements Scene {
  name = 'ending';
  time = 0;
  private parts = new Particles();
  private boomTimer = 0;
  private fireworkTimer = 0;
  private bigFlash = 0;
  private credits = creditLines();
  private creditsH = 0;
  private scroll = 0;
  private leaving = false;
  private musicPhase = '';
  private squad: { id: string; p2: boolean }[] = [];
  private epi: string[] = [];

  constructor(readonly session: GameSession) {
    this.creditsH = creditsHeight(this.credits);
    this.squad = endingSquad(session);
    this.epi = wrapText(EPILOGUE, 300);
  }

  get phase(): 0 | 1 | 2 {
    return this.time < T_CELEBRATE ? 0 : this.time < T_CREDITS ? 1 : 2;
  }

  enter(): void {
    enterMenu();
    progress.cleared = true;
    unlockMission(6);
    saveProgress();
    input.twoPlayerKeyboard = false;
  }

  private music(): void {
    const want = this.phase < 2 ? 'ending' : 'credits';
    if (want !== this.musicPhase) {
      this.musicPhase = want;
      audio.playMusic(want);
    }
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    const q = this.session.players.filter((p) => p.joined && qualifiesForHighScore(p.score)).map((p) => p.index);
    if (q.length) app.scenes.set(new NameEntryScene(this.session, q, true));
    else app.scenes.set(new HighScoresScene({ onDone: () => flow.title() }));
  }

  private jumpTo(t: number): void {
    if (this.time < t) {
      this.time = t;
      if (t >= T_CELEBRATE) this.parts.clear();
    }
  }

  get creditsDone(): boolean {
    // Credits + results have scrolled by and THE END has settled.
    return this.scroll > this.creditsH + 24 + 74 + 146 - 36;
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    this.music();
    const m = input.menu;
    const tap = !!uiInput.takeTap();
    const ph = this.phase;
    if ((m.pressed('confirm') || tap) && this.time > 0.6) {
      if (ph === 0) this.jumpTo(T_CELEBRATE);
      else if (ph === 1) this.jumpTo(T_CREDITS);
      else if (this.creditsDone) this.next();
    }
    if (m.pressed('start') && this.time > 0.6) {
      if (ph < 2) this.jumpTo(T_CREDITS);
      else this.scroll = Math.max(this.scroll, this.creditsH + 209);
    }
    if (ph === 0) this.updateDestruction(dt);
    else this.updateFireworks(dt);
    if (ph === 2) {
      const fast = m.held('confirm') || m.held('down');
      this.scroll += dt * (fast ? 70 : 18);
      if (this.creditsDone && this.scroll > this.creditsH + 208 + 18 * 12) this.next();
    }
    if (this.bigFlash > 0) this.bigFlash -= dt;
    this.parts.update(dt, null);
  }

  private citadelPoint(): [number, number] {
    return [VIEW_W / 2 + fxRng.range(-105, 105), fxRng.range(48, 168)];
  }

  private updateDestruction(dt: number): void {
    const t = this.time;
    if (t < T_BOOM) {
      this.boomTimer -= dt;
      const rate = 0.5 - Math.min(0.42, t * 0.07);
      if (this.boomTimer <= 0 && t > 0.8) {
        this.boomTimer = rate;
        const [x, y] = this.citadelPoint();
        const size = fxRng.pick(['medium', 'medium', 'large', t > 3 ? 'huge' : 'large'] as const);
        this.parts.add({ kind: 'sprite', x, y, sprite: sprites.get(`explosion_${size}`), fps: 16, life: 12 / 16, front: true });
        this.parts.debris(x, y, 6, ['#2a1a2a', '#4a2a2a', '#1c1026'], 160);
        this.parts.smokePuffs(x, y - 6, 2, 8, '#3a2a3a', '#2a1e2a');
        uiSfx(size === 'huge' ? 'explosion_big' : 'explosion', { vol: 0.5, pitchVar: 0.1 });
        if (size !== 'medium') app.renderer?.shake(size === 'huge' ? 4 : 2, 0.25);
      }
    } else if (t - dt < T_BOOM) {
      // The big one.
      this.bigFlash = 1.2;
      if (settings.flashes) app.renderer?.flash('#ffffff', 0.9);
      app.renderer?.shake(8, 1.2);
      uiSfx('boss_die');
      uiSfx('explosion_big');
      for (let i = 0; i < 10; i++) {
        const [x, y] = this.citadelPoint();
        this.parts.add({ kind: 'sprite', x, y, sprite: sprites.get('explosion_huge'), fps: 12, life: 1, front: true });
      }
      this.parts.debris(VIEW_W / 2, 110, 40, ['#2a1a2a', '#4a2a2a', '#ff8a2a'], 260);
    } else if (fxRng.chance(0.4)) {
      // Smoke column.
      this.parts.add({ kind: 'smoke', x: VIEW_W / 2 + fxRng.range(-30, 30), y: 150, vx: fxRng.range(-6, 6), vy: fxRng.range(-40, -25), life: 3, size: 6, size2: 22, color: '#4a3a44', color2: '#2a2030', alpha: 0.9 });
    }
  }

  private updateFireworks(dt: number): void {
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = fxRng.range(0.35, 0.9);
      const x = fxRng.range(40, VIEW_W - 40);
      const y = fxRng.range(24, 90);
      const col = fxRng.pick(['#ffd040', '#ff6a8a', '#7ad0ff', '#a0ff80', '#ffffff', '#ff9a3a']);
      const col2 = mixColor(col, '#ffffff', 0.5);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const sp = fxRng.range(50, 70);
        this.parts.add({ kind: 'px', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: fxRng.range(0.9, 1.4), color: col2, color2: col, gravity: 40, drag: 1.2, size: 1, front: true });
      }
      this.parts.add({ kind: 'ring', x, y, life: 0.3, size: 2, size2: 18, color: '#ffffff', front: true });
      uiSfx('explosion_small', { vol: 0.25, pitch: 1.6 });
    }
    if (this.phase === 1 && fxRng.chance(0.5)) {
      this.parts.add({ kind: 'px', x: fxRng.range(0, VIEW_W), y: -2, vx: fxRng.range(-10, 10), vy: fxRng.range(20, 40), life: 6, color: fxRng.pick(['#ffd040', '#ff6a8a', '#7ad0ff', '#a0ff80']), front: true, size: 2 });
    }
  }

  // ------------------------------------------------------------------ render

  private sky(g: CanvasRenderingContext2D, top: string, mid: string, bottom: string): void {
    for (let y = 0; y < VIEW_H; y += 3) {
      const t = y / VIEW_H;
      g.fillStyle = t < 0.6 ? mixColor(top, mid, t / 0.6) : mixColor(mid, bottom, (t - 0.6) / 0.4);
      g.fillRect(0, y, VIEW_W, 3);
    }
  }

  private sea(g: CanvasRenderingContext2D, y0: number, col: string, hi: string): void {
    rect(g, 0, y0, VIEW_W, VIEW_H - y0, col);
    g.fillStyle = hi;
    for (let y = y0 + 2; y < VIEW_H; y += 5) {
      const off = Math.floor(this.time * 10 + y * 3) % 24;
      for (let x = -24 + off; x < VIEW_W; x += 24) g.fillRect(x, y, 8, 1);
    }
  }

  render(g: CanvasRenderingContext2D): void {
    const ph = this.phase;
    if (ph === 0) this.renderDestruction(g);
    else if (ph === 1) this.renderCelebration(g);
    else this.renderCredits(g);
    if (this.bigFlash > 0) rect(g, 0, 0, VIEW_W, VIEW_H, '#ffffff', Math.min(1, this.bigFlash));
  }

  private renderDestruction(g: CanvasRenderingContext2D): void {
    this.sky(g, '#1a0c2a', '#6a2a3a', '#d8603a');
    // Glow behind the fortress.
    g.globalAlpha = 0.25 + Math.min(0.4, this.time * 0.05);
    g.fillStyle = '#ff8a3a';
    g.beginPath();
    g.arc(VIEW_W / 2, 150, 90 + Math.sin(this.time * 6) * 4, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    const shakeX = this.time > 2 && this.time < T_BOOM ? Math.round(Math.sin(this.time * 40) * Math.min(2, (this.time - 2) * 0.6)) : 0;
    sprites.get(this.time < T_BOOM ? 'ui_end_citadel' : 'ui_end_ruins').draw(g, VIEW_W / 2 + shakeX, 178);
    this.parts.render(g, false);
    this.sea(g, 176, '#2a1a3a', '#6a3a5a');
    this.parts.render(g, true);
    const msg = this.time < T_BOOM ? 'THE IRON CITADEL IS GOING DOWN!' : 'BOOM!';
    if (this.time > 0.5) {
      const n = Math.floor((this.time - 0.5) * 30);
      text(g, msg.slice(0, n), VIEW_W / 2, 10, { align: 'center', color: C.gold });
    }
    if (this.time > T_BOOM + 1) twoTone(g, 'THE LEGION IS FINISHED!', VIEW_W / 2, 24, C.white, C.gold, { scale: 2, align: 'center', split: 3 });
    footer(g, 'FIRE: SKIP', VIEW_H - 10, C.greyD);
  }

  private hill(g: CanvasRenderingContext2D, color: string, rim: string): void {
    g.fillStyle = color;
    for (let x = 0; x < VIEW_W; x++) {
      const y = Math.round(168 - 18 * Math.exp(-(((x - 200) / 140) ** 2)) + Math.sin(x * 0.07) * 1.5);
      g.fillRect(x, y, 1, VIEW_H - y);
      g.fillStyle = rim;
      g.fillRect(x, y, 1, 1);
      g.fillStyle = color;
    }
  }

  private hillY(x: number): number {
    return Math.round(168 - 18 * Math.exp(-(((x - 200) / 140) ** 2)) + Math.sin(x * 0.07) * 1.5);
  }

  private drawSquad(g: CanvasRenderingContext2D): void {
    const n = this.squad.length;
    const x0 = 200 - ((n - 1) * 34) / 2;
    this.squad.forEach((s, i) => {
      const x = Math.round(x0 + i * 34);
      const jump = Math.round(Math.max(0, Math.sin(this.time * 5 + i * 1.7)) * (i % 2 ? 6 : 3));
      const base = `char_${s.id}${s.p2 ? '_p2' : ''}`;
      const f = Math.floor(this.time * 3 + i) % 2 === 0 ? 5 : 6;
      sprites.get(`${base}_body`).draw(g, x, this.hillY(x) + 1 - jump, f, { flip: i >= n / 2 && n > 2 });
    });
    // Freed mechanics cheering at both ends.
    const hs = sprites.get('hostage');
    const spots = [x0 - 44, x0 - 24, x0 + (n - 1) * 34 + 24, x0 + (n - 1) * 34 + 44];
    spots.forEach((x, i) => {
      const hop = Math.floor(this.time * 4 + i) % 2 === 0;
      hs.draw(g, x, this.hillY(x) + 1 - (hop ? 3 : 0), hop ? HF.HOP : HF.SALUTE, { flip: x > 200 });
    });
  }

  private renderCelebration(g: CanvasRenderingContext2D): void {
    const k = Math.min(1, (this.time - T_CELEBRATE) / 3);
    this.sky(g, mixColor('#2a2a6a', '#4a8ad8', k), mixColor('#d86a5a', '#ffc0a0', k), '#ffe0a0');
    // Sun rising.
    g.fillStyle = '#fff0b0';
    g.beginPath();
    g.arc(300, 150 - k * 40, 18, 0, Math.PI * 2);
    g.fill();
    // Ruins smoking on the horizon (far).
    sprites.get('ui_end_ruins').draw(g, 110, 172, 0, { alpha: 0.55 });
    this.sea(g, 160, '#3a6aa8', '#8ac0e8');
    this.hill(g, '#3a7a2e', '#6ab84a');
    this.drawSquad(g);
    this.parts.render(g, false);
    this.parts.render(g, true);
    const t = this.time - T_CELEBRATE;
    twoTone(g, 'MISSION ACCOMPLISHED!', VIEW_W / 2, 8, C.white, C.gold, { scale: 2, align: 'center', split: 3 });
    if (t > 1) {
      panel(g, 30, 28, VIEW_W - 60, 12 + this.epi.length * 9, 'dark', 0.78);
      let left = Math.floor((t - 1) * 38);
      this.epi.forEach((l, i) => {
        if (left <= 0) return;
        drawText(g, l.slice(0, left), 40, 34 + i * 9, { color: C.white, outline: C.out });
        left -= l.length;
      });
    }
    footer(g, 'FIRE: SKIP', VIEW_H - 10, C.greyD);
  }

  private renderCredits(g: CanvasRenderingContext2D): void {
    this.sky(g, '#060418', '#141034', '#2a1a4a');
    const r = new Rng(7);
    for (let i = 0; i < 80; i++) {
      const x = r.int(0, VIEW_W);
      const y = r.int(0, 150);
      if (Math.sin(this.time * 2 + i) > -0.5) rect(g, x, y, 1, 1, i % 7 ? '#8a80c0' : '#ffffff');
    }
    sprites.get('ui_moon').draw(g, 330, 34);
    this.parts.render(g, false);
    this.parts.render(g, true);
    this.hill(g, '#141a2a', '#2a3450');
    this.drawSquad(g);
    // Night lighting on the foreground.
    rect(g, 0, 120, VIEW_W, VIEW_H - 120, '#06041a', 0.55);
    // Roll (credits, then the final stats) in the sky above the hill.
    const ROLL_BOTTOM = 146;
    g.save();
    g.beginPath();
    g.rect(0, 0, VIEW_W, ROLL_BOTTOM);
    g.clip();
    const top = ROLL_BOTTOM - this.scroll;
    renderCredits(g, this.credits, top, this.time);
    const sy = top + this.creditsH + 24;
    const cx = VIEW_W / 2;
    if (sy < ROLL_BOTTOM + 10) {
      twoTone(g, 'FINAL RESULTS', cx, sy, C.cream, C.gold, { align: 'center', split: 3 });
      const joined = this.session.players.filter((p) => p.joined);
      joined.forEach((p, i) => {
        const c = getCharacter(p.character);
        drawText(g, `${p.index + 1}P ${c.name}  ${pad(p.score, 8)}`, cx, sy + 14 + i * 10, { align: 'center', color: PLAYER_COLORS[p.index], outline: C.out });
      });
      const yy = sy + 16 + joined.length * 10;
      drawText(g, `PLAY TIME ${formatTime(this.session.playTime)}`, cx, yy, { align: 'center', color: C.white, outline: C.out });
      drawText(g, `CONTINUES ${this.session.players.reduce((a, p) => a + (p.joined ? p.continues : 0), 0)}`, cx, yy + 10, { align: 'center', color: C.white, outline: C.out });
    }
    const endY = Math.max(36, sy + 74);
    if (endY < ROLL_BOTTOM) {
      twoTone(g, 'THE END', cx, endY, C.white, C.gold, { scale: 3, align: 'center', split: 3 });
      text(g, 'THANK YOU FOR PLAYING!', cx, endY + 28, { align: 'center', color: C.blue });
    }
    // Soft fade at the roll's edges.
    for (let i = 0; i < 8; i++) {
      rect(g, 0, i * 2, VIEW_W, 2, '#060418', 0.6 - i * 0.075);
      rect(g, 0, ROLL_BOTTOM - 2 - i * 2, VIEW_W, 2, '#100c2c', 0.6 - i * 0.075);
    }
    g.restore();
    if (this.creditsDone && blink(this.time, 1.5, 0.7)) footer(g, 'PRESS FIRE', VIEW_H - 10, C.gold);
    else if (!this.creditsDone) footer(g, 'HOLD FIRE: FAST', VIEW_H - 10, C.greyD);
  }
}
