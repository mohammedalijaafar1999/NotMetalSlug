// In-game HUD: scores, lives, ammo/bombs, timer, boss bar, vehicle gauge, rescued hostages,
// banners ("MISSION 1 START!", "WARNING!"), the GO arrow and continue countdowns.

import { drawText, textWidth } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { sprites } from '../engine/sprites';
import type { World } from './world';
import type { Player } from './player';

interface Banner {
  text: string;
  sub?: string;
  color: string;
  time: number;
  max: number;
  scale: number;
}

export class Hud {
  banners: Banner[] = [];
  /** Continue countdown per player (seconds remaining, <0 = not counting). */
  continueTimers = [-1, -1];
  /** Whether player 2 can join (shows PRESS START). */
  allowJoin = true;
  time = 0;

  banner(text: string, opts: { sub?: string; color?: string; time?: number; scale?: number } = {}): void {
    this.banners = this.banners.filter((b) => b.text !== text);
    this.banners.push({ text, sub: opts.sub, color: opts.color ?? '#ffd040', time: opts.time ?? 2, max: opts.time ?? 2, scale: opts.scale ?? 3 });
  }

  clearBanners(): void {
    this.banners = [];
  }

  update(dt: number): void {
    this.time += dt;
    for (const b of this.banners) b.time -= dt;
    this.banners = this.banners.filter((b) => b.time > 0);
  }

