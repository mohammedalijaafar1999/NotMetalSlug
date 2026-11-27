// IRON CITADEL decor: props of the fortress-factory, drawn in world space by the theme.
// Every shape is baked once into a sprite ('m6d_*', pure PixelArt); renderers only blit them and
// add cheap animated touches (furnace glow + sparks, beacon sweeps, steam, sway, welding arcs).
//
// Kinds (DecorDef.kind -> props):
//   furnace        animated smelting furnace (glowing mouth, sparks, light pool)
//   chain          hanging chain from d.y (its top) + hook; props.len (px), load: 'ingot'|'robot'|'none'
//   banner         Legion banner hanging from d.y (its top); props.wave (default true)
//   pipes          riser pipes with flanges, a valve wheel and a gauge; leaks steam
//   beacon         rotating warning light; props.color 'amber'|'red', post (px, 0 = wall mounted)
//   scrap          heap of robot scrap (heads, arms, gears, plates)
//   ammo           Legion shell crates and artillery shells on a pallet
//   sign           hazard sign on a post; props.icon 'molten'|'crush'|'arrow'|'skull'|'volt'|'cog', post
//   girder         riveted I-beam column from the floor up; props.h (default 220)
//   arm            animated assembly-line welding arm
//   walker         a half-built war-walker leg hanging in its assembly cradle
//   emblem         big brass-cog Legion plaque (d.y = its centre)
//   wall           outer citadel wall section with crenellations (props.w, h); behindTerrain recommended
//   gate           the citadel gatehouse arch (portcullis raised) - stand-alone big backdrop
//   searchlight    lamp housing whose beam sweeps the night sky (d.y = lamp position)
//   reactor        the reactor core column for the shaft (d.y = its bottom); props.h
//   vent           wall fan vent (spinning blades)
//   crane          overhead crane rail segment with a trolley and hook block (d.y = rail y); props.w

import { sprites } from '../../../engine/sprites';
import { PixelArt, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import type { DecorRenderer } from '../../../game/theme';
import { ramp, shaded, type Ramp } from '../../vehicles/art';
import { M6, hash01 } from './palette';

const O = M6.outline;

// ------------------------------------------------------------------ small art helpers

/** Vertical cylinder (pipe) shading: lit left edge, dark right edge. */
function cylV(p: PixelArt, x: number, y: number, w: number, h: number, base: string): void {
  for (let i = 0; i < w; i++) {
    const t = w <= 1 ? 0.5 : i / (w - 1);
    let c = base;
    if (t < 0.2) c = shade(base, 0.18);
    else if (t < 0.42) c = shade(base, 0.34);
    else if (t > 0.85) c = shade(base, -0.34);
    else if (t > 0.65) c = shade(base, -0.16);
    p.rect(x + i, y, 1, h, c);
  }
}

/** Horizontal cylinder shading: lit top, dark bottom. */
function cylH(p: PixelArt, x: number, y: number, w: number, h: number, base: string): void {
  for (let j = 0; j < h; j++) {
    const t = h <= 1 ? 0.5 : j / (h - 1);
    let c = base;
    if (t < 0.25) c = shade(base, 0.3);
    else if (t > 0.8) c = shade(base, -0.34);
    else if (t > 0.6) c = shade(base, -0.14);
    p.rect(x, y + j, w, 1, c);
  }
}

function rv(p: PixelArt, x: number, y: number, light: string = M6.steelLL, dark: string = M6.steelDD): void {
  p.px(x, y, light);
  p.px(x + 1, y + 1, dark);
}

/** Legion brass cog: teeth, rim, hub. */
function cogArt(p: PixelArt, cx: number, cy: number, r: number, teeth = 8, base: string = M6.brass): void {
  const R = ramp(base, 0.3, -0.34);
  shaded(
    p,
    (m) => {
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        m.rotRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(1, r * 0.28), Math.max(1, r * 0.22), a, '#fff');
      }
      m.circle(cx, cy, r, '#fff');
    },
    R,
  );
  p.ring(cx, cy, r * 0.62, shade(base, -0.3), 1);
  p.circle(cx, cy, Math.max(1, r * 0.3), shade(base, -0.42));
  p.px(Math.round(cx - r * 0.45), Math.round(cy - r * 0.5), shade(base, 0.5));
}

const steelR: Ramp = ramp(M6.steel, 0.3, -0.3);
const ironR: Ramp = ramp(M6.iron, 0.28, -0.32);
const brickR: Ramp = ramp(M6.brick, 0.22, -0.3);

// ------------------------------------------------------------------ furnace

const FW = 64;
const FH = 96;
/** Mouth arch geometry (sprite space). */
const MOUTH = { cx: 32, by: 84, r: 13, h: 26 };

