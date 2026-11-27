// Mission 4 (RUSTWATER DOCKS) decor: the props of a rainy harbour at dusk.
//  - Fixed-size pieces are sprites (auto outline, reviewable with scripts/spritesheet.ts, prefix m4d_).
//  - Variable-size pieces (containers, warehouse facades, canal walls, ship hulls, fences, the dry
//    dock wall) are procedural PixelArt baked lazily into canvases on first draw (never at import).
//  - Light sources (lamps, burning barrels, windows) add soft pixel glows at draw time.
// Decor kinds (LevelDef.decor kind -> props):
//   lamp {flip, off}            harbour lamp post with two lanterns (warm glow, rare flicker)
//   bollard {rope}              cast-iron mooring bollard (rope = coil + line to the water)
//   tires {small}               stacked tyres          fender {}  tyre fender hung on a quay face
//   net {flip}                  fishing-net heap with floats and a fish crate
//   wreck {flip}                rusted, smashed car
//   firebarrel {}               burning oil drum (animated, glows)
//   crates {flip}               crates on a pallet
//   sign {v: dock|warn|legion|welcome|arrow, text}
//   crane {cable, flip, w}      portal jib crane on the quay (behind terrain), swinging hook
//   container {w,h,c,doors,mark,seed}  shipping container (skin for solids or background stacks)
//   warehouse {w,h,door,name,seed}     brick warehouse facade (behind terrain)
//   canal {w, water}            far canal wall + dark water body (behind terrain, fills a pit)
//   ship {w,h,name,dock}        ship hull side (behind terrain; dock = under construction)
//   fence {w}                   chain-link fence with barbed wire
//   drydock {w, floor}          back wall of the dry dock (behind terrain)
//   keelblocks {w}              timber keel blocks on the dry dock floor
//   deepwater {w, depth}        dark open water body under a surface (behind terrain)
//   openharbour {w}             background zone: near rooftops fade to the open harbour
// Decor is drawn in world space with (d.x, d.y) = bottom-centre (on the ground) unless noted.

import { sprites } from '../../../engine/sprites';
import { PixelArt, shade } from '../../../engine/pixelart';
import { glyphRows } from '../../../engine/font';
import { Rng } from '../../../engine/rng';
import type { DecorRenderer } from '../../../game/theme';
import { P4, hash01 } from './art';

// ------------------------------------------------------------------ palette

export const D4 = {
  ink: '#140c1c',
  iron: '#3a3648',
  ironL: '#5c586e',
  ironH: '#8a86a0',
  ironD: '#26222f',
  rust: '#7a3e2a',
  rustL: '#a05a36',
  rustD: '#4a2622',
  conc: '#6e6a82',
  concL: '#8e8aa2',
  concD: '#4a465c',
  rubber: '#26222a',
  rubberL: '#4a4652',
  rope: '#a08a5a',
  ropeD: '#6a5a3a',
  glass: '#ffd690',
  glassL: '#fff2c8',
  glow: '#ffb868',
  fire: ['#fff4b0', '#ffc848', '#ff8a24', '#d8401c'],
  net: '#3e4e48',
  netL: '#5e7062',
  float: '#e0602e',
  car: '#46626c',
  carL: '#6a8a92',
  carD: '#2c3e46',
  crane: '#8a6034',
  craneL: '#b07e46',
  craneD: '#563a22',
  hull: '#2c2836',
  hullL: '#423c4e',
  boot: '#7a2e2a',
  wood: P4.wood,
  woodL: P4.woodL,
  woodD: P4.woodD,
} as const;

export const CONTAINER_COLORS: Record<string, string> = {
  red: '#8a3c34',
  blue: '#36587a',
  green: '#3c6a4c',
  orange: '#a8622c',
  teal: '#2c6a6e',
  grey: '#5e5e6e',
  yellow: '#a08a3a',
  purple: '#5a3e6a',
};

const T0 = 'transparent';

// ------------------------------------------------------------------ helpers

/** Stencil text in the 5x7 font into PixelArt. Returns the width. */
export function stencil(p: PixelArt, text: string, x: number, y: number, c: string, rough = 0, seed = 1): number {
  const r = new Rng(seed);
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += 4;
      continue;
    }
    const rows = glyphRows(ch);
    if (rows) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#' && !(rough > 0 && r.chance(rough))) p.px(cx + rx, y + ry, c);
      });
    }
    cx += 6;
  }
  return cx - x - 1;
}

export function stencilWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 4 : 6;
  return Math.max(0, w - 1);
}

/** Pixelated soft glow: stacked translucent discs. */
export function glow(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number): void {
  const disc = (rr: number, aa: number) => {
    if (rr < 1 || aa <= 0) return;
    g.globalAlpha = aa;
    g.fillStyle = color;
    for (let dy = -rr; dy <= rr; dy++) {
      const hw = Math.floor(Math.sqrt(rr * rr - dy * dy));
      g.fillRect(Math.round(cx) - hw, Math.round(cy) + dy, hw * 2 + 1, 1);
    }
  };
  disc(r, a * 0.22);
  disc(Math.round(r * 0.66), a * 0.3);
  disc(Math.round(r * 0.36), a * 0.45);
  g.globalAlpha = 1;
}

/** Flat pool of light on the ground (pixel ellipse). */
function lightPool(g: CanvasRenderingContext2D, cx: number, y: number, rx: number, color: string, a: number): void {
  g.globalAlpha = a;
  g.fillStyle = color;
  for (let dy = -1; dy <= 1; dy++) {
    const hw = Math.round(rx * Math.sqrt(1 - (dy * dy) / 4));
    g.fillRect(Math.round(cx) - hw, Math.round(y) + dy, hw * 2 + 1, 1);
  }
  g.globalAlpha = 1;
}

/** Lamp flicker: mostly steady, rare short dips (deterministic in time). */
function flicker(time: number, seed: number): number {
  const n = Math.floor(time * 11 + seed * 7.3);
  return hash01(n, Math.round(seed * 97)) < 0.025 ? 0.35 : 1;
}

function def(name: string, w: number, h: number, draw: (p: PixelArt, f: number) => void, frames = 1, ox?: number, oy?: number): void {
  sprites.define({ name, w, h, frames, ox, oy, draw });
}

const bakeCache = new Map<string, HTMLCanvasElement>();
function baked(key: string, make: () => PixelArt): HTMLCanvasElement {
  let c = bakeCache.get(key);
  if (!c) {
    c = make().toCanvas();
    bakeCache.set(key, c);
  }
  return c;
}

const num = (v: unknown, dflt: number) => (typeof v === 'number' && isFinite(v) ? v : dflt);

// ------------------------------------------------------------------ fixed-size sprites

