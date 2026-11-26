// Procedural UI art: the IRON RUCKUS logo (chunky chrome + brass letters with a shine sweep),
// title-screen silhouettes (Iron Citadel, hills, marching troops, tank, helicopter, the squad),
// the Puerto Polvora tactical map, HUD icons and small decorations. Pure PixelArt (no DOM).

import { PixelArt, mixColor, shade } from '../../engine/pixelart';
import { sprites } from '../../engine/sprites';
import { glyphRows } from '../../engine/font';
import { Rng } from '../../engine/rng';
import { drawHuman, type HumanoidStyle, type HumanPose } from '../../art/humanoid';
import { characters, getCharacter } from '../../game/characters';
import { HOSTAGE_STYLE } from '../../game/hostage';

// ------------------------------------------------------------------ helpers

/** Bake text into PixelArt using the bitmap font. */
export function pxText(p: PixelArt, s: string, x: number, y: number, color: string, scale = 1): number {
  let cx = x;
  for (const ch of s) {
    const rows = glyphRows(ch);
    for (let yy = 0; yy < rows.length; yy++) {
      const row = rows[yy];
      for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') p.rect(cx + xx * scale, y + yy * scale, scale, scale, color);
    }
    cx += (rows[0].length + 1) * scale;
  }
  return cx - x - scale;
}

/** Copy `src` onto `p` at (dx,dy) as a silhouette with rim lights on exposed edges. */
function silhouetteBlit(p: PixelArt, src: PixelArt, dx: number, dy: number, body: string, rimRight: string | null, rimTop: string | null): void {
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < src.w && y < src.h && src.opaque(x, y);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (!op(x, y)) continue;
      let c = body;
      if (rimTop && !op(x, y - 1)) c = rimTop;
      if (rimRight && !op(x + 1, y)) c = rimRight;
      p.px(dx + x, dy + y, c);
    }
  }
}

/** Fully dark copy of a humanoid style (keeps the shape-defining options). */
function darkStyle(st: HumanoidStyle, c = '#0e0814'): HumanoidStyle {
  return {
    ...st,
    skin: c,
    hair: c,
    shirt: c,
    pants: c,
    boots: c,
    belt: c,
    vest: st.vest ? c : undefined,
    strap: st.strap ? c : undefined,
    gloves: st.gloves ? c : undefined,
    headgearColor: c,
    headgearAccent: c,
    beard: st.beard ? c : undefined,
    mustache: st.mustache ? c : undefined,
    backpack: st.backpack ? c : undefined,
    scarf: st.scarf ? c : undefined,
    gunColor: c,
    eye: c,
    sunglasses: false,
  };
}

// ------------------------------------------------------------------ logo

export const LOGO_H = 30;
const LOGO_GAP = 4;
const LOGO_SPACE = 12;
export const LOGO_EXTRUDE = 3;

type Pts = number[];
interface LogoGlyph {
  w: number;
  /** Filled outline polygons. */
  fill: Pts[];
  /** Polygons erased afterwards (counters). */
  holes?: Pts[];
  /** Rivet positions. */
  rivets?: [number, number][];
}

