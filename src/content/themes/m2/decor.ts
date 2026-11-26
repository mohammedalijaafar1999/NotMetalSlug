// Mission 2 decor kinds (world space; d.x/d.y = bottom-center on the ground unless noted).
//   saguaro(v 0-2) cactus(v 0-3) palm reeds pumpjack derrick tank drums(v 0-2) column(v 0-2)
//   ruinwall(v 0-1) bones(v 0-1) wreck(v 0-1) tent windpump flag sign(v 0-5) rocks(v 0-2)
//   tumbleweed(props.w span, rolls right->left) vulture(perched) pipeline(props.w, h, valve)
//   surface(props.type 'salt'|'road', props.w: paints the ground top along the level's ground line)
//   pillar(props.h) watchtower(props.h, pair with a 'plank' platform) barrier(props.w)
//   m2_bg (region marker for the backdrop, draws nothing)
// Common props: v (variant), flip (mirror), dy (vertical nudge).

import { sprites } from '../../../engine/sprites';
import type { DecorDef, LevelDef } from '../../../game/level';
import type { DecorRenderer } from '../../../game/theme';
import { C } from './palette';
import { levelGroundY, renderCtx } from './terrain';
import { gustAt } from './weather';

function spr(name: string, frameOf?: (d: DecorDef, time: number) => number, sink = 1): DecorRenderer {
  return (g, d, time) => {
    const f = frameOf ? frameOf(d, time) : ((d.props?.v as number) ?? 0);
    sprites.get(name).draw(g, d.x, d.y + sink + ((d.props?.dy as number) ?? 0), f, d.props?.flip ? { flip: true } : undefined);
  };
}

/** Deterministic per-decor phase so neighbours don't animate in lockstep. */
function phase(d: DecorDef): number {
  return ((d.x * 0.6180339) % 1) * 10;
}

// ------------------------------------------------------------------ ground surface strips

const stripCache = new WeakMap<DecorDef, { c: HTMLCanvasElement; x: number; y: number } | null>();

function bakeSurface(level: LevelDef, d: DecorDef): { c: HTMLCanvasElement; x: number; y: number } | null {
  const w = Math.max(1, Math.round((d.props?.w as number) ?? 400));
  const x0 = Math.round(d.x);
  const ys: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < w; i++) {
    const y = levelGroundY(level, x0 + i + 0.5);
    ys.push(y);
    if (isFinite(y)) {
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  if (!isFinite(lo)) return null;
  const top = Math.floor(lo) - 3;
  const H = Math.ceil(hi - top) + 16;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = H;
  const g = c.getContext('2d')!;
  const type = d.props?.type ?? 'salt';
  const fill = (x: number, y: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, h);
  };
  // Hash noise for cracks / tracks.
  const hsh = (n: number) => {
    const v = Math.sin(n * 91.345 + 7.13) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < w; i++) {
    const gy = ys[i];
    if (!isFinite(gy)) continue;
    const y = Math.round(gy) - top;
    const wx = x0 + i;
    // Fade out over the first/last 12 px so the strip blends into the sand.
    const edge = Math.min(i, w - 1 - i);
    if (type === 'salt') {
      if (edge < 12 && hsh(wx) * 12 > edge) continue;
      fill(i, y, 1, '#fff6e8');
      fill(i, y + 1, 2, '#eee4d4');
      fill(i, y + 3, 3, '#e2d6c2');
      fill(i, y + 6, 3, '#d8c8b0');
      if (hsh(wx * 3) < 0.6) fill(i, y + 9, 1, '#d0bc9e');
      // Polygonal crack network: vertical cracks every ~11-17 px, horizontal mid-line breaks.
      const cell = Math.floor(wx / 14);
      const cx = cell * 14 + Math.floor(hsh(cell) * 8);
      if (wx === cx) fill(i, y + 2, 6, '#bcae98');
      if (wx === cx + 1) fill(i, y + 2, 5, '#fff6e8');
      if ((wx + cell) % 14 < 6 && hsh(cell + 50) < 0.5) fill(i, y + 5, 1, '#c4b49e');
      if (hsh(wx * 7) < 0.05) fill(i, y - 1, 1, '#fff6e8');
    } else {
      // Dirt road: packed darker band with two tire ruts and scattered gravel.
      if (edge < 10 && hsh(wx) * 10 > edge) continue;
      fill(i, y, 1, '#c8a274');
      fill(i, y + 1, 1, '#b48c62');
      fill(i, y + 2, 4, '#a88058');
      fill(i, y + 3, 1, (wx >> 1) % 5 === 0 ? '#8c6844' : '#96724e');
      fill(i, y + 6, 1, '#b48c62');
      if (hsh(wx * 5) < 0.12) fill(i, y + 1 + Math.floor(hsh(wx) * 5), 1, '#d8b888');
    }
  }
  return { c, x: x0, y: top };
}

