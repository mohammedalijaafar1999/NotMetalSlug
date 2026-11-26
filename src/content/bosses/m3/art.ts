// FROST BASTION art: a Rustcoat Legion mountain gatehouse of blue granite, olive armor plate and
// ice. Everything is authored FACING RIGHT (the fortress front is the right edge of the sprite,
// light from the top-left) and flipped at draw time, like every other sprite in the game.
//
// Sprite space of the main wall (bm3_wall): 226 x 152, ground at y = 152, front face at x = 160,
// machicolation gallery overhanging x 160..225 at y 52..64. WALL.* constants describe the anchor
// points the boss logic uses (turret mounts, gate, emitter, icicle slots).

import { sprites } from '../../../engine/sprites';
import { PixelArt, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';

export const STONE = { base: '#5c6680', light: '#7e8aa6', lighter: '#a6b2ca', dark: '#3e4660', darker: '#2a3046', mortar: '#20263a' };
export const SNOW = { white: '#f6faff', light: '#dce8f8', shade: '#b0c4e2', deep: '#8aa0c8' };
export const ICE = { white: '#effbff', light: '#bfe8ff', mid: '#7cc4f0', dark: '#3a7cc0', deep: '#24508e' };
export const IRON = { base: '#5e6a3c', light: '#8a965c', dark: '#3c4428', darker: '#262c1a', rivet: '#b0bc80' };
export const RUST = { base: '#a0502a', light: '#cc7a3e', dark: '#6a3018' };
export const BRASS = { base: '#c89a3a', light: '#f2d276', dark: '#8a6420' };
export const HAZ = { y: '#f0b830', k: '#2a2420' };
export const WARM = { glow: '#ffd86a', mid: '#f08a2a', dark: '#8a3a14' };
export const CORE = { white: '#f6feff', light: '#aef2ff', mid: '#4ac8f8', dark: '#1a6ab8', deep: '#10336e' };
export const SOOT = '#1a1820';

/** Wall sprite geometry (sprite space, facing right). */
export const WALL = {
  W: 226,
  H: 152,
  OX: 92,
  /** Front face column. World face x F = boss.x - (FACE - OX). */
  FACE: 160,
  /** Gallery walkway top / underside (sprite y) and its tip (sprite x). */
  GALLERY_TOP: 52,
  GALLERY_BOTTOM: 64,
  GALLERY_END: 225,
  /** Gate opening in the face (a dark recess; the core slides out of it). */
  GATE: { x: 148, y: 106, w: 12, h: 42 },
  /** The gate frame sticks out FRAME px from the face: header block from HEADER down to GATE.y. */
  HEADER: 97,
  FRAME: 16,
  /** Core assembly: fully extended its back sits on the face and the crystal tip is CORE_LEN out. */
  CORE_LEN: 40,
  /** Turret mounts: the MG hangs from the gallery underside, flak and mortar sit on the deck. */
  MG: { x: 214, y: 64 },
  FLAK: { x: 194, y: 52 },
  MORTAR: { x: 172, y: 52 },
  SMOKESTACK: { x: 36, y: 1 },
  /** Steam vent grille on the gatehouse. */
  VENT: { x: 137, y: 122 },
  /** Icicle slots along the gallery underside (sprite x). */
  ICICLES: [182, 198, 224],
  /** Machicolation corbels under the gallery (sprite x of their left edge). */
  CORBELS: [163, 188, 206],
  BEACONS: [
    { x: 131, y: 76 },
    { x: 147, y: 76 },
  ],
  /** Breach / crack points that smoke and burn as the wall takes damage (most visible first). */
  BREACHES: [
    { x: 118, y: 92 },
    { x: 62, y: 106 },
    { x: 176, y: 58 },
    { x: 30, y: 58 },
  ],
};

/** Icicle length per growth frame (bm3_icicle frames 0..3). */
export const ICICLE_LEN = [6, 11, 16, 21] as const;

// ------------------------------------------------------------------ helpers

function masonry(p: PixelArt, x0: number, y0: number, w: number, h: number, seed: number, base = STONE.base, rowH = 10): void {
  const r = new Rng(seed);
  p.rect(x0, y0, w, h, STONE.mortar);
  let y = y0;
  let row = 0;
  while (y < y0 + h) {
    const bh = Math.min(rowH + r.int(-1, 1), y0 + h - y);
    let x = x0 - (row % 2 ? r.int(5, 10) : r.int(0, 3));
    while (x < x0 + w) {
      const bw = r.int(11, 21);
      const bx = Math.max(x, x0);
      const bx2 = Math.min(x + bw - 1, x0 + w);
      if (bx2 - bx >= 2 && bh >= 3) {
        const c = shade(base, r.range(-0.09, 0.07));
        p.rect(bx, y, bx2 - bx, bh - 1, c);
        p.rect(bx, y, bx2 - bx, 1, shade(c, 0.24));
        p.rect(bx, y + 1, 1, bh - 2, shade(c, 0.12));
        p.rect(bx, y + bh - 2, bx2 - bx, 1, shade(c, -0.2));
        p.rect(bx2 - 1, y + 1, 1, bh - 2, shade(c, -0.13));
        const n = Math.floor(((bx2 - bx) * bh) / 45);
        for (let k = 0; k < n; k++) p.px(r.int(bx + 1, bx2 - 2), r.int(y + 1, y + bh - 3), shade(c, r.chance(0.5) ? -0.13 : 0.09));
      }
      x += bw;
    }
    y += bh;
    row++;
  }
}

/** Snow resting on a ledge whose top is at y (covers y-1 .. y+depth). */
function snowCap(p: PixelArt, x0: number, y: number, w: number, seed: number, depth = 3, drips = true): void {
  const r = new Rng(seed);
  for (let x = x0; x < x0 + w; x++) {
    const d = Math.max(1, depth + Math.round(Math.sin(x * 0.4 + seed) * 0.9 + r.range(-0.5, 0.5)));
    const lump = x === x0 || x === x0 + w - 1 ? 0 : 1;
    p.rect(x, y - lump, 1, d + lump, SNOW.white);
    p.px(x, y + d - 1, SNOW.light);
    p.px(x, y + d, SNOW.shade);
    if (drips && r.chance(0.07)) {
      const l = r.int(1, 3);
      p.rect(x, y + d, 1, l, SNOW.light);
      p.px(x, y + d + l, ICE.mid);
    }
  }
  p.rect(x0 + 1, y - 1, Math.max(0, w - 2), 1, '#ffffff');
}

/** Small cosmetic icicle hanging from (x, y). */
function hangIcicle(p: PixelArt, x: number, y: number, len: number, w = 3): void {
  p.tri(x, y, x + w, y, x + w / 2, y + len, ICE.light);
  p.rect(x, y, w, 1, ICE.white);
  p.vline(x, y, y + Math.floor(len * 0.5), ICE.white);
  p.px(x + w / 2, y + len - 1, ICE.mid);
}

function rivets(p: PixelArt, x0: number, y: number, x1: number, step: number, c = IRON.rivet): void {
  for (let x = x0; x <= x1; x += step) {
    p.px(x, y, c);
    p.px(x + 1, y + 1, IRON.darker);
  }
}

/** Riveted olive armor plate with bevel. */
export function ironPlate(p: PixelArt, x: number, y: number, w: number, h: number, base = IRON.base): void {
  p.rect(x, y, w, h, base);
  p.rect(x, y, w, 1, shade(base, 0.3));
  p.rect(x, y + 1, 1, h - 1, shade(base, 0.16));
  p.rect(x, y + h - 1, w, 1, shade(base, -0.35));
  p.rect(x + w - 1, y + 1, 1, h - 2, shade(base, -0.25));
  if (h >= 6) {
    rivets(p, x + 2, y + 2, x + w - 3, 5);
    rivets(p, x + 2, y + h - 3, x + w - 3, 5);
  }
}

function hazardStripes(p: PixelArt, x: number, y: number, w: number, h: number, phase = 0): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.px(x + xx, y + yy, Math.floor((xx + yy + phase) / 3) % 2 ? HAZ.k : HAZ.y);
}

