// Mission tally: stats count up one by one, rescued hostages pop in, the rescue bonus (+1000
// each) rolls into each player's score, a rank stamp lands, then on to the next briefing or
// the ending.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { drawText, textWidth } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { progress, saveProgress, unlockMission } from '../engine/storage';
import { flow, type MissionStats } from './flow';
import { getLevel, levelForMission } from '../game/level';
import { getCharacter } from '../game/characters';
import type { GameSession } from '../game/session';
import { C, PLAYER_COLORS, blink, ctl, easeOut, easeOutBack, enterMenu, footer, formatTime, panel, rect, text, twoTone, uiInput, uiSfx, syncTouch } from './ui';
import { faceSprite } from '../content/ui/art';
import { countHostages, missionInfo } from '../content/ui/missions';

export const RESCUE_BONUS = 1000;
export const LAST_MISSION = 6;

const T_ROWS = [0.7, 1.1, 1.7, 2.2];
const ROW_DUR = 0.5;
const T_HOST = 2.9;
const ICON_DT = 0.12;

/** Letter rank from the share of hostages rescued (null if unknown). */
export function missionRank(rescues: number, total: number): string | null {
  if (total <= 0) return null;
  const f = rescues / total;
  return f >= 1 ? 'S' : f >= 0.75 ? 'A' : f >= 0.45 ? 'B' : 'C';
}

export function accuracy(kills: number, shots: number): number {
  return Math.min(100, Math.round((kills * 100) / Math.max(1, shots)));
}

export class TallyScene implements Scene {
  name = 'tally';
  time = 0;
  bonusApplied = false;
  private finished = false;
  private baseScores: number[];
  private tickT = 0;
  private lastCounts = '';
  private readonly tBonus: number;
  private readonly tRank: number;
  private readonly tDone: number;
  readonly rank: string | null;
  /** Hostages placed in the level (0 = unknown). */
  readonly hostageTotal: number;
  private rankSfx = false;
  private bonusSfx = false;
  private poppedIcons = 0;

  constructor(
    readonly session: GameSession,
    readonly stats: MissionStats,
  ) {
    this.baseScores = session.players.map((p) => p.score);
    const maxR = Math.max(0, ...stats.playerRescues.map((r, i) => (session.players[i]?.joined ? r : 0)));
    this.tBonus = T_HOST + Math.min(maxR, 20) * ICON_DT + 0.35;
    this.tRank = this.tBonus + 1.0;
    this.tDone = this.tRank + 0.5;
    const def = (stats.levelId ? getLevel(stats.levelId) : undefined) ?? levelForMission(this.missionNo);
    this.hostageTotal = countHostages(def);
    this.rank = missionRank(stats.rescues, this.hostageTotal);
  }

  get missionNo(): number {
    return this.stats.mission || this.session.mission;
  }

  enter(): void {
    enterMenu();
    audio.playMusic('tally');
  }

  private applyBonus(): void {
    if (this.bonusApplied) return;
    this.bonusApplied = true;
    this.session.players.forEach((p, i) => {
      if (p.joined) p.score = this.baseScores[i] + (this.stats.playerRescues[i] ?? 0) * RESCUE_BONUS;
    });
  }

  /** Jump to the end of the count-up. */
  skip(): void {
    if (this.time < this.tDone) this.time = this.tDone;
    this.applyBonus();
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.applyBonus();
    const s = this.session;
    const m = this.missionNo;
    unlockMission(Math.min(LAST_MISSION, m + 1));
    progress.totalKills += this.stats.kills;
    progress.totalRescues += this.stats.rescues;
    saveProgress();
    const next = m + 1;
    if (m >= LAST_MISSION || !levelForMission(next)) {
      flow.ending(s);
    } else {
      s.mission = next;
      flow.mission(s);
    }
  }

  private k(start: number, dur = ROW_DUR): number {
    return Math.max(0, Math.min(1, (this.time - start) / dur));
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    const m = input.menu;
    const press = m.pressed('confirm') || m.pressed('start') || !!uiInput.takeTap();
    if (press && this.time > 0.4) {
      if (this.time < this.tDone) this.skip();
      else {
        this.finish();
        return;
      }
    }
    if (this.time >= this.tBonus + 0.8 && !this.bonusApplied) this.applyBonus();
    if (this.time > this.tDone + 7) this.finish();
    // Sounds.
    const counts = this.countsKey();
    this.tickT -= dt;
    if (counts !== this.lastCounts && this.tickT <= 0 && this.time < this.tDone) {
      uiSfx('tally_tick', { vol: 0.6 });
      this.tickT = 0.05;
    }
    this.lastCounts = counts;
    const icons = this.iconsShown();
    if (icons > this.poppedIcons) {
      this.poppedIcons = icons;
      uiSfx('tally_tick', { pitch: 1.4 });
    }
    if (!this.bonusSfx && this.time >= this.tBonus + 0.8) {
      this.bonusSfx = true;
      uiSfx('tally_bonus');
    }
    if (!this.rankSfx && this.rank && this.time >= this.tRank) {
      this.rankSfx = true;
      uiSfx('explosion_small', { vol: 0.5 });
    }
  }