// Harbour lamp post: fluted iron pole, scrolled cross-arm, two lanterns. Frame 1 = lamps dark.
const LAMP_W = 19;
const LAMP_H = 56;
def(
  'm4d_lamp',
  LAMP_W,
  LAMP_H,
  (p, f) => {
    const { iron, ironL, ironH, ironD } = D4;
    const B = LAMP_H - 1;
    // Base plinth with a flared foot.
    p.rect(4, B - 3, 11, 4, iron);
    p.rect(4, B - 3, 11, 1, ironL);
    p.rect(14, B - 2, 1, 3, ironD);
    p.rect(6, B - 9, 7, 6, iron);
    p.rect(6, B - 9, 1, 6, ironL);
    p.rect(12, B - 9, 1, 6, ironD);
    p.rect(6, B - 9, 7, 1, ironH);
    // Fluted pole.
    p.rect(8, 13, 3, B - 21, iron);
    p.rect(8, 13, 1, B - 21, ironL);
    p.rect(10, 13, 1, B - 21, ironD);
    // Collars.
    p.rect(7, B - 12, 5, 2, iron);
    p.rect(7, B - 12, 5, 1, ironL);
    p.rect(7, 26, 5, 1, ironL);
    p.rect(7, 27, 5, 1, ironD);
    // Finial.
    p.rect(9, 5, 1, 6, iron);
    p.circle(9, 4, 1.5, ironL);
    p.px(8, 3, ironH);
    // Cross-arm with scroll brackets.
    p.rect(2, 10, 15, 2, iron);
    p.rect(2, 10, 15, 1, ironL);
    p.px(5, 12, iron);
    p.px(6, 13, iron);
    p.px(7, 14, iron);
    p.px(13, 12, iron);
    p.px(12, 13, iron);
    p.px(11, 14, iron);
    // Lanterns.
    for (const lx of [0, 14]) {
      p.px(lx + 2, 12, ironD);
      p.rect(lx + 1, 13, 3, 1, iron);
      p.rect(lx, 14, 5, 1, ironL);
      const lit = f === 0;
      p.rect(lx, 15, 5, 5, lit ? D4.glass : '#5a4a46');
      if (lit) {
        p.rect(lx, 15, 1, 5, D4.glassL);
        p.px(lx + 1, 15, D4.glassL);
      }
      p.rect(lx + 2, 15, 1, 5, lit ? '#e0a860' : ironD);
      p.rect(lx, 20, 5, 1, iron);
      p.px(lx + 2, 21, ironD);
    }
  },
  2,
  9,
  LAMP_H,
);

// Mooring bollard; frame 1 has a rope coil with a line running off toward the water.
def(
  'm4d_bollard',
  14,
  11,
  (p, f) => {
    const { iron, ironL, ironH, ironD } = D4;
    p.rect(2, 8, 9, 3, iron);
    p.rect(2, 8, 9, 1, ironL);
    p.rect(4, 3, 5, 6, iron);
    p.rect(4, 3, 1, 6, ironL);
    p.rect(8, 3, 1, 6, ironD);
    p.rect(2, 1, 9, 3, iron);
    p.rect(3, 0, 7, 1, iron);
    p.rect(3, 1, 6, 1, ironH);
    p.rect(2, 3, 9, 1, ironD);
    if (f === 1) {
      p.rect(3, 5, 7, 2, D4.rope);
      p.px(4, 5, D4.ropeD);
      p.px(6, 6, D4.ropeD);
      p.px(8, 5, D4.ropeD);
      p.line(10, 6, 13, 10, D4.rope);
      p.px(11, 8, D4.ropeD);
    }
  },
  2,
  6,
  11,
);

// Stacked tyres (frame 0: four high, frame 1: a pair).
def(
  'm4d_tires',
  20,
  25,
  (p, f) => {
    const { rubber, rubberL, ink } = D4;
    const offs = f === 0 ? [2, 3, 1, 2] : [2, 3];
    offs.forEach((ox, i) => {
      const y = 25 - 6 * (i + 1);
      p.rect(ox + 1, y, 14, 6, rubber);
      p.rect(ox, y + 1, 16, 4, rubber);
      p.rect(ox + 1, y + 1, 14, 1, rubberL);
      p.rect(ox, y + 2, 1, 2, rubberL);
      for (let k = 0; k < 5; k++) p.px(ox + 2 + k * 3, y + 3, '#1a1720');
      p.px(ox + 13, y + 4, '#3a3640');
    });
    // Top tyre seen from above: the hole.
    const top = 25 - 6 * offs.length;
    const tx = offs[offs.length - 1];
    p.ellipse(tx + 8, top + 1.5, 7, 2, rubberL);
    p.ellipse(tx + 8, top + 1.5, 4, 1, ink);
    // Rain pooled in the top tyre.
    p.px(tx + 7, top + 1, '#6a7890');
  },
  2,
  10,
  25,
);

// Tyre fender hung on a quay face (anchor = rope top).
def(
  'm4d_fender',
  14,
  18,
  (p) => {
    const { rubber, rubberL } = D4;
    p.rect(6, 0, 1, 6, D4.rope);
    p.rect(7, 0, 1, 5, D4.ropeD);
    p.circle(7, 11, 6, rubber);
    p.circle(7, 11, 2.5, T0);
    // Top-left light on the rim, rope through the hole.
    p.px(3, 7, rubberL);
    p.px(2, 9, rubberL);
    p.px(4, 6, rubberL);
    p.px(5, 5, rubberL);
    p.px(10, 15, '#1a1720');
    p.rect(6, 6, 2, 3, D4.rope);
  },
  1,
  7,
  0,
);

// Heap of fishing net with floats, a rope coil and a fish crate.
def(
  'm4d_net',
  34,
  15,
  (p) => {
    const { net, netL, float, rope, ropeD } = D4;
    // Crate under the net.
    p.rect(1, 7, 11, 8, D4.wood);
    p.rect(1, 7, 11, 1, D4.woodL);
    p.rect(1, 10, 11, 1, D4.woodD);
    p.rect(1, 13, 11, 1, D4.woodD);
    // Net heap.
    p.ellipse(17, 12, 14, 7, net);
    p.rect(3, 12, 29, 3, net);
    for (let y = 5; y < 15; y++) for (let x = 3; x < 32; x++) if (p.opaque(x, y) && (x + y * 2) % 4 === 0) p.px(x, y, netL);
    p.rect(8, 6, 14, 1, netL);
    // Floats.
    for (const [fx, fy] of [
      [9, 9],
      [16, 7],
      [22, 11],
      [13, 12],
    ]) {
      p.circle(fx, fy, 1.6, float);
      p.px(fx - 1, fy - 1, '#ffa070');
    }
    // Rope coil.
    p.ring(28, 11, 3.5, rope, 1.5);
    p.px(27, 9, ropeD);
    p.px(30, 12, ropeD);
  },
  1,
  17,
  15,
);

