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
  /** Gallery underside / walkway top (sprite y). */
  GALLERY_TOP: 52,
  GALLERY_BOTTOM: 64,
  GALLERY_END: 225,
  /** Core hatch slot on the face (the core assembly slides out of it). */
  GATE: { x: 150, y: 108, w: 10, h: 42 },
  /** Emitter (cannon muzzle) mount on the face; the muzzle tip is EMITTER.x + EMITTER_LEN. */
  EMITTER: { x: 160, y: 90 },
  EMITTER_LEN: 13,
  /** Core assembly: fully extended it spans FACE .. FACE + CORE_LEN (centered on the slot). */
  CORE_LEN: 28,
  /** Turret mounts (sprite space). */
  MG: { x: 212, y: 64 },
  FLAK: { x: 192, y: 52 },
  MORTAR: { x: 160, y: 52 },
  SMOKESTACK: { x: 18, y: 2 },
  /** Steam vent grille (sprite space). */
  VENT: { x: 140, y: 124 },
  /** Icicle slots along the gallery underside (sprite x). */
  ICICLES: [168, 178, 188, 198, 224],
  BEACONS: [
    { x: 131, y: 76 },
    { x: 146, y: 76 },
  ],
};

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
  // --- Keep (back tower).
  masonry(p, 4, 22, 74, H - 22, 11, shade(STONE.base, -0.06), 11);
  // Keep battlement: merlons.
  for (let x = 4; x < 78; x += 12) {
    masonry(p, x, 12, 8, 10, 30 + x, STONE.base, 10);
    snowCap(p, x, 12, 8, 70 + x, 2, false);
  }
  p.rect(4, 21, 74, 2, STONE.darker);
  snowCap(p, 4, 22, 74, 5, 2);
  // Smokestack.
  p.rect(14, 0, 9, 14, IRON.dark);
  p.rect(15, 0, 2, 14, IRON.base);
  p.rect(13, 0, 11, 2, IRON.darker);
  p.rect(14, 6, 9, 1, RUST.dark);
  // Iron bands with rivets.
  ironPlate(p, 4, 30, 74, 6);
  ironPlate(p, 4, 120, 74, 7, shade(IRON.base, -0.08));
  // Emblem + slits.
  p.circle(40, 70, 17, STONE.darker);
  legionCog(p, 40, 70, 14);
  arrowSlit(p, 16, 44);
  arrowSlit(p, 62, 44);
  arrowSlit(p, 16, 92);
  arrowSlit(p, 62, 92, 9, dmg < 2);
  // Keep shadow onto the curtain (light from top-left: the keep's right edge is dark).
  p.rect(77, 22, 2, H - 22, STONE.darker);

  // --- Curtain block under the gallery.
  masonry(p, 79, GB, F - 79, H - GB, 23, STONE.base, 10);
  // Gallery walkway (overhang).
  masonry(p, 70, GT, WALL.GALLERY_END - 70, GB - GT, 41, shade(STONE.base, 0.05), 6);
  p.rect(70, GB - 1, WALL.GALLERY_END - 70, 1, STONE.darker);
  p.rect(70, GB, WALL.GALLERY_END - 70, 1, SOOT);
  // Parapet merlons along the gallery front.
  for (let x = 206; x < WALL.GALLERY_END - 2; x += 10) {
    masonry(p, x, GT - 7, 6, 7, 90 + x, STONE.base, 7);
    snowCap(p, x, GT - 7, 6, 91 + x, 2, false);
  }
  snowCap(p, 70, GT, WALL.GALLERY_END - 70, 9, 3);
  // Machicolation corbels under the gallery at the face (stepped brackets with murder holes).
  for (let i = 0; i < 5; i++) {
    const x = F + 4 + i * 12;
    if (x > WALL.GALLERY_END - 10) break;
    p.rect(x, GB + 1, 7, 5, STONE.dark);
    p.rect(x + 1, GB + 6, 5, 3, STONE.dark);
    p.rect(x + 2, GB + 9, 3, 2, STONE.darker);
    p.rect(x, GB + 1, 7, 1, STONE.light);
    p.rect(x + 7, GB + 1, 4, 3, SOOT); // murder hole
  }
  // Iron truss from the face up to the gallery end.
  const tx0 = F;
  const ty0 = 98;
  const tx1 = 218;
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
  const bx = 96;
  p.rect(bx - 2, GB + 1, 24, 3, IRON.dark);
  const torn = dmg >= 2;
  const bh = torn ? 26 : 44;
  p.rect(bx, GB + 3, 20, bh, '#8a2418');
  p.rect(bx, GB + 3, 2, bh, '#b0342a');
  p.rect(bx + 18, GB + 3, 2, bh, '#5a140c');
  p.rect(bx + 3, GB + 5, 14, 1, BRASS.base);
  for (let x = 0; x < 20; x += 4) p.tri(bx + x, GB + 3 + bh, bx + x + 4, GB + 3 + bh, bx + x + 2, GB + 7 + bh, '#8a2418');
  if (!torn) legionCog(p, bx + 10, GB + 22, 6.5);
  else {
    p.rect(bx + 2, GB + 3 + bh - 3, 16, 3, SOOT);
    p.px(bx + 6, GB + bh + 1, WARM.mid);
    p.px(bx + 12, GB + bh, WARM.glow);
  }

  // Ledges / iron cladding on the curtain.
  ironPlate(p, 79, 118, F - 79 - 20, 6, shade(IRON.base, -0.05));

  // --- Gatehouse: iron-clad front block that houses the cannon core.
  const g = WALL.GATE;
  const gx0 = 124;
  const gy0 = 76;
  p.rect(gx0, gy0, F - gx0, H - gy0, IRON.darker);
  for (let x = gx0 + 1; x < F - 2; x += 12) ironPlate(p, x, gy0 + 6, Math.min(11, F - 1 - x), H - gy0 - 10, shade(IRON.base, -0.06));
  // Lintel with hazard band.
  ironPlate(p, gx0 - 2, gy0, F - gx0 + 2, 7, IRON.base);
  hazardStripes(p, gx0 - 1, gy0 + 4, F - gx0, 3);
  // Feed pipe with a red valve wheel.
  p.rect(gx0 + 4, GB + 2, 5, H - GB - 8, IRON.darker);
  p.rect(gx0 + 5, GB + 2, 2, H - GB - 8, '#7a8698');
  p.rect(gx0 + 5, GB + 2, 1, H - GB - 8, '#a8b4c4');
  for (const yy of [GB + 6, 112, 138]) p.rect(gx0 + 3, yy, 7, 2, IRON.dark);
  p.ring(gx0 + 6.5, 104, 4.5, '#a02418', 1.5);
  p.line(gx0 + 3, 104, gx0 + 10, 104, '#a02418');
  p.line(gx0 + 6.5, 100.5, gx0 + 6.5, 107.5, '#a02418');
  p.px(gx0 + 4, 101, '#e05a40');
  // Vent grille (steam puffs out of here when the core opens).
  p.rect(WALL.VENT.x - 7, WALL.VENT.y - 5, 15, 11, IRON.darker);
  for (let yy = -4; yy <= 4; yy += 2) {
    p.rect(WALL.VENT.x - 6, WALL.VENT.y + yy, 13, 1, '#0c0e14');
    p.rect(WALL.VENT.x - 6, WALL.VENT.y + yy + 1, 13, 1, IRON.light);
  }
  p.rect(WALL.VENT.x - 7, WALL.VENT.y - 6, 15, 1, ICE.light);
  // Hatch slot on the face (the core slides out here; the shutter sprites cover it).
  p.rect(g.x - 3, g.y - 3, g.w + 3, g.h + 3, IRON.darker);
  p.rect(g.x, g.y, g.w, g.h, '#080b14');
  p.rect(g.x, g.y, g.w, 2, '#1a2236');
  for (let yy = g.y + 4; yy < g.y + g.h; yy += 8) p.rect(g.x - 2, yy, 2, 3, HAZ.y);
  // Emitter collar above the slot.
  p.rect(F - 14, WALL.EMITTER.y - 9, 14, 18, IRON.dark);
  ironPlate(p, F - 14, WALL.EMITTER.y - 9, 13, 17);
  p.rect(F - 3, WALL.EMITTER.y - 8, 3, 16, IRON.darker);
  p.ring(F - 8, WALL.EMITTER.y, 4, CORE.dark, 1);
  // Sill.
  p.rect(gx0 - 4, H - 4, F - gx0 + 4, 4, STONE.dark);
  p.rect(gx0 - 4, H - 4, F - gx0 + 4, 1, STONE.light);
  // Frost on the cladding.
  snowCap(p, gx0 - 2, gy0, F - gx0 + 2, 17, 2);
  for (const [x, l] of [
    [gx0 + 14, 5],
    [gx0 + 26, 7],
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
  drift(0, 40, 7, 1);
  drift(34, 92, 10, 2);
  drift(88, 132, 6, 3);
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
    [84, 6],
    [118, 9],
  ] as const)
    hangIcicle(p, x, GB + 1, l, 3);

  // --- Damage.
  const r = new Rng(1234);
  if (dmg >= 1) {
    crack(p, r, 30, 24, 26, 1);
    crack(p, r, 110, GB + 2, 30, -1);
    crack(p, r, 60, 98, 20, 1);
    crack(p, r, 186, GT + 1, 8, 1);
    breach(p, r, 58, 104, 7, 5, false);
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
    breach(p, r, 24, 58, 11, 9, true);
    breach(p, r, 118, 92, 12, 10, true);
    breach(p, r, 172, GT + 6, 6, 4, false);
    crack(p, r, 140, 70, 34, 1);
    crack(p, r, 8, 64, 40, 1);
    // Broken gallery tip.
    p.poly([214, GT - 8, 226, GT - 8, 226, GB + 2, 219, GB + 2, 216, GT + 3], '#0000');
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

// ------------------------------------------------------------------ core, shutters, emitter, beacons

/**
 * Core assembly that slides out of the face when the gate opens: piston rods, a cradle and the
 * glowing frost crystal at the tip. Origin = attachment point on the face (left-middle).
 * Frames 0..3 idle pulse, 4..5 overcharged (white hot, before/while the lance fires).
 */
sprites.define({
  name: 'bm3_core',
  w: 28,
  h: 38,
  ox: 0,
  oy: 19,
  frames: 6,
  draw: (p, f) => {
    const hot = f >= 4;
    const pulse = hot ? 1 : [0, 0.33, 0.66, 0.33][f];
    // Piston rods.
    for (const y of [5, 32]) {
      p.rect(0, y - 2, 13, 5, IRON.darker);
      p.rect(0, y - 1, 13, 2, '#8a96a8');
      p.rect(0, y - 1, 13, 1, '#c8d2de');
    }
    // Cradle ring.
    p.rect(10, 0, 6, 38, IRON.dark);
    p.rect(10, 0, 6, 1, IRON.light);
    p.rect(10, 0, 1, 38, IRON.light);
    p.px(13, 3, IRON.rivet);
    p.px(13, 34, IRON.rivet);
    hazardStripes(p, 11, 15, 4, 8);
    // Glow halo.
    p.ellipse(21, 19, 7, 17, hot ? CORE.mid : CORE.deep);
    p.ellipse(21, 19, 5.5 + pulse, 15 + pulse, hot ? CORE.light : CORE.dark);
    // Crystal (hexagonal prism seen from the side).
    p.poly([16, 6, 24, 3, 27, 12, 27, 26, 24, 35, 16, 32], hot ? CORE.white : CORE.mid);
    p.poly([17, 8, 23, 6, 25, 13, 24, 27, 19, 30, 17, 22], hot ? '#ffffff' : CORE.light);
    p.line(19, 9, 19, 24, CORE.white);
    p.line(21, 7, 25, 12, CORE.white);
    p.px(24, 20, hot ? '#ffffff' : CORE.white);
    // Clamp claws.
    p.poly([15, 0, 22, 0, 18, 6], IRON.dark);
    p.poly([15, 38, 22, 38, 18, 32], IRON.dark);
    // Energy arcs.
    const r = new Rng(f + 3);
    for (let i = 0; i < (hot ? 5 : 2); i++) {
      const y = r.int(6, 31);
      p.px(r.chance(0.5) ? 26 : 16, y, CORE.white);
      p.px(r.chance(0.5) ? 27 : 15, y + 1, CORE.light);
    }
    if (pulse > 0.5 || hot) p.px(22, 10, '#ffffff');
  },
});

/** Core hatch halves. Frame 0: upper half (hazard edge at bottom), 1: lower half (edge at top). */
sprites.define({
  name: 'bm3_shutter',
  w: 13,
  h: 22,
  ox: 0,
  oy: 0,
  frames: 2,
  draw: (p, f) => {
    ironPlate(p, 0, 0, 13, 22, shade(IRON.base, -0.04));
    p.rect(11, 1, 2, 20, IRON.darker);
    for (const y of [5, 10, 15]) p.rect(3, f === 0 ? y : y + 2, 7, 1, IRON.darker);
    if (f === 0) hazardStripes(p, 0, 18, 11, 4);
    else hazardStripes(p, 0, 0, 11, 4, 1);
    p.rect(4, f === 0 ? 2 : 7, 2, 9, IRON.light);
    p.rect(0, f === 0 ? 0 : 21, 13, 1, ICE.light);
  },
});

/** The frost cannon muzzle above the core. f: 0 idle, 1..3 charging, 4 firing. Origin: face mount. */
sprites.define({
  name: 'bm3_emitter',
  w: 15,
  h: 16,
  ox: 0,
  oy: 8,
  frames: 5,
  draw: (p, f) => {
    p.rect(0, 2, 8, 12, IRON.darker);
    p.rect(0, 3, 7, 10, IRON.dark);
    p.rect(0, 3, 7, 1, IRON.light);
    p.rect(6, 0, 7, 16, IRON.dark);
    p.rect(6, 0, 7, 1, IRON.light);
    p.rect(6, 1, 1, 14, IRON.light);
    p.rect(8, 4, 5, 8, '#080a12');
    const glow = [0, 0.35, 0.65, 0.9, 1][f];
    if (glow > 0) {
      p.rect(9, 5, 4, 6, glow > 0.6 ? CORE.light : CORE.dark);
      p.rect(10, 6, 3, 4, glow > 0.8 ? '#ffffff' : CORE.mid);
      if (f >= 3) {
        p.rect(13, 6, 2, 4, CORE.white);
        p.px(14, 5, CORE.light);
        p.px(14, 10, CORE.light);
      }
    }
    for (let x = 1; x < 6; x += 2) p.px(x, 2, IRON.rivet);
    p.rect(2, 14, 4, 2, IRON.darker);
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

/** MG ball turret hanging from a mount. 6 aim angles (0..70 deg down) x [idle, firing]. */
sprites.define({
  name: 'bm3_mg',
  w: 26,
  h: 26,
  ox: 9,
  oy: 9,
  frames: 12,
  draw: (p, f) => {
    const ai = f % 6;
    const firing = f >= 6;
    const a = (ai * 14 * Math.PI) / 180;
    const cx = 9;
    const cy = 9;
    // Mount pipe up to the gallery.
    p.rect(cx - 3, 0, 6, 5, IRON.darker);
    p.rect(cx - 2, 0, 2, 5, IRON.base);
    // Barrels (twin) along angle a.
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const off of [-1.6, 1.6]) {
      const ox = -sa * off;
      const oy = ca * off;
      p.line(cx + ox + ca * 4, cy + oy + sa * 4, cx + ox + ca * 15, cy + oy + sa * 15, IRON.darker, 2);
      p.px(Math.round(cx + ox + ca * 15), Math.round(cy + oy + sa * 15), '#101010');
    }
    p.line(cx + ca * 5, cy + sa * 5, cx + ca * 9, cy + sa * 9, IRON.dark, 4);
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

/** Twin flak cannon on a shielded mount. 5 elevations (15..75 deg up) x [idle, firing]. */
sprites.define({
  name: 'bm3_flak',
  w: 34,
  h: 30,
  ox: 14,
  oy: 30,
  frames: 10,
  draw: (p, f) => {
    const ei = f % 5;
    const firing = f >= 5;
    const a = -((15 + ei * 15) * Math.PI) / 180;
    const px = 13;
    const py = 18;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const recoil = firing ? -2 : 0;
    // Barrels.
    for (const off of [-2.2, 2.2]) {
      const ox = -sa * off;
      const oy = ca * off;
      p.line(px + ox, py + oy, px + ox + ca * (17 + recoil), py + oy + sa * (17 + recoil), IRON.darker, 3);
      p.line(px + ox, py + oy, px + ox + ca * (16 + recoil), py + oy + sa * (16 + recoil), IRON.base, 1);
      p.line(px + ox + ca * (12 + recoil), py + oy + sa * (12 + recoil), px + ox + ca * (14 + recoil), py + oy + sa * (14 + recoil), RUST.base, 3);
    }
    // Base turntable.
    p.rect(2, 24, 24, 6, IRON.darker);
    ironPlate(p, 3, 24, 22, 5);
    hazardStripes(p, 4, 28, 20, 2);
    // Gun cradle + shield.
    p.circle(px, py, 6, IRON.dark);
    p.circle(px - 0.6, py - 0.6, 5, IRON.base);
    p.poly([3, 26, 3, 10, 9, 6, 13, 8, 12, 26], IRON.dark);
    p.poly([4, 25, 4, 11, 9, 7, 11, 9, 10, 25], IRON.base);
    p.line(4, 11, 9, 7, IRON.light);
    p.px(6, 14, IRON.rivet);
    p.px(6, 20, IRON.rivet);
    // Crew hatch light.
    p.rect(6, 16, 2, 2, WARM.glow);
    if (firing) {
      for (const off of [-2.2, 2.2]) {
        const mx = px - sa * off + ca * 19;
        const my = py + ca * off + sa * 19;
        p.circle(mx, my, 2.6, '#ffd23c');
        p.px(Math.round(mx), Math.round(my), '#ffffff');
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

/** Frost crystals left by the beam: 0..1 growing, 2 full, 3 shattering. */
sprites.define({
  name: 'bm3_crystal',
  w: 11,
  h: 12,
  ox: 5,
  oy: 12,
  frames: 4,
  draw: (p, f) => {
    const k = [0.45, 0.75, 1, 1][f];
    const spikes: [number, number, number][] = [
      [5, 12, 0],
      [2, 9, -0.45],
      [8, 9, 0.4],
    ];
    if (f === 3) {
      p.poly([1, 12, 3, 8, 5, 11, 7, 7, 10, 12], ICE.light);
      p.px(3, 6, ICE.white);
      p.px(8, 4, ICE.white);
      p.px(5, 3, ICE.light);
      return;
    }
    for (const [h, l, lean] of spikes) {
      const x = 5 + lean * 6;
      p.poly([x - 1.6, 12, x + 1.6, 12, x + lean * l * k, 12 - l * k * 0.95], ICE.mid);
      p.line(x - 0.5, 11, x + lean * l * k * 0.8, 12 - l * k * 0.8, ICE.white);
      void h;
    }
    p.rect(1, 11, 9, 1, ICE.light);
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