sprites.define({
  name: 'm6d_furnace',
  w: FW,
  h: FH,
  ox: FW / 2,
  oy: FH,
  frames: 4,
  draw: (p, f) => {
    const r = new Rng(808);
    // chimney + lip
    cylV(p, 26, 3, 12, 12, M6.iron);
    p.rect(24, 0, 16, 3, M6.ironL);
    p.rect(24, 2, 16, 1, M6.ironD);
    p.rect(26, 8, 12, 1, M6.ironD);
    // hood (trapezoid)
    shaded(p, (m) => m.poly([22, 14, 42, 14, 54, 27, 10, 27], '#fff'), ironR);
    for (let x = 13; x < 52; x += 6) rv(p, x, 24);
    // firebrick body (tapered)
    const top = 27;
    const bot = MOUTH.by;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const x0 = Math.round(12 - t * 8);
      const x1 = Math.round(52 + t * 8);
      const row = Math.floor((y - top) / 4);
      const off = row % 2 ? 4 : 0;
      for (let x = x0; x < x1; x++) {
        const bx = (x + off) % 8;
        const by = (y - top) % 4;
        let c: string = M6.brick;
        const k = hash01(Math.floor((x + off) / 8), row, 3);
        if (k < 0.3) c = M6.brickD;
        else if (k > 0.8) c = M6.brickL;
        if (bx === 0 || by === 3) c = M6.mortar;
        else if (by === 0) c = shade(c, 0.12);
        // edge light: left side lit, right side shadowed
        if (x - x0 < 2) c = shade(c, 0.16);
        if (x1 - x < 3) c = shade(c, -0.28);
        p.px(x, y, c);
      }
    }
    // iron bands with rivets
    for (const by of [36, 53, 70]) {
      const t = (by - top) / (bot - top);
      const x0 = Math.round(11 - t * 8);
      const x1 = Math.round(53 + t * 8);
      p.rect(x0, by, x1 - x0, 1, M6.ironL);
      p.rect(x0, by + 1, x1 - x0, 1, M6.iron);
      p.rect(x0, by + 2, x1 - x0, 1, M6.ironD);
      for (let x = x0 + 3; x < x1 - 2; x += 7) p.px(x, by + 1, M6.steelLL);
    }
    // peep holes (glow flickers with the frame)
    for (const [hx, ph] of [
      [22, 0],
      [42, 2],
    ] as const) {
      const on = (f + ph) % 4 < 3;
      p.circle(hx, 45, 2.6, M6.ironD);
      p.circle(hx, 45, 1.6, on ? M6.moltenL : M6.molten);
      p.px(hx, 45, on ? M6.moltenLL : M6.moltenL);
    }
    // warm light spilling onto the bricks around the mouth (dithered)
    for (let y = 52; y < bot; y++) {
      for (let x = 8; x < 57; x++) {
        const d = Math.hypot(x - MOUTH.cx, (y - (bot - 6)) * 1.3);
        if (d < 24 && d > 13 && (x + y) % 2 === 0 && p.opaque(x, y)) p.px(x, y, d < 18 ? '#9a4a22' : '#7a3a20');
      }
    }
    // mouth: arch frame
    const { cx, by, r: mr } = MOUTH;
    const archY = by - MOUTH.h + mr; // centre of the arch semicircle
    const inArch = (x: number, y: number, rad: number) => y <= by && (y >= archY ? Math.abs(x - cx) <= rad : Math.hypot(x - cx, y - archY) <= rad);
    for (let y = archY - mr - 3; y <= by; y++) {
      for (let x = cx - mr - 3; x <= cx + mr + 3; x++) {
        if (inArch(x + 0.5, y + 0.5, mr + 2.5) && !inArch(x + 0.5, y + 0.5, mr + 0.5)) p.px(x, y, y < archY - 4 || x < cx ? M6.ironL : M6.iron);
      }
    }
    // keystone + rivets on the arch
    p.rect(cx - 2, archY - mr - 4, 5, 4, M6.ironL);
    p.rect(cx - 2, archY - mr - 1, 5, 1, M6.ironD);
    // mouth interior: deep red edge -> orange -> flames -> white-hot coals
    for (let y = archY - mr; y <= by; y++) {
      for (let x = cx - mr; x <= cx + mr; x++) {
        if (!inArch(x + 0.5, y + 0.5, mr + 0.5)) continue;
        const edge = !inArch(x + 0.5, y + 0.5, mr - 1.5);
        const depth = (by - y) / MOUTH.h;
        let c: string = depth > 0.62 ? M6.crust : depth > 0.4 ? M6.moltenDD : M6.moltenD;
        if (edge) c = M6.moltenDD;
        p.px(x, y, c);
      }
    }
    // flame tongues
    for (let i = 0; i < 5; i++) {
      const fx = cx - 10 + i * 5 + ((f + i) % 2 ? 1 : -1);
      const hgt = 9 + Math.round(6 * Math.abs(Math.sin(f * 1.3 + i * 1.9))) + (i === 2 ? 4 : 0);
      p.poly([fx - 3, by, fx + 3, by, fx + ((f + i) % 3) - 1, by - hgt], M6.molten);
      p.poly([fx - 1.5, by, fx + 1.5, by, fx + ((f + i) % 3) - 1, by - hgt * 0.6], M6.moltenL);
    }
    // white-hot coal bed with dark lumps
    for (let x = cx - mr + 1; x <= cx + mr - 1; x++) {
      p.px(x, by - 1, M6.moltenLL);
      p.px(x, by - 2, (x + f) % 3 ? M6.moltenL : M6.moltenLL);
      if (hash01(x, f, 9) < 0.25) p.px(x, by - 1, M6.moltenD);
    }
    // base plinth (iron) + sill in front of the mouth
    shaded(p, (m) => m.rect(2, by, 60, FH - by, '#fff'), steelR);
    for (let x = 5; x < 60; x += 8) rv(p, x, by + 3);
    p.rect(2, by + 6, 60, 1, M6.steelD);
    shaded(p, (m) => m.rect(cx - mr - 3, by - 1, mr * 2 + 7, 3, '#fff'), ramp(M6.ironL, 0.3, -0.3));
    p.rect(cx - mr - 2, by - 1, mr * 2 + 5, 1, '#c8642a');
    // drip of slag over the sill
    p.rect(cx + 4, by + 2, 2, 3 + (f % 2), M6.moltenD);
    p.px(cx + 4, by + 2, M6.molten);
    void r;
  },
});

const furnace: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const k = Math.floor(time * 9 + d.x) % 4;
  sprites.get('m6d_furnace').draw(g, x, y, k);
  // light pool on the floor in front of the mouth
  const fl = 0.16 + 0.06 * Math.sin(time * 11 + d.x) + 0.04 * Math.sin(time * 23);
  g.fillStyle = M6.glow;
  for (let i = 0; i < 4; i++) {
    g.globalAlpha = fl * (1 - i * 0.22);
    const w = 44 + i * 16;
    g.fillRect(x - w / 2, y - 1 - (i === 0 ? 0 : 0), w, 1);
  }
  g.globalAlpha = fl * 0.6;
  g.fillRect(x - 15, y - 12 - MOUTH.h, 30, MOUTH.h);
  g.globalAlpha = 1;
  // sparks spitting out of the mouth: deterministic little arcs
  for (let i = 0; i < 6; i++) {
    const period = 1.1 + hash01(i, 1, d.x | 0) * 0.9;
    const t0 = hash01(i, 2, d.x | 0) * period;
    const t = ((time + t0) % period) / period;
    if (t > 0.7) continue;
    const vx = (hash01(i, 3, d.x | 0) - 0.5) * 70;
    const vy = -50 - hash01(i, 4, d.x | 0) * 50;
    const tt = t * 1.1;
    const sx = x + vx * tt;
    const sy = y - 6 + vy * tt + 120 * tt * tt;
    g.fillStyle = t < 0.3 ? M6.moltenLL : t < 0.5 ? M6.moltenL : M6.molten;
    g.fillRect(Math.round(sx), Math.round(sy), 1, 1);
  }
};

// ------------------------------------------------------------------ chain + hook + loads

sprites.define({
  name: 'm6d_link',
  w: 4,
  h: 5,
  outline: null,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      p.rect(1, 0, 2, 1, M6.ironL);
      p.rect(0, 1, 1, 3, M6.ironL);
      p.rect(3, 1, 1, 3, M6.ironD);
      p.rect(1, 4, 2, 1, M6.ironD);
      p.rect(1, 1, 2, 3, O);
    } else {
      p.rect(1, 0, 2, 5, O);
      p.rect(1, 0, 1, 5, M6.ironL);
      p.rect(2, 1, 1, 3, M6.iron);
    }
  },
});

sprites.define({
  name: 'm6d_hook',
  w: 11,
  h: 16,
  ox: 5,
  oy: 0,
  draw: (p) => {
    // pulley block
    shaded(p, (m) => m.rect(1, 0, 9, 6, '#fff'), ramp(M6.hazard, 0.25, -0.4));
    p.rect(2, 2, 7, 1, M6.hazardD);
    p.circle(5.5, 3.5, 1.3, M6.ironD);
    // shank + hook
    p.rect(4, 6, 3, 3, M6.iron);
    p.px(4, 6, M6.ironL);
    p.ring(5.5, 12, 3.5, M6.ironL, 2);
    p.mapPixels((v, x, y) => (x >= 7 && y >= 8 && y <= 11 ? 0 : v));
    p.px(8, 11, M6.ironL);
    p.px(9, 10, M6.steelLL);
  },
});