// Wrecked car: crushed roof, missing door, smashed glass, rust, flat tyres.
def(
  'm4d_wreck',
  52,
  23,
  (p) => {
    const { car, carL, carD, rust, rustL, rubber, rubberL, ink } = D4;
    const r = new Rng(42);
    // Lower body.
    p.rect(2, 12, 48, 7, car);
    p.rect(1, 13, 1, 5, carD);
    // Trunk and hood.
    p.poly([2, 12, 3, 9, 13, 9, 13, 12], car);
    p.poly([36, 12, 37, 9, 48, 10, 50, 12], car);
    p.rect(3, 9, 10, 1, carL);
    p.rect(37, 9, 11, 1, carL);
    // Crushed cabin.
    p.poly([13, 9, 17, 3, 24, 5, 31, 3, 36, 9], carD);
    p.poly([15, 9, 18, 4, 23, 6, 23, 9], '#1c1824');
    p.poly([25, 9, 25, 6, 30, 4, 34, 9], '#1c1824');
    // Glass shards.
    p.px(18, 5, '#8aa0b0');
    p.px(16, 7, '#8aa0b0');
    p.px(30, 5, '#8aa0b0');
    p.px(33, 8, '#6a8090');
    p.rect(17, 3, 7, 1, carL);
    p.rect(25, 4, 6, 1, carL);
    // Missing door: dark hole with a seat back.
    p.rect(18, 10, 11, 7, '#1c1824');
    p.rect(20, 11, 3, 5, '#4a3a3a');
    p.rect(2, 12, 48, 1, carL);
    // Rust: dithered patches on the sill and wheel arches.
    for (let i = 0; i < 70; i++) {
      const x = r.int(2, 49);
      const y = r.int(13, 18);
      if (p.opaque(x, y)) p.px(x, y, r.chance(0.6) ? rust : rustL);
    }
    // Wheels: flattened tyres.
    for (const wx of [11, 40]) {
      p.ellipse(wx, 19, 5.5, 3.5, rubber);
      p.rect(wx - 5, 21, 11, 2, rubber);
      p.ellipse(wx, 19, 2, 1.5, '#6e6a80');
      p.px(wx - 4, 18, rubberL);
      p.rect(wx - 6, 15, 12, 1, carD);
    }
    // Lights and bumpers.
    p.rect(49, 13, 2, 3, D4.ironL);
    p.px(48, 11, '#d8c890');
    p.rect(1, 13, 2, 3, D4.ironL);
    p.px(2, 11, '#8a3030');
    p.px(44, 10, ink);
    p.px(45, 11, ink);
  },
  1,
  26,
  23,
);

// Burning oil drum: 4 flame frames.
def(
  'm4d_firebarrel',
  16,
  30,
  (p, f) => {
    const { rust, rustL, rustD } = D4;
    const B = 29;
    // Flames (behind the rim).
    const fr = new Rng(100 + f * 13);
    const [c0, c1, c2, c3] = D4.fire;
    for (let i = 0; i < 5; i++) {
      const fx = 4 + i * 2 + fr.range(-0.5, 0.5);
      const h = [6, 10, 13, 9, 6][i] + fr.int(-2, 2);
      p.tri(fx - 2, B - 13, fx + 2, B - 13, fx + fr.range(-1.5, 1.5), B - 13 - h, c3);
    }
    for (let i = 0; i < 4; i++) {
      const fx = 5 + i * 2 + fr.range(-0.5, 0.5);
      const h = [5, 8, 9, 6][i] + fr.int(-1, 1);
      p.tri(fx - 1.5, B - 13, fx + 1.5, B - 13, fx + fr.range(-1, 1), B - 13 - h, c2);
    }
    p.tri(6, B - 13, 10, B - 13, 8 + fr.range(-1, 1), B - 19 - fr.int(0, 2), c1);
    p.rect(6, B - 14, 4, 1, c0);
    // Embers.
    p.px(3 + fr.int(0, 9), B - 22 - fr.int(0, 5), c1);
    // Drum.
    p.rect(2, B - 13, 12, 14, rust);
    p.rect(2, B - 13, 2, 14, rustL);
    p.rect(12, B - 13, 2, 14, rustD);
    p.rect(1, B - 13, 14, 2, D4.iron);
    p.rect(1, B - 13, 14, 1, D4.ironL);
    p.rect(2, B - 8, 12, 1, rustD);
    p.rect(2, B - 3, 12, 1, rustD);
    // Holes glowing from the fire inside.
    p.px(5, B - 6, f % 2 ? c1 : c2);
    p.px(9, B - 10, c2);
    p.px(10, B - 5, f % 2 ? c2 : c1);
  },
  4,
  8,
  30,
);

// Crates on a pallet.
def(
  'm4d_crates',
  32,
  27,
  (p) => {
    const { wood, woodL, woodD } = D4;
    const crate = (x: number, y: number, w: number, h: number, c: string) => {
      p.rect(x, y, w, h, c);
      p.rect(x, y, w, 1, shade(c, 0.22));
      p.rect(x, y, 1, h, shade(c, 0.12));
      for (let yy = y + 3; yy < y + h - 1; yy += 3) p.rect(x + 1, yy, w - 2, 1, shade(c, -0.25));
      p.rect(x + w - 1, y, 1, h, shade(c, -0.3));
      p.line(x + 1, y + h - 2, x + w - 2, y + 1, shade(c, -0.18));
    };
    p.rect(0, 23, 31, 4, woodD);
    p.rect(0, 23, 31, 1, wood);
    for (const x of [1, 14, 27]) p.rect(x, 24, 3, 3, wood);
    crate(1, 10, 15, 13, wood);
    crate(17, 13, 13, 10, shade(wood, 0.08));
    crate(4, 1, 11, 9, woodL);
    // Stencil marks.
    p.rect(6, 15, 5, 1, '#c8b890');
    p.rect(7, 17, 3, 1, '#c8b890');
    p.px(21, 17, '#c8b890');
    p.px(23, 17, '#c8b890');
    p.px(22, 18, '#c8b890');
  },
  1,
  16,
  27,
);

