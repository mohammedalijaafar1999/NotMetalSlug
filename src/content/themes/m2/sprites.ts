// Mission 2 decor sprites (all 'm2_' prefixed, authored facing right, lit from the top-left).
// Rendered by the theme's decor kinds (decor.ts). Pure PixelArt: safe to import headless.

import type { PixelArt } from '../../../engine/pixelart';
import { mixColor, shade } from '../../../engine/pixelart';
import { sprites } from '../../../engine/sprites';
import { C } from './palette';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ tiny 3x5 sign font

const GLYPHS: Record<string, string> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  W: '101101111111101',
  Y: '101101010010010',
  '!': '010010010000010',
  '>': '100010001010100',
  '<': '001010100010001',
  ' ': '000000000000000',
};

/** Draw text with the 3x5 font (4 px per char). Returns the width. */
export function signText(p: PixelArt, x: number, y: number, text: string, color: string): number {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') p.px(cx + (i % 3), y + Math.floor(i / 3), color);
    cx += 4;
  }
  return cx - x - 1;
}

export function textWidth(text: string): number {
  return text.length * 4 - 1;
}

// ------------------------------------------------------------------ shared helpers

/** Vertical cylinder-ish ribbed column shading for a cactus segment. */
function cactusSeg(p: PixelArt, x0: number, y0: number, x1: number, y1: number, r: number): void {
  p.capsule(x0, y0, x1, y1, r, C.cactus);
  // Ribs: lighter on the left, darker on the right.
  const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
  if (vertical) {
    const top = Math.min(y0, y1) - r + 1;
    const bot = Math.max(y0, y1) + r - 1;
    const cx = (x0 + x1) / 2;
    for (let y = Math.ceil(top); y < bot; y++) {
      p.px(cx - r + 0.5, y, C.cactusL);
      p.px(cx - r + 1.5, y, y % 3 === 0 ? C.cactusHi : C.cactusL);
      p.px(cx + 0.5, y, C.cactusD);
      p.px(cx + r - 0.5, y, C.cactusDD);
      if (r >= 3) p.px(cx + r - 1.5, y, C.cactusD);
    }
    // Spines.
    for (let y = Math.ceil(top) + 2; y < bot - 1; y += 4) {
      p.px(cx - r - 0.5, y, '#e8e0b0');
      p.px(cx + r + 0.5, y + 2, '#c8c090');
    }
    p.px(cx - 0.5, top - 0.5, C.cactusHi);
  } else {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const cy = (y0 + y1) / 2;
    for (let x = Math.floor(left); x <= right; x++) {
      p.px(x, cy - r + 0.5, C.cactusHi);
      p.px(x, cy + r - 0.5, C.cactusDD);
    }
  }
}

// ------------------------------------------------------------------ cacti & plants

sprites.define({
  name: 'm2_saguaro',
  w: 28,
  h: 52,
  frames: 3,
  draw: (p, f) => {
    const cx = 14;
    if (f === 0) {
      cactusSeg(p, cx, 49, cx, 7, 3.5);
      // Right arm (high), left arm (low).
      p.capsule(cx + 2, 24, cx + 8, 24, 2.5, C.cactus);
      cactusSeg(p, cx + 8.5, 24, cx + 8.5, 12, 2.5);
      p.rect(cx + 3, 25, 4, 1, C.cactusD);
      p.rect(cx + 3, 22, 4, 1, C.cactusHi);
      p.capsule(cx - 2, 32, cx - 7, 32, 2.5, C.cactus);
      cactusSeg(p, cx - 7.5, 32, cx - 7.5, 21, 2.5);
      p.rect(cx - 6, 33, 3, 1, C.cactusD);
      p.rect(cx - 6, 30, 3, 1, C.cactusHi);
    } else if (f === 1) {
      cactusSeg(p, cx, 49, cx, 11, 3.5);
      p.capsule(cx - 2, 28, cx - 8, 28, 2.5, C.cactus);
      cactusSeg(p, cx - 8.5, 28, cx - 8.5, 17, 2.5);
      p.rect(cx - 7, 29, 4, 1, C.cactusD);
      p.rect(cx - 7, 26, 4, 1, C.cactusHi);
      // Stub arm on the right.
      p.capsule(cx + 2, 36, cx + 6, 34, 2.2, C.cactus);
      p.px(cx + 6, 32, C.cactusHi);
    } else {
      cactusSeg(p, cx, 49, cx, 22, 3);
      // Blossoms on top.
      p.px(cx - 1, 18, '#f0e0f0');
      p.px(cx, 18, '#e870a0');
      p.px(cx + 1, 19, '#f0e0f0');
      p.px(cx, 17, '#ffd0e0');
    }
    // Sand mound at the base.
    p.ellipse(cx, 50.5, 6, 1.8, C.sandL);
    p.rect(cx - 4, 50, 8, 1, C.sandHi);
  },
});

