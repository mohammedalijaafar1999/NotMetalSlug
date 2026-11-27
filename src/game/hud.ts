// In-game HUD: player panels (portrait, lives, rolling score, weapon + ammo with low-ammo flash,
// bomb type/count), the checkpoint timer, boss bar (intro fill + damage trail), rescued hostage
// icons, the GO arrow, animated banners ("MISSION 1" / "START!" / "WARNING!") and continue
// prompts, including the full-screen CONTINUE? countdown when every joined player is out.

import { drawText, textWidth } from '../engine/font';
import { input, keyLabel } from '../engine/input';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { sprites } from '../engine/sprites';
import type { World } from './world';
import type { Player } from './player';
import type { GameSession } from './session';
import { getCharacter } from './characters';
import { C, PLAYER_COLORS, blink, ctl, easeOut, easeOutBack, panel, rect, stripes, text, twoTone, uiSfx } from '../scenes/ui';
import { faceSprite } from '../content/ui/art';

export type BannerStyle = 'drop' | 'slide' | 'small' | 'warning';

interface Banner {
  text: string;
  sub?: string;
  color: string;
  time: number;
  max: number;
  scale: number;
  style: BannerStyle;
  dir: 1 | -1;
}

interface PanelState {
  shown: number;
  weapon: string;
  weaponPop: number;
  bombs: number;
  bombPop: number;
  lives: number;
  livesPop: number;
}

/** Short HUD names for weapons (falls back to initials for long names). */
export function weaponShortName(id: string, name: string): string {
  const known: Record<string, string> = { pistol: 'PISTOL', hmg: 'H.M.G.', rocket: 'ROCKET', shotgun: 'SHOTGUN', flame: 'FLAME', laser: 'LASER', homing: 'CHASER', bouncer: 'BOUNCER' };
  if (known[id]) return known[id];
  if (name.length <= 8) return name;
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('.') + '.';
}

/** Inner width of a player panel's second row (the panel is 126 px; the portrait takes 23). */
export const PANEL_ROW_W = 99;

/**
 * Vehicle row of a player panel: the name at full width (DRAGONFLY is 53 px), then the armor
 * bar, then the secondary ammo count (at most 99, right-aligned). The bar starts at a fixed
 * column for short names and moves right for long ones; only a name that would squeeze the bar
 * under 16 px is shortened.
 */
export function vehicleRow(name: string, rowW: number, hasAmmo: boolean): { name: string; barX: number; barW: number } {
  const ammoW = hasAmmo ? textWidth('99') + 5 : 0;
  const minBar = 16;
  let nm = name;
  while (nm.length > 1 && textWidth(nm) + 5 + minBar + 1 + ammoW > rowW) nm = nm.slice(0, -1);
  const barX = Math.max(50, textWidth(nm) + 5);
  return { name: nm, barX, barW: rowW - barX - 1 - ammoW };
}

/** Continue-countdown summary for a session. */
export function continueState(session: GameSession, timers: number[]): { allOut: boolean; counting: boolean; time: number } {
  const joined = session.players.filter((p) => p.joined);
  const allOut = joined.length > 0 && joined.every((p) => p.out);
  let time = -1;
  for (const p of joined) if (p.out && timers[p.index] >= 0) time = Math.max(time, timers[p.index]);
  return { allOut, counting: time >= 0, time };
}

/** The button player 2 presses to drop in: START on a gamepad, their START key on the keyboard. */
export function joinKey(): string {
  if (input.lastDevice === 'gamepad') return 'START';
  return startKeyLabel(1);
}

/** Player i's START: START on the gamepad that drives them, else their (first) START key. */
export function startKeyLabel(i: 0 | 1): string {
  if (input.hasPadFor(i)) return 'START';
  const ks = (i === 0 ? input.bindings.p1 : input.bindings.p2).start ?? [];
  const k = ks.find((c) => !c.startsWith('Numpad')) ?? ks[0];
  return k ? keyLabel(k) : 'START';
}

/** Widest banner line (the screen less a margin). */
export const BANNER_MAX_W = VIEW_W - 16;