// Signs. Frames: 0 dock, 1 warn, 2 legion poster, 3 arrow (to the harbour).
const SIGN_W = 44;
const SIGN_H = 32;
def(
  'm4d_sign',
  SIGN_W,
  SIGN_H,
  (p, f) => {
    const { iron, ironL } = D4;
    const cx = SIGN_W / 2;
    if (f === 0 || f === 3) {
      // Enamel board on a post.
      p.rect(cx - 1, 13, 3, SIGN_H - 13, iron);
      p.rect(cx - 1, 13, 1, SIGN_H - 13, ironL);
      const bw = f === 0 ? 40 : 42;
      const bx = Math.round(cx - bw / 2);
      const c = f === 0 ? '#2e4a7a' : '#2e5a4a';
      p.rect(bx, 1, bw, 12, '#d8d4e4');
      p.rect(bx + 1, 2, bw - 2, 10, c);
      p.rect(bx + 1, 2, bw - 2, 1, shade(c, 0.2));
      if (f === 0) stencil(p, 'DOCK 7', bx + 3, 4, '#e8e4f0', 0.05, 3);
      else {
        stencil(p, 'DOCKS', bx + 3, 4, '#e8e4f0', 0.04, 4);
        // Arrow pointing right (this frame is never mirrored).
        const ax = bx + 34;
        p.rect(ax, 7, 5, 1, '#e8e4f0');
        p.rect(ax + 3, 5, 1, 5, '#e8e4f0');
        p.rect(ax + 4, 6, 1, 3, '#e8e4f0');
        p.px(ax + 5, 7, '#e8e4f0');
      }
      // Chipped enamel and rust drips.
      p.px(bx + 2, 11, '#7a3e2a');
      p.px(bx + bw - 3, 3, '#7a3e2a');
      p.px(bx + bw - 3, 4, '#5a3a3a');
    } else if (f === 1) {
      // Yellow warning board: "!" over waves (danger: deep water).
      p.rect(cx - 1, 15, 3, SIGN_H - 15, iron);
      p.rect(cx - 1, 15, 1, SIGN_H - 15, ironL);
      p.rect(cx - 8, 1, 17, 15, '#140c1c');
      p.rect(cx - 7, 2, 15, 13, '#c8a838');
      p.rect(cx - 7, 2, 15, 1, '#e8c858');
      p.rect(cx - 7, 2, 1, 13, '#d8b848');
      p.rect(cx - 1, 3, 2, 5, '#1c1824');
      p.rect(cx - 1, 9, 2, 1, '#1c1824');
      for (let x = cx - 6; x < cx + 7; x++) {
        const k = (x - cx + 12) % 4;
        p.px(x, k < 2 ? 12 : 11, '#1c1824');
        p.px(x, k < 2 ? 14 : 13, '#2a4a7a');
      }
    } else {
      // Legion propaganda poster (wheat-pasted, torn corner).
      p.rect(cx - 12, 2, 25, 28, '#8a2a24');
      p.rect(cx - 12, 2, 25, 1, '#a83a30');
      p.rect(cx - 12, 2, 1, 28, '#9a3228');
      // Cog emblem.
      p.circle(cx, 12, 6, '#1c1418');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        p.rect(Math.round(cx + Math.cos(a) * 7) - 1, Math.round(12 + Math.sin(a) * 7) - 1, 2, 2, '#1c1418');
      }
      p.circle(cx, 12, 3, '#c89a3a');
      p.circle(cx, 12, 1.4, '#1c1418');
      stencil(p, 'OBEY', cx - 11, 21, '#e8d8b0', 0.08, 7);
      p.tri(cx + 12, 2, cx + 12, 8, cx + 7, 2, T0);
      p.px(cx + 11, 3, '#d8c8a8');
    }
  },
  4,
  SIGN_W / 2,
  SIGN_H,
);

// Big welcome sign on two posts with a bulb strip.
def(
  'm4d_welcome',
  72,
  38,
  (p) => {
    const { iron, ironL, ironD } = D4;
    for (const px of [8, 62]) {
      p.rect(px, 16, 3, 22, iron);
      p.rect(px, 16, 1, 22, ironL);
      p.rect(px + 2, 16, 1, 22, ironD);
    }
    p.rect(1, 4, 70, 15, '#2a2434');
    p.rect(2, 5, 68, 13, '#3a3044');
    p.rect(2, 5, 68, 1, '#4e4258');
    stencil(p, 'RUSTWATER', 9, 8, '#d8823a', 0.02, 11);
    // Missing letter tiles / grime.
    p.px(30, 9, '#3a3044');
    p.px(31, 10, '#3a3044');
    // Bulb strip on top.
    p.rect(2, 2, 68, 2, iron);
    for (let x = 5; x < 70; x += 5) p.px(x, 1, '#5a4a40');
  },
  1,
  36,
  38,
);

// Crane hook block (hangs from a cable drawn at runtime).
def(
  'm4d_hook',
  9,
  14,
  (p) => {
    const { iron, ironL, ironD } = D4;
    p.rect(1, 0, 7, 6, '#c8a838');
    p.rect(1, 0, 7, 1, '#e8c858');
    p.rect(1, 0, 1, 6, '#e0c050');
    p.rect(7, 0, 1, 6, '#8a7028');
    p.rect(2, 2, 5, 1, '#1c1824');
    p.rect(4, 6, 1, 2, ironD);
    p.ring(4, 10, 2.5, iron, 1.2);
    p.px(2, 9, ironL);
    p.rect(5, 7, 2, 2, T0);
  },
  1,
  4,
  0,
);

// Portal jib crane (behind terrain). Origin bottom-centre.
const CRANE_W = 112;
const CRANE_H = 150;
/** Jib tip relative to the sprite origin (bottom-centre). */
const CRANE_TIP = { x: 110 - 56, y: 6 - 150 };
def(
  'm4d_crane',
  CRANE_W,
  CRANE_H,
  (p) => {
    const { crane: C, craneL: L, craneD: D, rust, ink } = D4;
    const B = CRANE_H - 1;
    const r = new Rng(808);
    // Portal legs (two visible, braced).
    const leg = (x0: number, x1: number) => {
      p.line(x0, B - 4, x1, 92, D, 4);
      p.line(x0, B - 4, x1, 92, C, 3);
      p.line(x0 - 1, B - 4, x1 - 1, 92, L, 1);
    };
    leg(18, 36);
    leg(78, 62);
    p.line(22, 136, 72, 104, D, 2);
    p.line(26, 104, 74, 136, D, 2);
    p.rect(20, 122, 58, 3, C);
    p.rect(20, 122, 58, 1, L);
    // Bogies on rails.
    for (const bx of [8, 68]) {
      p.rect(bx, B - 6, 22, 5, D);
      p.rect(bx, B - 6, 22, 1, C);
      for (let k = 0; k < 3; k++) p.circle(bx + 4 + k * 7, B - 1, 2, D4.iron);
    }
    // Portal top + slewing ring.
    p.rect(30, 88, 40, 6, C);
    p.rect(30, 88, 40, 1, L);
    p.rect(30, 93, 40, 1, D);
    p.rect(36, 84, 28, 4, D4.iron);
    p.rect(36, 84, 28, 1, D4.ironL);
    // Machinery house.
    p.rect(24, 58, 46, 26, C);
    p.rect(24, 58, 46, 2, L);
    p.rect(24, 58, 2, 26, L);
    p.rect(68, 60, 2, 24, D);
    p.rect(22, 55, 50, 3, D);
    p.rect(22, 55, 50, 1, C);
    // Windows (one lit) and a door.
    p.rect(30, 64, 7, 6, '#1c1824');
    p.rect(40, 64, 7, 6, '#1c1824');
    p.rect(41, 65, 5, 4, P4.win);
    p.px(41, 65, P4.winL);
    p.rect(54, 66, 8, 18, D);
    p.rect(55, 67, 6, 17, shade(C, -0.15));
    p.px(59, 76, L);
    // Counterweight.
    p.rect(8, 62, 16, 16, D4.iron);
    p.rect(8, 62, 16, 1, D4.ironL);
    p.rect(8, 62, 1, 16, D4.ironL);
    for (let y = 65; y < 78; y += 4) p.rect(9, y, 14, 1, D4.ironD);
    // Operator cab at the front.
    p.rect(70, 64, 12, 14, C);
    p.rect(70, 64, 12, 1, L);
    p.rect(72, 66, 8, 6, '#1c1824');
    p.rect(73, 67, 6, 4, P4.winD);
    // A-frame.
    p.line(36, 56, 48, 26, D, 3);
    p.line(62, 56, 48, 26, D, 3);
    p.line(36, 56, 48, 26, C, 2);
    p.line(62, 56, 48, 26, C, 2);
    p.rect(46, 24, 5, 4, D4.iron);
    // Jib: lattice boom from the house to the tip.
    const jx0 = 64;
    const jy0 = 60;
    const jx1 = 109;
    const jy1 = 6;
    p.line(jx0, jy0, jx1, jy1, D, 2);
    p.line(jx0 - 5, jy0 - 2, jx1 - 1, jy1 - 1, D, 2);
    p.line(jx0, jy0, jx1, jy1, C, 1);
    p.line(jx0 - 5, jy0 - 2, jx1 - 1, jy1 - 1, L, 1);
    for (let t = 0.08; t < 0.95; t += 0.11) {
      const ax = jx0 + (jx1 - jx0) * t;
      const ay = jy0 + (jy1 - jy0) * t;
      const bx = jx0 - 5 + (jx1 - 1 - jx0 + 5) * (t + 0.055);
      const by = jy0 - 2 + (jy1 - 1 - jy0 + 2) * (t + 0.055);
      p.line(ax, ay, bx, by, D, 1);
    }
    // Tie from the A-frame to the tip.
    p.line(48, 26, jx1, jy1 + 1, D, 1);
    // Sheave at the tip.
    p.circle(jx1, jy1, 2.5, D4.iron);
    p.px(jx1 - 1, jy1 - 1, D4.ironL);
    // Rust streaks and grime.
    for (let i = 0; i < 90; i++) {
      const x = r.int(8, 104);
      const y = r.int(30, 146);
      if (p.opaque(x, y) && r.chance(0.5)) p.px(x, y, r.chance(0.5) ? rust : shade(C, -0.25));
    }
    // Warning light housing on the A-frame.
    p.px(48, 23, ink);
  },
  1,
  56,
  CRANE_H,
);