sprites.define({
  name: 'm6d_load',
  w: 20,
  h: 18,
  ox: 10,
  oy: 0,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      // strapped bundle of steel ingots
      p.line(10, 0, 3, 6, M6.ironD);
      p.line(10, 0, 17, 6, M6.ironD);
      for (let i = 0; i < 3; i++) shaded(p, (m) => m.rect(2 + i * 5.5, 7, 5, 9, '#fff'), ramp(M6.steelL, 0.3, -0.3));
      shaded(p, (m) => m.rect(4, 4, 12, 4, '#fff'), ramp(M6.steelL, 0.3, -0.3));
      p.rect(1, 10, 18, 2, M6.crimsonD);
      p.rect(1, 10, 18, 1, M6.crimson);
    } else {
      // a dead robot torso hanging from its neck ring (assembly line)
      p.line(10, 0, 10, 3, M6.ironD);
      shaded(p, (m) => m.ellipse(10, 10, 7, 6.5, '#fff'), ramp('#8a6a2a', 0.3, -0.35));
      shaded(p, (m) => m.ellipse(10, 4.5, 4, 3, '#fff'), ramp('#6a5a4a', 0.3, -0.3));
      p.rect(8, 4, 4, 2, M6.steelDD);
      p.px(9, 4, '#5a2a1a');
      p.rect(5, 9, 10, 1, '#5a4218');
      p.circle(10, 12, 2, '#3a2a1a');
      p.px(9, 11, '#7a5a2a');
      p.rect(3, 14, 2, 4, M6.ironD);
      p.rect(15, 14, 2, 4, M6.ironD);
    }
  },
});

const chain: DecorRenderer = (g, d, time) => {
  const len: number = d.props?.len ?? 60;
  const n = Math.max(2, Math.floor(len / 4));
  const amp = d.props?.sway ?? 2.5;
  const sw = Math.sin(time * 1.15 + d.x * 0.37) * amp;
  const link = sprites.get('m6d_link');
  const x0 = Math.round(d.x);
  for (let k = 0; k < n; k++) {
    const t = k / n;
    const x = Math.round(x0 + sw * t * t);
    link.draw(g, x, d.y + k * 4 + 5, k % 2);
  }
  const ex = Math.round(x0 + sw);
  const ey = Math.round(d.y + n * 4);
  sprites.get('m6d_hook').draw(g, ex, ey);
  const load = d.props?.load;
  if (load === 'ingot' || load === 'robot') sprites.get('m6d_load').draw(g, ex, ey + 14, load === 'robot' ? 1 : 0);
};

// ------------------------------------------------------------------ banner

const BW = 22;
const BH = 50;
sprites.define({
  name: 'm6d_banner',
  w: BW,
  h: BH,
  ox: BW / 2,
  oy: 0,
  frames: 4,
  draw: (p, f) => {
    const wave = [0, 1, 0, -1][f];
    // rod with knobs
    p.rect(0, 1, BW, 2, M6.brass);
    p.rect(0, 1, BW, 1, M6.brassL);
    p.circle(1, 2, 1.6, M6.brassL);
    p.circle(BW - 2, 2, 1.6, M6.brass);
    // cloth
    const top = 4;
    const bot = 44;
    for (let y = top; y < bot + 1; y++) {
      const t = (y - top) / (bot - top);
      const off = Math.round(wave * t * t * 1.5);
      const xl = 2 + off;
      const xr = BW - 3 + off;
      // swallowtail notch
      const notch = y > bot - 7 ? Math.round(((y - (bot - 7)) / 7) * 5) : 0;
      for (let x = xl; x <= xr; x++) {
        if (y > bot - 7 && Math.abs(x - (BW / 2 - 0.5 + off)) < notch) continue;
        let c: string = M6.crimson;
        const u = x - xl;
        // folds that drift with the wave
        const fold1 = 6 + (f % 2);
        const fold2 = 13 - (f % 2);
        if (u === fold1 || u === fold2) c = M6.crimsonD;
        else if (u === fold1 - 1 || u === fold2 - 1) c = M6.crimsonL;
        if (u === 1 || x === xr - 1) c = M6.brassD;
        if (u === 0) c = M6.crimsonL;
        if (x === xr) c = M6.crimsonD;
        p.px(x, y, c);
      }
    }
    p.rect(2, top, BW - 4, 2, M6.brassD);
    p.rect(2, top, BW - 4, 1, M6.brass);
    // emblem: brass cog + two insignia bars
    cogArt(p, BW / 2 - 0.5 + Math.round(wave * 0.2), 19, 5, 8);
    const ow = Math.round(wave * 0.6);
    p.rect(6 + ow, 29, 9, 1, M6.brass);
    p.rect(6 + ow, 30, 9, 1, M6.brassD);
    p.rect(7 + ow, 32, 7, 1, M6.brass);
    p.rect(7 + ow, 33, 7, 1, M6.brassD);
  },
});

const banner: DecorRenderer = (g, d, time) => {
  const k = d.props?.wave === false ? 0 : Math.floor(time * 3 + d.x * 0.1) % 4;
  sprites.get('m6d_banner').draw(g, Math.round(d.x), Math.round(d.y), k);
};

// ------------------------------------------------------------------ pipes

sprites.define({
  name: 'm6d_pipes',
  w: 42,
  h: 74,
  ox: 21,
  oy: 74,
  draw: (p) => {
    // footings
    shaded(p, (m) => m.rect(2, 68, 38, 6, '#fff'), steelR);
    // thick riser
    cylV(p, 4, 0, 9, 68, M6.ironL);
    for (const fy of [8, 36, 60]) {
      cylV(p, 3, fy, 11, 3, M6.steelLL);
      p.px(4, fy + 1, M6.steelLLL);
      p.px(12, fy + 1, M6.steelD);
    }
    // gauge on the thick riser
    p.circle(8.5, 24, 4.5, M6.ironD);
    p.circle(8.5, 24, 3.5, '#d8d0b8');
    p.px(7, 22, '#ffffff');
    p.line(8.5, 24, 10.5, 22, M6.redD);
    p.px(8, 24, O);
    // medium riser with an elbow to the right
    cylV(p, 18, 16, 7, 52, M6.iron);
    cylH(p, 18, 12, 24, 7, M6.iron);
    p.rect(18, 12, 7, 7, shade(M6.iron, 0.1));
    p.px(18, 12, M6.ironL);
    for (const fx of [30, 38]) {
      cylV(p, fx, 11, 2, 9, M6.steelLL);
    }
    cylV(p, 17, 44, 9, 3, M6.steelLL);
    // valve body + wheel on the medium riser
    shaded(p, (m) => m.rect(16, 31, 11, 7, '#fff'), ramp(M6.steelL, 0.3, -0.3));
    p.ring(21.5, 28, 5, M6.crimsonL, 1);
    p.ring(21.5, 28, 4, M6.crimson, 1);
    p.line(17.5, 28, 25.5, 28, M6.crimsonD);
    p.line(21.5, 24, 21.5, 32, M6.crimsonD);
    p.circle(21.5, 28, 1.3, M6.brass);
    // thin pipe with a little stop-cock
    cylV(p, 32, 30, 4, 38, M6.steelL);
    shaded(p, (m) => m.rect(30, 48, 8, 4, '#fff'), ramp(M6.brassD, 0.3, -0.3));
    p.rect(36, 45, 4, 2, M6.brass);
    // stencil band on the thick riser
    p.rect(4, 48, 9, 3, M6.hazard);
    for (let i = 0; i < 9; i += 3) p.rect(4 + i, 48, 1, 3, M6.hazardD);
  },
});

