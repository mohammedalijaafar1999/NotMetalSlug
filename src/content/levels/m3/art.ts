// FROSTBITE PASS mission props art: the cable-car gondola (with its grip trolley and hanger arm)
// and the rickety trestle bridge over the creek ravine. Pure PixelArt, lit from the top-left,
// facing right, outlined automatically.

import { sprites } from '../../../engine/sprites';
import type { PixelArt } from '../../../engine/pixelart';
import { P3 } from '../../themes/m3/palette';
import { legionEmblem, pxText, shadedBox } from '../../themes/m3/art';

/** Cabin body width/height (the roof is the walkable top edge). */
export const CAB_W = 72;
export const CAB_H = 34;
/** Cable to roof distance. */
export const HANG = 44;
export const CAB_SPRITE = 'm3_cablecar';

const SW = CAB_W + 2;
const RY = HANG + 8; // roof row inside the sprite

/** Gondola frames: (beacon lit 0/1) * 2 + wheel phase 0/1. Origin = roof centre. */
sprites.define({
  name: CAB_SPRITE,
  w: SW,
  h: RY + CAB_H + 2,
  ox: SW / 2,
  oy: RY,
  frames: 4,
  draw: (p, f) => drawGondola(p, f >> 1, f & 1),
});

function drawGondola(p: PixelArt, lit: number, spin: number): void {
  const cx = SW / 2;
  const L = 1;
  const R = SW - 1;
  // ---- grip trolley on the cable (cable row = RY - HANG = 8)
  const cy = RY - HANG;
  shadedBox(p, cx - 11, cy - 3, 22, 8, P3.steelM, P3.steel, P3.steelDD);
  p.rect(cx - 9, cy + 1, 18, 1, P3.steelDD);
  for (const wx of [cx - 6, cx + 6]) {
    p.circle(wx, cy - 3, 3.4, P3.steelDD);
    p.circle(wx, cy - 3, 2.4, P3.steel);
    // Spokes alternate to show the wheel turning.
    if (spin) {
      p.px(wx - 1, cy - 4, P3.steelHi);
      p.px(wx + 1, cy - 2, P3.steelD);
    } else {
      p.px(wx + 1, cy - 4, P3.steelHi);
      p.px(wx - 1, cy - 2, P3.steelD);
    }
    p.px(wx, cy - 3, P3.steelDD);
  }
  p.rect(cx - 2, cy - 7, 4, 3, P3.olD);
  p.px(cx - 2, cy - 7, P3.ol);
  // ---- hanger arm (slight dog-leg) down to the roof
  for (let y = cy + 5; y < RY - 3; y++) {
    const k = y < cy + 14 ? 0 : y < cy + 18 ? 1 : 2;
    const ax = cx - 2 + (k === 2 ? 0 : 0);
    p.rect(ax, y, 4, 1, P3.steel);
    p.px(ax, y, P3.steelHi);
    p.px(ax + 3, y, P3.steelD);
  }
  for (let y = cy + 12; y < cy + 16; y++) p.rect(cx - 3, y, 6, 1, P3.steelM);
  // Roof bracket.
  p.poly([cx - 7, RY, cx + 7, RY, cx + 3, RY - 5, cx - 3, RY - 5], P3.steelM);
  p.rect(cx - 3, RY - 5, 6, 1, P3.steel);
  // ---- railings at both roof ends (posts + yellow safety bar)
  for (const [x0, dir] of [
    [L, 1],
    [R - 1, -1],
  ] as const) {
    p.rect(x0, RY - 13, 1, 13, P3.steelD);
    p.rect(x0 + dir * 6, RY - 9, 1, 9, P3.steelD);
    const xa = Math.min(x0, x0 + dir * 7);
    p.rect(xa, RY - 13, 8, 2, P3.gold);
    p.rect(xa, RY - 13, 8, 1, '#f6dc70');
    p.rect(xa, RY - 7, 8, 1, P3.steel);
  }
  // Beacon on the right rail post.
  p.rect(R - 2, RY - 16, 3, 3, lit ? '#ffb030' : '#7a5420');
  if (lit) p.px(R - 2, RY - 16, '#fff0a0');
  // ---- roof deck (walkway grating, light snow)
  p.rect(L, RY, SW - 2, 1, P3.steelHi);
  p.rect(L, RY + 1, SW - 2, 1, P3.steel);
  for (let x = L; x < R; x++) if ((x * 7) % 5 === 0) p.px(x, RY + 1, P3.steelM);
  p.rect(L, RY + 2, SW - 2, 1, P3.steelDD);
  for (const sx of [6, 7, 8, 30, 31, 52, 53, 54, 55]) p.px(sx, RY, P3.snowHi);
  // ---- body
  const bx = L + 2;
  const bw = SW - 2 - 4;
  const by = RY + 3;
  const bh = CAB_H - 3;
  p.rect(bx, by, bw, bh - 2, P3.red);
  p.rect(bx + 1, by + bh - 2, bw - 2, 1, P3.red);
  p.rect(bx + 2, by + bh - 1, bw - 4, 1, P3.redD);
  p.rect(bx, by, bw, 1, P3.redHi);
  p.rect(bx, by, 1, bh - 2, P3.redHi);
  p.rect(bx + bw - 1, by, 1, bh - 2, P3.redD);
  // Window band.
  const wy = by + 3;
  const wh = 11;
  p.rect(bx + 2, wy - 1, bw - 4, wh + 2, '#5a1420');
  const panes = 4;
  const pw = Math.floor((bw - 4 - (panes + 1) * 2) / panes);
  for (let i = 0; i < panes; i++) {
    const x = bx + 4 + i * (pw + 2);
    p.rect(x, wy, pw, wh, '#263248');
    p.rect(x, wy, pw, 2, '#4a6482');
    // Diagonal glare.
    for (let k = 0; k < 4; k++) p.px(x + 2 + k, wy + 7 - k, '#7ea6c8');
    p.px(x + 1, wy + 1, '#b8d4ea');
    // Interior: a seat back silhouette.
    p.rect(x + 1, wy + wh - 3, pw - 2, 2, '#1a2232');
    if (lit && i === 3) p.rect(x + pw - 3, wy + 2, 2, 2, '#ffe9a0');
  }
  // Cream stripe + lower panel.
  p.rect(bx, wy + wh + 2, bw, 2, '#efe2c4');
  p.rect(bx, wy + wh + 2, bw, 1, '#fff6e0');
  legionEmblem(p, bx + 12, wy + wh + 9, 3.6);
  pxText(p, bx + bw - 14, wy + wh + 7, '07', '#efe2c4');
  // Rivets.
  for (let x = bx + 3; x < bx + bw - 2; x += 6) p.px(x, by + bh - 3, P3.redD);
  // Bumper + door seam.
  p.rect(bx + 26, wy + wh + 4, 1, bh - wh - 9, P3.redD);
  p.rect(bx + 4, by + bh, bw - 8, 1, P3.steelDD);
  // Snow on the window ledge.
  p.rect(bx + 3, wy + wh + 1, bw - 6, 1, P3.snowM);
}