/** The Legion emblem: a brass cog with a red five-point star. */
export function legionCog(p: PixelArt, cx: number, cy: number, r: number): void {
  const teeth = 10;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    p.rotRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.22, r * 0.2, a, BRASS.dark);
  }
  p.circle(cx, cy, r, BRASS.dark);
  p.circle(cx - 0.4, cy - 0.4, r - 1, BRASS.base);
  p.circle(cx - 1, cy - 1, r * 0.55, BRASS.light);
  p.circle(cx, cy, r * 0.62, '#7a2014');
  const star: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.24 : r * 0.56;
    star.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.poly(star, '#e04a2a');
  p.px(cx - 1, cy - 2, '#ffb090');
}

function arrowSlit(p: PixelArt, x: number, y: number, h = 9, lit = true): void {
  p.rect(x - 1, y - 1, 4, h + 2, STONE.darker);
  p.rect(x, y, 2, h, lit ? WARM.mid : '#10121a');
  if (lit) {
    p.rect(x, y + 1, 1, h - 2, WARM.glow);
    p.px(x + 1, y, WARM.dark);
  }
}

/** Paint only where something is already drawn (scorch marks never float in the sky). */
function onOpaque(p: PixelArt, x: number, y: number, c: string): void {
  if (p.opaque(Math.floor(x + p.ox), Math.floor(y + p.oy))) p.px(x, y, c);
}

function crack(p: PixelArt, r: Rng, x: number, y: number, len: number, dir: number): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < len; i++) {
    onOpaque(p, cx, cy, SOOT);
    if (r.chance(0.5)) onOpaque(p, cx + 1, cy, STONE.darker);
    cy += 1;
    cx += r.chance(0.55) ? dir : r.chance(0.5) ? -dir : 0;
    if (r.chance(0.12)) crack(p, r, cx, cy, Math.floor(len / 3), -dir);
  }
}

/** Blasted hole exposing the fortress' innards (girders, glowing furnace light). */
function breach(p: PixelArt, r: Rng, cx: number, cy: number, rx: number, ry: number, deep: boolean): void {
  const pts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const k = r.range(0.7, 1.15);
    pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  p.poly(pts, SOOT);
  p.ellipse(cx, cy + 1, rx * 0.72, ry * 0.68, deep ? '#3a1a10' : '#24202a');
  if (deep) {
    p.ellipse(cx, cy + 2, rx * 0.5, ry * 0.42, WARM.dark);
    p.ellipse(cx, cy + 3, rx * 0.3, ry * 0.25, WARM.mid);
    // Exposed girder.
    p.rect(cx - rx * 0.8, cy - 1, rx * 1.6, 2, IRON.darker);
    p.px(Math.round(cx - rx * 0.4), cy - 1, IRON.rivet);
    p.px(Math.round(cx + rx * 0.3), cy - 1, IRON.rivet);
  }
  // Scorch rim.
  for (let i = 0; i < 26; i++) {
    const a = r.range(0, Math.PI * 2);
    onOpaque(p, cx + Math.cos(a) * rx * r.range(1.0, 1.4), cy + Math.sin(a) * ry * r.range(1.0, 1.4), r.chance(0.5) ? SOOT : STONE.darker);
  }
}

// ------------------------------------------------------------------ main wall