sprites.define({
  name: 'm2_cactus',
  w: 22,
  h: 16,
  frames: 4,
  draw: (p, f) => {
    if (f === 0) {
      // Barrel cactus with a flower crown.
      p.ellipse(11, 10, 6, 5.5, C.cactus);
      for (let x = 6; x <= 16; x += 2) for (let y = 6; y <= 14; y++) if (((x - 11) / 6) ** 2 + ((y - 10) / 5.5) ** 2 < 0.85) p.px(x, y, x < 11 ? C.cactusL : C.cactusD);
      p.px(8, 6, C.cactusHi);
      p.px(9, 5, C.cactusHi);
      p.rect(9, 4, 4, 1, '#f0b040');
      p.px(10, 3, '#ffd870');
      p.px(12, 3, '#e87830');
      p.rect(5, 15, 12, 1, C.sandL);
    } else if (f === 1) {
      // Prickly pear pads.
      const pad = (x: number, y: number, rx: number, ry: number) => {
        p.ellipse(x, y, rx, ry, C.cactus);
        p.ellipse(x - 1, y - 1, rx - 1.5, ry - 1.5, C.cactusL);
        p.px(x - 1, y - ry + 1, C.cactusHi);
        p.px(x + 1, y + 1, '#e8e0b0');
        p.px(x - 2, y + 2, '#e8e0b0');
      };
      pad(9, 11, 4, 4.5);
      pad(15, 9, 3.5, 4);
      pad(11, 5, 3, 3.5);
      p.px(11, 1, '#e04870');
      p.px(16, 4, '#e04870');
      p.rect(4, 15, 15, 1, C.sandL);
    } else if (f === 2) {
      // Dry sagebrush.
      for (const [x0, y0, x1, y1] of [
        [11, 15, 5, 6],
        [11, 15, 9, 4],
        [11, 15, 13, 3],
        [11, 15, 17, 6],
        [11, 15, 19, 10],
        [11, 15, 3, 10],
      ]) p.line(x0, y0, x1, y1, C.dryD);
      for (const [x, y] of [
        [5, 6],
        [9, 4],
        [13, 3],
        [17, 6],
        [19, 10],
        [3, 10],
        [7, 8],
        [15, 7],
        [11, 6],
      ]) {
        p.circle(x, y, 1.6, '#a8a060');
        p.px(x - 0.5, y - 0.5, '#c8c080');
      }
    } else {
      // Agave rosette.
      for (const [x1, y1] of [
        [2, 8],
        [5, 3],
        [9, 1],
        [13, 1],
        [17, 3],
        [20, 8],
      ]) {
        p.line(11, 15, x1, y1, '#7c9a78', 2);
        p.px(x1, y1, '#c0d0a8');
      }
      p.line(11, 15, 11, 2, '#94b08c', 2);
      p.rect(5, 15, 13, 1, C.sandL);
    }
  },
});

sprites.define({
  name: 'm2_palm',
  w: 46,
  h: 62,
  frames: 2,
  draw: (p, f) => {
    // Curving trunk with diamond bark.
    const tx = (y: number) => 20 + Math.sin((60 - y) / 26) * 6;
    for (let y = 60; y > 14; y--) {
      const x = tx(y);
      p.rect(x - 2, y, 5, 1, (y % 4) < 2 ? '#9a7450' : '#86623e');
      p.px(x - 2, y, '#b48c62');
      p.px(x + 2, y, '#5e4430');
      if (y % 4 === 0) p.rect(x - 1, y, 3, 1, '#6e5036');
    }
    const hx = tx(14);
    const hy = 13;
    const sway = f ? 1 : 0;
    // Date clusters.
    p.circle(hx - 3, hy + 4, 2.2, '#b0602c');
    p.circle(hx + 3, hy + 5, 2, '#9a4e24');
    p.px(hx - 4, hy + 3, '#d8884a');
    // Fronds: thick arching spines with leaflets hanging below.
    const fronds: Array<[number, number, number, number]> = [
      [-1, -0.15, 21, 0.55],
      [-0.85, -0.6, 17, 0.4],
      [-0.35, -1, 12, 0.15],
      [0.3, -1, 12, 0.15],
      [0.85, -0.55, 17, 0.4],
      [1, -0.1, 21, 0.55],
      [-0.95, 0.35, 14, 0.5],
      [0.95, 0.4, 14, 0.5],
    ];
    for (const [dx0, dy0, L, droop] of fronds) {
      const len = Math.hypot(dx0, dy0);
      const dx = dx0 / len + (dx0 > 0 ? sway * 0.05 : -sway * 0.03);
      const dy = dy0 / len;
      const n = Math.round(L);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = hx + dx * L * t;
        const y = hy + dy * L * t + droop * L * t * t + (sway && t > 0.5 ? 1 : 0);
        // Leaflets: longer near the middle, angled down and outward.
        if (i > 1 && i % 2 === 0) {
          const ll = 2 + Math.sin(t * Math.PI) * 3;
          p.line(x, y, x + Math.sign(dx || 1) * 1.2, y + ll, C.palmD);
          p.line(x, y, x - Math.sign(dx || 1) * 0.6, y + ll * 0.7, C.palm);
        }
        p.px(x, y, C.palm);
        p.px(x, y - 1, t < 0.85 ? C.palmL : C.palm);
        p.px(x, y + 1, C.palmD);
      }
    }
    p.circle(hx, hy, 2.5, C.palm);
    p.px(hx - 1, hy - 1, C.palmL);
  },
});

sprites.define({
  name: 'm2_reeds',
  w: 24,
  h: 18,
  frames: 2,
  draw: (p, f) => {
    const blades: Array<[number, number, number]> = [
      [4, 10, -2],
      [7, 15, -1],
      [10, 17, 0],
      [13, 14, 1],
      [16, 16, 2],
      [19, 11, 2],
      [9, 12, -1],
    ];
    blades.forEach(([x, h, lean], i) => {
      const sway = f ? (i % 2 ? 1 : 0) : 0;
      p.line(x, 17, x + lean + sway, 17 - h, i % 3 === 0 ? '#5a7a3c' : '#6e9446');
      p.px(x + lean + sway, 17 - h, '#9cc068');
    });
    // Cattail heads.
    p.rect(10, 1 + (f ? 0 : 0), 2, 4, '#7a4a2a');
    p.rect(16 + (f ? 1 : 0), 2, 2, 3, '#7a4a2a');
    p.px(10, 1, '#9a6a44');
  },
});