const oct = (x: number, y: number, w: number, h: number, c: number): Pts => [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
const box = (x: number, y: number, w: number, h: number): Pts => [x, y, x + w, y, x + w, y + h, x, y + h];
const H = LOGO_H;

const LOGO_GLYPHS: Record<string, LogoGlyph> = {
  I: {
    w: 18,
    fill: [[2, 0, 16, 0, 18, 2, 18, 5, 16, 7, 13, 7, 13, 23, 16, 23, 18, 25, 18, 28, 16, 30, 2, 30, 0, 28, 0, 25, 2, 23, 5, 23, 5, 7, 2, 7, 0, 5, 0, 2]],
    rivets: [
      [3, 3],
      [14, 3],
      [3, 26],
      [14, 26],
    ],
  },
  R: {
    w: 26,
    fill: [[0, 0, 19, 0, 24, 5, 24, 13, 20, 17, 26, 30, 17, 30, 12, 19, 8, 19, 8, 30, 0, 30]],
    holes: [oct(8, 7, 9, 5, 1)],
    rivets: [
      [3, 3],
      [3, 26],
    ],
  },
  O: {
    w: 24,
    fill: [oct(0, 0, 24, H, 6)],
    holes: [oct(8, 8, 8, H - 16, 2)],
    rivets: [
      [3, 14],
      [19, 14],
    ],
  },
  N: {
    w: 24,
    fill: [box(0, 0, 8, H), box(16, 0, 8, H), [0, 0, 8, 0, 24, H, 16, H]],
    rivets: [
      [3, 26],
      [19, 3],
    ],
  },
  U: {
    w: 24,
    fill: [[0, 0, 8, 0, 8, 20, 10, 22, 14, 22, 16, 20, 16, 0, 24, 0, 24, 24, 18, 30, 6, 30, 0, 24]],
    rivets: [
      [3, 3],
      [19, 3],
    ],
  },
  C: {
    w: 24,
    fill: [oct(0, 0, 24, H, 6)],
    holes: [oct(8, 8, 10, H - 16, 2), box(16, 11, 9, H - 22)],
    rivets: [[3, 14]],
  },
  K: {
    w: 24,
    fill: [box(0, 0, 8, H), [7, 12, 15, 0, 24, 0, 13, 17, 7, 17], [7, 13, 13, 13, 24, H, 15, H, 7, 20]],
    rivets: [
      [3, 3],
      [3, 26],
    ],
  },
  S: {
    w: 24,
    fill: [[5, 0, 24, 0, 24, 7, 8, 7, 8, 11, 19, 11, 24, 16, 24, 25, 19, 30, 0, 30, 0, 23, 16, 23, 16, 18, 5, 18, 0, 13, 0, 5]],
    rivets: [
      [19, 3],
      [3, 26],
    ],
  },
};

interface LogoLayout {
  w: number;
  h: number;
  letters: { ch: string; x: number; word: number }[];
}

function layoutLogo(words: string[]): LogoLayout {
  const letters: LogoLayout['letters'] = [];
  let x = 0;
  words.forEach((word, wi) => {
    if (wi > 0) x += LOGO_SPACE;
    [...word].forEach((ch, i) => {
      if (i > 0) x += LOGO_GAP;
      letters.push({ ch, x, word: wi });
      x += LOGO_GLYPHS[ch].w;
    });
  });
  return { w: x + LOGO_EXTRUDE + 1, h: H + LOGO_EXTRUDE + 1, letters };
}

const LOGO_WORDS = ['IRON', 'RUCKUS'];
const LOGO = layoutLogo(LOGO_WORDS);
export const LOGO_W = LOGO.w;
export const LOGO_SHINE_FRAMES = 12;

/** Face color for a word at letter-relative row y. */
function logoFace(word: number, y: number): string {
  if (word === 0) {
    // Chrome steel.
    if (y < 14) return mixColor('#f4f8ff', '#94a6c8', y / 13);
    if (y === 14) return '#ffffff';
    if (y === 15) return '#34446a';
    return mixColor('#3e5078', '#a4b6da', (y - 16) / 13);
  }
  // Polished brass.
  if (y < 14) return mixColor('#fffbd8', '#ffbe2e', y / 13);
  if (y === 14) return '#fffbe8';
  if (y === 15) return '#9a440e';
  return mixColor('#b4560e', '#ffb43a', (y - 16) / 13);
}

const EXTRUDE_COLORS = [
  ['#424a64', '#30364c', '#22263a'],
  ['#8e4c14', '#6a3410', '#4a220c'],
];

function drawLogo(p: PixelArt, frame: number): void {
  const L = LOGO;
  // Mask: letter index + 1 per pixel.
  const mask = new Int16Array(L.w * L.h);
  const rel = new Int8Array(L.w * L.h).fill(-1);
  L.letters.forEach((lt, li) => {
    const g = LOGO_GLYPHS[lt.ch];
    const m = new PixelArt(g.w + 2, H + 1);
    for (const poly of g.fill) m.poly(poly, '#ffffff');
    for (const hole of g.holes ?? []) m.poly(hole, 'transparent');
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        if (!m.opaque(x, y)) continue;
        const X = lt.x + x;
        if (X >= L.w || y >= L.h) continue;
        mask[y * L.w + X] = li + 1;
        rel[y * L.w + X] = y;
      }
  });
  const inMask = (x: number, y: number) => x >= 0 && y >= 0 && x < L.w && y < L.h && mask[y * L.w + x] > 0;
  // Extrusion (down-right), far layers first.
  for (let k = LOGO_EXTRUDE; k >= 1; k--) {
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const li = mask[y * L.w + x];
        if (!li) continue;
        const word = L.letters[li - 1].word;
        p.px(x + k, y + k, EXTRUDE_COLORS[word][k - 1]);
      }
  }
  // Shine band position for this frame.
  const shine = frame > 0;
  const s0 = -20 + ((frame - 1) / (LOGO_SHINE_FRAMES - 1)) * (L.w + 40);
  // Face with bevels.
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      const li = mask[y * L.w + x];
      if (!li) continue;
      const lt = L.letters[li - 1];
      const ry = rel[y * L.w + x];
      let c = logoFace(lt.word, ry);
      if (!inMask(x, y - 1)) c = mixColor(c, '#ffffff', 0.75);
      else if (!inMask(x - 1, y)) c = mixColor(c, '#ffffff', 0.35);
      if (!inMask(x, y + 1)) c = mixColor(c, '#000000', 0.38);
      else if (!inMask(x + 1, y)) c = mixColor(c, '#000000', 0.22);
      if (shine) {
        const d = x + y * 0.55;
        if (d >= s0 && d < s0 + 7) c = mixColor(c, '#ffffff', 0.7);
        else if (d >= s0 + 10 && d < s0 + 12) c = mixColor(c, '#ffffff', 0.45);
      }
      p.px(x, y, c);
    }
  // Rivets.
  for (const lt of L.letters) {
    for (const [rx, ry] of LOGO_GLYPHS[lt.ch].rivets ?? []) {
      const x = lt.x + rx;
      p.px(x, ry, lt.word === 0 ? '#ffffff' : '#fffff0');
      p.px(x + 1, ry, lt.word === 0 ? '#6a7a9a' : '#a8601a');
      p.px(x, ry + 1, lt.word === 0 ? '#6a7a9a' : '#a8601a');
      p.px(x + 1, ry + 1, lt.word === 0 ? '#2a3450' : '#5a2a08');
    }
  }
}

sprites.define({
  name: 'ui_logo',
  w: LOGO.w,
  h: LOGO.h,
  ox: 0,
  oy: 0,
  frames: LOGO_SHINE_FRAMES + 1,
  outlineDiagonal: true,
  draw: drawLogo,
});