function drawWall(p: PixelArt, dmg: number): void {
  const H = WALL.H;
  const F = WALL.FACE;
  const GT = WALL.GALLERY_TOP;
  const GB = WALL.GALLERY_BOTTOM;
  const GE = WALL.GALLERY_END;
  // --- Keep (back tower).
  masonry(p, 4, 22, 76, H - 22, 11, shade(STONE.base, -0.06), 11);
  // Smokestack behind the battlement.
  const sx = WALL.SMOKESTACK.x;
  p.rect(sx - 5, 0, 11, 16, IRON.darker);
  p.rect(sx - 4, 2, 9, 14, IRON.dark);
  p.rect(sx - 3, 2, 2, 14, IRON.base);
  p.rect(sx - 6, 0, 13, 3, IRON.darker);
  p.rect(sx - 5, 0, 11, 1, IRON.light);
  p.rect(sx - 4, 8, 9, 1, RUST.dark);
  p.px(sx + 3, 5, RUST.base);
  // Keep battlement: merlons.
  for (let x = 4; x < 80; x += 12) {
    masonry(p, x, 12, 8, 10, 30 + x, STONE.base, 10);
    snowCap(p, x, 12, 8, 70 + x, 2, false);
  }
  p.rect(4, 21, 76, 2, STONE.darker);
  snowCap(p, 4, 22, 76, 5, 2);
  // Iron bands with rivets.
  ironPlate(p, 4, 30, 76, 6);
  ironPlate(p, 4, 120, 76, 7, shade(IRON.base, -0.08));
  // Emblem + lit slits.
  p.circle(48, 74, 17, STONE.darker);
  legionCog(p, 48, 74, 14);
  arrowSlit(p, 18, 44);
  arrowSlit(p, 72, 46);
  arrowSlit(p, 18, 94);
  arrowSlit(p, 72, 96, 9, dmg < 2);
  // Keep shadow onto the curtain (light from the top-left: the keep's right edge is dark).
  p.rect(79, 22, 2, H - 22, STONE.darker);

  // --- Curtain block under the gallery.
  masonry(p, 81, GB, F - 81, H - GB, 23, STONE.base, 10);
  // Gallery walkway (overhang).
  masonry(p, 72, GT, GE - 72, GB - GT, 41, shade(STONE.base, 0.05), 6);
  p.rect(72, GB - 1, GE - 72, 1, STONE.darker);
  p.rect(72, GB, GE - 72, 1, SOOT);
  // Parapet merlons along the gallery front.
  for (let x = 208; x < GE - 2; x += 9) {
    masonry(p, x, GT - 7, 6, 7, 90 + x, STONE.base, 7);
    snowCap(p, x, GT - 7, 6, 91 + x, 2, false);
  }
  snowCap(p, 72, GT, GE - 72, 9, 3);
  // Machicolation corbels under the gallery (stepped brackets with murder holes).
  for (const x of WALL.CORBELS) {
    p.rect(x, GB + 1, 8, 5, STONE.dark);
    p.rect(x + 1, GB + 6, 6, 3, STONE.dark);
    p.rect(x + 2, GB + 9, 4, 2, STONE.darker);
    p.rect(x, GB + 1, 8, 1, STONE.light);
    p.px(x, GB + 2, STONE.lighter);
    p.rect(x + 8, GB + 1, 3, 3, SOOT); // murder hole
  }
  // Iron truss from the gate header up to the gallery tip.
  const tx0 = F + 10;
  const ty0 = WALL.HEADER;
  const tx1 = 220;
  const ty1 = GB + 1;
  p.line(tx0, ty0, tx1, ty1, IRON.darker, 4);
  p.line(tx0, ty0 - 1, tx1, ty1 - 1, IRON.base, 2);
  p.line(tx0 + 1, ty0 - 2, tx1, ty1 - 2, IRON.light);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    const x = tx0 + (tx1 - tx0) * t;
    const y = ty0 + (ty1 - ty0) * t;
    p.line(x, y, x, GB + 1, IRON.dark, 2);
    p.px(Math.round(x), Math.round(y) - 1, IRON.rivet);
  }

  // Legion banner hanging from the gallery.
  const bx = 94;
  p.rect(bx - 2, GB + 1, 24, 3, IRON.dark);
  p.rect(bx - 2, GB + 1, 24, 1, IRON.light);
  const torn = dmg >= 2;
  const bh = torn ? 26 : 44;
  p.rect(bx, GB + 3, 20, bh, '#8a2418');
  p.rect(bx, GB + 3, 2, bh, '#b0342a');
  p.rect(bx + 18, GB + 3, 2, bh, '#5a140c');
  p.rect(bx + 3, GB + 5, 14, 1, BRASS.base);
  p.rect(bx + 3, GB + bh - 1, 14, 1, BRASS.base);
  for (let x = 0; x < 20; x += 4) p.tri(bx + x, GB + 3 + bh, bx + x + 4, GB + 3 + bh, bx + x + 2, GB + 7 + bh, '#8a2418');
  if (!torn) legionCog(p, bx + 10, GB + 22, 6.5);
  else {
    p.rect(bx + 2, GB + 3 + bh - 3, 16, 3, SOOT);
    p.px(bx + 6, GB + bh + 1, WARM.mid);
    p.px(bx + 12, GB + bh, WARM.glow);
  }

  // Ledges / iron cladding on the curtain.
  ironPlate(p, 81, 118, F - 81 - 38, 6, shade(IRON.base, -0.05));

  // --- Gatehouse: iron-clad front block that houses the frost core.
  const g = WALL.GATE;
  const gx0 = 122;
  const gy0 = 76;
  p.rect(gx0, gy0, F - gx0, H - gy0, IRON.darker);
  for (let x = gx0 + 1; x < F - 2; x += 12) ironPlate(p, x, gy0 + 6, Math.min(11, F - 1 - x), H - gy0 - 10, shade(IRON.base, -0.06));
  // Lintel with hazard band.
  ironPlate(p, gx0 - 2, gy0, F - gx0 + 2, 7, IRON.base);
  hazardStripes(p, gx0 - 1, gy0 + 4, F - gx0, 3);
  // Coolant pipe with a red valve wheel.
  p.rect(gx0 + 4, GB + 2, 5, H - GB - 8, IRON.darker);
  p.rect(gx0 + 5, GB + 2, 2, H - GB - 8, '#7a8698');
  p.rect(gx0 + 5, GB + 2, 1, H - GB - 8, '#a8b4c4');
  for (const yy of [GB + 6, 112, 138]) p.rect(gx0 + 3, yy, 7, 2, IRON.dark);
  p.ring(gx0 + 6.5, 102, 4.5, '#a02418', 1.5);
  p.line(gx0 + 3, 102, gx0 + 10, 102, '#a02418');
  p.line(gx0 + 6.5, 98.5, gx0 + 6.5, 105.5, '#a02418');
  p.px(gx0 + 4, 99, '#e05a40');
  // Frost gauge (blue dial).
  p.circle(gx0 + 17, 92, 4.5, IRON.darker);
  p.circle(gx0 + 17, 92, 3.5, '#d8e4ee');
  p.line(gx0 + 17, 92, gx0 + 19, 90, '#a02418');
  p.px(gx0 + 15, 90, '#ffffff');
  // Vent grille (steam puffs out of here when the core opens).
  const v = WALL.VENT;
  p.rect(v.x - 7, v.y - 6, 15, 13, IRON.darker);
  for (let yy = -5; yy <= 5; yy += 2) {
    p.rect(v.x - 6, v.y + yy, 13, 1, '#0c0e14');
    p.rect(v.x - 6, v.y + yy + 1, 13, 1, IRON.light);
  }
  p.rect(v.x - 7, v.y - 7, 15, 1, ICE.light);
  // Gate opening: a dark recess in the face with the core's blue glow deep inside.
  p.rect(g.x - 3, g.y - 3, g.w + 3, g.h + 3, IRON.darker);
  p.rect(g.x, g.y, g.w, g.h, '#070a12');
  p.rect(g.x + 2, g.y + 8, g.w - 2, g.h - 16, CORE.deep);
  p.rect(g.x + 4, g.y + 14, g.w - 4, g.h - 28, '#173a78');
  p.rect(g.x, g.y, g.w, 2, '#1a2236');
  for (let yy = g.y + 3; yy < g.y + g.h - 2; yy += 7) p.rect(g.x - 2, yy, 2, 3, HAZ.y);
  // Protruding gate frame: a riveted header block (the upper blast door retracts into it) and a sill.
  const FR = WALL.FRAME;
  const hy = WALL.HEADER;
  p.rect(F - 1, hy, FR + 1, g.y - hy, IRON.darker);
  ironPlate(p, F - 1, hy, FR, g.y - hy - 1, IRON.base);
  p.rect(F - 1, g.y - 3, FR, 2, HAZ.k);
  hazardStripes(p, F - 1, g.y - 3, FR, 2, 1);
  p.rect(F + FR - 2, hy + 1, 1, g.y - hy - 2, IRON.dark);
  snowCap(p, F - 1, hy, FR + 1, 23, 2, false);
  hangIcicle(p, F + 4, g.y - 1, 3, 2);
  p.rect(F - 1, H - 3, FR, 3, IRON.darker);
  p.rect(F - 1, H - 3, FR, 1, IRON.light);
  // Sill.
  p.rect(gx0 - 4, H - 4, F - gx0 + 4, 4, STONE.dark);
  p.rect(gx0 - 4, H - 4, F - gx0 + 4, 1, STONE.light);
  // Frost on the cladding.
  snowCap(p, gx0 - 2, gy0, F - gx0 + 2, 17, 2);
  for (const [x, l] of [
    [gx0 + 14, 5],
    [gx0 + 27, 7],
  ] as const)
    hangIcicle(p, x, gy0 + 7, l, 2);
  // Snow drifts along the foot of the wall (not over the gate).
  const drift = (x0: number, x1: number, hh: number, seed: number) => {
    const r = new Rng(seed);
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      const d = Math.round(hh * Math.sin(t * Math.PI) + r.range(-0.6, 0.6));
      if (d <= 0) continue;
      p.rect(x, H - d, 1, d, SNOW.light);
      p.px(x, H - d, SNOW.white);
      if (d > 2) p.px(x, H - d + 1, SNOW.white);
    }
  };
  drift(0, 42, 7, 1);
  drift(36, 94, 10, 2);
  drift(90, 128, 6, 3);
  // Icicles under the keep walkway and banner ledge (cosmetic).
  for (const [x, l] of [
    [8, 5],
    [22, 8],
    [37, 4],
    [52, 7],
    [66, 5],
  ] as const)
    hangIcicle(p, x, 24, l, 2);
  for (const [x, l] of [
    [86, 6],
    [120, 9],
  ] as const)
    hangIcicle(p, x, GB + 1, l, 3);

  // --- Damage.
  const r = new Rng(1234);
  if (dmg >= 1) {
    crack(p, r, 30, 24, 26, 1);
    crack(p, r, 110, GB + 2, 30, -1);
    crack(p, r, 64, 100, 20, 1);
    crack(p, r, 190, GT + 1, 8, 1);
    breach(p, r, 62, 106, 7, 5, false);
    // Scorch dither.
    for (let i = 0; i < 160; i++) {
      const x = r.int(90, 158);
      const y = r.int(70, 140);
      if ((x + y) % 2 === 0) onOpaque(p, x, y, SOOT);
    }
    // Missing merlon.
    p.rect(52, 10, 9, 13, '#0000');
    p.rect(52, 20, 9, 3, STONE.darker);
  }
  if (dmg >= 2) {
    breach(p, r, 30, 58, 11, 9, true);
    breach(p, r, 118, 92, 12, 10, true);
    breach(p, r, 176, GT + 6, 6, 4, false);
    crack(p, r, 140, 70, 34, 1);
    crack(p, r, 8, 64, 40, 1);
    // Smashed parapet at the gallery tip.
    p.poly([215, GT - 8, 226, GT - 8, 226, GT + 2, 219, GT + 3], '#0000');
    for (let i = 0; i < 220; i++) {
      const x = r.int(6, 150);
      const y = r.int(24, 150);
      if ((x + y) % 2 === 0 && r.chance(0.6)) onOpaque(p, x, y, SOOT);
    }
  }
}