// ------------------------------------------------------------------ oil field

/** Pumpjack: 8-frame stroke of the walking beam with the crank turning. */
const PJ_W = 70;
const PJ_H = 46;
sprites.define({
  name: 'm2_pumpjack',
  w: PJ_W,
  h: PJ_H,
  frames: 8,
  draw: (p, f) => {
    const th = (f / 8) * TAU;
    const pivot = { x: 33, y: 13 };
    const crank = { x: 54, y: 32 };
    const pin = { x: crank.x + Math.cos(th) * 6, y: crank.y + Math.sin(th) * 6 };
    // Beam angle from the crank pin height (small angle model).
    const ang = (pin.y - crank.y) / 6 * 0.2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const beamPt = (d: number, off = 0) => ({ x: pivot.x + d * ca - off * sa, y: pivot.y + d * sa + off * ca });
    // Concrete pad.
    p.rect(2, 41, 66, 5, '#b4aa98');
    p.rect(2, 41, 66, 1, '#d4ccb8');
    p.rect(2, 45, 66, 1, '#8c8474');
    // Wellhead + polished rod at the left.
    const head = beamPt(-27, 2);
    p.rect(6, 33, 6, 8, C.steelD);
    p.rect(7, 33, 2, 8, C.steel);
    p.rect(5, 36, 8, 2, C.steelL);
    p.line(head.x - 2, head.y + 6, 9, 33, '#c8ccd0');
    // Samson post (A-frame).
    p.line(25, 41, pivot.x, pivot.y + 2, C.steelD, 3);
    p.line(41, 41, pivot.x, pivot.y + 2, C.steelD, 3);
    p.line(26, 40, pivot.x - 0.5, pivot.y + 3, C.steel, 1);
    p.rect(27, 29, 13, 2, C.steelD);
    p.rect(30, 22, 7, 1, C.steelD);
    // Gearbox + crank.
    p.rect(47, 26, 14, 15, C.oliveD);
    p.rect(48, 27, 12, 13, C.olive);
    p.rect(48, 27, 12, 1, C.oliveL);
    p.rect(58, 28, 2, 12, C.oliveD);
    p.rect(60, 35, 7, 6, C.steelD);
    p.rect(61, 36, 5, 2, C.steel);
    // Counterweights on the crank arm.
    p.line(crank.x, crank.y, pin.x, pin.y, C.steelDD, 3);
    const cw = { x: crank.x - Math.cos(th) * 5, y: crank.y - Math.sin(th) * 5 };
    p.circle(cw.x, cw.y, 5, C.steelDD);
    p.circle(cw.x - 0.8, cw.y - 0.8, 3.6, C.steelD);
    p.px(cw.x - 2, cw.y - 2, C.steel);
    p.circle(crank.x, crank.y, 1.5, C.steelL);
    // Pitman arm from the crank pin up to the beam end.
    const tail = beamPt(19, 1);
    p.line(pin.x, pin.y, tail.x, tail.y + 1, C.steelD, 2);
    // Walking beam.
    const a = beamPt(-24);
    const b = beamPt(22);
    p.line(a.x, a.y, b.x, b.y, C.rustD, 4);
    p.line(a.x, a.y - 1, b.x, b.y - 1, C.rustL, 1);
    for (let d = -20; d <= 20; d += 6) {
      const q = beamPt(d, 0.5);
      p.px(q.x, q.y, C.rust);
    }
    // Horse head (curved plate).
    const hh = beamPt(-25);
    p.poly([hh.x + 4, hh.y - 4, hh.x - 3, hh.y - 4, hh.x - 6, hh.y, hh.x - 4, hh.y + 7, hh.x + 1, hh.y + 5, hh.x + 4, hh.y + 2], C.rust);
    p.line(hh.x - 3, hh.y - 4, hh.x - 6, hh.y, C.rustL);
    p.px(hh.x, hh.y - 1, C.rustD);
    // Pivot bearing.
    p.circle(pivot.x, pivot.y + 1, 2, C.steelDD);
    p.px(pivot.x - 0.5, pivot.y + 0.5, C.steelL);
    // Hazard stripe on the gearbox guard.
    for (let i = 0; i < 6; i++) p.rect(48 + i * 2, 38, 1, 2, i % 2 ? C.ink : '#e0b030');
  },
});