/** Banner ribbon under the logo (text drawn at runtime). */
export const RIBBON_W = 176;
sprites.define({
  name: 'ui_ribbon',
  w: RIBBON_W,
  h: 16,
  ox: RIBBON_W / 2,
  oy: 0,
  draw: (p) => {
    const W = RIBBON_W;
    // Tails.
    p.poly([0, 4, 16, 4, 16, 15, 0, 15, 5, 9.5], '#7a1818');
    p.poly([W, 4, W - 16, 4, W - 16, 15, W, 15, W - 5, 9.5], '#7a1818');
    p.tri(10, 12, 16, 12, 16, 15, '#4a0c10');
    p.tri(W - 10, 12, W - 16, 12, W - 16, 15, '#4a0c10');
    // Band.
    p.rect(10, 0, W - 20, 12, '#b8282a');
    p.rect(10, 0, W - 20, 1, '#ff6a50');
    p.rect(10, 1, W - 20, 2, '#d8403a');
    p.rect(10, 10, W - 20, 2, '#801418');
    // Stitching.
    for (let x = 14; x < W - 14; x += 4) {
      p.px(x, 2, '#ffb0a0');
      p.px(x, 9, '#f07060');
    }
  },
});

sprites.define({
  name: 'ui_sparkle',
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const r = [1, 3, 4, 2][f];
    p.line(4 - r, 4, 4 + r, 4, '#fff6d0');
    p.line(4, 4 - r, 4, 4 + r, '#fff6d0');
    if (f === 1 || f === 2) {
      p.px(3, 3, '#ffe890');
      p.px(5, 5, '#ffe890');
      p.px(3, 5, '#ffe890');
      p.px(5, 3, '#ffe890');
    }
    p.px(4, 4, '#ffffff');
  },
});

// ------------------------------------------------------------------ title backdrop

export const SKY_STOPS: [number, string][] = [
  [0, '#07051a'],
  [70, '#1a0c34'],
  [120, '#3c1640'],
  [150, '#7a2a38'],
  [168, '#b8482c'],
];

/** Height profile of the far hills (y of the top edge, screen space). */
export function farHillY(x: number): number {
  return Math.round(150 - 6 * Math.sin(x * 0.021 + 1.2) - 4 * Math.sin(x * 0.053 + 0.3) - 3 * Math.sin(x * 0.11));
}
/** Height profile of the mid hills (soldiers and the tank walk on it). */
export function midHillY(x: number): number {
  return Math.round(170 - 7 * Math.sin(x * 0.017 + 2.1) - 3 * Math.sin(x * 0.045 + 1.0) - 2 * Math.sin(x * 0.13 + 0.4));
}
/** Height profile of the foreground ridge (the squad stands on it). */
export function ridgeY(x: number): number {
  const base = 196 - 10 * Math.exp(-(((x - 70) / 60) ** 2)) - 3 * Math.sin(x * 0.05);
  return Math.round(base + 2 * Math.sin(x * 0.19));
}

/** Hill layers are wider than the screen so the title camera can sway (parallax). */
export const LAYER_PAD = 10;
const LAYER_W = 384 + LAYER_PAD * 2;
const FAR_TOP = 126;
const MID_TOP = 150;
const RIDGE_TOP = 176;

sprites.define({
  name: 'ui_bg_hills_far',
  w: LAYER_W,
  h: 216 - FAR_TOP,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    p.ox += LAYER_PAD;
    const rng = new Rng(81);
    const col = '#2a1232';
    // Ruined buildings on the horizon.
    for (let i = 0; i < 9; i++) {
      const bx = rng.int(4, 370);
      const bw = rng.int(8, 18);
      const bh = rng.int(6, 16);
      const by = farHillY(bx + bw / 2) - FAR_TOP - bh + 2;
      p.rect(bx, by, bw, bh + 4, col);
      // Broken top.
      for (let k = 0; k < bw; k += 2) if (rng.chance(0.5)) p.rect(bx + k, by - rng.int(1, 3), 2, 3, col);
      // Empty window holes (sky shows through, glowing).
      for (let wy = by + 3; wy < by + bh - 1; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) if (rng.chance(0.35)) p.rect(wx, wy, 2, 2, '#5a2038');
    }
    for (let x = -LAYER_PAD; x < 384 + LAYER_PAD; x++) {
      const top = farHillY(x) - FAR_TOP;
      p.rect(x, top, 1, 216 - FAR_TOP - top, col);
      p.px(x, top, '#4a1e44');
    }
  },
});

sprites.define({
  name: 'ui_bg_hills_mid',
  w: LAYER_W,
  h: 216 - MID_TOP,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    p.ox += LAYER_PAD;
    const rng = new Rng(97);
    const col = '#180a20';
    for (let x = -LAYER_PAD; x < 384 + LAYER_PAD; x++) {
      const top = midHillY(x) - MID_TOP;
      p.rect(x, top, 1, 216 - MID_TOP - top, col);
      p.px(x, top, '#36163a');
    }
    // Dead trees and telegraph poles.
    for (let i = 0; i < 7; i++) {
      const tx = rng.int(10, 374);
      const ty = midHillY(tx) - MID_TOP;
      if (rng.chance(0.5)) {
        const h = rng.int(10, 16);
        p.rect(tx, ty - h, 1, h + 1, col);
        p.rect(tx - 3, ty - h + 2, 7, 1, col);
        p.px(tx - 3, ty - h + 3, col);
        p.px(tx + 3, ty - h + 3, col);
      } else {
        const h = rng.int(8, 14);
        p.line(tx, ty, tx, ty - h, col);
        p.line(tx, ty - h + 4, tx - 4, ty - h, col);
        p.line(tx, ty - h + 6, tx + 3, ty - h + 2, col);
        p.line(tx + 3, ty - h + 2, tx + 5, ty - h + 3, col);
      }
    }
  },
});