// ------------------------------------------------------------------ procedural (variable size)

/** Shipping container w x h (outline included in the returned art: (w+2) x (h+2)). */
export function containerArt(w: number, h: number, color: string, opts: { doors?: 'left' | 'right' | 'none'; mark?: string; seed?: number } = {}): PixelArt {
  const p = new PixelArt(w + 2, h + 2);
  const r = new Rng(opts.seed ?? w * 7 + h);
  const c = color;
  const hi = shade(c, 0.18);
  const lo = shade(c, -0.28);
  const X = 1;
  const Y = 1;
  p.rect(X, Y, w, h, c);
  // Corrugation ribs.
  for (let x = X + 4; x < X + w - 4; x += 3) {
    p.rect(x, Y + 3, 1, h - 6, hi);
    p.rect(x + 1, Y + 3, 1, h - 6, lo);
  }
  // Top/bottom rails and corner posts.
  p.rect(X, Y, w, 2, shade(c, -0.12));
  p.rect(X, Y, w, 1, shade(c, 0.28));
  p.rect(X, Y + h - 3, w, 3, shade(c, -0.36));
  p.rect(X, Y, 3, h, shade(c, -0.08));
  p.rect(X, Y, 1, h, shade(c, 0.2));
  p.rect(X + w - 3, Y, 3, h, shade(c, -0.34));
  // Corner castings.
  for (const [cx, cy] of [
    [X, Y],
    [X + w - 3, Y],
    [X, Y + h - 3],
    [X + w - 3, Y + h - 3],
  ])
    p.rect(cx, cy, 3, 3, shade(c, -0.45));
  // Doors with locking bars.
  const doors = opts.doors ?? 'none';
  if (doors !== 'none') {
    const dw = Math.min(26, Math.floor(w * 0.45));
    const dx = doors === 'left' ? X + 3 : X + w - 3 - dw;
    p.rect(dx, Y + 2, dw, h - 5, shade(c, -0.05));
    p.rect(dx + Math.floor(dw / 2), Y + 2, 1, h - 5, lo);
    for (const bx of [dx + 3, dx + Math.floor(dw / 2) - 3, dx + Math.floor(dw / 2) + 3, dx + dw - 4]) {
      p.rect(bx, Y + 3, 1, h - 7, '#9a98a8');
      p.px(bx + 1, Y + Math.floor(h / 2), '#cac8d8');
    }
  }
  // Painted mark (shipping line code).
  if (opts.mark && h >= 14) {
    const tw = stencilWidth(opts.mark);
    const tx = doors === 'left' ? X + w - tw - 8 : X + 8;
    stencil(p, opts.mark, tx, Y + Math.floor((h - 7) / 2), shade(c, 0.45), 0.12, opts.seed ?? 5);
  }
  // Rust streaks running down from the top rail, dents.
  for (let i = 0; i < Math.round(w / 9); i++) {
    const x = r.int(X + 3, X + w - 4);
    const len = r.int(3, Math.max(4, Math.floor(h * 0.6)));
    for (let y = Y + 2; y < Y + 2 + len; y++) if (r.chance(0.7)) p.px(x, y, r.chance(0.5) ? D4.rust : D4.rustL);
  }
  for (let i = 0; i < Math.round(w / 14); i++) p.px(r.int(X + 3, X + w - 4), r.int(Y + 4, Y + h - 4), shade(c, -0.4));
  p.outline(D4.ink);
  return p;
}

/** Brick warehouse facade (behind terrain). */
function warehouseArt(w: number, h: number, door: number, name: string, seed: number): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  const brick = shade(P4.brick, -0.38);
  const mortar = shade(P4.brickMortar, -0.1);
  p.rect(0, 0, w, h, mortar);
  for (let row = 0; row * 4 < h; row++) {
    const off = row % 2 ? 4 : 0;
    for (let x = -off; x < w; x += 8) {
      const c = shade(brick, r.range(-0.1, 0.06));
      p.rect(x + 1, row * 4 + 1, 7, 3, c);
      p.rect(x + 1, row * 4 + 1, 7, 1, shade(c, 0.08));
    }
  }
  // Parapet and sign band.
  p.rect(0, 0, w, 4, shade(P4.coping, -0.35));
  p.rect(0, 0, w, 1, shade(P4.coping, -0.15));
  if (name) {
    const tw = stencilWidth(name);
    const bx = Math.max(3, Math.floor((w - tw) / 2) - 3);
    p.rect(bx, 7, Math.min(w - 2 * bx, tw + 6), 11, '#2a2232');
    stencil(p, name, bx + 3, 9, '#9a8a7a', 0.18, seed);
  }
  // Windows (some lit, some broken).
  for (let x = 8; x < w - 12; x += 22) {
    if (Math.abs(x + 5 - door) < 30) continue;
    const y = 24;
    p.rect(x, y, 11, 9, '#1a1622');
    const lit = r.chance(0.35);
    if (lit) p.rect(x + 1, y + 1, 9, 7, shade(P4.win, -0.15));
    else if (r.chance(0.5)) {
      p.px(x + 2, y + 2, '#5a5a70');
      p.px(x + 7, y + 5, '#5a5a70');
    }
    p.rect(x + 5, y, 1, 9, '#2a2434');
    p.rect(x, y + 4, 11, 1, '#2a2434');
    p.rect(x - 1, y + 9, 13, 1, shade(P4.coping, -0.3));
  }
  // Roller door (slightly open, dark gap at the bottom).
  if (door >= 0) {
    const dw = 40;
    const dh = Math.min(38, h - 26);
    const dx = Math.round(door - dw / 2);
    const dy = h - dh;
    p.rect(dx - 2, dy - 3, dw + 4, dh + 3, shade(P4.coping, -0.35));
    for (let y = dy; y < h - 5; y += 2) {
      p.rect(dx, y, dw, 1, '#4a4656');
      p.rect(dx, y + 1, dw, 1, '#3a3646');
    }
    p.rect(dx, h - 5, dw, 5, '#100c16');
    p.rect(dx + 4, dy + 6, 12, 3, '#8a6a2a');
    p.rect(dx + 4, dy + 6, 12, 1, '#a8883a');
  }
  // Downpipe with rust.
  const px = w - 6;
  p.rect(px, 2, 2, h - 2, '#3a3646');
  p.rect(px, 2, 1, h - 2, '#4e4a5c');
  for (let y = 6; y < h; y += 14) p.rect(px - 1, y, 4, 1, '#2a2632');
  // Rain grime streaks under the windows.
  for (let i = 0; i < w / 6; i++) {
    const x = r.int(2, w - 3);
    const y0 = r.int(4, h - 10);
    for (let y = y0; y < y0 + r.int(3, 9); y++) if (r.chance(0.6)) p.px(x, y, shade(brick, -0.25));
  }
  return p;
}