// ------------------------------------------------------------------ trestle bridge

export const BRIDGE_DECK = 3; // deck thickness (rows)

/** Bridge plank strip, tiled along the deck (16 px period). Frame 1 = cracked. */
sprites.define({
  name: 'm3_bridge_deck',
  w: 16,
  h: 8,
  ox: 0,
  oy: 0,
  frames: 2,
  outline: P3.outline,
  draw: (p, f) => {
    for (let i = 0; i < 4; i++) {
      const x = i * 4;
      const c = i % 2 ? P3.wood : P3.woodHi;
      p.rect(x, 1, 3, 3, c);
      p.rect(x, 1, 3, 1, i % 2 ? P3.woodHi : '#d8a874');
      p.rect(x, 3, 3, 1, P3.woodD);
      p.px(x + 3, 1, P3.woodDD);
      p.px(x + 3, 2, P3.woodDD);
      p.px(x + 3, 3, P3.woodDD);
    }
    // Stringer beam under the planks.
    p.rect(0, 4, 16, 2, P3.woodM);
    p.rect(0, 5, 16, 1, P3.woodDD);
    // Snow dusting.
    p.rect(1, 0, 5, 1, P3.snow);
    p.rect(9, 0, 3, 1, P3.snowHi);
    if (f === 1) {
      p.px(5, 1, P3.woodDD);
      p.px(6, 2, P3.woodDD);
      p.px(6, 3, P3.woodDD);
      p.px(11, 2, P3.woodDD);
      p.px(12, 1, P3.woodDD);
    }
  },
});

/** Trestle bent (X-braced legs) under the deck; origin top-centre, `h` tall. */
sprites.define({
  name: 'm3_bridge_bent',
  w: 18,
  h: 64,
  oy: 0,
  outline: P3.outline,
  draw: (p) => {
    const H = 64;
    p.rect(1, 0, 3, H, P3.woodM);
    p.rect(1, 0, 1, H, P3.wood);
    p.rect(14, 0, 3, H, P3.woodD);
    p.rect(14, 0, 1, H, P3.woodM);
    for (let y = 4; y < H - 10; y += 18) {
      p.line(3, y, 14, y + 14, P3.woodM);
      p.line(14, y, 3, y + 14, P3.woodD);
      p.rect(1, y, 16, 2, P3.woodD);
      p.rect(1, y, 16, 1, P3.wood);
    }
    p.rect(0, 0, 18, 3, P3.woodD);
    p.rect(0, 0, 18, 1, P3.woodHi);
    // Icicles hanging off the cap beam.
    for (const x of [4, 9, 12]) for (let k = 0; k < 3 + (x % 3); k++) p.px(x, 3 + k, k > 1 ? P3.iceHi : P3.ice);
  },
});

/** A single broken plank (debris). */
sprites.define({
  name: 'm3_plank',
  w: 10,
  h: 4,
  outline: P3.outline,
  draw: (p) => {
    p.rect(0, 0, 10, 3, P3.wood);
    p.rect(0, 0, 10, 1, P3.woodHi);
    p.rect(0, 2, 10, 1, P3.woodD);
    p.px(9, 0, P3.woodDD);
    p.px(8, 2, P3.woodDD);
  },
});