sprites.define({
  name: 'ui_bg_ridge',
  w: LAYER_W,
  h: 216 - RIDGE_TOP,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    p.ox += LAYER_PAD;
    const col = '#0b0610';
    for (let x = -LAYER_PAD; x < 384 + LAYER_PAD; x++) {
      const top = ridgeY(x) - RIDGE_TOP;
      p.rect(x, top, 1, 216 - RIDGE_TOP - top, col);
      p.px(x, top, '#2a1222');
    }
    // Sandbag wall (right) and barbed wire posts.
    const sb = (x: number) => ridgeY(x) - RIDGE_TOP;
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 6 - row; k++) {
        const x = 300 + row * 6 + k * 12;
        const y = sb(x) - 6 - row * 5;
        p.ellipse(x + 6, y + 3, 6.5, 3.2, col);
        p.hline(x + 1, x + 10, y, '#2a1222');
      }
    }
    for (let x = 150; x < 290; x += 34) {
      const y = sb(x);
      p.rect(x, y - 12, 2, 13, col);
      p.px(x, y - 12, '#2a1222');
    }
    for (let x = 150; x < 286; x++) {
      const y = sb(150) - 10 + Math.round(Math.sin(x * 0.4) * 1.5) + Math.round(((x - 150) / 136) * (sb(286) - sb(150)));
      if (x % 3 !== 0) p.px(x, y, '#2a1626');
      if (x % 7 === 0) {
        p.px(x, y - 1, '#2a1626');
        p.px(x, y + 1, '#2a1626');
      }
    }
  },
});

/** The Iron Citadel silhouette (title + ending). */
function drawCitadel(p: PixelArt, W: number, Hh: number, ruined: boolean, seed: number): void {
  const k = W / 168;
  const S = (v: number) => Math.round(v * k);
  const rng = new Rng(seed);
  const body = '#1c1026';
  const rock = '#140a1a';
  const tmp = new PixelArt(W, Hh);
  const y0 = Hh - S(96);
  const Y = (v: number) => y0 + S(v);
  // Crag.
  tmp.poly([0, Hh, S(10), Y(74), S(26), Y(66), S(40), Y(64), S(128), Y(64), S(146), Y(68), S(160), Y(78), W, Hh], rock);
  if (!ruined) {
    // Curtain wall + merlons.
    tmp.rect(S(18), Y(54), S(132), S(14), body);
    for (let x = S(22); x < S(148); x += S(8)) tmp.rect(x, Y(50), S(4), S(4) + 1, body);
    // Keep.
    tmp.rect(S(52), Y(24), S(64), S(32), body);
    for (let x = S(54); x < S(114); x += S(7)) tmp.rect(x, Y(20), S(4), S(4) + 1, body);
    // Towers.
    tmp.rect(S(26), Y(18), S(16), S(40), body);
    tmp.tri(S(23), Y(19), S(34), Y(4), S(45), Y(19), body);
    tmp.rect(S(124), Y(10), S(18), S(48), body);
    tmp.tri(S(121), Y(11), S(133), Y(0), S(145), Y(11), body);
    // Smokestacks.
    for (const [sx, sy, sw] of [
      [62, 2, 6],
      [74, 0, 7],
      [96, 6, 6],
    ]) {
      tmp.rect(S(sx), Y(sy), S(sw), S(26 - sy), body);
      tmp.rect(S(sx) - 1, Y(sy), S(sw) + 2, Math.max(1, S(2)), body);
    }
    // The doomsday walker's dome rising behind the keep.
    tmp.ellipse(S(103), Y(24), S(11), S(8), body);
    tmp.rect(S(92), Y(24), S(22), S(6), body);
  } else {
    // Broken walls and leaning stumps.
    for (let x = S(18); x < S(150); x += 2) {
      const h = S(6) + rng.int(0, S(10));
      tmp.rect(x, Y(64) - h, 2, h, body);
    }
    tmp.poly([S(50), Y(64), S(56), Y(34), S(64), Y(40), S(70), Y(30), S(80), Y(46), S(92), Y(38), S(104), Y(50), S(116), Y(64)], body);
    tmp.poly([S(26), Y(64), S(28), Y(38), S(36), Y(30), S(42), Y(44), S(42), Y(64)], body);
    tmp.poly([S(124), Y(64), S(128), Y(28), S(140), Y(40), S(142), Y(64)], body);
  }
  // Silhouette with rim light (moon top-left, fire glow from below).
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      if (!tmp.opaque(x, y)) continue;
      const c0 = tmp.getRaw(x, y);
      let c = c0 === tmp.getRaw(0, Hh - 1) ? rock : body;
      const fy = (y - (Hh - S(34))) / S(34);
      if (fy > 0) c = mixColor(c, '#4a1420', Math.min(1, fy) * 0.7);
      if (!tmp.opaque(x, y - 1)) c = '#3a2a4e';
      else if (!tmp.opaque(x - 1, y)) c = '#2e2040';
      p.px(x, y, c);
    }
  if (!ruined) {
    // Lit windows.
    const win = (x: number, y: number, w = 1, h = 2) => {
      const c = rng.pick(['#ffb02a', '#ff8a2a', '#ffd870', '#ff6a3a']);
      p.rect(x, y, w, h, c);
    };
    for (let wy = Y(30); wy < Y(52); wy += S(6)) for (let wx = S(56); wx < S(112); wx += S(5)) if (rng.chance(0.42)) win(wx, wy, Math.max(1, S(2)), Math.max(2, S(2)));
    for (let wy = Y(24); wy < Y(54); wy += S(7)) {
      if (rng.chance(0.6)) win(S(32), wy, Math.max(1, S(2)), Math.max(2, S(3)));
      if (rng.chance(0.6)) win(S(131), wy, Math.max(1, S(2)), Math.max(2, S(3)));
    }
    for (let wx = S(22); wx < S(148); wx += S(9)) if (rng.chance(0.3)) win(wx, Y(59), 1, 2);
    // Gate glow.
    p.rect(S(78), Y(44), S(12), S(12), '#2a0c10');
    p.rect(S(80), Y(46), S(8), S(10), '#a83a1a');
    p.rect(S(81), Y(48), S(6), S(8), '#ff8a2a');
  } else {
    // Fires in the rubble.
    for (let i = 0; i < 10; i++) {
      const x = rng.int(S(24), S(144));
      const y = Y(60) - rng.int(0, S(14));
      p.rect(x, y, 2, 2, rng.pick(['#ff8a2a', '#ffd040', '#ff4a2a']));
    }
  }
}