/** Far canal wall + water body below the surface (behind terrain). */
function canalArt(w: number, depth: number, waterOff: number, seed: number): PixelArt {
  const p = new PixelArt(w, depth);
  const r = new Rng(seed);
  const stone = shade(P4.stone, -0.42);
  const mortar = shade(P4.mortar, -0.2);
  p.rect(0, 0, w, depth, mortar);
  for (let row = 0; row * 8 < depth; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < w; x += 16) {
      const c = shade(stone, r.range(-0.12, 0.05));
      p.rect(x + 1, row * 8 + 1, 15, 7, c);
      p.rect(x + 1, row * 8 + 1, 15, 1, shade(c, 0.1));
    }
  }
  // Coping at the top (the far quay edge).
  p.rect(0, 0, w, 3, shade(P4.curb, -0.45));
  p.rect(0, 0, w, 1, shade(P4.curb, -0.25));
  // Algae band at the waterline, very dark water body below.
  for (let x = 0; x < w; x++) {
    const a = 2 + Math.round(hash01(x >> 1, seed) * 3);
    p.rect(x, waterOff - a, 1, a, P4.algae);
  }
  // Under the surface the wall continues, fading into the murk; a few drifting specks.
  p.mapPixels((v, _x, y) => {
    if (y < waterOff) return v;
    const t = Math.min(1, (y - waterOff) / 64);
    const k = 0.3 + 0.7 * t;
    const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
    return ((255 << 24) | (mix((v >>> 16) & 255, 0x20) << 16) | (mix((v >>> 8) & 255, 0x12) << 8) | mix(v & 255, 0x0c)) >>> 0;
  });
  for (let i = 0; i < w / 10; i++) p.rect(r.int(0, w - 4), waterOff + r.int(2, depth - waterOff - 1), r.int(2, 6), 1, '#16203a');
  // Mooring rings, a ladder, a drain outlet.
  for (let x = 20 + r.int(0, 20); x < w - 10; x += 70 + r.int(0, 40)) {
    p.ring(x, 9, 2.5, '#2a2834', 1);
    p.px(x, 6, '#4a4658');
  }
  const lx = Math.floor(w * 0.62);
  for (const rx of [lx, lx + 7]) p.rect(rx, 1, 1, waterOff + 6, '#3a3646');
  for (let y = 4; y < waterOff + 6; y += 4) p.rect(lx, y, 8, 1, '#4a4658');
  const dx = Math.floor(w * 0.28);
  p.circle(dx, waterOff - 9, 4, '#1a1622');
  p.ring(dx, waterOff - 9, 4, '#3a3646', 1);
  return p;
}

/**
 * Ship hull side (behind terrain): deck line at row 12, keel at the bottom. Rounded stern on the
 * left, raked bow on the right. `dock` = under construction in the dry dock: missing plates show
 * the frames, rudder and screw exposed, a bare wheelhouse frame on deck.
 */
function shipArt(w: number, h: number, name: string, seed: number, dock: boolean): PixelArt {
  const top = 12;
  const p = new PixelArt(w, h + top);
  const r = new Rng(seed);
  const { hull, hullL, boot } = D4;
  const B = top + h - 1;
  // Hull silhouette.
  p.poly([3, top, w - 1, top - 2, w - 8, top + h * 0.45, w - 26, B + 1, 22, B + 1, 8, top + h * 0.55, 2, top + h * 0.2], hull);
  const inside = (x: number, y: number) => p.opaque(x, y);
  // Plate seams, a lit sheer strake under the deck edge (top-left light).
  for (let y = top; y <= B; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (y < top + 3) p.px(x, y, hullL);
      else if (x % 24 === 0 || (y - top) % 12 === 0) p.px(x, y, shade(hull, -0.2));
      else if (y >= B - 12) p.px(x, y, y === B - 12 ? shade(boot, 0.2) : boot);
    }
  // Bow highlight along the stem.
  for (let y = top; y < B - 8; y++) {
    const t = (y - top) / Math.max(1, h * 0.45);
    const x = Math.round(w - 1 - t * 7 - (y > top + h * 0.45 ? (y - top - h * 0.45) * 1.1 : 0));
    if (inside(x - 1, y)) p.px(x - 1, y, shade(hull, 0.18));
  }
  // Portholes along the upper hull.
  for (let x = 16; x < w - 22; x += 18) {
    p.circle(x, top + 9, 2.5, '#1a1622');
    p.ring(x, top + 9, 2.5, '#6a6680', 1);
    if (!dock && r.chance(0.3)) p.circle(x, top + 9, 1.5, shade(P4.win, -0.2));
  }
  // Name and draft marks on the bow.
  if (name) stencil(p, name, 18, top + 16, '#c8c4d8', 0.15, seed);
  for (let k = 0; k < 4; k++) {
    const y = B - 8 - k * 7;
    if (y < top + 14) break;
    stencil(p, String(6 - k), w - 34, y - 6, '#d8d4e4', 0.1, seed + k);
  }
  // Rust streaks.
  for (let i = 0; i < w / 8; i++) {
    const x = r.int(4, w - 10);
    for (let y = top + 3; y < top + 3 + r.int(6, Math.max(8, h - 14)); y++) if (inside(x, y) && r.chance(0.65)) p.px(x, y, r.chance(0.5) ? D4.rust : D4.rustD);
  }
  // Railing along the deck.
  for (let x = 4; x < w - 4; x++) {
    p.px(x, 3, '#4a4658');
    if (x % 6 === 0) p.rect(x, 3, 1, top - 3, '#3a3646');
  }
  p.rect(4, 7, w - 8, 1, '#3a3646');
  if (dock) {
    // Missing plates: an open bay showing the frames.
    const bx = Math.floor(w * 0.52);
    const bw = Math.floor(w * 0.22);
    for (let y = top + 4; y < B - 14; y++)
      for (let x = bx; x < bx + bw; x++) if (inside(x, y)) p.px(x, y, (x - bx) % 6 === 0 ? '#3a3646' : '#120e18');
    // Bare wheelhouse frame on deck.
    const wx = 26;
    p.rect(wx, 0, 30, 1, '#4a4658');
    for (const fx of [wx, wx + 10, wx + 20, wx + 29]) p.rect(fx, 0, 1, top, '#4a4658');
    // Rudder and screw at the stern.
    p.rect(14, B - 16, 4, 14, '#3a3646');
    p.rect(14, B - 16, 1, 14, '#5a5670');
    p.circle(22, B - 8, 3.5, '#8a6a3a');
    p.rect(21, B - 13, 2, 10, '#a8844a');
    p.px(22, B - 8, '#2a2632');
  }
  return p;
}