export class Hud {
  banners: Banner[] = [];
  /** Continue countdown per player (seconds remaining, <0 = not counting). */
  continueTimers = [-1, -1];
  /** Whether player 2 can join (shows PRESS START). */
  allowJoin = true;
  /** Attract-mode demo: hide join/continue prompts. */
  demo = false;
  time = 0;
  private panels: PanelState[] = [0, 1].map(() => ({ shown: 0, weapon: '', weaponPop: 0, bombs: -1, bombPop: 0, lives: -1, livesPop: 0 }));
  private rescueShown = 0;
  private rescuePop = 0;
  private boss: unknown = null;
  private bossIntro = 0;
  private bossTrail = 1;
  private bossTrailHold = 0;
  private bannerCount = 0;

  banner(text: string, opts: { sub?: string; color?: string; time?: number; scale?: number; style?: BannerStyle } = {}): void {
    let scale = opts.scale ?? 3;
    let sub = opts.sub;
    // Fit the screen: a long "WARNING! <SUBJECT>" puts the subject on the line under the stripes
    // (like the bosses' own WARNING! / ... APPROACHES); any other text too wide shrinks.
    if (textWidth(text, scale) > BANNER_MAX_W) {
      const m = /^WARNING!?\s+(.+)$/.exec(text);
      if (m) {
        text = 'WARNING!';
        sub = sub ? `${m[1]} - ${sub}` : m[1];
      }
      while (scale > 1 && textWidth(text, scale) > BANNER_MAX_W) scale--;
    }
    this.banners = this.banners.filter((b) => b.text !== text);
    const style: BannerStyle = opts.style ?? (/^WARNING/.test(text) ? 'warning' : scale >= 3 ? 'drop' : scale === 2 ? 'slide' : 'small');
    const time = opts.time ?? 2;
    this.bannerCount++;
    this.banners.push({ text, sub, color: opts.color ?? C.gold, time, max: time, scale, style, dir: this.bannerCount % 2 ? 1 : -1 });
    if (scale >= 2 || style === 'warning') uiSfx(style === 'warning' ? 'alarm' : 'banner', { vol: 0.8 });
  }

  clearBanners(): void {
    this.banners = [];
  }

  update(dt: number, world?: World): void {
    this.time += dt;
    for (const b of this.banners) b.time -= dt;
    this.banners = this.banners.filter((b) => b.time > 0);
    if (!world) return;
    for (const p of world.players) {
      const st = this.panels[p.index];
      if (!st) continue;
      const score = p.profile.score;
      if (st.shown > score) st.shown = score;
      else if (st.shown < score) st.shown = Math.min(score, st.shown + Math.max(10, Math.ceil((score - st.shown) * 0.2)));
      if (st.weapon !== p.weapon.id) {
        if (st.weapon) st.weaponPop = 0.5;
        st.weapon = p.weapon.id;
      }
      if (st.bombs !== p.bombs) {
        if (st.bombs >= 0 && p.bombs > st.bombs) st.bombPop = 0.5;
        st.bombs = p.bombs;
      }
      if (st.lives !== p.profile.lives) {
        if (st.lives >= 0) st.livesPop = 0.6;
        st.lives = p.profile.lives;
      }
      st.weaponPop = Math.max(0, st.weaponPop - dt);
      st.bombPop = Math.max(0, st.bombPop - dt);
      st.livesPop = Math.max(0, st.livesPop - dt);
    }
    // Rescued hostages.
    let rescues = 0;
    for (const prof of world.session.players) rescues += prof.missionRescues;
    if (rescues > this.rescueShown) this.rescuePop = 0.4;
    this.rescueShown = rescues;
    this.rescuePop = Math.max(0, this.rescuePop - dt);
    // Boss bar.
    const boss = world.boss && !world.boss.dead ? world.boss : null;
    if (boss !== this.boss) {
      this.boss = boss;
      this.bossIntro = 0;
      this.bossTrail = 1;
    }
    if (boss) {
      this.bossIntro = Math.min(1, this.bossIntro + dt * 0.9);
      const frac = Math.max(0, boss.hp / Math.max(1, boss.maxHp));
      if (this.bossTrail < frac) this.bossTrail = frac;
      if (this.bossTrail > frac) {
        this.bossTrailHold += dt;
        if (this.bossTrailHold > 0.35) this.bossTrail = Math.max(frac, this.bossTrail - dt * 0.45);
      } else this.bossTrailHold = 0;
    }
  }