export const CITADEL_W = 168;
export const CITADEL_H = 96;
sprites.define({ name: 'ui_bg_citadel', w: CITADEL_W, h: CITADEL_H, outline: null, draw: (p) => drawCitadel(p, CITADEL_W, CITADEL_H, false, 5) });
/** Light positions on the title citadel (relative to its top-left): stacks, towers, walker eye. */
export const CITADEL_LIGHTS: [number, number][] = [
  [64, 1],
  [77, -1],
  [98, 5],
  [34, 3],
  [133, -1],
];
export const CITADEL_STACKS: [number, number][] = [
  [65, 1],
  [77, -1],
  [99, 5],
];
export const END_CITADEL_W = 252;
export const END_CITADEL_H = 144;
sprites.define({ name: 'ui_end_citadel', w: END_CITADEL_W, h: END_CITADEL_H, outline: null, draw: (p) => drawCitadel(p, END_CITADEL_W, END_CITADEL_H, false, 9) });
sprites.define({ name: 'ui_end_ruins', w: END_CITADEL_W, h: END_CITADEL_H, outline: null, draw: (p) => drawCitadel(p, END_CITADEL_W, END_CITADEL_H, true, 9) });

sprites.define({
  name: 'ui_moon',
  w: 30,
  h: 30,
  ox: 15,
  oy: 15,
  outline: null,
  draw: (p) => {
    p.circle(15, 15, 13.5, '#e8d8b8');
    p.circle(17, 13, 11, '#f6ecd4');
    p.circle(10, 10, 2.6, '#d4c4a2');
    p.circle(19, 20, 3.4, '#dccca8');
    p.circle(21, 9, 1.8, '#e0d0ae');
    p.circle(8, 19, 1.6, '#d4c4a2');
    // Terminator shade (lower-left).
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 30; x++) {
        const d = (x - 15) ** 2 + (y - 15) ** 2;
        if (d <= 13.5 * 13.5 && (x - 22) ** 2 + (y - 8) ** 2 > 19 * 19) p.px(x, y, (x + y) % 2 ? '#bca888' : '#c8b494');
      }
  },
});

/** Distant marching Legion trooper silhouette (small, 4-frame walk, shouldered rifle). */
sprites.define({
  name: 'ui_sil_soldier',
  w: 12,
  h: 17,
  ox: 6,
  oy: 16,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const t = new PixelArt(12, 17);
    const c = '#120818';
    // Legs (scissor walk).
    const s = [-2, 0, 2, 0][f];
    t.line(5, 11, 5 + s, 16, c, 2);
    t.line(6, 11, 6 - s, 16, c, 2);
    // Torso + pack.
    t.rect(4, 5, 4, 7, c);
    t.rect(3, 6, 1, 4, c);
    // Head + helmet.
    t.circle(6, 3.5, 1.8, c);
    t.ellipse(6, 2.2, 2.6, 1.6, c);
    // Shouldered rifle.
    t.line(7, 7, 10, 0, c);
    t.line(8, 7, 10, 2, c);
    // Arm swing.
    t.line(5, 6, 4 + [-1, 0, 1, 0][f], 10, c);
    silhouetteBlit(p, t, 0, 0, c, '#4a1e2e', '#2c1430');
  },
});

sprites.define({
  name: 'ui_sil_tank',
  w: 44,
  h: 20,
  ox: 22,
  oy: 19,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const t = new PixelArt(44, 20);
    const c = '#120818';
    t.poly([2, 13, 6, 8, 38, 8, 42, 13, 38, 19, 6, 19], c);
    t.rect(12, 3, 18, 6, c);
    t.ellipse(21, 4, 9, 3, c);
    t.rect(29, 4, 15, 2, c);
    t.rect(16, 1, 4, 3, c);
    const tmp = t;
    silhouetteBlit(p, tmp, 0, 0, c, '#4a1e2e', '#2c1430');
    for (let x = 6 + (f % 2) * 3; x < 38; x += 6) p.rect(x, 15, 2, 2, '#26122a');
  },
});

sprites.define({
  name: 'ui_sil_heli',
  w: 48,
  h: 20,
  ox: 24,
  oy: 10,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const c = '#120818';
    p.ellipse(28, 11, 11, 5.5, c);
    p.poly([18, 9, 2, 8, 2, 11, 18, 13], c);
    p.rect(1, 5, 3, 6, c);
    p.rect(24, 4, 6, 3, c);
    p.rect(22, 17, 14, 1, c);
    p.rect(25, 15, 1, 2, c);
    p.rect(33, 15, 1, 2, c);
    if (f === 0) p.rect(6, 3, 42, 1, '#2a1630');
    else p.rect(14, 3, 28, 1, '#2a1630');
    p.ellipse(33, 10, 3.5, 2.5, '#3a1e3a');
  },
});