  render(g: CanvasRenderingContext2D, world: World): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const players = world.players;
    for (let i = 0; i < 2; i++) {
      const p = players.find((x) => x.index === i);
      if (p && p.profile.joined) this.playerPanel(g, p, i === 0 ? 'left' : 'right');
      else if (i === 1 && this.allowJoin) {
        if (Math.floor(this.time * 2) % 2 === 0) drawText(g, '2P PRESS START', VIEW_W - 4, 4, { align: 'right', color: '#a0a0b0' });
      }
    }
    // Timer.
    const lvl = world.level;
    if (lvl && lvl.timerEnabled) {
      const t = lvl.timeLeft;
      const col = t <= 10 && Math.floor(this.time * 4) % 2 === 0 ? '#ff4040' : '#ffffff';
      drawText(g, pad(t, 2), VIEW_W / 2, 3, { align: 'center', scale: 2, color: col, outline: '#140c1c' });
    }
    // Boss bar.
    if (world.boss && !world.boss.dead) this.bossBar(g, world);
    // Rescued hostages (bottom-left).
    let rescues = 0;
    for (const p of players) rescues += p.profile.missionRescues;
    if (rescues > 0) {
      const hs = sprites.tryGet('hud_hostage');
      for (let i = 0; i < Math.min(rescues, 12); i++) {
        if (hs) hs.draw(g, 8 + i * 8, VIEW_H - 4, 0);
        else {
          g.fillStyle = '#140c1c';
          g.fillRect(4 + i * 8, VIEW_H - 11, 6, 8);
          g.fillStyle = '#e8782a';
          g.fillRect(5 + i * 8, VIEW_H - 7, 4, 3);
          g.fillStyle = '#f0c098';
          g.fillRect(5 + i * 8, VIEW_H - 10, 4, 3);
        }
      }
      if (rescues > 12) drawText(g, '+' + (rescues - 12), 4 + 12 * 8 + 2, VIEW_H - 10, { color: '#ffffff' });
    }
    // GO arrow.
    if (lvl && lvl.goTimer > 0 && Math.floor(this.time * 3) % 2 === 0) {
      drawText(g, 'GO', VIEW_W - 34, VIEW_H / 2 - 12, { scale: 2, color: '#ffd040', outline: '#140c1c' });
      drawText(g, '→', VIEW_W - 30, VIEW_H / 2 + 4, { scale: 2, color: '#ffd040', outline: '#140c1c' });
    }
    // Continue prompts.
    for (let i = 0; i < 2; i++) {
      const t = this.continueTimers[i];
      if (t < 0) continue;
      const x = i === 0 ? VIEW_W * 0.25 : VIEW_W * 0.75;
      drawText(g, `${i + 1}P CONTINUE?`, x, VIEW_H / 2 - 20, { align: 'center', color: '#ffffff', outline: '#140c1c' });
      drawText(g, String(Math.ceil(t)), x, VIEW_H / 2 - 8, { align: 'center', scale: 3, color: '#ffd040', outline: '#140c1c' });
      drawText(g, 'PRESS START', x, VIEW_H / 2 + 18, { align: 'center', color: Math.floor(this.time * 3) % 2 ? '#ffffff' : '#a0a0a0', outline: '#140c1c' });
    }
    // Banners.
    let by = VIEW_H * 0.34;
    for (const b of this.banners) {
      const a = Math.min(1, b.time / 0.25, (b.max - b.time) / 0.12 + 0.3);
      const wob = b.max - b.time < 0.15 ? (0.15 - (b.max - b.time)) * 40 : 0;
      drawText(g, b.text, VIEW_W / 2, by - wob, { align: 'center', scale: b.scale, color: b.color, outline: '#140c1c', alpha: a });
      by += 7 * b.scale + 4;
      if (b.sub) {
        drawText(g, b.sub, VIEW_W / 2, by, { align: 'center', scale: 1, color: '#ffffff', outline: '#140c1c', alpha: a });
        by += 12;
      }
    }
  }

  private playerPanel(g: CanvasRenderingContext2D, p: Player, side: 'left' | 'right'): void {
    const prof = p.profile;
    const L = side === 'left';
    const x = L ? 4 : VIEW_W - 4;
    const al = L ? 'left' : 'right';
    const col = p.char.color;
    const tag = `${p.index + 1}UP`;
    // Row 1: tag, lives, score.
    if (L) {
      let cx = x;
      cx += drawText(g, tag, cx, 3, { color: col, outline: '#140c1c' }) + 2;
      cx += drawText(g, '=' + Math.max(0, prof.lives), cx, 3, { color: '#ffffff', outline: '#140c1c' }) + 6;
      drawText(g, pad(prof.score, 8), cx, 3, { color: '#ffe060', outline: '#140c1c' });
    } else {
      let cx = x;
      cx -= drawText(g, '=' + Math.max(0, prof.lives), cx, 3, { color: '#ffffff', outline: '#140c1c', align: 'right' }) + 2;
      cx -= drawText(g, tag, cx, 3, { color: col, outline: '#140c1c', align: 'right' }) + 6;
      drawText(g, pad(prof.score, 8), cx, 3, { color: '#ffe060', outline: '#140c1c', align: 'right' });
    }
    if (p.state === 'out') return;
    // Row 2: ARMS / BOMB panel.
    const v = p.vehicle;
    const arms = v ? (v.secondaryAmmo >= 0 ? String(v.secondaryAmmo) : '∞') : isFinite(p.ammo) ? String(Math.max(0, Math.floor(p.ammo))) : '∞';
    const bombs = String(p.bombs);
    const panelW = 92;
    const px = L ? x : x - panelW;
    g.fillStyle = 'rgba(20,12,28,0.72)';
    g.fillRect(px, 12, panelW, 11);
    g.fillStyle = '#5a4a6a';
    g.fillRect(px, 12, panelW, 1);
    drawText(g, 'ARMS', px + 3, 14, { color: '#9ad0ff', shadow: null });
    drawText(g, arms, px + 45, 14, { color: '#ffffff', align: 'right', shadow: null });
    drawText(g, 'BOMB', px + 50, 14, { color: p.bombKind === 'firebomb' ? '#ff9a4a' : '#a0e060', shadow: null });
    drawText(g, bombs, px + panelW - 3, 14, { color: '#ffffff', align: 'right', shadow: null });
    // Vehicle gauge.
    if (v) {
      const gy = 25;
      g.fillStyle = 'rgba(20,12,28,0.72)';
      g.fillRect(px, gy, panelW, 8);
      const frac = Math.max(0, v.hp / v.maxHp);
      const bw = panelW - 34;
      g.fillStyle = '#3a2a2a';
      g.fillRect(px + 31, gy + 2, bw, 4);
      g.fillStyle = frac > 0.5 ? '#40e060' : frac > 0.25 ? '#ffd040' : Math.floor(this.time * 6) % 2 ? '#ff4040' : '#a02020';
      g.fillRect(px + 31, gy + 2, Math.round(bw * frac), 4);
      drawText(g, v.vehicleName.slice(0, 5), px + 2, gy + 1, { color: '#ffffff', shadow: null });
    }
  }

  private bossBar(g: CanvasRenderingContext2D, world: World): void {
    const b = world.boss!;
    const frac = Math.max(0, b.hp / b.maxHp);
    const w = 150;
    const x = Math.round(VIEW_W / 2 - w / 2);
    const y = 22;
    g.fillStyle = '#140c1c';
    g.fillRect(x - 2, y - 1, w + 4, 8);
    g.fillStyle = '#4a1a1a';
    g.fillRect(x, y + 1, w, 4);
    g.fillStyle = frac > 0.3 || Math.floor(this.time * 6) % 2 ? '#ff4a2a' : '#ffd040';
    g.fillRect(x, y + 1, Math.round(w * frac), 4);
    g.fillStyle = '#ffb0a0';
    g.fillRect(x, y + 1, Math.round(w * frac), 1);
    const name = world.bossName;
    drawText(g, name, VIEW_W / 2, y + 8, { align: 'center', color: '#ffb0a0', outline: '#140c1c' });
    void textWidth;
  }
}