/** Lattice oil derrick with a doghouse and a crown beacon. */
sprites.define({
  name: 'm2_derrick',
  w: 48,
  h: 104,
  frames: 2,
  draw: (p, f) => {
    const top = 6;
    const bot = 92;
    const lx = (y: number) => 7 + ((y - top) / (bot - top)) * 0; // eslint-disable-line
    void lx;
    const half = (y: number) => 4 + ((y - top) / (bot - top)) * 15;
    const cx = 24;
    // Legs.
    for (let y = top; y <= bot; y++) {
      const h = half(y);
      p.rect(cx - h - 1, y, 2, 1, C.steelD);
      p.rect(cx + h - 1, y, 2, 1, C.steelDD);
      p.px(cx - h - 1, y, C.steelL);
    }
    // Girts and X bracing.
    let prev = top;
    for (let y = top + 8; y <= bot; y += Math.round(6 + (y - top) * 0.08)) {
      const h0 = half(prev);
      const h1 = half(y);
      p.line(cx - h0, prev, cx + h1, y, C.steel);
      p.line(cx + h0, prev, cx - h1, y, C.steelD);
      p.rect(cx - h1, y, h1 * 2, 1, C.steelD);
      p.px(cx - h1, y, C.steelL);
      prev = y;
    }
    // Crown block + beacon.
    p.rect(cx - 6, top - 3, 12, 4, C.steelD);
    p.rect(cx - 6, top - 3, 12, 1, C.steelL);
    p.rect(cx - 1, top - 6, 2, 3, C.steelDD);
    p.px(cx - 0.5, top - 7, f ? '#ff4030' : '#802018');
    // Monkey board.
    p.rect(cx - 9, 34, 7, 2, C.woodD);
    // Rig floor + doghouse.
    p.rect(2, bot, 44, 4, C.woodD);
    p.rect(2, bot, 44, 1, C.woodL);
    p.rect(30, bot - 12, 14, 12, C.olive);
    p.rect(30, bot - 12, 14, 1, C.oliveL);
    p.rect(29, bot - 14, 16, 2, C.oliveD);
    p.rect(33, bot - 9, 4, 3, C.glass);
    p.px(33, bot - 9, '#d8f0f0');
    p.rect(39, bot - 8, 3, 8, C.oliveD);
    // Substructure legs.
    p.rect(4, bot + 4, 3, 8, C.steelD);
    p.rect(41, bot + 4, 3, 8, C.steelD);
    p.rect(22, bot + 4, 4, 8, C.steelDD);
    p.line(6, bot + 11, 23, bot + 5, C.steel);
    p.line(42, bot + 11, 25, bot + 5, C.steelD);
    // Traveling block + cable.
    p.rect(cx, top + 1, 1, 46, '#a0a8b0');
    p.rect(cx - 2, top + 47, 5, 5, C.steelDD);
    p.px(cx - 1, top + 48, C.steelL);
    p.rect(cx, top + 52, 1, bot - top - 52, '#a0a8b0');
  },
});

/** Squat oil storage tank (decor, behind the action). */
sprites.define({
  name: 'm2_tank',
  w: 64,
  h: 44,
  draw: (p) => {
    p.rect(2, 8, 60, 34, C.steelL);
    p.ellipse(32, 8, 30, 4, C.steelHi);
    p.ellipse(32, 8, 26, 2.5, C.steelL);
    // Vertical shading (light from the left).
    for (let x = 2; x < 62; x++) {
      const t = (x - 2) / 60;
      const c = t < 0.12 ? C.steelHi : t < 0.55 ? C.steelL : t < 0.85 ? C.steel : C.steelD;
      p.rect(x, 9, 1, 33, c);
    }
    // Plate seams + rust streaks.
    for (const y of [17, 26, 35]) p.rect(2, y, 60, 1, C.steelD);
    for (const x of [14, 31, 47]) {
      p.rect(x, 9, 1, 33, mixColor(C.steelD, C.steel, 0.5));
      p.rect(x + 1, 12, 1, 9, C.rust);
      p.rect(x + 1, 21, 1, 4, C.rustD);
    }
    // Legion stencil band.
    p.rect(2, 20, 60, 5, C.olive);
    p.rect(2, 20, 60, 1, C.oliveL);
    p.circle(22, 22.5, 2, '#d8b030');
    p.circle(22, 22.5, 0.9, C.olive);
    signText(p, 27, 20, 'OIL', '#e8d8a0');
    // Spiral stair.
    p.line(50, 42, 60, 30, C.steelDD, 2);
    p.line(48, 30, 58, 18, C.steelDD, 2);
    // Base.
    p.rect(0, 40, 64, 4, '#a49a88');
    p.rect(0, 40, 64, 1, '#c8c0ac');
  },
});

/** Oil drums: 0 = two upright + one lying, 1 = tipped and leaking, 2 = pyramid. */
sprites.define({
  name: 'm2_drums',
  w: 34,
  h: 24,
  frames: 3,
  draw: (p, f) => {
    const drum = (x: number, y: number, col: string) => {
      // Upright drum: 9 x 12 with ribs.
      p.rect(x, y, 9, 12, col);
      p.rect(x, y, 2, 12, shade(col, 0.25));
      p.rect(x + 7, y, 2, 12, shade(col, -0.3));
      p.rect(x, y + 3, 9, 1, shade(col, -0.35));
      p.rect(x, y + 8, 9, 1, shade(col, -0.35));
      p.rect(x, y, 9, 1, shade(col, 0.4));
      p.px(x + 2, y + 5, C.rust);
      p.px(x + 6, y + 10, C.rust);
    };
    const lying = (x: number, y: number, col: string) => {
      p.rect(x, y, 13, 8, col);
      p.rect(x, y, 13, 2, shade(col, 0.25));
      p.rect(x, y + 6, 13, 2, shade(col, -0.3));
      p.rect(x + 4, y, 1, 8, shade(col, -0.35));
      p.rect(x + 9, y, 1, 8, shade(col, -0.35));
      p.ellipse(x + 13, y + 4, 2, 4, shade(col, -0.15));
      p.px(x + 13, y + 3, C.steelDD);
    };
    const blue = '#4a6a8a';
    const olive = C.olive;
    if (f === 0) {
      drum(2, 12, blue);
      drum(12, 12, olive);
      lying(20, 16, blue);
    } else if (f === 1) {
      lying(8, 16, olive);
      // Oil puddle.
      p.ellipse(4, 23, 5, 1.2, C.oil);
      p.px(2, 23, C.oilHi);
      drum(22, 12, blue);
    } else {
      drum(4, 12, blue);
      drum(14, 12, olive);
      drum(9, 0, blue);
      drum(24, 12, '#7a6a4a');
    }
  },
});