/** The Ruckus Squad on the ridge, silhouetted against the burning sky. */
const SQUAD_POSES: { gun: HumanPose['gun']; aim: number; dx: number; lean?: number; crouch?: boolean }[] = [
  { gun: 'heavy', aim: -0.25, dx: 16 },
  { gun: 'pistol', aim: -0.55, dx: 40 },
  { gun: 'rocket', aim: -0.18, dx: 64 },
  { gun: 'shotgun', aim: 0.1, dx: 88, crouch: true },
];
sprites.define({
  name: 'ui_sil_squad',
  w: 104,
  h: 40,
  ox: 52,
  oy: 39,
  outline: null,
  draw: (p) => {
    const cs = characters().slice(0, 4);
    cs.forEach((c, i) => {
      const pose = SQUAD_POSES[i % SQUAD_POSES.length];
      const t = new PixelArt(104, 40);
      const st = darkStyle(getCharacter(c.id).style, '#0b0610');
      if (pose.crouch) drawHuman(t, pose.dx, 39, { hip: [0, -8], footB: [-4.5, 0], footF: [4.5, 0], lean: 1.5, gun: pose.gun, aim: pose.aim }, st);
      else drawHuman(t, pose.dx, 39, { hip: [0, -13], footB: [-3.5, 0], footF: [3.5, 0], gun: pose.gun, aim: pose.aim, lean: pose.lean ?? 0 }, st);
      silhouetteBlit(p, t, 0, 0, '#0b0610', '#ff7a3a', '#6a3050');
    });
  },
});

// ------------------------------------------------------------------ tactical map

export const MAP_W = 176;
export const MAP_H = 120;
/** Mission marker positions on the map (mission 1..6). */
export const MAP_POINTS: [number, number][] = [
  [36, 88],
  [92, 96],
  [58, 30],
  [136, 56],
  [104, 22],
  [154, 98],
];

interface Island {
  x: number;
  y: number;
  rx: number;
  ry: number;
  land: string;
  dark: string;
  kind: 'jungle' | 'desert' | 'snow' | 'city' | 'volcano';
}

const ISLANDS: Island[] = [
  { x: 36, y: 86, rx: 26, ry: 17, land: '#3a8a3a', dark: '#2a6a2e', kind: 'jungle' },
  { x: 94, y: 94, rx: 27, ry: 14, land: '#c8964e', dark: '#a8763a', kind: 'desert' },
  { x: 60, y: 30, rx: 30, ry: 17, land: '#c8d4e4', dark: '#8a9ab4', kind: 'snow' },
  { x: 136, y: 54, rx: 20, ry: 17, land: '#7a7a86', dark: '#5a5a66', kind: 'city' },
  { x: 154, y: 99, rx: 15, ry: 13, land: '#4a3034', dark: '#2e1c20', kind: 'volcano' },
];

function islandBlobs(is: Island, seed: number): [number, number, number, number][] {
  const rng = new Rng(seed);
  const out: [number, number, number, number][] = [[is.x, is.y, is.rx * 0.8, is.ry * 0.8]];
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    out.push([is.x + Math.cos(a) * is.rx * 0.6, is.y + Math.sin(a) * is.ry * 0.55, is.rx * rng.range(0.3, 0.55), is.ry * rng.range(0.35, 0.6)]);
  }
  return out;
}

/** Organic island fill: union of blobs with a wobbly (angle-modulated) coastline grown by `grow` px. */
function fillIsland(p: PixelArt, blobs: [number, number, number, number][], grow: number, color: string, seed: number): void {
  const rng = new Rng(seed);
  const ph = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
  for (const [bx, by, rx, ry] of blobs) {
    const R = Math.max(rx, ry) * 1.3 + grow + 2;
    for (let y = Math.floor(by - R); y <= by + R; y++)
      for (let x = Math.floor(bx - R); x <= bx + R; x++) {
        const dx = x + 0.5 - bx;
        const dy = y + 0.5 - by;
        const a = Math.atan2(dy, dx);
        const wob = 1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.09 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(11 * a + ph[2]);
        const ex = rx * wob + grow;
        const ey = ry * wob + grow;
        if ((dx / ex) ** 2 + (dy / ey) ** 2 <= 1) p.px(x, y, color);
      }
  }
}