// Three damage states baked as separate frames (0 intact, 1 cracked, 2 ruined).
sprites.define({
  name: 'bm3_wall',
  w: WALL.W,
  h: WALL.H,
  ox: WALL.OX,
  oy: WALL.H,
  frames: 3,
  draw: (p, f) => drawWall(p, f),
});

// ------------------------------------------------------------------ core, blast doors, beacons

/**
 * Frost core assembly that rams out of the gate on two pistons: chrome rods, an armoured collar and
 * the glowing ice crystal (the weak point). Origin = the back of the pistons (left-middle).
 * Frames 0..3 idle pulse, 4..5 overcharged (white hot, charging / firing).
 */
sprites.define({
  name: 'bm3_core',
  w: 41,
  h: 42,
  ox: 0,
  oy: 21,
  frames: 6,
  draw: (p, f) => {
    const hot = f >= 4;
    const pulse = hot ? 1 : [0, 0.4, 0.8, 0.4][f];
    // Piston rods.
    for (const y of [9, 32]) {
      p.rect(0, y - 3, 18, 6, IRON.darker);
      p.rect(0, y - 2, 18, 3, '#8a96a8');
      p.rect(0, y - 2, 18, 1, '#d6e0ea');
      p.rect(0, y + 1, 18, 1, '#5a6470');
      p.rect(6, y - 3, 2, 6, IRON.dark);
    }
    // Armoured collar.
    p.rect(13, 0, 11, 42, IRON.darker);
    p.rect(14, 1, 9, 40, IRON.dark);
    p.rect(14, 1, 9, 1, IRON.light);
    p.rect(14, 1, 1, 40, IRON.light);
    p.rect(22, 2, 1, 38, IRON.darker);
    hazardStripes(p, 15, 16, 6, 10);
    for (const y of [4, 11, 30, 37]) {
      p.px(17, y, IRON.rivet);
      p.px(18, y + 1, IRON.darker);
    }
    // Glow halo behind the crystal.
    p.ellipse(31, 21, 10, 19, hot ? CORE.mid : CORE.deep);
    p.ellipse(31, 21, 7.5 + pulse, 16.5 + pulse, hot ? CORE.light : CORE.dark);
    // Crystal (hexagonal prism seen from the side).
    p.poly([22, 8, 31, 3, 40, 12, 40, 30, 31, 39, 22, 34], hot ? CORE.white : CORE.mid);
    p.poly([24, 10, 30, 6, 37, 13, 36, 29, 30, 35, 24, 31], hot ? '#ffffff' : CORE.light);
    p.poly([26, 12, 30, 8, 33, 13, 31, 26, 27, 28], hot ? '#ffffff' : CORE.white);
    p.line(31, 4, 31, 38, hot ? CORE.light : CORE.mid);
    p.line(36, 13, 36, 28, hot ? '#ffffff' : CORE.white);
    p.px(38, 14, '#ffffff');
    // Clamp claws.
    p.poly([19, 0, 29, 0, 25, 8], IRON.dark);
    p.poly([20, 0, 27, 0, 24, 5], IRON.base);
    p.poly([19, 42, 29, 42, 25, 34], IRON.dark);
    p.px(21, 1, IRON.light);
    // Energy crackle.
    const r = new Rng(f + 3);
    for (let i = 0; i < (hot ? 6 : 2 + (f % 2)); i++) {
      const y = r.int(7, 34);
      p.px(r.chance(0.5) ? 40 : 21, y, CORE.white);
      p.px(r.chance(0.5) ? 39 : 22, y + 1, CORE.light);
    }
    if (pulse > 0.5 || hot) p.px(28, 10, '#ffffff');
  },
});