  render(g: CanvasRenderingContext2D, world: World): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const session = world.session;
    const cs = continueState(session, this.continueTimers);
    for (let i = 0; i < 2; i++) {
      const prof = session.players[i];
      const p = world.players.find((x) => x.index === i);
      const side = i === 0 ? 'left' : 'right';
      if (prof.joined && p && !prof.out) this.playerPanel(g, p, side);
      else if (prof.joined && prof.out && !cs.allOut) this.outPanel(g, i, prof.score, side);
      else if (!prof.joined && i === 1 && this.allowJoin && !this.demo) this.joinPrompt(g);
    }
    const lvl = world.level;
    // Timer.
    if (lvl && lvl.timerEnabled) {
      const t = lvl.timeLeft;
      const low = t <= 10;
      panel(g, VIEW_W / 2 - 14, 1, 28, 19, 'dark', 0.75);
      const col = low && blink(this.time, 4) ? C.red : C.white;
      twoTone(g, pad(t, 2), VIEW_W / 2, 4, col, low ? '#ffb0b0' : '#c8d8f0', { scale: 2, align: 'center', split: 3 });
    }
    if (world.boss && !world.boss.dead && this.boss) this.bossBar(g, world);
    this.hostages(g);
    // GO arrow.
    if (lvl && lvl.goTimer > 0) {
      const k = Math.floor(this.time * 3) % 2 === 0;
      const dx = Math.round(((this.time * 18) % 10));
      if (k) {
        sprites.get('ui_go_arrow').draw(g, VIEW_W - 40 + dx, VIEW_H / 2 + 4);
        twoTone(g, 'GO!', VIEW_W - 30, VIEW_H / 2 - 18, C.white, C.gold, { scale: 2, align: 'center', split: 3 });
      }
    }
    this.renderBanners(g);
    if (cs.allOut && cs.counting && !this.demo) this.continueScreen(g, session, cs.time);
  }

  // ------------------------------------------------------------------ player panels

  private playerPanel(g: CanvasRenderingContext2D, p: Player, side: 'left' | 'right'): void {
    const st = this.panels[p.index];
    const prof = p.profile;
    const L = side === 'left';
    const pw = 126;
    const px = L ? 2 : VIEW_W - 2 - pw;
    const col = PLAYER_COLORS[p.index];
    panel(g, px, 1, pw, 25, 'dark', 0.72);
    // Portrait.
    const fx = L ? px + 2 : px + pw - 20;
    rect(g, fx, 3, 18, 20, '#000000', 0.35);
    rect(g, fx, 3, 18, 1, col);
    const face = sprites.get(faceSprite(p.char.id, p.index === 1));
    const pop = st.livesPop > 0 ? Math.round(Math.sin(st.livesPop * 30) * 1) : 0;
    face.draw(g, fx + 9, 22 + pop, 0, { flip: !L });
    // Row 1: tag, lives, score.
    const tx = L ? px + 23 : px + pw - 23;
    const al = L ? 'left' : 'right';
    const tag = `${p.index + 1}P`;
    const tw = drawText(g, tag, tx, 4, { color: col, outline: C.out, align: al });
    const lifeCol = st.livesPop > 0 && blink(this.time, 8) ? C.gold : C.white;
    drawText(g, `×${Math.max(0, prof.lives)}`, tx + (L ? 1 : -1) * (tw + 3), 4, { color: lifeCol, outline: C.out, align: al });
    drawText(g, pad(st.shown, 8), L ? px + pw - 4 : px + 4, 4, { color: C.gold, outline: C.out, align: L ? 'right' : 'left' });
    // Row 2: weapon / vehicle + bombs.
    const y2 = 14;
    const v = p.vehicle;
    const inner = L ? px + 23 : px + 4;
    const innerW = PANEL_ROW_W;
    if (v) {
      const frac = Math.max(0, v.hp / Math.max(1, v.maxHp));
      const row = vehicleRow(v.vehicleName, innerW, v.secondaryAmmo >= 0);
      drawText(g, row.name, inner, y2, { color: C.blue, outline: C.out });
      const bx = inner + row.barX;
      const bw = row.barW;
      rect(g, bx - 1, y2, bw + 2, 7, C.out);
      rect(g, bx, y2 + 1, bw, 5, '#3a2030');
      const fc = frac > 0.5 ? '#40e060' : frac > 0.25 ? C.gold : blink(this.time, 6) ? C.red : '#a02020';
      rect(g, bx, y2 + 1, Math.round(bw * frac), 5, fc);
      rect(g, bx, y2 + 1, Math.round(bw * frac), 1, '#ffffff', 0.35);
      for (let k = 1; k < 8; k++) rect(g, bx + Math.round((bw * k) / 8), y2 + 1, 1, 5, C.out, 0.5);
      if (v.secondaryAmmo >= 0) drawText(g, String(v.secondaryAmmo), inner + innerW, y2, { align: 'right', color: C.white, outline: C.out });
      return;
    }
    const w = p.weapon;
    const base = isFinite(w.ammo) ? w.ammo * (w.heavy ? p.char.heavyAmmoMul : 1) : Infinity;
    const ammo = isFinite(p.ammo) ? Math.max(0, Math.floor(p.ammo)) : Infinity;
    const low = isFinite(ammo) && ammo <= Math.max(5, base * 0.2);
    // Weapon chip (crate letter in the weapon color), name, ammo | bomb icon + count.
    // Player 2's panel is mirrored: bombs | ammo, name, chip.
    const popK = st.weaponPop > 0 ? easeOutBack(1 - st.weaponPop / 0.5) : 1;
    const chipX = L ? inner : inner + innerW - 9;
    rect(g, chipX, y2 - 2, 9, 11, C.out);
    rect(g, chipX + 1, y2 - 1, 7, 9, st.weaponPop > 0 && blink(this.time, 10) ? '#ffffff' : w.color);
    rect(g, chipX + 1, y2 - 1, 7, 1, '#ffffff', 0.5);
    drawText(g, w.letter, chipX + 5, y2, { align: 'center', color: C.out, shadow: null });
    const nm = weaponShortName(w.id, w.name);
    const nameCol = st.weaponPop > 0 ? C.gold : C.white;
    const slide = Math.round((1 - popK) * 6);
    if (L) drawText(g, nm, chipX + 11 + slide, y2, { color: nameCol, outline: C.out });
    else drawText(g, nm, chipX - 2 - slide, y2, { color: nameCol, outline: C.out, align: 'right' });
    const ammoStr = isFinite(ammo) ? String(ammo) : '∞';
    const ammoCol = low ? (blink(this.time, 5) ? C.red : C.white) : isFinite(ammo) ? C.gold : C.white;
    const bombX = L ? inner + innerW - 22 : inner;
    if (L) drawText(g, ammoStr, bombX - 5, y2, { align: 'right', color: ammoCol, outline: C.out });
    else drawText(g, ammoStr, bombX + 27, y2, { color: ammoCol, outline: C.out });
    // Bombs.
    const fire = p.bombKind === 'firebomb';
    const bspr = sprites.get(fire ? 'ui_icon_firebomb' : 'ui_icon_grenade');
    const bpop = st.bombPop > 0 ? Math.round(Math.sin(st.bombPop * 25) * 1.5) : 0;
    rect(g, L ? bombX - 2 : bombX + 22, y2 - 1, 1, 9, '#5a4a6a', 0.8);
    bspr.draw(g, bombX + 3, y2 + 8 + bpop);
    drawText(g, String(p.bombs), bombX + 8, y2, { color: p.bombs <= 0 ? C.red : fire ? '#ffb070' : '#b0f070', outline: C.out });
  }

  /** A player who is out while the other keeps playing: countdown or "press start". */
  private outPanel(g: CanvasRenderingContext2D, i: number, score: number, side: 'left' | 'right'): void {
    const L = side === 'left';
    const pw = 126;
    const px = L ? 2 : VIEW_W - 2 - pw;
    const t = this.continueTimers[i];
    panel(g, px, 1, pw, 25, 'dark', 0.72);
    const cx = px + pw / 2;
    drawText(g, `${i + 1}P ${pad(score, 8)}`, cx, 4, { align: 'center', color: PLAYER_COLORS[i], outline: C.out });
    if (this.demo) return;
    if (t >= 0) {
      drawText(g, `CONTINUE? ${Math.max(0, Math.floor(t))}`, cx, 14, { align: 'center', color: blink(this.time, 2) ? C.gold : C.white, outline: C.out });
    } else if (blink(this.time, 1.5, 0.7)) {
      // Name the key: player 2 on the keyboard presses RSHIFT, not "START".
      drawText(g, `PRESS ${startKeyLabel(i as 0 | 1)}`, cx, 14, { align: 'center', color: C.white, outline: C.out });
    }
  }

  private joinPrompt(g: CanvasRenderingContext2D): void {
    // Touch players can't drop in a second player (and the pause button lives there).
    if (input.lastDevice === 'touch' || !blink(this.time, 1, 0.7)) return;
    text(g, `2P PRESS ${joinKey()}`, VIEW_W - 5, 4, { align: 'right', color: C.grey });
  }

  // ------------------------------------------------------------------ boss bar

  private bossBar(g: CanvasRenderingContext2D, world: World): void {
    const b = world.boss!;
    const frac = Math.max(0, b.hp / Math.max(1, b.maxHp));
    const intro = easeOut(this.bossIntro);
    const shown = Math.min(frac, intro);
    const w = 160;
    const x = Math.round(VIEW_W / 2 - w / 2);
    const y = 24;
    panel(g, x - 4, y - 2, w + 8, 21, 'dark', 0.8);
    rect(g, x - 1, y, w + 2, 8, C.out);
    rect(g, x, y + 1, w, 6, '#3a1018');
    // Damage trail.
    if (this.bossTrail > shown) rect(g, x + Math.round(w * shown), y + 1, Math.round(w * (Math.min(this.bossTrail, intro) - shown)), 6, '#ffffff', 0.85);
    const low = frac < 0.3;
    const col = low ? (blink(this.time, 6) ? '#ff3a2a' : C.gold) : '#ff5a2a';
    rect(g, x, y + 1, Math.round(w * shown), 6, col);
    rect(g, x, y + 1, Math.round(w * shown), 2, low ? '#ffd0a0' : '#ffb080');
    rect(g, x, y + 6, Math.round(w * shown), 1, '#a02010');
    for (let k = 1; k < 10; k++) rect(g, x + Math.round((w * k) / 10), y + 1, 1, 6, C.out, 0.45);
    const name = world.bossName || 'BOSS';
    drawText(g, `◆ ${name} ◆`, VIEW_W / 2, y + 10, { align: 'center', color: '#ffb0a0', outline: C.out });
  }

  // ------------------------------------------------------------------ hostages

  private hostages(g: CanvasRenderingContext2D): void {
    const n = this.rescueShown;
    if (n <= 0) return;
    const spr = sprites.tryGet('hud_hostage') ?? sprites.get('ui_hostage');
    const shown = Math.min(n, 16);
    for (let i = 0; i < shown; i++) {
      const last = i === shown - 1;
      const bounce = last && this.rescuePop > 0 ? Math.round(Math.sin((0.4 - this.rescuePop) * 20) * 3 * (this.rescuePop / 0.4)) : 0;
      spr.draw(g, 7 + i * 8, VIEW_H - 3 - bounce);
    }
    if (n > 16) text(g, `+${n - 16}`, 7 + 16 * 8, VIEW_H - 10, { color: C.white });
  }

  // ------------------------------------------------------------------ banners

  private renderBanners(g: CanvasRenderingContext2D): void {
    let by = Math.round(VIEW_H * 0.3);
    for (const b of this.banners) {
      const age = b.max - b.time;
      const out = b.time < 0.3 ? 1 - b.time / 0.3 : 0;
      const h = 7 * b.scale;
      if (b.style === 'warning') by += 9;
      switch (b.style) {
        case 'warning': {
          const a = Math.min(1, age / 0.15, b.time / 0.25);
          g.globalAlpha = a;
          // Nearly opaque: the boss rolling in under it must read as behind the banner.
          rect(g, 0, by - 8, VIEW_W, h + 16, '#200408', 0.86);
          stripes(g, 0, by - 8, VIEW_W, 4, this.time, C.red, '#200408');
          stripes(g, 0, by + h + 4, VIEW_W, 4, -this.time, C.red, '#200408');
          g.globalAlpha = 1;
          if (blink(this.time, 3, 0.75)) text(g, b.text, VIEW_W / 2, by, { align: 'center', scale: b.scale, color: b.color, alpha: a });
          break;
        }
        case 'drop': {
          // Letters drop in one by one, then slide away.
          const w = textWidth(b.text, b.scale);
          let x = VIEW_W / 2 - w / 2 - out * out * VIEW_W * 0.7 * b.dir;
          let i = 0;
          for (const ch of b.text) {
            const cw = textWidth(ch, b.scale);
            const k = easeOutBack((age - i * 0.04) / 0.28);
            if (k > 0) {
              const dy = Math.round((1 - k) * -30);
              twoTone(g, ch, Math.round(x), by + dy, C.white, b.color, { scale: b.scale, split: 3, alpha: Math.min(1, k * 2) * (1 - out) });
            }
            x += cw + b.scale;
            i++;
          }
          break;
        }
        case 'slide': {
          const k = easeOutBack(age / 0.25);
          const ox = Math.round((1 - k) * VIEW_W * 0.6 * b.dir - out * out * VIEW_W * 0.6 * b.dir);
          twoTone(g, b.text, VIEW_W / 2 + ox, by, C.white, b.color, { scale: b.scale, align: 'center', split: 3, alpha: 1 - out * 0.5 });
          break;
        }
        default: {
          const a = Math.min(1, age / 0.15) * (1 - out);
          text(g, b.text, VIEW_W / 2, by + Math.round((1 - Math.min(1, age / 0.15)) * 6), { align: 'center', color: b.color, alpha: a });
        }
      }
      by += h + 5 + (b.style === 'warning' ? 9 : 0);
      if (b.sub) {
        const k = Math.min(1, Math.max(0, (age - 0.2) / 0.2));
        const shownLen = Math.floor(b.sub.length * Math.min(1, Math.max(0, (age - 0.25) / 0.4)));
        if (k > 0) text(g, b.sub.slice(0, shownLen), VIEW_W / 2, by, { align: 'center', color: C.white, alpha: k * (1 - out) });
        by += 12;
      }
    }
  }

  // ------------------------------------------------------------------ continue screen

  private continueScreen(g: CanvasRenderingContext2D, session: GameSession, t: number): void {
    rect(g, 0, 0, VIEW_W, VIEW_H, '#06030c', 0.72);
    const cx = VIEW_W / 2;
    twoTone(g, 'CONTINUE?', cx, 30, C.white, C.gold, { scale: 3, align: 'center', split: 3 });
    const digit = Math.max(0, Math.floor(t));
    const frac = t - Math.floor(t);
    // Ring that drains each second.
    const r = 30;
    const cy = 92;
    g.lineWidth = 3;
    g.strokeStyle = '#3a2a4a';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = digit <= 3 ? C.red : C.gold;
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    g.stroke();
    g.lineWidth = 1;
    const sc = frac > 0.85 ? 7 : 6;
    twoTone(g, String(digit), cx, cy - Math.round((7 * sc) / 2), C.white, digit <= 3 ? '#ff8a7a' : C.gold, { scale: sc, align: 'center', split: 3 });
    if (blink(this.time, 1.6, 0.7)) text(g, ctl('PRESS START OR FIRE', 'TAP TO CONTINUE'), cx, 134, { align: 'center', color: C.white });
    session.players.forEach((p, i) => {
      if (!p.joined) return;
      const x = session.twoPlayer ? (i === 0 ? cx - 90 : cx + 90) : cx;
      const c = getCharacter(p.character);
      sprites.get(faceSprite(c.id, i === 1)).draw(g, x, 170);
      drawText(g, `${i + 1}P ${c.name}`, x, 173, { align: 'center', color: PLAYER_COLORS[i], outline: C.out });
      drawText(g, pad(p.score, 8), x, 183, { align: 'center', color: C.gold, outline: C.out });
    });
    drawText(g, 'CREDITS: FREE PLAY', cx, VIEW_H - 12, { align: 'center', color: C.grey, outline: C.out });
  }
}