sprites.define({
  name: 'ui_map',
  w: MAP_W,
  h: MAP_H,
  ox: 0,
  oy: 0,
  draw: (p) => {
    // Sea.
    p.rect(0, 0, MAP_W, MAP_H, '#123a52');
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if ((x * 7 + y * 13) % 23 === 0) p.px(x, y, '#18465e');
    ISLANDS.forEach((is, i) => {
      const blobs = islandBlobs(is, 11 + i * 7);
      // Shallows, beach, land.
      fillIsland(p, blobs, 4, '#1e5a6e', 3 + i);
      fillIsland(p, blobs, 1.5, is.kind === 'snow' ? '#e8eef6' : is.kind === 'volcano' ? '#3a2a2a' : '#e0cc90', 3 + i);
      fillIsland(p, blobs, 0, is.land, 3 + i);
      const rng = new Rng(99 + i);
      // Terrain details.
      for (let k = 0; k < 26; k++) {
        const b = rng.pick(blobs);
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(0, 0.8);
        const x = Math.round(b[0] + Math.cos(a) * b[2] * r);
        const y = Math.round(b[1] + Math.sin(a) * b[3] * r);
        switch (is.kind) {
          case 'jungle':
            p.circle(x, y, 1.6, is.dark);
            p.px(x - 1, y - 1, '#5aae4a');
            break;
          case 'desert':
            p.hline(x - 2, x + 2, y, is.dark);
            p.px(x - 1, y - 1, '#e0b46a');
            break;
          case 'snow':
            if (k % 3 === 0) {
              p.tri(x - 4, y + 3, x, y - 4, x + 4, y + 3, is.dark);
              p.tri(x - 1.5, y - 1, x, y - 4, x + 1.5, y - 1, '#ffffff');
            }
            break;
          case 'city':
            p.rect(x - 1, y - 1, 3, 3, k % 2 ? '#5a5a66' : '#9a9aa6');
            break;
          case 'volcano':
            break;
        }
      }
      if (is.kind === 'volcano') {
        p.tri(is.x - 10, is.y + 6, is.x, is.y - 9, is.x + 10, is.y + 6, '#2a1a1e');
        p.tri(is.x - 4, is.y - 3, is.x, is.y - 9, is.x + 4, is.y - 3, '#4a2a2a');
        p.rect(is.x - 2, is.y - 9, 4, 2, '#ff5a2a');
        p.line(is.x, is.y - 7, is.x - 4, is.y + 3, '#c83a1a');
        p.line(is.x + 1, is.y - 7, is.x + 5, is.y + 1, '#c83a1a');
      }
      if (is.kind === 'city') {
        // Harbor piers.
        for (let k = 0; k < 4; k++) p.rect(is.x - is.rx - 4, is.y - 6 + k * 4, 6, 1, '#9a8a6a');
      }
    });
    // Storm clouds (mission 5).
    for (const [x, y, r] of [
      [100, 20, 7],
      [108, 18, 6],
      [94, 24, 5],
      [112, 24, 5],
      [104, 25, 6],
    ]) {
      p.circle(x, y, r, '#8a94a8');
      p.circle(x - 1, y - 1, r - 1.5, '#c8d0dc');
    }
    p.line(104, 26, 101, 31, '#ffe060');
    p.line(101, 31, 105, 31, '#ffe060');
    p.line(105, 31, 102, 36, '#ffe060');
    // Compass rose.
    const cx = 162;
    const cy = 20;
    p.tri(cx - 2, cy, cx, cy - 9, cx + 2, cy, '#e8d8a8');
    p.tri(cx - 2, cy, cx, cy + 9, cx + 2, cy, '#7a6a48');
    p.tri(cx, cy - 2, cx + 9, cy, cx, cy + 2, '#7a6a48');
    p.tri(cx, cy - 2, cx - 9, cy, cx, cy + 2, '#7a6a48');
    p.circle(cx, cy, 1.5, '#ffffff');
    pxText(p, 'N', cx - 2, cy - 18 + 1, '#e8d8a8');
    // Frame.
    p.box(0, 0, MAP_W, MAP_H, '#6a5a3a');
    p.box(1, 1, MAP_W - 2, MAP_H - 2, '#2a2014');
  },
});

// ------------------------------------------------------------------ HUD / menu icons

sprites.define({
  name: 'ui_hostage',
  w: 7,
  h: 9,
  ox: 3,
  oy: 9,
  draw: (p) => {
    const st = HOSTAGE_STYLE;
    p.rect(0, 5, 7, 4, st.shirt);
    p.rect(0, 5, 7, 1, shade(st.shirt, 0.25));
    p.circle(3.5, 3, 2.8, st.skin);
    p.rect(1, 3.5, 5, 2, st.beard ?? '#7a5232');
    p.px(2, 2, '#2a1a1a');
    p.px(5, 2, '#2a1a1a');
    p.px(3, 0, shade(st.skin, 0.2));
  },
});

sprites.define({
  name: 'ui_icon_grenade',
  w: 7,
  h: 9,
  ox: 3,
  oy: 9,
  draw: (p) => {
    p.ellipse(3.5, 5.5, 3.2, 3.4, '#4a6a2a');
    p.ellipse(3, 5, 2, 2.2, '#6a8a3a');
    p.hline(1, 6, 5, '#34501e');
    p.vline(3, 3, 8, '#34501e');
    p.rect(2, 0, 3, 2, '#a0a0a8');
    p.px(5, 1, '#d0d0d8');
    p.px(2, 4, '#9aba5a');
  },
});

sprites.define({
  name: 'ui_icon_firebomb',
  w: 7,
  h: 9,
  ox: 3,
  oy: 9,
  draw: (p) => {
    p.rect(1, 3, 5, 6, '#b83a1a');
    p.rect(1, 3, 2, 6, '#e05a2a');
    p.rect(2, 1, 3, 2, '#8a8a90');
    p.px(3, 0, '#ffd040');
    p.px(2, 0, '#ff8a2a');
    p.hline(1, 5, 5, '#ffd040');
  },
});

sprites.define({
  name: 'ui_go_arrow',
  w: 22,
  h: 15,
  ox: 0,
  oy: 7,
  draw: (p) => {
    p.poly([0, 4, 12, 4, 12, 0, 22, 7.5, 12, 15, 12, 11, 0, 11], '#ffc020');
    p.poly([1, 5, 13, 5, 13, 2, 20, 7.5], '#ffe880');
    p.hline(1, 12, 10, '#c87a10');
  },
});

sprites.define({
  name: 'ui_lock',
  w: 7,
  h: 9,
  ox: 3,
  oy: 9,
  draw: (p) => {
    p.ring(3.5, 3.5, 3, '#8a8a98', 1.3);
    p.rect(0, 4, 7, 5, '#c8a040');
    p.rect(0, 4, 7, 1, '#ffe080');
    p.px(3, 6, '#3a2a10');
    p.px(3, 7, '#3a2a10');
  },
});