/**
 * Blast door halves that close the gate (they stick out of the face like a clamshell).
 * Frame 0: upper half (hazard seam at the bottom), 1: lower half (seam at the top). Origin top-left.
 */
sprites.define({
  name: 'bm3_door',
  w: 17,
  h: 21,
  ox: 0,
  oy: 0,
  frames: 2,
  draw: (p, f) => {
    const up = f === 0;
    const base = shade(IRON.base, -0.02);
    p.rect(0, 0, 16, 21, IRON.darker);
    p.rect(0, 0, 15, 21, base);
    p.rect(0, 0, 15, 1, shade(base, 0.3));
    p.rect(0, 0, 1, 21, shade(base, 0.16));
    // Bulging rounded nose (front = right).
    p.rect(13, 1, 3, 19, IRON.base);
    p.rect(14, 2, 1, 17, IRON.light);
    p.rect(16, 3, 1, 15, IRON.dark);
    p.px(15, 1, IRON.dark);
    p.px(15, 19, IRON.dark);
    // Reinforcement ribs and rivets.
    const ry = up ? 7 : 11;
    p.rect(2, ry, 11, 2, IRON.darker);
    p.rect(2, ry, 11, 1, IRON.light);
    rivets(p, 3, up ? 3 : 15, 11, 4);
    // Hazard seam where the halves meet.
    if (up) hazardStripes(p, 0, 17, 16, 4);
    else hazardStripes(p, 0, 0, 16, 4, 1);
    p.rect(0, up ? 16 : 4, 16, 1, IRON.darker);
    // Red warning lamp on the nose.
    p.rect(12, up ? 11 : 7, 3, 3, '#5a140c');
    p.px(13, up ? 12 : 8, '#ff4a2a');
    // Frost.
    if (up) {
      p.rect(0, 0, 16, 1, ICE.light);
      p.px(3, 1, ICE.white);
    }
  },
});