const pipes: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  sprites.get('m6d_pipes').draw(g, x, y);
  // steam leaking from the elbow flange in puffs
  const per = 2.6 + hash01(x, 5) * 1.6;
  const t = (time + hash01(x, 6) * per) % per;
  if (t < 1.2) {
    const k = t / 1.2;
    for (let i = 0; i < 5; i++) {
      const px = x + 17 + i * 2 + k * 10;
      const py = y - 64 - k * 18 - (i % 2) * 3;
      g.globalAlpha = (1 - k) * 0.55;
      g.fillStyle = i % 2 ? '#b8b0b8' : '#8a8490';
      const s = 1 + Math.floor(k * 3);
      g.fillRect(Math.round(px), Math.round(py), s, s);
    }
    g.globalAlpha = 1;
  }
};

// ------------------------------------------------------------------ beacon

function beaconArt(lit: string, mid: string, dark: string): (p: PixelArt, f: number) => void {
  return (p, f) => {
    // bracket
    shaded(p, (m) => m.rect(1, 8, 8, 4, '#fff'), ironR);
    p.px(2, 10, M6.steelLL);
    p.px(7, 10, M6.steelLL);
    // glass dome
    p.ellipse(5, 7, 4, 5.5, dark);
    p.rect(1, 7, 8, 1, dark);
    for (let y = 2; y < 8; y++) for (let x = 1; x < 9; x++) if (p.opaque(x, y) && Math.hypot(x - 4.5, (y - 7) * 0.8) < 3.6) p.px(x, y, mid);
    // rotating reflector: bright band sweeping across
    const sx = [1, 3, 5, 7, 7, 5, 3, 1][f];
    for (let y = 2; y < 8; y++) for (let x = sx; x < sx + 2; x++) if (p.opaque(x, y)) p.px(x, y, lit);
    p.px(sx, 3, '#ffffff');
    // cap
    p.rect(3, 0, 4, 2, M6.ironL);
  };
}
sprites.define({ name: 'm6d_beacon_amber', w: 10, h: 12, frames: 8, draw: beaconArt('#fff0a0', M6.amber, '#a06010') });
sprites.define({ name: 'm6d_beacon_red', w: 10, h: 12, frames: 8, draw: beaconArt('#ffd0c0', M6.red, M6.redD) });

const beacon: DecorRenderer = (g, d, time) => {
  const red = d.props?.color === 'red';
  const post: number = d.props?.post ?? 0;
  const x = Math.round(d.x);
  let y = Math.round(d.y);
  if (post > 0) {
    g.fillStyle = O;
    g.fillRect(x - 2, y - post, 4, post);
    g.fillStyle = M6.iron;
    g.fillRect(x - 1, y - post, 2, post);
    g.fillStyle = M6.ironL;
    g.fillRect(x - 1, y - post, 1, post);
    y -= post;
  }
  const spin = time * 5 + d.x * 0.05;
  const f = Math.floor(((spin / (Math.PI * 2)) % 1) * 8 + 8) % 8;
  sprites.get(red ? 'm6d_beacon_red' : 'm6d_beacon_amber').draw(g, x, y, f);
  // sweeping beam (crisp stepped rects) + halo
  const c = Math.cos(spin);
  const dir = c >= 0 ? 1 : -1;
  const reach = Math.abs(c);
  g.fillStyle = red ? M6.red : M6.amber;
  const cy = y - 7;
  for (let i = 0; i < 14; i++) {
    const w = 4;
    const bx = x + dir * (4 + i * w);
    const hh = 1 + Math.floor(i / 3);
    g.globalAlpha = 0.22 * reach * (1 - i / 14);
    g.fillRect(dir > 0 ? bx : bx - w, cy - hh, w, hh * 2 + 1);
  }
  g.globalAlpha = 0.12 + 0.1 * reach;
  g.fillRect(x - 7, cy - 6, 14, 12);
  g.globalAlpha = 1;
};

// ------------------------------------------------------------------ scrap heap

sprites.define({
  name: 'm6d_scrap',
  w: 50,
  h: 24,
  draw: (p) => {
    const r = new Rng(31);
    // mound of dark plates
    shaded(p, (m) => m.poly([0, 24, 6, 14, 14, 9, 24, 6, 34, 8, 42, 13, 50, 24], '#fff'), ramp(M6.steelD, 0.28, -0.3));
    for (let i = 0; i < 9; i++) {
      const x = r.range(6, 44);
      const y = r.range(12, 21);
      p.rotRect(x, y, r.range(3, 6), r.range(1, 2), r.range(-0.6, 0.6), r.pick([M6.steel, M6.steelL, M6.iron, M6.ironD]));
    }
    // robot head (dead eye)
    shaded(p, (m) => m.circle(15, 10, 5.5, '#fff'), ramp('#8a6a2a', 0.28, -0.34));
    p.rect(12, 9, 6, 3, '#2a1c14');
    p.circle(15, 10.5, 1.2, '#5a2a1a');
    p.rect(14, 3, 1, 3, M6.ironL);
    p.px(14, 2, M6.redD);
    // gear
    cogArt(p, 31, 11, 4.2, 8, '#8a6a2a');
    // arm with claw
    shaded(p, (m) => m.capsule(36, 7, 45, 13, 2, '#fff'), ramp(M6.steelL, 0.3, -0.3));
    p.line(45, 13, 48, 11, M6.ironL);
    p.line(45, 13, 48, 16, M6.ironL);
    // spring
    for (let i = 0; i < 4; i++) p.line(22 + i * 2, 16, 23 + i * 2, 19, i % 2 ? '#7a5a20' : '#a8822e');
    // a few rust flecks
    for (let i = 0; i < 12; i++) {
      const x = r.int(4, 46);
      const y = r.int(13, 23);
      if (p.opaque(x, y)) p.px(x, y, '#5a3020');
    }
  },
});

// ------------------------------------------------------------------ ammo crates + shells