/** Dry dock back wall: stepped masonry ("altars") from the quay level down to the floor. */
function drydockArt(w: number, depth: number, seed: number): PixelArt {
  const p = new PixelArt(w, depth);
  const r = new Rng(seed);
  const stone = shade(P4.stone, -0.36);
  p.rect(0, 0, w, depth, shade(P4.mortar, -0.15));
  for (let row = 0; row * 8 < depth; row++) {
    const off = row % 2 ? 8 : 0;
    // Deeper rows are darker (less light reaches down).
    const dk = Math.min(0.3, row * 0.012);
    for (let x = -off; x < w; x += 16) {
      const c = shade(stone, r.range(-0.1, 0.05) - dk);
      p.rect(x + 1, row * 8 + 1, 15, 7, c);
      p.rect(x + 1, row * 8 + 1, 15, 1, shade(c, 0.1));
    }
  }
  // Altar ledges every 24 px.
  for (let y = 22; y < depth - 4; y += 24) {
    p.rect(0, y, w, 2, shade(P4.curb, -0.5));
    p.rect(0, y, w, 1, shade(P4.curb, -0.35));
  }
  // Painted dock number.
  stencil(p, 'DRY DOCK 2', Math.floor(w / 2) - 30, 30, '#8a8698', 0.2, seed);
  // Water stains and a culvert.
  for (let i = 0; i < w / 5; i++) {
    const x = r.int(0, w - 1);
    const y0 = r.int(0, depth - 20);
    for (let y = y0; y < y0 + r.int(4, 14); y++) if (r.chance(0.55)) p.px(x, y, P4.algae);
  }
  const cx = Math.floor(w * 0.7);
  p.rect(cx - 10, depth - 22, 20, 18, '#0e0a14');
  p.rect(cx - 11, depth - 23, 22, 2, shade(P4.curb, -0.45));
  for (let x = cx - 9; x < cx + 10; x += 3) p.rect(x, depth - 21, 1, 17, '#3a3646');
  return p;
}

function fenceArt(w: number, seed: number): PixelArt {
  const H = 24;
  const p = new PixelArt(w, H);
  const r = new Rng(seed);
  // Mesh (diagonal weave, translucent look via sparse pixels).
  for (let y = 5; y < H - 1; y++)
    for (let x = 0; x < w; x++) {
      if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) p.px(x, y, '#5a5870aa');
    }
  // Torn hole.
  const hx = r.int(10, Math.max(11, w - 20));
  for (let y = 10; y < 18; y++) for (let x = hx; x < hx + 8 - Math.abs(y - 14); x++) p.px(x, y, T0);
  // Posts + top rail.
  for (let x = 0; x < w; x += 24) {
    p.rect(x, 3, 2, H - 3, D4.iron);
    p.rect(x, 3, 1, H - 3, D4.ironL);
  }
  p.rect(0, 5, w, 1, D4.ironL);
  // Barbed wire.
  for (let x = 0; x < w; x++) {
    p.px(x, 1 + (x % 6 < 3 ? 0 : 1), '#6a6880');
    if (x % 6 === 2) {
      p.px(x, 0, '#8a88a0');
      p.px(x, 3, '#8a88a0');
    }
  }
  return p;
}

function keelArt(w: number): PixelArt {
  const p = new PixelArt(w, 14);
  for (let x = 2; x < w - 10; x += 22) {
    for (let k = 0; k < 3; k++) {
      const y = 14 - (k + 1) * 4;
      const c = k % 2 ? D4.woodL : D4.wood;
      p.rect(x + k, y, 12 - k * 2, 4, c);
      p.rect(x + k, y, 12 - k * 2, 1, shade(c, 0.2));
      p.rect(x + k, y + 3, 12 - k * 2, 1, D4.woodD);
    }
  }
  return p;
}

// ------------------------------------------------------------------ renderers

function spr(name: string, frame = 0): DecorRenderer {
  return (g, d) => sprites.get(name).draw(g, d.x, d.y, frame, { flip: !!d.props?.flip });
}

function drawBaked(g: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number): void {
  g.drawImage(c, Math.round(x), Math.round(y));
}