  private iconsShown(): number {
    if (this.time < T_HOST) return 0;
    return Math.floor((this.time - T_HOST) / ICON_DT) + 1;
  }

  private countsKey(): string {
    const st = this.stats;
    return [
      Math.round(st.time * this.k(T_ROWS[0])),
      Math.round(st.kills * this.k(T_ROWS[1])),
      Math.round(st.shotsFired * this.k(T_ROWS[2])),
      Math.round(st.rescues * this.k(T_ROWS[3])),
      Math.round(this.k(this.tBonus, 0.8) * 100),
    ].join(',');
  }

  render(g: CanvasRenderingContext2D): void {
    const cx = VIEW_W / 2;
    // Background: dusk gradient with rays.
    for (let y = 0; y < VIEW_H; y += 4) {
      const t = y / VIEW_H;
      g.fillStyle = t < 0.5 ? `rgb(${16 + t * 40},${12 + t * 20},${40 + t * 30})` : `rgb(${36 - (t - 0.5) * 30},${22 - (t - 0.5) * 20},${55 - (t - 0.5) * 50})`;
      g.fillRect(0, y, VIEW_W, 4);
    }
    g.globalAlpha = 0.05;
    g.fillStyle = '#ffd080';
    for (let i = 0; i < 12; i++) {
      const a = this.time * 0.15 + (i * Math.PI) / 6;
      g.beginPath();
      g.moveTo(cx, -20);
      g.lineTo(cx + Math.cos(a) * 500, -20 + Math.sin(a) * 500);
      g.lineTo(cx + Math.cos(a + 0.12) * 500, -20 + Math.sin(a + 0.12) * 500);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    const st = this.stats;
    const n = this.missionNo;
    const info = missionInfo(n);
    // Header (letters drop in).
    const head = n > 0 ? `MISSION ${n} COMPLETE!` : 'TRAINING COMPLETE!';
    const hw = textWidth(head, 2);
    let hx = cx - hw / 2;
    let i = 0;
    for (const ch of head) {
      const k = easeOutBack((this.time - i * 0.03) / 0.3);
      if (k > 0) twoTone(g, ch, Math.round(hx), 8 + Math.round((1 - k) * -24), C.white, C.gold, { scale: 2, split: 3, alpha: Math.min(1, k * 2) });
      hx += textWidth(ch, 2) + 2;
      i++;
    }
    if (this.time > 0.4) text(g, info.name, cx, 27, { align: 'center', color: C.blue });
    // Stats panel.
    const px = 70;
    const pw = 244;
    panel(g, px, 38, pw, 62, 'steel', 0.9);
    // Hostages freed (out of how many) is what the rank is graded on, so it gets the last row.
    const freed = Math.round(st.rescues * this.k(T_ROWS[3]));
    const rows: [string, string][] = [
      ['CLEAR TIME', formatTime(st.time * this.k(T_ROWS[0]))],
      ['ENEMIES DOWN', String(Math.round(st.kills * this.k(T_ROWS[1])))],
      ['SHOTS FIRED', String(Math.round(st.shotsFired * this.k(T_ROWS[2])))],
      ['HOSTAGES FREED', this.hostageTotal > 0 ? `${freed}/${this.hostageTotal}` : String(freed)],
    ];
    rows.forEach(([label, value], r) => {
      if (this.time < T_ROWS[r] - 0.1) return;
      const y = 45 + r * 13;
      const slide = easeOut((this.time - T_ROWS[r] + 0.1) / 0.25);
      const ox = Math.round((1 - slide) * -30);
      drawText(g, label, px + 10 + ox, y, { color: C.grey, outline: C.out });
      const lw = textWidth(label);
      for (let x = px + 14 + lw; x < px + pw - 60; x += 4) rect(g, x, y + 5, 1, 1, C.greyD);
      text(g, value, px + pw - 10, y, { align: 'right', color: this.k(T_ROWS[r]) < 1 ? C.white : C.gold });
    });
    // Rank stamp.
    if (this.rank && this.time >= this.tRank) {
      const k = Math.min(1, (this.time - this.tRank) / 0.18);
      const sc = k < 1 ? 5 - k * 2 : 3;
      const rx = px + pw + 34;
      const ry = 69;
      g.globalAlpha = Math.min(1, k * 1.5);
      g.strokeStyle = C.red;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(rx, ry, 9 * (sc / 3) + 6, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1;
      g.globalAlpha = 1;
      const col = this.rank === 'S' ? C.gold : this.rank === 'A' ? '#70e070' : this.rank === 'B' ? C.blue : C.grey;
      text(g, this.rank, rx + 1, ry - Math.round((7 * sc) / 2), { align: 'center', scale: Math.round(sc), color: col, alpha: Math.min(1, k * 1.5) });
      drawText(g, 'RANK', rx, ry + 18, { align: 'center', color: C.red, outline: C.out });
    }
    // Player panels.
    const joined = this.session.players.filter((p) => p.joined);
    const two = joined.length > 1;
    const ppw = two ? 180 : 244;
    joined.forEach((p, j) => {
      const x = two ? (j === 0 ? 10 : VIEW_W - 10 - ppw) : px;
      const y = 106;
      const idx = p.index;
      const c = getCharacter(p.character);
      panel(g, x, y, ppw, 84, 'dark', 0.88);
      rect(g, x + 2, y + 2, ppw - 4, 1, PLAYER_COLORS[idx]);
      sprites.get(faceSprite(c.id, idx === 1)).draw(g, x + 13, y + 20);
      drawText(g, `${idx + 1}P`, x + 24, y + 5, { color: PLAYER_COLORS[idx], outline: C.out });
      text(g, c.name, x + 40, y + 5, { color: C.white });
      const pk = this.stats.playerKills?.[idx];
      if (pk !== undefined) drawText(g, `KILLS ${Math.round(pk * this.k(T_ROWS[1]))}`, x + ppw - 8, y + 5, { align: 'right', color: C.grey, outline: C.out });
      // Hostage icons.
      const res = this.stats.playerRescues[idx] ?? 0;
      drawText(g, 'RESCUED', x + 24, y + 18, { color: C.grey, outline: C.out });
      const shown = Math.min(res, this.iconsShown());
      const perRow = two ? 10 : 16;
      for (let h = 0; h < Math.min(shown, perRow * 2); h++) {
        const age = this.time - (T_HOST + h * ICON_DT);
        const pop = easeOutBack(age / 0.2);
        const hx2 = x + 72 + (h % perRow) * 8;
        const hy2 = y + 26 + Math.floor(h / perRow) * 11 - Math.round((1 - Math.min(1, pop)) * 6);
        (sprites.tryGet('hud_hostage') ?? sprites.get('ui_hostage')).draw(g, hx2, hy2, 0, { alpha: Math.min(1, pop) });
      }
      if (res === 0 && this.time > T_HOST) drawText(g, 'NONE', x + 72, y + 18, { color: C.greyD, outline: C.out });
      if (res > 0 && shown >= res) drawText(g, `×${res}`, x + ppw - 8, y + 18, { align: 'right', color: C.white, outline: C.out });
      // Bonus and score.
      const bonus = res * RESCUE_BONUS;
      const bk = this.bonusApplied ? 1 : this.k(this.tBonus, 0.8);
      const showBonus = this.time >= this.tBonus - 0.35;
      drawText(g, 'BONUS', x + 24, y + 50, { color: C.grey, outline: C.out });
      if (showBonus) {
        if (bk < 1) twoTone(g, `+${Math.round(bonus * (1 - bk))}`, x + ppw - 8, y + 46, C.cream, C.gold, { align: 'right', scale: 2, split: 3 });
        else drawText(g, `+${bonus} ✓`, x + ppw - 8, y + 50, { align: 'right', color: C.greyD, outline: C.out });
      }
      drawText(g, 'SCORE', x + 24, y + 68, { color: C.grey, outline: C.out });
      const scoreShown = this.bonusApplied ? p.score : this.baseScores[idx] + Math.round(bonus * bk);
      twoTone(g, pad(scoreShown, 8), x + ppw - 8, y + 64, C.white, C.gold, { align: 'right', scale: 2, split: 3 });
    });
    if (this.time >= this.tDone) {
      if (blink(this.time, 1.5, 0.7)) footer(g, ctl('PRESS FIRE TO CONTINUE', 'TAP TO CONTINUE'), VIEW_H - 14, C.gold);
    } else footer(g, ctl('FIRE: SKIP', 'TAP: SKIP'), VIEW_H - 14, C.greyD);
  }
}