const OLIVE = '#4c4a36';
sprites.define({
  name: 'm6d_ammo',
  w: 46,
  h: 30,
  draw: (p) => {
    const ol = ramp(OLIVE, 0.3, -0.34);
    // pallet
    p.rect(0, 27, 46, 3, '#3a2a1e');
    p.rect(0, 27, 46, 1, '#5a4430');
    for (const x of [2, 20, 40]) p.rect(x, 28, 4, 2, '#2a1e16');
    // two stacked steel ammo boxes
    shaded(p, (m) => m.rect(1, 14, 22, 13, '#fff'), ol);
    shaded(p, (m) => m.rect(4, 3, 17, 11, '#fff'), ol);
    for (const [bx, by, bw] of [
      [1, 14, 22],
      [4, 3, 17],
    ] as const) {
      p.rect(bx + 2, by + 3, bw - 4, 1, shade(OLIVE, -0.3));
      p.rect(bx + Math.floor(bw / 2) - 3, by + 1, 6, 1, M6.ironD);
      // Legion stripe + cog stencil
      p.rect(bx + 1, by + 6, bw - 2, 2, M6.crimsonD);
      p.rect(bx + 1, by + 6, bw - 2, 1, M6.crimson);
      p.circle(bx + 5, by + 9.5, 1.6, '#a8986a');
      p.px(bx + 5, by + 9, OLIVE);
    }
    // artillery shells
    for (const sx of [26, 32, 38]) {
      shaded(p, (m) => m.rect(sx, 13, 5, 14, '#fff'), ramp(M6.brass, 0.32, -0.32));
      shaded(p, (m) => m.poly([sx, 13, sx + 5, 13, sx + 4, 8, sx + 2.5, 5, sx + 1, 8], '#fff'), ramp(M6.steel, 0.35, -0.3));
      p.rect(sx, 12, 5, 1, '#b8642e');
      p.rect(sx, 25, 5, 1, M6.brassD);
    }
  },
});

// ------------------------------------------------------------------ hazard signs

const ICONS = ['molten', 'crush', 'arrow', 'skull', 'volt', 'cog'];
sprites.define({
  name: 'm6d_sign',
  w: 15,
  h: 15,
  frames: ICONS.length,
  draw: (p, f) => {
    // plate: hazard yellow with a black inner border
    p.rect(0, 0, 15, 15, M6.hazard);
    p.rect(0, 0, 15, 1, shade(M6.hazard, 0.25));
    p.rect(0, 14, 15, 1, shade(M6.hazard, -0.3));
    p.box(1, 1, 13, 13, M6.hazardD);
    const k = M6.hazardD;
    switch (ICONS[f]) {
      case 'molten':
        p.poly([7.5, 3, 10.5, 8, 7.5, 10, 4.5, 8], k);
        p.circle(7.5, 8, 3, k);
        p.rect(3, 11, 9, 1, k);
        p.px(6, 7, M6.hazard);
        break;
      case 'crush':
        p.rect(4, 3, 7, 3, k);
        p.rect(7, 6, 1, 2, k);
        p.poly([4, 8, 11, 8, 7.5, 11], k);
        p.rect(3, 12, 9, 1, k);
        break;
      case 'arrow':
        p.rect(3, 6, 6, 3, k);
        p.poly([8, 3.5, 12.5, 7.5, 8, 11.5], k);
        break;
      case 'skull':
        p.circle(7.5, 6.5, 3.6, k);
        p.rect(5, 9, 5, 3, k);
        p.px(6, 6, M6.hazard);
        p.px(9, 6, M6.hazard);
        p.px(6, 7, M6.hazard);
        p.px(9, 7, M6.hazard);
        p.px(7, 11, M6.hazard);
        break;
      case 'volt':
        p.poly([9, 2.5, 4.5, 8, 7.5, 8, 6, 12.5, 10.5, 7, 7.5, 7], k);
        break;
      default:
        cogArt(p, 7.5, 7.5, 3.6, 8, M6.hazardD);
    }
  },
});

const sign: DecorRenderer = (g, d) => {
  const icon = Math.max(0, ICONS.indexOf(d.props?.icon ?? 'skull'));
  const post: number = d.props?.post ?? 16;
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  if (post > 0) {
    g.fillStyle = O;
    g.fillRect(x - 2, y - post, 4, post);
    g.fillStyle = M6.ironL;
    g.fillRect(x - 1, y - post, 1, post);
    g.fillStyle = M6.iron;
    g.fillRect(x, y - post, 1, post);
  }
  sprites.get('m6d_sign').draw(g, x, y - post, icon);
};

// ------------------------------------------------------------------ girder column

sprites.define({
  name: 'm6d_girder_seg',
  w: 12,
  h: 16,
  outline: null,
  draw: (p) => {
    p.rect(0, 0, 12, 16, O);
    p.rect(1, 0, 2, 16, M6.ironL);
    p.rect(3, 0, 6, 16, M6.ironD);
    p.rect(9, 0, 2, 16, M6.iron);
    // lightening hole in the web
    p.ellipse(6, 8, 1.6, 3.6, M6.steelDD);
    p.px(5, 5, M6.iron);
    // rivets on the flanges
    p.px(2, 3, M6.steelLL);
    p.px(2, 11, M6.steelLL);
    p.px(10, 3, M6.ironL);
    p.px(10, 11, M6.ironL);
  },
});

sprites.define({
  name: 'm6d_girder_base',
  w: 18,
  h: 6,
  draw: (p) => {
    shaded(p, (m) => m.rect(0, 1, 18, 5, '#fff'), steelR);
    rv(p, 2, 3);
    rv(p, 14, 3);
    p.rect(3, 0, 12, 1, M6.ironL);
  },
});

const girder: DecorRenderer = (g, d) => {
  const h: number = d.props?.h ?? 220;
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const seg = sprites.get('m6d_girder_seg');
  for (let yy = y - 4; yy > y - h; yy -= 16) seg.draw(g, x, yy);
  sprites.get('m6d_girder_base').draw(g, x, y);
};

// ------------------------------------------------------------------ welding arm

const ARM_FRAMES = 8;
sprites.define({
  name: 'm6d_arm',
  w: 40,
  h: 46,
  ox: 14,
  oy: 46,
  frames: ARM_FRAMES,
  draw: (p, f) => {
    // pedestal with hazard stripes
    shaded(p, (m) => m.rect(4, 38, 20, 8, '#fff'), steelR);
    for (let i = 0; i < 20; i += 4) p.rect(4 + i, 39, 2, 2, M6.hazard);
    shaded(p, (m) => m.ellipse(14, 37, 7, 3, '#fff'), ironR);
    // pose: shoulder swings, elbow folds
    const ph = (f / ARM_FRAMES) * Math.PI * 2;
    const a1 = -1.2 + Math.sin(ph) * 0.35;
    const a2 = 0.9 + Math.sin(ph + 1.2) * 0.45;
    const sx = 14;
    const sy = 33;
    const ex = sx + Math.cos(a1) * 15;
    const ey = sy + Math.sin(a1) * 15;
    const wx = ex + Math.cos(a1 + a2) * 13;
    const wy = ey + Math.sin(a1 + a2) * 13;
    const armR = ramp('#a07a2a', 0.3, -0.36);
    shaded(p, (m) => m.capsule(sx, sy, ex, ey, 3, '#fff'), armR);
    shaded(p, (m) => m.capsule(ex, ey, wx, wy, 2.2, '#fff'), armR);
    p.line(sx + 1, sy - 2, ex + 1, ey - 2, M6.steelDD);
    shaded(p, (m) => m.circle(sx, sy, 3.4, '#fff'), ramp(M6.crimson, 0.3, -0.3));
    shaded(p, (m) => m.circle(ex, ey, 2.6, '#fff'), ramp(M6.crimson, 0.3, -0.3));
    p.px(Math.round(sx), Math.round(sy), M6.brassL);
    p.px(Math.round(ex), Math.round(ey), M6.brassL);
    // torch head
    const tx = wx + Math.cos(a1 + a2) * 4;
    const ty = wy + Math.sin(a1 + a2) * 4;
    p.line(wx, wy, tx, ty, M6.steelLL, 2);
    p.px(Math.round(tx), Math.round(ty), M6.ironD);
  },
});