sprites.define({
  name: 'ui_star',
  w: 11,
  h: 11,
  ox: 5,
  oy: 5,
  draw: (p) => {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 5.4 : 2.3;
      pts.push(5.5 + Math.cos(a) * r, 5.6 + Math.sin(a) * r);
    }
    p.poly(pts, '#ffc828');
    p.circle(4.5, 4.5, 1.3, '#fff2a0');
  },
});

sprites.define({
  name: 'ui_reticle',
  w: 15,
  h: 15,
  ox: 7,
  oy: 7,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const c = f ? '#ff6a4a' : '#ff3a2a';
    p.ring(7.5, 7.5, 6.5 - f, c, 1);
    p.vline(7, 0, 3, c);
    p.vline(7, 11, 14, c);
    p.hline(0, 3, 7, c);
    p.hline(11, 14, 7, c);
    p.px(7, 7, '#ffffff');
  },
});

/** Stylized gamepad (controls screen). */
sprites.define({
  name: 'ui_gamepad',
  w: 92,
  h: 46,
  ox: 46,
  oy: 23,
  draw: (p) => {
    const body = '#3a3a4a';
    p.ellipse(18, 28, 17, 16, body);
    p.ellipse(74, 28, 17, 16, body);
    p.rect(18, 10, 56, 26, body);
    p.rect(18, 10, 56, 2, '#5a5a6e');
    p.ellipse(18, 26, 14, 12, '#44445a');
    p.ellipse(74, 26, 14, 12, '#44445a');
    // D-pad.
    p.rect(14, 18, 8, 22 - 4, '#1e1e28');
    p.rect(9, 23, 18, 8, '#1e1e28');
    p.rect(15, 19, 6, 16, '#2e2e3a');
    p.rect(10, 24, 16, 6, '#2e2e3a');
    // Face buttons (A bottom, B right, X left, Y top).
    p.circle(74, 33, 3.6, '#3aa84a');
    p.circle(81, 26, 3.6, '#d83a3a');
    p.circle(67, 26, 3.6, '#3a6ad8');
    p.circle(74, 19, 3.6, '#e8c030');
    for (const [x, y] of [
      [73, 32],
      [80, 25],
      [66, 25],
      [73, 18],
    ])
      p.px(x, y, '#ffffff');
    // Start / select.
    p.rect(39, 20, 6, 3, '#1e1e28');
    p.rect(48, 20, 6, 3, '#1e1e28');
    // Shoulder buttons.
    p.rect(8, 6, 18, 4, '#2a2a36');
    p.rect(66, 6, 18, 4, '#2a2a36');
  },
});

/** Rubber stamp: double-bordered text box, rotated by `ang` radians (nearest-neighbour). */
function defineStamp(name: string, label: string, color: string, ang: number, scale = 1, wear = 1): void {
  const tw = (label.length * 6 - 1) * scale;
  const bw = tw + 6 + 4 * scale;
  const bh = 7 * scale + 8;
  const W = Math.ceil(Math.abs(bw * Math.cos(ang)) + Math.abs(bh * Math.sin(ang))) + 2;
  const Hh = Math.ceil(Math.abs(bw * Math.sin(ang)) + Math.abs(bh * Math.cos(ang))) + 2;
  sprites.define({
    name,
    w: W,
    h: Hh,
    ox: Math.floor(W / 2),
    oy: Math.floor(Hh / 2),
    outline: null,
    draw: (p) => {
      const src = new PixelArt(bw, bh);
      src.box(0, 0, bw, bh, color);
      src.box(1, 1, bw - 2, bh - 2, color);
      if (scale > 1) src.box(3, 3, bw - 6, bh - 6, color);
      pxText(src, label, 3 + 2 * scale, 4, color, scale);
      // Worn ink: knock out a few pixels.
      const rng = new Rng(label.length * 31);
      for (let i = 0; i < bw * 0.5 * wear; i++) src.setRaw(rng.int(0, bw - 1), rng.int(0, bh - 1), 0);
      const cx = W / 2;
      const cy = Hh / 2;
      const c = Math.cos(-ang);
      const s = Math.sin(-ang);
      for (let y = 0; y < Hh; y++)
        for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const sx = Math.floor(dx * c - dy * s + bw / 2);
          const sy = Math.floor(dx * s + dy * c + bh / 2);
          if (sx >= 0 && sy >= 0 && sx < bw && sy < bh && src.opaque(sx, sy)) p.px(x, y, color);
        }
    },
  });
}

defineStamp('ui_stamp_secret', 'TOP SECRET', '#e0302a', -0.12, 2, 1);
defineStamp('ui_stamp_cleared', 'CLEARED', '#3ac04a', 0, 1, 0.6);

// ------------------------------------------------------------------ portraits (lazy, runtime)

/** Head-and-shoulders portrait of a character (defined lazily so content overrides apply). */
export function faceSprite(id: string, p2 = false): string {
  const name = `ui_face_${id}${p2 ? '_p2' : ''}`;
  if (!sprites.has(name)) {
    sprites.define({
      name,
      w: 16,
      h: 16,
      ox: 8,
      oy: 16,
      draw: (p) => {
        const c = getCharacter(id);
        const st = p2 ? { ...c.style, ...c.p2 } : c.style;
        drawHuman(p, 7, 35, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], gun: 'none', handF: [3, 9], handB: [-3, 9], expr: 'normal' }, st);
      },
    });
  }
  return name;
}