// ------------------------------------------------------------------ ruins

sprites.define({
  name: 'm2_column',
  w: 36,
  h: 60,
  frames: 3,
  draw: (p, f) => {
    const cx = 18;
    const shaft = (y0: number, y1: number) => {
      for (let y = y0; y < y1; y++) {
        p.rect(cx - 5, y, 11, 1, C.stone);
        p.px(cx - 5, y, C.stoneHi);
        p.px(cx - 4, y, C.stoneL);
        p.px(cx - 1, y, C.stoneL);
        p.px(cx + 2, y, C.stoneM);
        p.px(cx + 4, y, C.stoneD);
        p.px(cx + 5, y, C.stoneDD);
      }
      // Drum joints + chips.
      for (let y = y0 + 9; y < y1 - 2; y += 10) {
        p.rect(cx - 5, y, 11, 1, C.stoneM);
        p.px(cx + 3, y + 1, C.stoneD);
      }
    };
    if (f === 0) {
      // Base.
      p.rect(cx - 8, 54, 17, 6, C.stoneM);
      p.rect(cx - 8, 54, 17, 1, C.stoneL);
      p.rect(cx - 7, 51, 15, 3, C.stone);
      p.rect(cx - 7, 51, 15, 1, C.stoneHi);
      shaft(11, 51);
      // Capital.
      p.rect(cx - 7, 8, 15, 3, C.stone);
      p.rect(cx - 9, 4, 19, 4, C.stoneL);
      p.rect(cx - 9, 4, 19, 1, C.stoneHi);
      p.rect(cx - 9, 7, 19, 1, C.stoneD);
      p.px(cx - 8, 9, C.stoneD);
      p.px(cx + 8, 9, C.stoneD);
      // Carved glyph.
      p.ring(cx, 30, 2.5, C.stoneD);
      p.px(cx, 30, C.stoneD);
    } else if (f === 1) {
      p.rect(cx - 8, 54, 17, 6, C.stoneM);
      p.rect(cx - 8, 54, 17, 1, C.stoneL);
      p.rect(cx - 7, 51, 15, 3, C.stone);
      p.rect(cx - 7, 51, 15, 1, C.stoneHi);
      shaft(30, 51);
      // Jagged break.
      p.poly([cx - 5, 30, cx - 3, 26, cx - 1, 29, cx + 1, 25, cx + 3, 28, cx + 5, 27, cx + 5, 31, cx - 5, 31], C.stone);
      p.line(cx - 4, 27, cx - 3, 26, C.stoneHi);
      p.line(cx + 1, 25, cx + 2, 26, C.stoneHi);
      // Crack.
      p.line(cx + 1, 33, cx - 1, 40, C.stoneD);
      // Fallen drum.
      p.rect(cx + 9, 53, 9, 7, C.stone);
      p.rect(cx + 9, 53, 9, 1, C.stoneHi);
      p.rect(cx + 16, 53, 2, 7, C.stoneD);
    } else {
      // Toppled drums lying in the sand.
      for (const [x, w] of [
        [3, 11],
        [15, 9],
        [25, 9],
      ]) {
        p.rect(x, 50, w, 9, C.stone);
        p.rect(x, 50, w, 1, C.stoneHi);
        p.rect(x, 51, w, 1, C.stoneL);
        p.rect(x, 57, w, 2, C.stoneD);
        p.rect(x + w - 1, 50, 1, 9, C.stoneM);
      }
      p.rect(0, 58, 36, 2, C.sandL);
    }
  },
});

sprites.define({
  name: 'm2_ruinwall',
  w: 72,
  h: 50,
  frames: 2,
  draw: (p, f) => {
    // Masonry courses with a ragged top profile.
    const prof =
      f === 0
        ? (x: number) => (x < 8 ? 22 + x : x < 30 ? 4 + Math.abs(x - 19) * 0.2 : x < 46 ? 2 : x < 56 ? 12 + (x - 46) : 26 + (x - 56) * 0.4)
        : (x: number) => (x < 20 ? 26 - x * 0.3 : x < 40 ? 18 + Math.sin(x) * 2 : 24 + (x - 40) * 0.5);
    for (let x = 0; x < 72; x++) {
      const top = Math.round(prof(x));
      for (let y = top; y < 50; y++) {
        const row = Math.floor(y / 6);
        const off = row % 2 ? 6 : 0;
        const joint = y % 6 === 5 || (x + off) % 12 === 11;
        let c = joint ? C.stoneD : (x + off) % 12 < 2 ? C.stoneL : C.stone;
        if (y === top) c = C.stoneHi;
        if ((x * 7 + y * 3) % 31 === 0 && !joint) c = C.stoneM;
        p.px(x, y, c);
      }
    }
    if (f === 0) {
      // Arched window.
      for (let y = 14; y < 34; y++) {
        for (let x = 33; x < 45; x++) {
          const inArch = y >= 20 ? true : (x - 39) * (x - 39) + (y - 20) * (y - 20) * 1.2 < 36;
          if (inArch) p.px(x, y, C.stoneDD);
        }
      }
      p.rect(33, 34, 12, 2, C.stoneL);
      p.rect(33, 34, 12, 1, C.stoneHi);
      p.rect(44, 18, 1, 16, C.stoneM);
      // Carved sun disc.
      p.ring(19, 22, 5, C.stoneD);
      p.circle(19, 22, 2.5, C.stoneM);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        p.px(19 + Math.cos(a) * 7, 22 + Math.sin(a) * 7, C.stoneD);
      }
    } else {
      // Doorway with a lintel.
      p.rect(26, 26, 12, 24, C.stoneDD);
      p.rect(24, 23, 16, 3, C.stoneL);
      p.rect(24, 23, 16, 1, C.stoneHi);
      p.rect(24, 25, 16, 1, C.stoneD);
    }
    // Sand drift at the foot.
    p.ellipse(10, 50, 14, 3, C.sandL);
    p.ellipse(58, 50, 16, 4, C.sandL);
    p.rect(0, 49, 72, 1, C.sand);
  },
});