const surface: DecorRenderer = (g, d) => {
  const L = renderCtx.level;
  if (!L) return;
  let s = stripCache.get(d);
  if (s === undefined) {
    s = bakeSurface(L, d);
    stripCache.set(d, s);
  }
  if (s) g.drawImage(s.c, s.x, s.y);
};

// ------------------------------------------------------------------ procedural pieces

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** Pipeline on H supports: props.w length, props.h pipe-center height above the ground, props.valve offset. */
const pipeline: DecorRenderer = (g, d) => {
  const L = renderCtx.level;
  const w = Math.round((d.props?.w as number) ?? 200);
  const h = Math.round((d.props?.h as number) ?? 12);
  const x0 = Math.round(d.x);
  const yc = Math.round(d.y - h);
  // Supports first.
  for (let x = x0 + 8; x < x0 + w - 4; x += 40) {
    const gy = L ? levelGroundY(L, x + 1) : d.y;
    const len = isFinite(gy) ? Math.max(0, Math.round(gy - yc)) : h;
    px(g, x - 1, yc + 2, 5, len - 1, C.ink);
    px(g, x, yc + 2, 3, len - 2, C.steelD);
    px(g, x, yc + 2, 1, len - 2, C.steel);
    px(g, x - 3, yc + 4, 9, 2, C.ink);
    px(g, x - 2, yc + 4, 7, 1, C.steelD);
  }
  // Pipe body (6 px) with outline.
  px(g, x0, yc - 4, w, 8, C.ink);
  px(g, x0, yc - 3, w, 1, C.steelHi);
  px(g, x0, yc - 2, w, 2, C.steelL);
  px(g, x0, yc, w, 2, C.steel);
  px(g, x0, yc + 2, w, 1, C.steelD);
  // Rust drips and flanges.
  for (let x = x0 + 20; x < x0 + w - 4; x += 40) {
    px(g, x - 1, yc - 5, 4, 10, C.ink);
    px(g, x, yc - 4, 2, 8, C.steelD);
    px(g, x, yc - 4, 1, 8, C.steelL);
  }
  for (let x = x0 + 7; x < x0 + w - 4; x += 23) {
    px(g, x, yc + 1, 2, 1, C.rust);
    px(g, x + 1, yc + 2, 1, 1, C.rustD);
  }
  // Valve wheel.
  const vo = d.props?.valve as number | undefined;
  if (vo !== undefined) {
    const vx = x0 + vo;
    px(g, vx - 1, yc - 9, 3, 6, C.ink);
    px(g, vx, yc - 8, 1, 5, C.steelD);
    px(g, vx - 4, yc - 11, 9, 3, C.ink);
    px(g, vx - 3, yc - 10, 7, 1, C.red);
  }
};