/** Torch tip position for an arm frame (sprite-local, relative to the origin). */
function armTip(f: number): [number, number] {
  const ph = (f / ARM_FRAMES) * Math.PI * 2;
  const a1 = -1.2 + Math.sin(ph) * 0.35;
  const a2 = 0.9 + Math.sin(ph + 1.2) * 0.45;
  const ex = 14 + Math.cos(a1) * 15;
  const ey = 33 + Math.sin(a1) * 15;
  const wx = ex + Math.cos(a1 + a2) * 17;
  const wy = ey + Math.sin(a1 + a2) * 17;
  return [wx - 14, wy - 46];
}

const arm: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const flip = !!d.props?.flip;
  const f = Math.floor(time * 4 + d.x * 0.01) % ARM_FRAMES;
  sprites.get('m6d_arm').draw(g, x, y, f, { flip });
  // welding arc on the "down" frames
  const [tx, ty] = armTip(f);
  const ax = x + (flip ? -tx : tx);
  const ay = y + ty;
  if (Math.sin((f / ARM_FRAMES) * Math.PI * 2 + 1.2) > 0.1) {
    const on = hash01(Math.floor(time * 30), x, 3) < 0.7;
    if (on) {
      g.fillStyle = '#e8f4ff';
      g.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      g.globalAlpha = 0.25;
      g.fillStyle = '#9ad8ff';
      g.fillRect(Math.round(ax) - 5, Math.round(ay) - 5, 11, 11);
      g.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        const k = hash01(Math.floor(time * 20), i, x);
        g.fillStyle = i % 2 ? M6.moltenLL : M6.moltenL;
        g.fillRect(Math.round(ax + (k - 0.5) * 12), Math.round(ay + k * 8), 1, 1);
      }
    }
  }
};

// ------------------------------------------------------------------ half-built walker in its cradle

sprites.define({
  name: 'm6d_walker',
  w: 76,
  h: 120,
  draw: (p) => {
    // cradle: two posts + top beam + hazard foot plates
    for (const x of [2, 66]) {
      shaded(p, (m) => m.rect(x, 6, 8, 114, '#fff'), ironR);
      for (let y = 10; y < 116; y += 10) p.px(x + 2, y, M6.steelLL);
    }
    shaded(p, (m) => m.rect(0, 0, 76, 8, '#fff'), ironR);
    for (let x = 4; x < 74; x += 8) p.px(x, 3, M6.steelLL);
    for (const x of [0, 64]) {
      p.rect(x, 114, 12, 6, M6.hazard);
      for (let i = 0; i < 12; i += 4) p.rect(x + i, 114, 2, 6, M6.hazardD);
    }
    // hanging chains
    p.line(26, 8, 26, 22, M6.ironD);
    p.line(50, 8, 50, 22, M6.ironD);
    // hip block (crimson + brass)
    const crim = ramp(M6.crimson, 0.3, -0.35);
    const brass = ramp(M6.brassD, 0.34, -0.3);
    shaded(p, (m) => m.poly([20, 22, 56, 22, 60, 34, 16, 34], '#fff'), crim);
    for (let x = 22; x < 56; x += 6) p.px(x, 25, M6.brassL);
    // thigh (exposed frame + piston)
    shaded(p, (m) => m.poly([28, 34, 44, 34, 48, 64, 34, 66], '#fff'), ramp(M6.steel, 0.3, -0.3));
    p.line(31, 38, 41, 62, M6.steelDD, 1);
    p.line(39, 37, 45, 60, M6.steelDD, 1);
    shaded(p, (m) => m.capsule(46, 36, 50, 60, 2, '#fff'), brass);
    p.line(48, 44, 48, 58, M6.steelLLL);
    // knee joint (backwards) + armour plate half-fitted
    shaded(p, (m) => m.circle(42, 67, 6, '#fff'), crim);
    p.circle(42, 67, 2.4, M6.brass);
    shaded(p, (m) => m.poly([18, 40, 28, 36, 30, 58, 20, 62], '#fff'), crim);
    rv(p, 22, 44, M6.brassL, M6.crimsonD);
    rv(p, 24, 54, M6.brassL, M6.crimsonD);
    // shin
    shaded(p, (m) => m.poly([38, 70, 46, 70, 38, 102, 30, 100], '#fff'), ramp(M6.steel, 0.3, -0.3));
    shaded(p, (m) => m.capsule(46, 72, 40, 98, 1.6, '#fff'), brass);
    // foot (not yet attached: resting on a stand)
    shaded(p, (m) => m.poly([22, 108, 50, 108, 54, 116, 18, 116], '#fff'), crim);
    p.rect(20, 116, 32, 4, M6.ironD);
    p.rect(24, 109, 22, 1, M6.crimsonL);
    // dangling cables from the knee
    p.line(36, 70, 33, 84, M6.ironD);
    p.line(37, 71, 35, 88, '#5a3a1a');
  },
});

// ------------------------------------------------------------------ Legion emblem plaque

sprites.define({
  name: 'm6d_emblem',
  w: 42,
  h: 42,
  ox: 21,
  oy: 21,
  draw: (p) => {
    shaded(p, (m) => m.circle(21, 21, 20, '#fff'), ramp(M6.crimsonD, 0.3, -0.3));
    p.ring(21, 21, 19, M6.brassD, 2);
    p.ring(21, 21, 19.5, M6.brass, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.px(Math.round(21 + Math.cos(a) * 17), Math.round(21 + Math.sin(a) * 17), M6.brassL);
    }
    cogArt(p, 21, 21, 10.5, 10);
    // crossed pistons behind the hub
    p.line(15, 27, 27, 15, M6.brassD, 2);
    p.line(15, 15, 27, 27, M6.brassD, 2);
    p.circle(21, 21, 4, M6.brass);
    p.circle(21, 21, 2, M6.crimsonD);
  },
});

const emblem: DecorRenderer = (g, d) => sprites.get('m6d_emblem').draw(g, Math.round(d.x), Math.round(d.y));