sprites.define({
  name: 'bm3_beacon',
  w: 7,
  h: 7,
  ox: 3,
  oy: 6,
  frames: 6,
  draw: (p, f) => {
    // 0 off, 1..4 rotating amber, 5 red alarm.
    p.rect(0, 5, 7, 2, IRON.dark);
    p.rect(1, 5, 5, 1, IRON.light);
    const lens = f === 0 ? '#6a5420' : f === 5 ? '#ff3020' : '#ffb020';
    p.circle(3.5, 3, 2.6, lens);
    if (f > 0) {
      p.px(2, 2, '#fff6c0');
      const sweep = (f - 1) % 4;
      if (f < 5) p.rect([0, 2, 4, 2][sweep], 1, 2, 3, '#ffffff');
    }
  },
});

/** Beacon light cone overlay (cosmetic glow pixels drawn by the boss). */
export const BEACON_GLOW = ['#ffd040', '#ff8020'];

// ------------------------------------------------------------------ turrets

/** MG ball turret hanging from a mount. 11 aim angles (-15..135 deg below "forward") x [idle, firing]. */
export const MG_FRAMES = { a0: -15, step: 15, n: 11 };
sprites.define({
  name: 'bm3_mg',
  w: 38,
  h: 34,
  ox: 19,
  oy: 0,
  frames: MG_FRAMES.n * 2,
  draw: (p, f) => {
    const ai = f % MG_FRAMES.n;
    const firing = f >= MG_FRAMES.n;
    const a = ((MG_FRAMES.a0 + ai * MG_FRAMES.step) * Math.PI) / 180;
    const cx = 19;
    const cy = 9;
    // Mount pipe up to the gallery.
    p.rect(cx - 3, 0, 6, 4, IRON.darker);
    p.rect(cx - 2, 0, 2, 4, IRON.base);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Barrel shroud + twin barrels along angle a.
    p.line(cx + ca * 4, cy + sa * 4, cx + ca * 9, cy + sa * 9, IRON.darker, 5);
    for (const off of [-1.6, 1.6]) {
      const ox = -sa * off;
      const oy = ca * off;
      p.line(cx + ox + ca * 6, cy + oy + sa * 6, cx + ox + ca * 15, cy + oy + sa * 15, IRON.darker, 2);
      p.px(Math.round(cx + ox + ca * 15), Math.round(cy + oy + sa * 15), '#101010');
    }
    p.line(cx + ca * 5, cy + sa * 5, cx + ca * 8, cy + sa * 8, IRON.base, 2);
    // Ball housing.
    p.circle(cx, cy, 7, IRON.dark);
    p.circle(cx - 0.8, cy - 0.8, 6, IRON.base);
    p.circle(cx - 2, cy - 2.2, 2.6, IRON.light);
    p.px(cx - 3, cy - 3, '#d8e0b0');
    // Vision slit + rust band.
    p.rect(cx - 5, cy + 2, 9, 2, RUST.dark);
    p.rect(cx - 4, cy + 2, 3, 1, WARM.glow);
    p.px(cx + 3, cy - 4, IRON.rivet);
    p.px(cx - 6, cy + 1, IRON.rivet);
    if (firing) {
      const mx = cx + ca * 17;
      const my = cy + sa * 17;
      p.circle(mx, my, 3, '#ffd23c');
      p.circle(mx, my, 1.6, '#ffffff');
    }
  },
});

/** Twin ice-flak cannon on an armoured turntable. 5 elevations (15..75 deg up) x [idle, firing]. */
sprites.define({
  name: 'bm3_flak',
  w: 38,
  h: 32,
  ox: 14,
  oy: 32,
  frames: 10,
  draw: (p, f) => {
    const ei = f % 5;
    const firing = f >= 5;
    const a = -((15 + ei * 15) * Math.PI) / 180;
    const px = 15;
    const py = 19;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const L = firing ? 17 : 20;
    // Twin barrels: dark steel tubes with a lit top edge, a cooling jacket and a muzzle brake.
    for (const off of [2.6, -2.6]) {
      const x0 = px - sa * off;
      const y0 = py + ca * off;
      const x1 = x0 + ca * L;
      const y1 = y0 + sa * L;
      p.line(x0, y0, x1, y1, IRON.darker, 3);
      p.line(x0 - sa * -0.8, y0 + ca * -0.8, x1 - sa * -0.8, y1 + ca * -0.8, '#6e7684');
      p.line(x0 + ca * 4, y0 + sa * 4, x0 + ca * 9, y0 + sa * 9, IRON.dark, 4);
      p.rotRect(x1 - ca * 1.5, y1 - sa * 1.5, 2.2, 2.2, a, IRON.darker);
      p.px(Math.round(x1 - ca * 1.5 - sa * -1), Math.round(y1 - sa * 1.5 + ca * -1), '#8a92a0');
    }
    // Turntable with hazard skirt.
    p.rect(2, 25, 26, 7, IRON.darker);
    ironPlate(p, 3, 25, 24, 6);
    hazardStripes(p, 4, 29, 22, 2);
    // Gun cradle.
    p.circle(px, py, 6.5, IRON.darker);
    p.circle(px - 0.5, py - 0.5, 5.5, IRON.base);
    p.circle(px - 2, py - 2, 2.2, IRON.light);
    // Crew shield (sloped plate behind the guns).
    p.poly([3, 26, 3, 11, 9, 6, 12, 8, 11, 26], IRON.darker);
    p.poly([4, 25, 4, 12, 9, 7, 10, 9, 10, 25], IRON.base);
    p.line(4, 12, 9, 7, IRON.light);
    p.rect(4, 13, 1, 12, shade(IRON.base, 0.12));
    p.px(7, 15, IRON.rivet);
    p.px(7, 21, IRON.rivet);
    // Lit vision slit + frost.
    p.rect(5, 17, 4, 1, WARM.glow);
    p.px(5, 16, WARM.mid);
    p.rect(4, 11, 3, 1, ICE.light);
    if (firing) {
      for (const off of [2.6, -2.6]) {
        const mx = px - sa * off + ca * (L + 3);
        const my = py + ca * off + sa * (L + 3);
        p.circle(mx, my, 2.8, '#ffd23c');
        p.circle(mx, my, 1.4, '#ffffff');
      }
    }
  },
});