// ------------------------------------------------------------------ remains & clutter

sprites.define({
  name: 'm2_bones',
  w: 30,
  h: 16,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      // Longhorn skull lying on the sand.
      p.ellipse(15, 10, 5, 4, C.bone);
      p.rect(13, 12, 5, 3, C.bone);
      p.rect(14, 14, 3, 1, C.boneD);
      p.circle(13, 9.5, 1.2, C.boneDD);
      p.circle(17, 9.5, 1.2, C.boneDD);
      p.px(15, 12, C.boneDD);
      // Horns.
      p.line(10, 8, 4, 6, C.bone, 2);
      p.line(4, 6, 1, 3, C.boneD);
      p.line(20, 8, 26, 6, C.bone, 2);
      p.line(26, 6, 29, 3, C.boneD);
      p.px(12, 7, '#ffffff');
      p.rect(8, 15, 14, 1, C.sandM);
    } else {
      // Rib cage.
      p.line(3, 13, 26, 13, C.boneD, 2);
      for (let i = 0; i < 6; i++) {
        const x = 6 + i * 3.6;
        const h = 9 - Math.abs(i - 2.5) * 1.2;
        for (let k = 0; k <= h; k++) p.px(x + Math.sin((k / h) * 1.5) * 2, 13 - k, k > h - 2 ? C.boneD : C.bone);
      }
      p.px(3, 12, C.bone);
      p.rect(1, 15, 28, 1, C.sandM);
    }
  },
});

sprites.define({
  name: 'm2_wreck',
  w: 64,
  h: 28,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      // Abandoned pickup: faded teal paint, rust, no tires.
      const paint = '#5a8c88';
      const paintL = '#7cb0a8';
      const paintD = '#3e6460';
      p.poly([4, 14, 8, 11, 36, 11, 38, 3, 52, 3, 58, 11, 62, 13, 62, 22, 4, 22], paint);
      p.rect(4, 14, 58, 1, paintL);
      p.line(38, 3, 52, 3, paintL);
      p.rect(4, 20, 58, 2, paintD);
      // Cab window (smashed).
      p.poly([40, 5, 50, 5, 54, 11, 40, 11], C.glassD);
      p.line(41, 6, 44, 10, C.glass);
      p.px(48, 7, C.glass);
      // Rust patches + holes.
      for (const [x, y, w, h] of [
        [10, 16, 6, 3],
        [24, 15, 4, 4],
        [55, 15, 5, 3],
        [44, 13, 3, 2],
      ]) {
        p.rect(x, y, w, h, C.rust);
        p.px(x, y, C.rustL);
      }
      for (const [x, y] of [
        [20, 17],
        [33, 16],
        [48, 17],
      ])
        p.px(x, y, C.ink);
      // Bed rails.
      p.rect(6, 11, 30, 1, paintD);
      p.rect(36, 4, 2, 18, paintD);
      // Wheel rims sunk in the sand.
      for (const x of [14, 50]) {
        p.circle(x, 23, 4.5, C.steelDD);
        p.circle(x, 23, 2.5, C.steel);
        p.px(x - 1, 22, C.steelL);
      }
      p.ellipse(32, 27, 31, 2.5, C.sandL);
      p.rect(2, 26, 60, 2, C.sandL);
    } else {
      // Burnt-out jeep frame.
      p.poly([6, 16, 10, 10, 30, 10, 34, 6, 42, 6, 46, 12, 56, 13, 58, 22, 6, 22], '#4a3c3a');
      p.rect(6, 16, 52, 1, '#6a5650');
      p.rect(30, 6, 1, 6, '#2a2026');
      for (const [x, y] of [
        [14, 14],
        [22, 18],
        [40, 15],
        [50, 18],
      ])
        p.px(x, y, C.rust);
      for (const x of [16, 48]) {
        p.circle(x, 23, 4.5, C.steelDD);
        p.circle(x, 23, 2, '#3a3a40');
      }
      p.rect(2, 26, 60, 2, C.sandL);
    }
  },
});

/** Legion canvas tent: 2 frames of the door flap stirring in the wind. */
sprites.define({
  name: 'm2_tent',
  w: 52,
  h: 32,
  frames: 2,
  draw: (p, f) => {
    // Ridge pole tent seen from the side-front.
    p.poly([4, 30, 22, 4, 30, 4, 48, 30], C.canvas);
    p.poly([4, 30, 22, 4, 24, 4, 8, 30], C.canvasL);
    p.poly([36, 30, 30, 4, 34, 8, 48, 30], C.canvasD);
    p.rect(22, 3, 8, 2, C.canvasD);
    // Rust stripe + seams.
    p.line(8, 24, 44, 24, C.rust, 2);
    p.line(14, 16, 38, 16, C.canvasD);
    // Door: dark opening with a flap.
    p.poly([20, 30, 26, 12, 32, 30], '#3a2c22');
    if (f === 0) p.poly([26, 12, 32, 30, 35, 30, 28, 14], C.canvasL);
    else p.poly([26, 12, 33, 30, 37, 29, 29, 13], C.canvasL);
    // Guy ropes and pegs.
    p.line(4, 30, 0, 31, C.woodD);
    p.line(48, 30, 51, 31, C.woodD);
    p.rect(25, 0, 2, 4, C.woodD);
    // Legion cog emblem.
    p.circle(14, 20, 2, '#d8b030');
    p.circle(14, 20, 0.9, C.canvas);
  },
});