// ------------------------------------------------------------------ outer wall + gatehouse

const STONE = '#3a3340';
function stoneWall(p: PixelArt, x0: number, y0: number, w: number, h: number, seed: number): void {
  const r = new Rng(seed);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 7);
    const off = row % 2 ? 7 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const bx = (x - x0 + off) % 14;
      const by = (y - y0) % 7;
      let c = shade(STONE, (hash01(Math.floor((x - x0 + off) / 14), row, seed) - 0.5) * 0.24);
      if (bx === 0 || by === 6) c = '#211c26';
      else if (by === 0) c = shade(c, 0.14);
      else if (bx === 1) c = shade(c, 0.08);
      p.px(x, y, c);
    }
  }
  void r;
}

function wallArt(w: number, h: number, seed: number): (p: PixelArt) => void {
  return (p) => {
    stoneWall(p, 0, 8, w, h - 8, seed);
    // crenellations
    for (let x = 0; x < w; x += 12) {
      stoneWall(p, x, 0, 7, 9, seed + x);
      p.rect(x, 0, 7, 1, shade(STONE, 0.2));
    }
    p.rect(0, 8, w, 1, shade(STONE, 0.2));
    p.rect(0, 11, w, 2, '#211c26');
    // arrow slits with a faint glow
    for (let x = 16; x < w - 10; x += 34) {
      p.rect(x, 24, 3, 12, '#120e16');
      p.rect(x + 1, 27, 1, 7, '#5a2a18');
      p.rect(x, 60, 3, 12, '#120e16');
      if (hash01(x, 9, seed) < 0.5) p.rect(x + 1, 63, 1, 7, '#7a3a1e');
    }
    // soot streaks under the slits
    for (let x = 16; x < w - 10; x += 34) for (let k = 0; k < 10; k++) if (k % 2 === 0) p.px(x + 1, 37 + k, '#2a2430');
  };
}

const WALL_W = 160;
const WALL_H = 120;
sprites.define({ name: 'm6d_wall', w: WALL_W, h: WALL_H, ox: 0, oy: WALL_H, draw: wallArt(WALL_W, WALL_H, 5) });

const GATE_W = 150;
const GATE_H = 176;
sprites.define({
  name: 'm6d_gate',
  w: GATE_W,
  h: GATE_H,
  oy: GATE_H,
  draw: (p) => {
    // two towers + a curtain between them
    const tw = 40;
    stoneWall(p, 0, 22, tw, GATE_H - 22, 11);
    stoneWall(p, GATE_W - tw, 22, tw, GATE_H - 22, 12);
    stoneWall(p, tw, 46, GATE_W - tw * 2, GATE_H - 46, 13);
    for (const tx of [0, GATE_W - tw]) {
      for (let x = 0; x < tw; x += 10) {
        stoneWall(p, tx + x, 12, 6, 11, 20 + x);
        p.rect(tx + x, 12, 6, 1, shade(STONE, 0.22));
      }
      p.rect(tx - 1, 22, tw + 2, 3, '#211c26');
      p.rect(tx - 1, 21, tw + 2, 1, shade(STONE, 0.22));
      // tower slits glowing
      p.rect(tx + tw / 2 - 1, 40, 3, 14, '#120e16');
      p.rect(tx + tw / 2, 43, 1, 9, '#c8642a');
      p.rect(tx + tw / 2 - 1, 84, 3, 14, '#120e16');
      p.rect(tx + tw / 2, 87, 1, 9, '#7a3a1e');
    }
    for (let x = tw; x < GATE_W - tw; x += 10) {
      stoneWall(p, x, 38, 6, 9, 40 + x);
      p.rect(x, 38, 6, 1, shade(STONE, 0.22));
    }
    // the arch opening (passage), dark inside with a raised portcullis
    const ax0 = tw + 6;
    const ax1 = GATE_W - tw - 6;
    const acx = (ax0 + ax1) / 2;
    const ar = (ax1 - ax0) / 2;
    const ay = GATE_H - 62;
    for (let y = ay - ar - 3; y < GATE_H; y++) {
      for (let x = ax0 - 3; x <= ax1 + 3; x++) {
        const inside = y >= ay ? x >= ax0 && x <= ax1 : Math.hypot(x - acx, y - ay) <= ar;
        const rim = y >= ay ? x >= ax0 - 3 && x <= ax1 + 3 : Math.hypot(x - acx, y - ay) <= ar + 3;
        if (inside) {
          const depth = (y - (ay - ar)) / (GATE_H - (ay - ar));
          p.px(x, y, depth > 0.75 ? '#1a1218' : '#100c12');
        } else if (rim) p.px(x, y, y < ay ? shade(STONE, 0.12) : shade(STONE, -0.12));
      }
    }
    // voussoirs
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      p.line(acx + Math.cos(a) * (ar + 0.5), ay + Math.sin(a) * (ar + 0.5), acx + Math.cos(a) * (ar + 3), ay + Math.sin(a) * (ar + 3), '#211c26');
    }
    // raised portcullis teeth peeking out of the arch top
    for (let x = ax0 + 3; x < ax1 - 2; x += 6) {
      p.rect(x, ay - ar + 6, 2, 16, M6.ironD);
      p.px(x, ay - ar + 6, M6.ironL);
      p.poly([x - 0.5, ay - ar + 21, x + 2.5, ay - ar + 21, x + 1, ay - ar + 25], M6.ironD);
    }
    p.rect(ax0 + 2, ay - ar + 10, ax1 - ax0 - 3, 2, M6.iron);
    p.rect(ax0 + 2, ay - ar + 17, ax1 - ax0 - 3, 2, M6.iron);
    // inner glow at the far end of the passage (the factory beyond)
    for (let y = ay - 4; y < GATE_H; y++) for (let x = ax0 + 8; x < ax1 - 8; x++) if ((x + y) % 2 === 0 && y > GATE_H - 30) p.px(x, y, '#3a1a14');
    // keystone emblem
    cogArt(p, acx, ay - ar - 9, 6, 8);
  },
});

const wall: DecorRenderer = (g, d) => {
  const w: number = d.props?.w ?? WALL_W;
  const s = sprites.get('m6d_wall');
  for (let x = 0; x < w; x += WALL_W) s.draw(g, Math.round(d.x + x), Math.round(d.y));
};

const gate: DecorRenderer = (g, d) => sprites.get('m6d_gate').draw(g, Math.round(d.x), Math.round(d.y));

// ------------------------------------------------------------------ searchlight

sprites.define({
  name: 'm6d_searchlight',
  w: 16,
  h: 14,
  frames: 1,
  draw: (p) => {
    shaded(p, (m) => m.rect(3, 10, 10, 4, '#fff'), ironR);
    p.rect(7, 6, 2, 4, M6.ironD);
    shaded(p, (m) => m.ellipse(8, 5, 6, 4.5, '#fff'), ironR);
    p.ellipse(9, 5, 3.4, 3, '#e8e0c0');
    p.px(8, 4, '#ffffff');
  },
});