/** Mortar battery: twin stubby tubes on a sandbagged armored base. f 0 idle, 1 firing, 2 recoil. */
sprites.define({
  name: 'bm3_mortar',
  w: 30,
  h: 22,
  ox: 15,
  oy: 22,
  frames: 3,
  draw: (p, f) => {
    const kick = f === 2 ? 1 : 0;
    // Sandbags.
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 6;
      p.ellipse(x + 3, 19, 3.4, 2.6, '#8a7a52');
      p.ellipse(x + 2.6, 18.4, 2.4, 1.5, '#b4a274');
    }
    snowCap(p, 2, 16, 26, 3, 1, false);
    // Tubes (aimed up-forward ~70 deg).
    for (const [x0, len] of [
      [9, 15],
      [17, 13],
    ] as const) {
      const a = -1.2;
      const x1 = x0 + Math.cos(a) * len;
      const y1 = 17 + Math.sin(a) * len + kick;
      p.line(x0, 17 + kick, x1, y1, IRON.darker, 5);
      p.line(x0 - 0.5, 16.5 + kick, x1 - 0.5, y1 - 0.5, IRON.base, 2);
      p.rect(x1 - 2, y1 - 1, 5, 2, IRON.dark);
      p.px(Math.round(x1), Math.round(y1) - 1, '#0a0a0a');
      if (f === 1) {
        p.circle(x1 + 1, y1 - 3, 3, '#ffd23c');
        p.circle(x1 + 1, y1 - 3, 1.5, '#ffffff');
      }
    }
    // Ammo crate.
    p.rect(22, 12, 7, 6, '#6a5a34');
    p.rect(22, 12, 7, 1, '#8a7a4a');
    p.rect(24, 14, 3, 2, BRASS.base);
  },
});

/** Turret wrecks: 0 = MG stub hanging, 1 = flak base, 2 = mortar nest. */
sprites.define({
  name: 'bm3_wreck',
  w: 26,
  h: 18,
  ox: 13,
  oy: 18,
  frames: 3,
  draw: (p, f) => {
    if (f === 0) {
      p.rect(10, 0, 6, 5, IRON.darker);
      p.poly([7, 5, 19, 5, 17, 11, 13, 13, 9, 10], SOOT);
      p.poly([8, 5, 17, 5, 15, 9, 10, 9], '#3a3430');
      p.line(15, 9, 20, 15, IRON.darker, 2);
      p.px(12, 7, WARM.mid);
      p.px(14, 8, WARM.glow);
      return;
    }
    p.rect(2, 12, 22, 6, SOOT);
    p.rect(3, 12, 20, 2, '#3a3430');
    if (f === 1) {
      p.line(10, 12, 16, 3, IRON.darker, 3);
      p.line(14, 12, 22, 9, IRON.darker, 2);
      p.poly([4, 12, 6, 4, 9, 6, 8, 12], '#2a2622');
    } else {
      for (let i = 0; i < 4; i++) p.ellipse(4 + i * 6, 15, 3, 2.4, '#5a4c36');
      p.line(10, 13, 13, 6, IRON.darker, 3);
    }
    p.px(12, 13, WARM.mid);
    p.px(7, 14, WARM.glow);
  },
});

// ------------------------------------------------------------------ hazards & projectiles

/** Hanging/falling icicle: frames 0..3 = growing (3 = full). Origin: hanging point (top center). */
sprites.define({
  name: 'bm3_icicle',
  w: 8,
  h: 22,
  ox: 4,
  oy: 0,
  frames: 4,
  draw: (p, f) => {
    const len = [6, 11, 16, 21][f];
    const w = [4, 5, 6, 7][f];
    const x0 = 4 - w / 2;
    p.poly([x0, 0, x0 + w, 0, 4.4, len], ICE.mid);
    p.poly([x0 + 0.5, 0, x0 + w * 0.55, 0, 3.6, len - 2], ICE.light);
    p.line(x0 + 1, 1, 3.5, len * 0.7, ICE.white);
    p.rect(x0 - 1, 0, w + 2, 2, ICE.light);
    p.rect(x0 - 1, 0, w + 2, 1, ICE.white);
    p.px(4, len - 1, ICE.dark);
  },
});

sprites.define({
  name: 'bm3_shard',
  w: 6,
  h: 6,
  ox: 3,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      p.poly([0, 3, 3, 0, 6, 2, 4, 6, 1, 5], ICE.mid);
      p.poly([1, 3, 3, 1, 4, 2, 2, 4], ICE.white);
    } else {
      p.poly([1, 0, 5, 1, 6, 5, 2, 6, 0, 3], ICE.light);
      p.poly([2, 1, 4, 2, 3, 4], ICE.white);
    }
  },
});

sprites.define({
  name: 'bm3_flakshell',
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    p.circle(3.5, 3.5, 3.2, f ? '#ffffff' : '#4a5260');
    p.circle(3.5, 3.5, 2, f ? '#ffe070' : '#7a8496');
    p.px(2, 2, f ? '#ffffff' : '#c8d0dc');
    p.rect(1, 3, 5, 1, f ? '#ff5030' : RUST.base);
  },
});

/** Mortar shell, pointing right (rotated to velocity). */
sprites.define({
  name: 'bm3_mshell',
  w: 11,
  h: 6,
  ox: 5,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    p.ellipse(6, 3, 4.5, 2.6, '#3a3e48');
    p.ellipse(6.5, 2.3, 3, 1.2, '#6a7080');
    p.rect(0, 1, 3, 4, IRON.dark);
    p.rect(0, 0, 1, 6, IRON.darker);
    p.rect(8, 2, 2, 2, f ? '#ff4020' : '#a02010');
  },
});