/** Windmill water pump tower (static part). */
sprites.define({
  name: 'm2_windpump',
  w: 30,
  h: 78,
  draw: (p) => {
    const cx = 15;
    const top = 16;
    const bot = 76;
    const half = (y: number) => 2 + ((y - top) / (bot - top)) * 11;
    for (let y = top; y <= bot; y++) {
      const h = half(y);
      p.px(cx - h, y, C.woodL);
      p.px(cx - h + 1, y, C.wood);
      p.px(cx + h, y, C.woodD);
      p.px(cx + h - 1, y, C.wood);
    }
    for (let y = top + 10; y <= bot - 2; y += 12) {
      const h = half(y);
      p.rect(cx - h, y, h * 2, 1, C.wood);
      const h2 = half(y + 12);
      p.line(cx - h, y, cx + h2, Math.min(bot, y + 12), C.woodD);
    }
    // Pump rod and the trough tank at the foot.
    p.rect(cx, top, 1, bot - top, '#9aa0a6');
    p.rect(cx - 14, 66, 9, 10, C.steelD);
    p.rect(cx - 14, 66, 9, 1, C.steelL);
    p.rect(cx - 13, 67, 7, 2, C.water);
    // Head + tail vane.
    p.rect(cx - 3, top - 4, 7, 5, C.steelD);
    p.rect(cx - 3, top - 4, 7, 1, C.steelL);
    p.line(cx + 3, top - 2, cx + 12, top - 2, C.steelD, 2);
    p.poly([cx + 9, top - 9, cx + 14, top - 9, cx + 14, top + 4, cx + 9, top + 1], C.rustL);
    p.rect(cx + 9, top - 9, 5, 1, '#e8a070');
    p.px(cx + 11, top - 5, C.rustD);
  },
});

/** Windmill wheel (4 rotation frames, hub at the sprite center). */
sprites.define({
  name: 'm2_windwheel',
  w: 30,
  h: 30,
  ox: 15,
  oy: 15,
  frames: 4,
  draw: (p, f) => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (f / 4) * (TAU / n);
      const x0 = 15 + Math.cos(a) * 4;
      const y0 = 15 + Math.sin(a) * 4;
      const x1 = 15 + Math.cos(a) * 13;
      const y1 = 15 + Math.sin(a) * 13;
      p.line(x0, y0, x1, y1, i % 2 ? '#c8ccd0' : '#9aa2aa', 2);
    }
    p.ring(15, 15, 13.5, C.steelD);
    p.circle(15, 15, 3, C.steelDD);
    p.px(14, 14, C.steelL);
  },
});

/** Legion banner on a pole, flapping (4 frames). */
sprites.define({
  name: 'm2_flag',
  w: 26,
  h: 48,
  frames: 4,
  draw: (p, f) => {
    p.rect(2, 2, 2, 46, C.steelD);
    p.px(2, 2, C.steelL);
    p.rect(1, 0, 4, 2, '#d8b030');
    for (let x = 0; x < 20; x++) {
      const wave = Math.round(Math.sin(x * 0.45 - f * (TAU / 4)) * 1.4 * (x / 20));
      for (let y = 0; y < 12; y++) {
        const c = y === 0 ? C.redL : y >= 10 ? '#8a2a22' : C.red;
        p.px(4 + x, 4 + y + wave, x > 17 && (y + f) % 4 === 0 ? '#8a2a22' : c);
      }
    }
    // Emblem: yellow cog.
    const ex = 12;
    const ey = 10 + Math.round(Math.sin(8 * 0.45 - f * (TAU / 4)) * 0.6);
    p.circle(ex, ey, 3, '#d8b030');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      p.px(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4, '#d8b030');
    }
    p.circle(ex, ey, 1.2, C.red);
  },
});

