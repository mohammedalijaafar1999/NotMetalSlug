// Animated war-night backdrop shared by the title and every front-end menu screen: burning sky,
// moon, stars, sweeping searchlights, flak tracers, the Iron Citadel with smoking stacks,
// marching Legion troops, a tank, a passing helicopter, distant explosions, rising embers and
// the Ruckus Squad on the ridge. A module singleton so it keeps animating across screens.

import { sprites } from '../engine/sprites';
import { fxRng, Rng } from '../engine/rng';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { Particles } from '../game/effects';
import { CITADEL_H, CITADEL_LIGHTS, CITADEL_STACKS, CITADEL_W, LAYER_PAD, SKY_STOPS, midHillY, ridgeY } from '../content/ui/art';
import { mixColor } from '../engine/pixelart';

interface Boom {
  x: number;
  y: number;
  t: number;
  size: 'tiny' | 'small' | 'medium';
}

interface Tracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Walker {
  x: number;
  speed: number;
  phase: number;
}

const CIT_X = 300; // citadel center x
const CIT_BASE = 154; // citadel bottom y

export class TitleBackdrop {
  t = 0;
  private parts = new Particles();
  private booms: Boom[] = [];
  private tracers: Tracer[] = [];
  private boomTimer = 1;
  private tracerTimer = 0.5;
  private emberTimer = 0;
  private smokeTimer = 0;
  private stars: { x: number; y: number; ph: number; big: boolean }[] = [];
  private troops: Walker[] = [];
  private tankX = 420;
  private tankFire = 3;
  private tankFlash = 0;
  private heliX = -999;
  private heliTimer = 6;
  private sky: string[] = [];
  /** Squad visible (title press-start state) - fades in/out. */
  squad = 1;
  private squadTarget = 1;