export const M4_DECOR: Record<string, DecorRenderer> = {
  lamp: (g, d, time) => {
    const off = !!d.props?.off;
    const k = off ? 0 : flicker(time, d.x * 0.01);
    sprites.get('m4d_lamp').draw(g, d.x, d.y, off || k < 0.5 ? 1 : 0);
    if (off) {
      // Broken lamp: an occasional spark.
      if (hash01(Math.floor(time * 6), Math.round(d.x)) < 0.06) {
        g.fillStyle = '#fff2c8';
        g.fillRect(Math.round(d.x) + 7, Math.round(d.y) - LAMP_H + 21, 1, 2);
      }
      return;
    }
    const top = d.y - LAMP_H;
    for (const lx of [-7, 7]) glow(g, d.x + lx, top + 18, 11, D4.glow, 0.55 * k);
    lightPool(g, d.x, d.y + 1, 22, D4.glow, 0.1 * k);
  },
  bollard: (g, d) => sprites.get('m4d_bollard').draw(g, d.x, d.y, d.props?.rope ? 1 : 0, { flip: !!d.props?.flip }),
  tires: (g, d) => sprites.get('m4d_tires').draw(g, d.x, d.y, d.props?.small ? 1 : 0, { flip: !!d.props?.flip }),
  fender: spr('m4d_fender'),
  net: spr('m4d_net'),
  wreck: spr('m4d_wreck'),
  crates: spr('m4d_crates'),
  firebarrel: (g, d, time) => {
    const f = Math.floor(time * 10 + d.x) % 4;
    sprites.get('m4d_firebarrel').draw(g, d.x, d.y, f);
    const k = 0.85 + 0.15 * Math.sin(time * 13 + d.x);
    glow(g, d.x, d.y - 20, 16, '#ff8a30', 0.5 * k);
    lightPool(g, d.x, d.y + 1, 18, '#ff8a30', 0.12 * k);
  },
  sign: (g, d) => {
    const v = String(d.props?.v ?? 'dock');
    if (v === 'welcome') {
      sprites.get('m4d_welcome').draw(g, d.x, d.y);
      return;
    }
    const f = v === 'warn' ? 1 : v === 'legion' ? 2 : v === 'arrow' ? 3 : 0;
    // Text boards are never mirrored.
    sprites.get('m4d_sign').draw(g, d.x, d.y, f, { flip: !!d.props?.flip && f === 1 });
  },
  crane: (g, d, time) => {
    const flip = !!d.props?.flip;
    sprites.get('m4d_crane').draw(g, d.x, d.y, 0, { flip });
    const tx = d.x + (flip ? -CRANE_TIP.x : CRANE_TIP.x);
    const ty = d.y + CRANE_TIP.y;
    const len = num(d.props?.cable, 78);
    const a = Math.sin(time * 0.9 + d.x * 0.01) * 0.07;
    const hx = tx + Math.sin(a) * len;
    const hy = ty + Math.cos(a) * len;
    g.fillStyle = '#2a2632';
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      g.fillRect(Math.round(tx + (hx - tx) * t), Math.round(ty + (hy - ty) * t), 1, 1);
    }
    sprites.get('m4d_hook').draw(g, hx, hy, 0);
    // Blinking aviation light on the A-frame.
    if ((time + d.x * 0.003) % 1.6 < 0.25) {
      const lx = d.x + (flip ? 8 : -8);
      const ly = d.y - CRANE_H + 22;
      glow(g, lx, ly, 4, '#ff4038', 0.9);
      g.fillStyle = '#ff6a58';
      g.fillRect(Math.round(lx), Math.round(ly), 1, 1);
    }
  },
  container: (g, d) => {
    const w = Math.round(num(d.props?.w, 64));
    const h = Math.round(num(d.props?.h, 32));
    const cname = String(d.props?.c ?? 'red');
    const color = CONTAINER_COLORS[cname] ?? cname;
    const doors = (d.props?.doors ?? 'none') as 'left' | 'right' | 'none';
    const mark = d.props?.mark ? String(d.props.mark) : '';
    const seed = num(d.props?.seed, Math.round(d.x));
    const c = baked(`c:${w}x${h}:${color}:${doors}:${mark}:${seed}`, () => containerArt(w, h, color, { doors, mark, seed }));
    // Anchor: bottom-centre on the floor; the art carries a 1px outline border.
    drawBaked(g, c, d.x - w / 2 - 1, d.y - h - 1);
  },
  warehouse: (g, d, time) => {
    const w = Math.round(num(d.props?.w, 200));
    const h = Math.round(num(d.props?.h, 100));
    const door = num(d.props?.door, Math.round(w / 2));
    const name = d.props?.name ? String(d.props.name) : '';
    const seed = num(d.props?.seed, Math.round(d.x));
    const c = baked(`w:${w}x${h}:${door}:${name}:${seed}`, () => warehouseArt(w, h, door, name, seed));
    drawBaked(g, c, d.x - w / 2, d.y - h);
    // Wall lamp over the door.
    if (door >= 0) {
      const lx = d.x - w / 2 + door;
      const ly = d.y - Math.min(38, h - 26) - 8;
      g.fillStyle = '#2a2632';
      g.fillRect(Math.round(lx) - 3, Math.round(ly) - 1, 7, 2);
      g.fillStyle = D4.glass;
      g.fillRect(Math.round(lx) - 2, Math.round(ly) + 1, 5, 1);
      glow(g, lx, ly + 2, 12, D4.glow, 0.45 * flicker(time, d.x * 0.02));
    }
  },
  canal: (g, d, time) => {
    const w = Math.round(num(d.props?.w, 120));
    const depth = Math.round(num(d.props?.depth, 172));
    const waterOff = Math.round(num(d.props?.water, 10));
    const seed = num(d.props?.seed, Math.round(d.x));
    const c = baked(`k:${w}x${depth}:${waterOff}:${seed}`, () => canalArt(w, depth, waterOff, seed));
    // Anchor: left edge at the quay level (d.x = canal left x, d.y = ground y).
    drawBaked(g, c, d.x, d.y);
    // Drain trickle.
    const dx = Math.round(d.x + Math.floor(w * 0.28));
    const y0 = Math.round(d.y + waterOff - 6);
    g.fillStyle = '#7a8ab0';
    for (let i = 0; i < 3; i++) {
      const t = (time * 2.2 + i / 3) % 1;
      g.fillRect(dx + (i % 2), y0 + Math.round(t * 6), 1, 2);
    }
  },
  ship: (g, d) => {
    const w = Math.round(num(d.props?.w, 260));
    const h = Math.round(num(d.props?.h, 60));
    const name = d.props?.name ? String(d.props.name) : '';
    const seed = num(d.props?.seed, Math.round(d.x));
    const dock = !!d.props?.dock;
    const c = baked(`s:${w}x${h}:${name}:${seed}:${dock}`, () => shipArt(w, h, name, seed, dock));
    // Anchor: left edge, d.y = the waterline.
    drawBaked(g, c, d.x, d.y - h - 12);
  },
  fence: (g, d) => {
    const w = Math.round(num(d.props?.w, 96));
    const c = baked(`f:${w}`, () => fenceArt(w, w));
    drawBaked(g, c, d.x - w / 2, d.y - 24);
  },
  drydock: (g, d) => {
    const w = Math.round(num(d.props?.w, 400));
    const depth = Math.round(num(d.props?.depth, 140));
    const c = baked(`d:${w}x${depth}`, () => drydockArt(w, depth, 31));
    // Anchor: left edge at the quay level.
    drawBaked(g, c, d.x, d.y);
  },
  // Open deep water body under a surface at d.y (behind terrain; the theme's water tints it).
  deepwater: (g, d, time) => {
    const w = Math.round(num(d.props?.w, 200));
    const depth = Math.round(num(d.props?.depth, 170));
    const x0 = Math.round(d.x);
    const y0 = Math.round(d.y);
    g.fillStyle = '#0c1220';
    g.fillRect(x0, y0, w, depth);
    g.fillStyle = '#16203a';
    for (let i = 0; i < w / 14; i++) {
      const gx = x0 + Math.floor(hash01(i, 3) * w);
      const gy = y0 + 3 + Math.floor(hash01(i, 5) * Math.min(30, depth - 4));
      const drift = Math.round(Math.sin(time * 0.7 + i) * 2);
      g.fillRect(gx + drift, gy, 3 + (i % 4), 1);
    }
  },
  // Marks a stretch where the near rooftops give way to the open harbour (read by weather.ts).
  openharbour: () => {},
  keelblocks: (g, d) => {
    const w = Math.round(num(d.props?.w, 160));
    const c = baked(`kb:${w}`, () => keelArt(w));
    drawBaked(g, c, d.x - w / 2, d.y - 14);
  },
};

/** Sprites added by this module (for tests). */
export const M4_DECOR_SPRITES = ['m4d_lamp', 'm4d_bollard', 'm4d_tires', 'm4d_fender', 'm4d_net', 'm4d_wreck', 'm4d_firebarrel', 'm4d_crates', 'm4d_sign', 'm4d_welcome', 'm4d_hook', 'm4d_crane'];