/** Tumbleweed rolling right -> left across props.w (faster in gusts). */
const tumbleweed: DecorRenderer = (g, d, time) => {
  const L = renderCtx.level;
  const span = (d.props?.w as number) ?? 320;
  const speed = 34;
  const lap = span + 120;
  const s = (time * speed * (1 + gustAt(time) * 0.8) + phase(d) * 40) % lap;
  if (s > span) return;
  const x = d.x + span / 2 - s;
  const gy = L ? levelGroundY(L, x) : d.y;
  if (!isFinite(gy)) return;
  const hop = Math.abs(Math.sin(s * 0.09)) * 5;
  sprites.get('m2_tumble').draw(g, x, gy - hop + 1, Math.floor(s / 4) % 4);
};

const windpump: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y) + 1;
  sprites.get('m2_windpump').draw(g, x, y, 0);
  sprites.get('m2_windwheel').draw(g, x, y - 77 + 15, Math.floor(time * (6 + gustAt(time) * 8) + phase(d)) % 4);
};

const pumpjack: DecorRenderer = (g, d, time) => {
  const f = Math.floor(time * 5 + phase(d) * 2) % 8;
  sprites.get('m2_pumpjack').draw(g, d.x, d.y + 1, f, d.props?.flip ? { flip: true } : undefined);
};

/** Sandstone pillar holding up a ruin lintel: props.h = height from the ground to the lintel. */
const pillar: DecorRenderer = (g, d) => {
  const h = Math.round((d.props?.h as number) ?? 40);
  const x = Math.round(d.x);
  const y = Math.round(d.y) + 1;
  const top = y - h + 8; // the lintel covers the top 8 px
  // Base and capital blocks.
  px(g, x - 7, y - 4, 15, 5, C.ink);
  px(g, x - 6, y - 3, 13, 3, C.stoneM);
  px(g, x - 6, y - 3, 13, 1, C.stoneL);
  px(g, x - 6, top - 1, 13, 4, C.ink);
  px(g, x - 5, top, 11, 2, C.stone);
  px(g, x - 5, top, 11, 1, C.stoneHi);
  // Shaft with drum joints.
  const s0 = top + 3;
  const s1 = y - 3;
  px(g, x - 5, s0, 11, s1 - s0, C.ink);
  px(g, x - 4, s0, 9, s1 - s0, C.stone);
  px(g, x - 4, s0, 1, s1 - s0, C.stoneHi);
  px(g, x - 3, s0, 1, s1 - s0, C.stoneL);
  px(g, x + 2, s0, 1, s1 - s0, C.stoneM);
  px(g, x + 3, s0, 1, s1 - s0, C.stoneD);
  px(g, x + 4, s0, 1, s1 - s0, C.stoneDD);
  for (let yy = s0 + 9; yy < s1 - 2; yy += 10) {
    px(g, x - 4, yy, 9, 1, C.stoneM);
    px(g, x + 1, yy + 1, 1, 1, C.stoneD);
  }
};

/** Legion watchtower: legs from the ground to a deck props.h above it, a hut and a roof above.
 *  Pair it with a 'plank' platform { x: d.x - 17, y: d.y - h, w: 34 }. */