/** Avalanche ball: a boulder of packed ice and rock. 4 roll frames. */
sprites.define({
  name: 'bm3_boulder',
  w: 22,
  h: 22,
  ox: 11,
  oy: 11,
  frames: 4,
  draw: (p, f) => {
    const a0 = (f / 4) * (Math.PI / 2);
    p.circle(11, 11, 10.4, ICE.dark);
    p.circle(10.4, 10.4, 9.2, ICE.mid);
    p.circle(9, 8.6, 6, ICE.light);
    p.circle(7.6, 7, 2.6, ICE.white);
    // Embedded rocks and cracks that rotate with the roll.
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i * Math.PI) / 2;
      const x = 11 + Math.cos(a) * 5.5;
      const y = 11 + Math.sin(a) * 5.5;
      p.ellipse(x, y, 2.2, 1.7, i % 2 ? STONE.dark : STONE.base);
      p.px(Math.round(x - 1), Math.round(y - 1), STONE.light);
      p.line(11, 11, 11 + Math.cos(a + 0.7) * 9, 11 + Math.sin(a + 0.7) * 9, ICE.dark);
    }
    p.circle(11, 11, 1.5, ICE.deep);
  },
});

/** Armor plate / stone chunk debris (rotated freely). 0..2 plates, 3..5 stone chunks. */
sprites.define({
  name: 'bm3_plate',
  w: 12,
  h: 9,
  ox: 6,
  oy: 4,
  frames: 6,
  draw: (p, f) => {
    if (f < 3) {
      const w = [12, 10, 8][f];
      const h = [7, 9, 6][f];
      ironPlate(p, 0, 0, w, h, f === 1 ? shade(IRON.base, -0.1) : IRON.base);
      if (f === 2) hazardStripes(p, 0, h - 2, w, 2);
      p.px(w - 2, 1, SOOT);
      return;
    }
    const pts = [
      [1, 2, 7, 0, 11, 3, 9, 8, 2, 7],
      [0, 3, 4, 0, 9, 2, 8, 6, 3, 8],
      [2, 1, 9, 2, 8, 7, 1, 6],
    ][f - 3];
    p.poly(pts, STONE.base);
    p.poly(pts.map((v, i) => (i % 2 ? v * 0.6 : v * 0.8)), STONE.light);
    p.px(5, 4, STONE.dark);
  },
});

/** Ruined bastion left after the death sequence (cosmetic). */
sprites.define({
  name: 'bm3_rubble',
  w: 170,
  h: 46,
  ox: 92,
  oy: 46,
  draw: (p) => {
    const r = new Rng(77);
    // Big heap profile.
    const pts: number[] = [0, 46];
    for (let x = 0; x <= 170; x += 10) pts.push(x, 46 - Math.max(4, 40 * Math.sin((x / 170) * Math.PI) * r.range(0.7, 1.05)));
    pts.push(170, 46);
    p.poly(pts, STONE.dark);
    for (let i = 0; i < 70; i++) {
      const x = r.int(6, 164);
      const top = 46 - 36 * Math.sin((x / 170) * Math.PI);
      const y = r.int(Math.round(top) + 2, 44);
      const c = r.pick([STONE.base, STONE.light, STONE.dark, STONE.base]);
      p.ellipse(x, y, r.range(2, 6), r.range(1.5, 4), c);
      p.px(x - 1, y - 1, shade(c, 0.2));
    }
    // Twisted girders and a smashed shutter.
    p.line(40, 30, 70, 6, IRON.darker, 3);
    p.line(44, 30, 74, 8, IRON.base);
    p.line(110, 34, 126, 12, IRON.darker, 3);
    p.rect(96, 26, 16, 12, IRON.dark);
    hazardStripes(p, 96, 34, 16, 4);
    p.rect(60, 36, 10, 4, WARM.dark);
    p.rect(62, 37, 5, 2, WARM.mid);
    // Snow dusting.
    for (let x = 4; x < 166; x++) {
      const top = 46 - 40 * Math.sin((x / 170) * Math.PI);
      if (r.chance(0.5)) p.px(x, Math.round(top) + r.int(0, 3), SNOW.white);
    }
  },
});

/** Ice spike cluster erupting from the floor (spike wave): 0..2 growing, 3 shattering. Origin bottom-centre. */
sprites.define({
  name: 'bm3_spike',
  w: 15,
  h: 21,
  frames: 4,
  draw: (p, f) => {
    const B = 21;
    if (f === 3) {
      // Shattering: a low heap of shards and flying chips.
      p.poly([1, B, 3, B - 5, 5, B - 2, 7, B - 7, 9, B - 3, 11, B - 6, 14, B], ICE.mid);
      p.poly([3, B, 4, B - 3, 6, B - 1, 7, B - 5, 9, B - 1, 12, B], ICE.light);
      p.px(2, B - 9, ICE.white);
      p.px(12, B - 11, ICE.light);
      p.px(7, B - 13, ICE.white);
      p.px(5, B - 10, ICE.light);
      return;
    }
    const k = [0.45, 0.8, 1][f];
    // [base x0, base x1, tip x, height]
    const shards: [number, number, number, number][] = [
      [0, 6, 1 - 2 * k, 13],
      [9, 15, 14 + k, 11],
      [3.5, 11, 7, 20],
    ];
    for (const [x0, x1, tx, h] of shards) {
      const ty = B - h * k;
      const mx = (x0 + x1) / 2;
      p.poly([x0, B, x1, B, tx, ty], ICE.dark);
      p.poly([x0 + 0.6, B, x1 - 0.8, B, tx, ty + 1], ICE.mid);
      // Lit left face.
      p.poly([x0 + 0.8, B, mx, B, tx, ty + 1.5], ICE.light);
      p.line(x0 + 1.2, B - 1, tx, ty + 2, ICE.white);
    }
    // Frosty base.
    p.rect(0, B - 1, 15, 1, ICE.light);
    p.px(2, B - 2, ICE.white);
    p.px(11, B - 2, ICE.white);
    if (f === 2) p.px(7, Math.round(B - 20 * k) + 3, '#ffffff');
  },
});