/** Signs: 0 DUSTWIND, 1 BRIDGE >, 2 DANGER (skull), 3 KEEP OUT, 4 SALT FLAT, 5 OASIS >. */
const SIGNS = ['DUSTWIND', 'BRIDGE>', 'DANGER', 'KEEP OUT', 'SALT FLAT', 'OASIS>'];
sprites.define({
  name: 'm2_sign',
  w: 48,
  h: 32,
  frames: SIGNS.length,
  draw: (p, f) => {
    const text = SIGNS[f];
    const tw = textWidth(text);
    const metal = f === 2 || f === 3;
    const bw = tw + (f === 2 ? 14 : 6);
    const bh = f === 2 ? 12 : 9;
    const x0 = Math.round(24 - bw / 2);
    const y0 = 4;
    const twoPosts = bw > 30;
    // Posts.
    const postC = metal ? C.steelD : C.woodD;
    if (twoPosts) {
      p.rect(x0 + 3, y0, 2, 32 - y0, postC);
      p.rect(x0 + bw - 5, y0, 2, 32 - y0, postC);
      p.px(x0 + 3, y0 + bh, metal ? C.steel : C.wood);
    } else p.rect(23, y0, 2, 32 - y0, postC);
    // Board.
    const face = f === 2 ? '#e8e0d0' : f === 3 ? C.olive : '#c8a066';
    const faceL = f === 2 ? '#ffffff' : f === 3 ? C.oliveL : '#dcb47c';
    const faceD = f === 2 ? '#b8b0a0' : f === 3 ? C.oliveD : '#9a7444';
    if (f === 1 || f === 5) {
      // Arrow-shaped board.
      p.poly([x0, y0, x0 + bw, y0, x0 + bw + 5, y0 + bh / 2, x0 + bw, y0 + bh, x0, y0 + bh], face);
      p.line(x0, y0, x0 + bw, y0, faceL);
    } else {
      p.rect(x0, y0, bw, bh, face);
      p.rect(x0, y0, bw, 1, faceL);
      p.rect(x0, y0 + bh - 1, bw, 1, faceD);
    }
    if (!metal) for (let x = x0 + 5; x < x0 + bw; x += 9) p.px(x, y0 + bh - 2, faceD);
    if (f === 2) {
      p.rect(x0, y0, bw, 1, C.red);
      p.rect(x0, y0 + bh - 1, bw, 1, C.red);
      // Skull.
      p.circle(x0 + 5, y0 + 5, 2.6, '#2a2026');
      p.rect(x0 + 4, y0 + 7, 3, 2, '#2a2026');
      p.px(x0 + 4, y0 + 5, face);
      p.px(x0 + 6, y0 + 5, face);
      signText(p, x0 + 10, y0 + 3, text, C.red);
    } else {
      signText(p, x0 + 3, y0 + 2, text, f === 3 ? '#e8d8a0' : '#4a2c18');
    }
    if (f === 3) {
      p.px(x0 + 1, y0 + 1, C.rust);
      p.px(x0 + bw - 2, y0 + bh - 2, C.rust);
    }
    // Weathering cracks.
    if (f === 0 || f === 4) {
      p.px(x0 + bw - 4, y0 + 1, faceD);
      p.px(x0 + bw - 3, y0 + 2, faceD);
    }
  },
});

/** Red-rock boulders: 0 pair, 1 scatter, 2 tall spire rock. */
sprites.define({
  name: 'm2_rocks',
  w: 44,
  h: 34,
  frames: 3,
  draw: (p, f) => {
    const boulder = (cx: number, cy: number, rx: number, ry: number) => {
      p.ellipse(cx, cy, rx, ry, C.rock);
      p.ellipse(cx - rx * 0.25, cy - ry * 0.3, rx * 0.7, ry * 0.55, C.rockL);
      p.ellipse(cx - rx * 0.4, cy - ry * 0.5, rx * 0.3, ry * 0.25, C.rockHi);
      p.ellipse(cx + rx * 0.45, cy + ry * 0.35, rx * 0.45, ry * 0.4, C.rockD);
      // Strata line.
      p.line(cx - rx + 1, cy + 1, cx + rx - 1, cy + 2, C.rockM);
    };
    if (f === 0) {
      boulder(16, 25, 13, 9);
      boulder(32, 28, 9, 6);
      p.rect(2, 33, 40, 1, C.sandM);
    } else if (f === 1) {
      boulder(10, 29, 7, 5);
      boulder(24, 30, 5, 4);
      boulder(34, 31, 4, 3);
      p.rect(2, 33, 40, 1, C.sandM);
    } else {
      // Spire: stacked strata blocks narrowing upward.
      const rows: Array<[number, number]> = [
        [33, 13],
        [28, 12],
        [23, 10],
        [18, 9],
        [13, 8],
        [8, 9],
        [4, 11],
      ];
      for (const [y, hw] of rows) {
        p.rect(22 - hw, y - 5, hw * 2, 6, C.rock);
        p.rect(22 - hw, y - 5, hw * 2, 1, C.rockL);
        p.rect(22 - hw, y - 5, 2, 6, C.rockL);
        p.rect(22 + hw - 3, y - 5, 3, 6, C.rockD);
        p.rect(22 - hw, y, hw * 2, 1, C.rockM);
      }
      p.rect(11, 0, 22, 2, C.rockL);
      p.rect(11, 0, 22, 1, C.rockHi);
    }
  },
});

/** Tumbleweed (4 rolling frames). */
sprites.define({
  name: 'm2_tumble',
  w: 14,
  h: 13,
  frames: 4,
  draw: (p, f) => {
    const a0 = (f / 4) * (Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const a = a0 + (i / 9) * TAU;
      const b = a + 2.3;
      p.line(7 + Math.cos(a) * 5.5, 6.5 + Math.sin(a) * 5, 7 + Math.cos(b) * 5, 6.5 + Math.sin(b) * 5.5, i % 2 ? C.dryD : C.dry);
    }
    p.ring(7, 6.5, 5.5, '#b89c58');
    p.px(5, 4, '#e0cc88');
  },
});

/** Vulture perched on a post or bones (2 frames: head turn). */
sprites.define({
  name: 'm2_vulture',
  w: 14,
  h: 14,
  frames: 2,
  draw: (p, f) => {
    p.ellipse(7, 8, 4, 4.5, '#3a2c30');
    p.ellipse(6, 7, 2.5, 3, '#4e3c40');
    p.rect(5, 12, 1, 2, '#c8a070');
    p.rect(8, 12, 1, 2, '#c8a070');
    // Neck ruff + bare head.
    p.rect(8, 3, 3, 2, '#e8e0d0');
    const hx = f ? 11 : 9;
    p.rect(hx, 1, 3, 3, '#d87060');
    p.px(hx + (f ? 3 : -1), 2, '#e8d8a0');
    p.px(hx + 1, 1, C.ink);
  },
});