const searchlight: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  // beam: a long thin wedge sweeping back and forth across the sky
  const a = -Math.PI / 2 + Math.sin(time * 0.45 + d.x * 0.013) * 0.62;
  const c = Math.cos(a);
  const s = Math.sin(a);
  g.fillStyle = '#e8e0c0';
  for (let i = 4; i < 230; i += 3) {
    const bx = x + c * i;
    const by = y - 6 + s * i;
    const half = 1 + i * 0.07;
    g.globalAlpha = 0.11 * (1 - i / 240);
    g.fillRect(Math.round(bx - half), Math.round(by - 1), Math.round(half * 2), 3);
  }
  g.globalAlpha = 1;
  sprites.get('m6d_searchlight').draw(g, x, y);
};

// ------------------------------------------------------------------ reactor core column

const REACT_W = 64;
sprites.define({
  name: 'm6d_reactor_seg',
  w: REACT_W,
  h: 24,
  outline: null,
  frames: 4,
  draw: (p, f) => {
    const cx = REACT_W / 2;
    // iron cage posts
    for (const x of [4, REACT_W - 10]) {
      p.rect(x, 0, 6, 24, O);
      cylV(p, x + 1, 0, 4, 24, M6.iron);
    }
    // glass tube with the glowing core
    for (let x = 12; x < REACT_W - 12; x++) {
      const u = (x - 12) / (REACT_W - 25);
      const k = Math.abs(u - 0.5) * 2; // 0 centre .. 1 edge
      let c = '#2a1620';
      if (k < 0.25) c = f % 2 ? '#fff6d0' : '#ffe8a0';
      else if (k < 0.45) c = '#ffb43a';
      else if (k < 0.7) c = '#e0601a';
      else if (k < 0.9) c = '#7a2a18';
      for (let y = 0; y < 24; y++) {
        let cc = c;
        // energy ripple travelling up
        if (k < 0.7 && (y + f * 6) % 24 < 3) cc = shade(c, 0.25);
        p.px(x, y, cc);
      }
    }
    // glass highlight
    p.rect(15, 0, 1, 24, '#ffd8a0');
    // clamp ring
    p.rect(8, 10, REACT_W - 16, 4, O);
    cylH(p, 9, 10, REACT_W - 18, 3, M6.steelL);
    p.rect(cx - 2, 11, 4, 1, M6.red);
  },
});

const reactor: DecorRenderer = (g, d, time) => {
  const h: number = d.props?.h ?? 240;
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const f = Math.floor(time * 8) % 4;
  const seg = sprites.get('m6d_reactor_seg');
  for (let yy = y; yy > y - h; yy -= 24) seg.draw(g, x, yy, f);
  // pulse halo
  const pulse = 0.08 + 0.06 * Math.sin(time * 3.1);
  g.fillStyle = '#ff8a2a';
  g.globalAlpha = pulse;
  g.fillRect(x - REACT_W / 2 - 10, y - h, REACT_W + 20, h);
  g.globalAlpha = pulse * 0.6;
  g.fillRect(x - REACT_W / 2 - 22, y - h, REACT_W + 44, h);
  g.globalAlpha = 1;
};

// ------------------------------------------------------------------ fan vent

sprites.define({
  name: 'm6d_vent',
  w: 22,
  h: 22,
  ox: 11,
  oy: 11,
  frames: 3,
  draw: (p, f) => {
    shaded(p, (m) => m.rect(0, 0, 22, 22, '#fff'), steelR);
    p.circle(11, 11, 8.5, M6.steelDD);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + (f / 3) * ((Math.PI * 2) / 3);
      p.line(11, 11, 11 + Math.cos(a) * 7.5, 11 + Math.sin(a) * 7.5, M6.ironL, 2);
    }
    p.circle(11, 11, 2, M6.iron);
    // grille bars
    for (let x = 4; x < 20; x += 4) p.rect(x, 3, 1, 16, M6.steelD);
    rv(p, 1, 1);
    rv(p, 19, 1);
    rv(p, 1, 19);
    rv(p, 19, 19);
  },
});

const vent: DecorRenderer = (g, d, time) => sprites.get('m6d_vent').draw(g, Math.round(d.x), Math.round(d.y), Math.floor(time * 14) % 3);

// ------------------------------------------------------------------ overhead crane rail

sprites.define({
  name: 'm6d_crane_rail',
  w: 32,
  h: 10,
  ox: 0,
  oy: 0,
  outline: null,
  draw: (p) => {
    p.rect(0, 0, 32, 10, O);
    p.rect(0, 1, 32, 2, M6.ironL);
    p.rect(0, 3, 32, 4, M6.ironD);
    p.rect(0, 7, 32, 2, M6.iron);
    for (let x = 2; x < 32; x += 8) {
      p.line(x, 3, x + 4, 7, M6.iron);
      p.px(x, 1, M6.steelLL);
    }
  },
});
sprites.define({
  name: 'm6d_trolley',
  w: 18,
  h: 10,
  ox: 9,
  oy: 0,
  draw: (p) => {
    shaded(p, (m) => m.rect(0, 2, 18, 7, '#fff'), ramp(M6.hazard, 0.2, -0.45));
    for (let i = 0; i < 18; i += 6) p.rect(i, 5, 3, 4, M6.hazardD);
    p.circle(4, 2, 2, M6.ironD);
    p.circle(14, 2, 2, M6.ironD);
  },
});

const crane: DecorRenderer = (g, d, time) => {
  const w: number = d.props?.w ?? 192;
  const x0 = Math.round(d.x);
  const y = Math.round(d.y);
  const rail = sprites.get('m6d_crane_rail');
  for (let x = 0; x < w; x += 32) rail.draw(g, x0 + x, y);
  // the trolley drifts slowly back and forth along the rail with its hook block
  const t = (Math.sin(time * 0.25 + d.x * 0.01) + 1) / 2;
  const tx = Math.round(x0 + 14 + t * (w - 28));
  sprites.get('m6d_trolley').draw(g, tx, y + 8);
  const len: number = d.props?.len ?? 40;
  g.fillStyle = O;
  g.fillRect(tx - 2, y + 18, 4, len);
  g.fillStyle = M6.steelL;
  g.fillRect(tx - 1, y + 18, 1, len);
  g.fillRect(tx + 1, y + 18, 1, len);
  sprites.get('m6d_hook').draw(g, tx, y + 18 + len);
};

// ------------------------------------------------------------------ registry

const simple =
  (name: string): DecorRenderer =>
  (g, d) =>
    sprites.get(name).draw(g, Math.round(d.x), Math.round(d.y), 0, { flip: !!d.props?.flip });

export const M6_DECOR: Record<string, DecorRenderer> = {
  furnace,
  chain,
  banner,
  pipes,
  beacon,
  scrap: simple('m6d_scrap'),
  ammo: simple('m6d_ammo'),
  sign,
  girder,
  arm,
  walker: simple('m6d_walker'),
  emblem,
  wall,
  gate,
  searchlight,
  reactor,
  vent,
  crane,
};