const watchtower: DecorRenderer = (g, d) => {
  const h = Math.round((d.props?.h as number) ?? 46);
  const x = Math.round(d.x);
  const y = Math.round(d.y) + 1;
  const deck = y - 1 - h;
  // Legs + braces.
  for (const lx of [x - 15, x + 12]) {
    px(g, lx - 1, deck, 5, h, C.ink);
    px(g, lx, deck, 3, h, C.wood);
    px(g, lx, deck, 1, h, C.woodL);
    px(g, lx + 2, deck, 1, h, C.woodD);
  }
  for (let k = 0; k < 2; k++) {
    const y0 = deck + 6 + k * Math.floor(h / 2);
    const y1 = Math.min(y - 2, y0 + Math.floor(h / 2) - 4);
    for (let i = 0; i <= 24; i++) {
      const yy = Math.round(y0 + ((y1 - y0) * i) / 24);
      px(g, x - 12 + i, yy - 1, 1, 3, C.ink);
      px(g, x - 12 + i, yy, 1, 1, C.woodD);
      const yb = Math.round(y1 - ((y1 - y0) * i) / 24);
      px(g, x - 12 + i, yb - 1, 1, 3, C.ink);
      px(g, x - 12 + i, yb, 1, 1, C.wood);
    }
  }
  // Hut: back wall, side posts, roof.
  px(g, x - 17, deck - 30, 35, 30, C.ink);
  px(g, x - 16, deck - 26, 33, 26, C.canvasD);
  px(g, x - 16, deck - 26, 33, 1, C.canvas);
  px(g, x - 16, deck - 12, 33, 3, C.canvas);
  px(g, x - 16, deck - 12, 33, 1, C.canvasL);
  px(g, x - 16, deck - 26, 3, 26, C.woodD);
  px(g, x + 14, deck - 26, 3, 26, C.woodD);
  // Corrugated roof.
  for (let i = 0; i < 41; i++) {
    const rx = x - 20 + i;
    const ry = deck - 31 + Math.round(i * 0.12);
    px(g, rx, ry - 1, 1, 5, C.ink);
    px(g, rx, ry, 1, 3, i % 3 === 0 ? C.steelD : C.steelL);
    px(g, rx, ry, 1, 1, C.steelHi);
  }
};

/** Striped boom barrier at the Legion checkpoint. */
const barrier: DecorRenderer = (g, d) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y) + 1;
  px(g, x - 3, y - 16, 7, 16, C.ink);
  px(g, x - 2, y - 15, 5, 15, C.steelD);
  px(g, x - 2, y - 15, 1, 15, C.steel);
  px(g, x - 4, y - 18, 9, 4, C.ink);
  px(g, x - 3, y - 17, 7, 2, C.olive);
  const len = (d.props?.w as number) ?? 46;
  px(g, x + 3, y - 17, len + 1, 5, C.ink);
  for (let i = 0; i < len; i++) px(g, x + 4 + i, y - 16, 1, 3, Math.floor(i / 6) % 2 ? '#e8e0d0' : C.red);
  px(g, x + 4, y - 16, len, 1, '#ffffff');
  px(g, x + len + 1, y - 13, 2, 13, C.ink);
  px(g, x + len + 1, y - 12, 1, 12, C.steelD);
};

export const M2_DECOR: Record<string, DecorRenderer> = {
  pillar,
  watchtower,
  barrier,
  m2_bg: () => {},
  surface,
  pipeline,
  tumbleweed,
  windpump,
  pumpjack,
  saguaro: spr('m2_saguaro'),
  cactus: spr('m2_cactus'),
  palm: spr('m2_palm', (d, t) => (Math.floor(t * 1.5 + phase(d)) % 3 === 0 || gustAt(t) > 0.4 ? 1 : 0)),
  reeds: spr('m2_reeds', (d, t) => (Math.floor(t * 2 + phase(d)) % 2)),
  derrick: spr('m2_derrick', (d, t) => (Math.floor(t * 1.4 + phase(d)) % 2), 0),
  tank: spr('m2_tank', () => 0, 0),
  drums: spr('m2_drums'),
  column: spr('m2_column'),
  ruinwall: spr('m2_ruinwall'),
  bones: spr('m2_bones'),
  wreck: spr('m2_wreck'),
  tent: spr('m2_tent', (d, t) => (gustAt(t) > 0.3 ? Math.floor(t * 8) % 2 : Math.floor(t * 0.7 + phase(d)) % 5 === 0 ? 1 : 0)),
  flag: spr('m2_flag', (d, t) => Math.floor(t * (6 + gustAt(t) * 6) + phase(d)) % 4),
  sign: spr('m2_sign'),
  rocks: spr('m2_rocks'),
  vulture: spr('m2_vulture', (d, t) => (Math.floor(t * 0.8 + phase(d)) % 4 === 0 ? 1 : 0), 0),
};