  constructor() {
    const r = new Rng(1234);
    for (let i = 0; i < 70; i++) this.stars.push({ x: r.int(0, VIEW_W - 1), y: r.int(0, 110), ph: r.range(0, 6), big: r.chance(0.12) });
    for (let i = 0; i < 9; i++) this.troops.push({ x: 150 + i * 13 + r.int(0, 4), speed: 6, phase: r.range(0, 8) });
    // Precomputed sky bands (2px).
    for (let y = 0; y < VIEW_H; y += 2) {
      let c = SKY_STOPS[SKY_STOPS.length - 1][1];
      for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        const [y0, c0] = SKY_STOPS[i];
        const [y1, c1] = SKY_STOPS[i + 1];
        if (y >= y0 && y < y1) {
          c = mixColor(c0, c1, (y - y0) / (y1 - y0));
          break;
        }
      }
      this.sky.push(c);
    }
    // Pre-warm smoke/embers so the first frame isn't empty.
    for (let i = 0; i < 240; i++) this.update(1 / 60);
    this.t = 0;
  }

  setSquad(visible: boolean): void {
    this.squadTarget = visible ? 1 : 0;
  }

  update(dt: number): void {
    this.t += dt;
    this.squad += Math.sign(this.squadTarget - this.squad) * Math.min(Math.abs(this.squadTarget - this.squad), dt * 2.5);
    // Distant explosions along the horizon.
    this.boomTimer -= dt;
    if (this.boomTimer <= 0) {
      this.boomTimer = fxRng.range(0.6, 1.8);
      const x = fxRng.chance(0.5) ? fxRng.range(10, 220) : fxRng.range(230, 384);
      this.booms.push({ x, y: fxRng.range(138, 152), t: 0, size: fxRng.pick(['tiny', 'small', 'small', 'medium'] as const) });
    }
    for (const b of this.booms) {
      b.t += dt;
      if (b.t > 0.15 && b.t - dt <= 0.15) this.parts.smokePuffs(b.x, b.y - 6, 2, 5, '#2a1a30', '#1a1022');
    }
    this.booms = this.booms.filter((b) => b.t < 1.2);
    // Flak tracers.
    this.tracerTimer -= dt;
    if (this.tracerTimer <= 0) {
      this.tracerTimer = fxRng.range(0.05, 0.12);
      if (Math.sin(this.t * 0.7) > -0.2) {
        const x0 = fxRng.chance(0.5) ? 70 + fxRng.range(-10, 10) : 190 + fxRng.range(-10, 10);
        const ang = -Math.PI / 2 + Math.sin(this.t * 1.3 + x0) * 0.35;
        const sp = 210;
        this.tracers.push({ x: x0, y: 150, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: fxRng.range(0.45, 0.75) });
      }
    }
    for (const tr of this.tracers) {
      tr.x += tr.vx * dt;
      tr.y += tr.vy * dt;
      tr.life -= dt;
      if (tr.life <= 0 && fxRng.chance(0.35)) {
        this.parts.add({ kind: 'smoke', x: tr.x, y: tr.y, vx: 0, vy: -3, life: 0.8, size: 2, size2: 4, color: '#3a2a40', color2: '#2a1e32', alpha: 0.8 });
        this.parts.add({ kind: 'px', x: tr.x, y: tr.y, life: 0.1, size: 3, color: '#ffe0a0' });
      }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    // Smoke plumes from the citadel's stacks.
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.12;
      for (const [sx, sy] of CITADEL_STACKS) {
        const x = CIT_X - CITADEL_W / 2 + sx;
        const y = CIT_BASE - CITADEL_H + sy;
        this.parts.add({ kind: 'smoke', x: x + fxRng.range(-1, 1), y, vx: fxRng.range(-9, -4), vy: fxRng.range(-12, -7), life: fxRng.range(2.5, 4), size: 2, size2: 8, color: '#2c2036', color2: '#20182a', alpha: 0.9 });
      }
    }
    // Embers.
    this.emberTimer -= dt;
    while (this.emberTimer <= 0) {
      this.emberTimer += 0.06;
      this.parts.add({
        kind: 'px',
        x: fxRng.range(0, VIEW_W),
        y: VIEW_H + 2,
        vx: fxRng.range(-6, 10),
        vy: fxRng.range(-38, -16),
        life: fxRng.range(3, 6),
        color: fxRng.pick(['#ff9a2e', '#ffd060', '#ff6a2a']),
        color2: '#a03a1a',
        size: fxRng.chance(0.2) ? 2 : 1,
        front: true,
        drag: 0.05,
      });
    }
    // Troops march left along the mid hills; the tank rolls in behind them.
    for (const w of this.troops) {
      w.x -= w.speed * dt;
      w.phase += dt * 5;
      if (w.x < -16) w.x += VIEW_W + 60;
    }
    this.tankX -= 6 * dt;
    if (this.tankX < -40) this.tankX = VIEW_W + 120;
    this.tankFire -= dt;
    if (this.tankFlash > 0) this.tankFlash -= dt;
    if (this.tankFire <= 0) {
      this.tankFire = fxRng.range(3, 6);
      this.tankFlash = 0.12;
      const mx = this.tankX - 22;
      const my = midHillY(this.tankX) - 14;
      this.parts.smokePuffs(mx, my, 3, 3, '#3a2a40', '#2a1e32');
    }
    // Helicopter pass.
    this.heliTimer -= dt;
    if (this.heliTimer <= 0 && this.heliX < -100) {
      this.heliX = VIEW_W + 40;
      this.heliTimer = fxRng.range(14, 22);
    }
    if (this.heliX > -100) this.heliX -= 34 * dt;
    // Particles drift with the wind.
    for (const p of this.parts.list) if (p.kind === 'px' && p.front) p.vx += Math.sin(this.t * 2 + p.y * 0.05) * 6 * dt;
    this.parts.update(dt, null);
  }

  render(g: CanvasRenderingContext2D, opts: { dim?: number; squad?: boolean } = {}): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const t = this.t;
    // Slow camera sway: nearer layers shift more (parallax).
    const sway = Math.sin(t * 0.21);
    const oM = Math.round(sway * 1);
    const oC = Math.round(sway * 2);
    const oF = Math.round(sway * 4);
    const oMid = Math.round(sway * 6);
    const oR = Math.round(sway * (LAYER_PAD - 1));
    // Sky.
    for (let i = 0; i < this.sky.length; i++) {
      g.fillStyle = this.sky[i];
      g.fillRect(0, i * 2, VIEW_W, 2);
    }
    // Fire glow pulse near the horizon.
    g.globalAlpha = 0.18 + Math.sin(t * 1.7) * 0.05;
    g.fillStyle = '#ff6a2a';
    g.fillRect(0, 140, VIEW_W, 20);
    g.globalAlpha = 0.1;
    g.fillRect(0, 128, VIEW_W, 12);
    g.globalAlpha = 1;
    // Stars.
    for (const s of this.stars) {
      const tw = Math.sin(t * 2.2 + s.ph);
      if (tw < -0.6) continue;
      g.fillStyle = tw > 0.7 ? '#ffffff' : '#9a8ac8';
      g.fillRect(s.x, s.y, 1, 1);
      if (s.big && tw > 0.5) {
        g.globalAlpha = 0.5;
        g.fillRect(s.x - 1, s.y, 3, 1);
        g.fillRect(s.x, s.y - 1, 1, 3);
        g.globalAlpha = 1;
      }
    }
    // Moon with halo.
    const mx = 364 + oM;
    const my = 30;
    g.globalAlpha = 0.08;
    g.fillStyle = '#ffe8c0';
    g.beginPath();
    g.arc(mx, my, 26, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.07;
    g.beginPath();
    g.arc(mx, my, 20, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    sprites.get('ui_moon').draw(g, mx, my);
    // Searchlights (behind the hills).
    this.searchlight(g, 120 + oF, 150, -Math.PI / 2 + Math.sin(t * 0.45) * 0.55, 0.07);
    this.searchlight(g, 248 + oF, 148, -Math.PI / 2 + Math.sin(t * 0.37 + 2) * 0.6, 0.06);
    this.searchlight(g, CIT_X - CITADEL_W / 2 + 133 + oC, CIT_BASE - CITADEL_H + 2, -Math.PI / 2 - 0.5 + Math.sin(t * 0.5 + 1) * 0.5, 0.07);
    // Tracers.
    g.fillStyle = '#ffd890';
    for (const tr of this.tracers) {
      const len = 0.018;
      g.globalAlpha = Math.min(1, tr.life * 3);
      for (let k = 0; k < 3; k++) g.fillRect(Math.round(tr.x - tr.vx * len * k), Math.round(tr.y - tr.vy * len * k), 1, 1);
    }
    g.globalAlpha = 1;
    // Heli.
    if (this.heliX > -100) {
      const hy = 64 + Math.sin(t * 1.4) * 3;
      sprites.get('ui_sil_heli').draw(g, this.heliX, hy, Math.floor(t * 20) % 2, { flip: true });
      if (Math.floor(t * 2) % 2 === 0) {
        g.fillStyle = '#ff3a2a';
        g.fillRect(Math.round(this.heliX + 2), Math.round(hy + 6), 1, 1);
      }
    }
    // Distant explosions (behind the far hills).
    for (const b of this.booms) {
      if (b.t < 0.12) {
        g.globalAlpha = 0.25 * (1 - b.t / 0.12);
        g.fillStyle = '#ffd8a0';
        g.beginPath();
        g.arc(b.x + oF, b.y, 16, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      const spr = sprites.get(`explosion_${b.size}`);
      const f = Math.min(spr.frameCount - 1, Math.floor((b.t / 1.0) * spr.frameCount));
      spr.draw(g, b.x + oF, b.y, f, { alpha: 0.85 });
    }
    // Smoke behind the citadel layer.
    this.parts.render(g, false);
    // Citadel.
    const cx0 = CIT_X - CITADEL_W / 2 + oC;
    const cy0 = CIT_BASE - CITADEL_H;
    sprites.get('ui_bg_citadel').draw(g, CIT_X + oC, CIT_BASE);
    // Blinking warning lights.
    CITADEL_LIGHTS.forEach(([lx, ly], i) => {
      if (Math.floor(t * 1.5 + i * 0.37) % 2 === 0) {
        g.fillStyle = '#ff2a1a';
        g.fillRect(cx0 + lx, cy0 + ly, 2, 1);
        g.globalAlpha = 0.35;
        g.fillRect(cx0 + lx - 1, cy0 + ly - 1, 4, 3);
        g.globalAlpha = 1;
      }
    });
    // The walker's eye glows.
    const eye = 0.55 + Math.sin(t * 2.4) * 0.45;
    g.globalAlpha = eye;
    g.fillStyle = '#ff3a2a';
    g.fillRect(cx0 + 98, cy0 + 22, 9, 2);
    g.fillStyle = '#ffd0a0';
    g.fillRect(cx0 + 101, cy0 + 22, 3, 1);
    g.globalAlpha = 1;
    // Hills.
    sprites.get('ui_bg_hills_far').draw(g, -LAYER_PAD + oF, 126);
    // Marching troops and tank on the mid hills.
    sprites.get('ui_bg_hills_mid').draw(g, -LAYER_PAD + oMid, 150);
    const sold = sprites.get('ui_sil_soldier');
    for (const w of this.troops) {
      const x = Math.round(w.x);
      sold.draw(g, x + oMid, midHillY(x) + 1, Math.floor(w.phase) % 4, { flip: true });
    }
    const tx = Math.round(this.tankX);
    sprites.get('ui_sil_tank').draw(g, tx + oMid, midHillY(tx) + 2, Math.floor(t * 8) % 2, { flip: true });
    if (this.tankFlash > 0) {
      g.fillStyle = '#ffe080';
      g.fillRect(tx + oMid - 24, midHillY(tx) - 16, 4, 3);
      g.globalAlpha = 0.4;
      g.fillRect(tx + oMid - 27, midHillY(tx) - 18, 8, 7);
      g.globalAlpha = 1;
    }
    // Foreground ridge and the squad.
    sprites.get('ui_bg_ridge').draw(g, -LAYER_PAD + oR, 176);
    const sq = (opts.squad ?? true) ? this.squad : 0;
    if (sq > 0.02) sprites.get('ui_sil_squad').draw(g, 72 + oR, ridgeY(72) + 1, 0, { alpha: sq });
    // Embers in front.
    this.parts.render(g, true);
    // Vignette (top/bottom bands).
    g.fillStyle = '#05030a';
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.28 - i * 0.045;
      g.fillRect(0, i * 2, VIEW_W, 2);
      g.fillRect(0, VIEW_H - 2 - i * 2, VIEW_W, 2);
    }
    g.globalAlpha = 1;
    if (opts.dim) {
      g.globalAlpha = opts.dim;
      g.fillStyle = '#06040c';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalAlpha = 1;
    }
  }

  private searchlight(g: CanvasRenderingContext2D, x: number, y: number, ang: number, alpha: number): void {
    const len = 260;
    const spread = 0.075;
    g.globalAlpha = alpha;
    g.fillStyle = '#fff4d0';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
    g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
    g.closePath();
    g.fill();
    g.globalAlpha = alpha * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang - spread * 0.4) * len, y + Math.sin(ang - spread * 0.4) * len);
    g.lineTo(x + Math.cos(ang + spread * 0.4) * len, y + Math.sin(ang + spread * 0.4) * len);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }
}

let shared: TitleBackdrop | null = null;

/** The shared title backdrop (created on first use). */
export function backdrop(): TitleBackdrop {
  if (!shared) shared = new TitleBackdrop();
  return shared;
}
