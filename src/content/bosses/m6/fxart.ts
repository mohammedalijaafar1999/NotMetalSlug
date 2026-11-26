// JUGGERNAUT effects art: shockwave, artillery shell, rain missile, escape pod + parachute,
// jet flame, debris chunks and the burnt-out wreck. Authored facing right, lit from the top-left.

import { sprites } from '../../../engine/sprites';
import type { PixelArt } from '../../../engine/pixelart';
import { BC, Pen, cog, hazardStripes } from '../common/kit';
import { DOME_OX, DOME_OY, DOME_W, JC, JPen, drawDome, drawHull, type DomeExpr } from './art';

// ------------------------------------------------------------------ stomp shockwave

/** Ground shockwave travelling right (flip for left): a fiery crest of torn-up floor. */
sprites.define({
  name: 'bm6_wave',
  w: 24,
  h: 19,
  ox: 12,
  oy: 19,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 12, 19, 0);
    const k = [0, 1, 2, 1][f];
    // dust tail
    d.poly([-12, 0, -10, -4, -6, -6 - (f % 2), -2, -5, 0, 0], '#8a6a4a');
    d.poly([-10, 0, -7, -3, -3, -3, -2, 0], '#b08a5e');
    // crest
    d.poly([-6, 0, -4, -7 - k, 0, -12 - k, 5, -14 - k, 9, -11, 11, -5, 12, 0], '#c8401a');
    d.poly([-3, 0, -1, -7 - k, 3, -11 - k, 7, -10, 9, -5, 10, 0], '#ff8a20');
    d.poly([1, 0, 3, -6 - k, 6, -8, 8, -4, 9, 0], '#ffd040');
    d.poly([4, 0, 6, -5, 8, -2, 8.5, 0], '#fff8d0');
    // torn-up chunks and sparks
    const chunks: [number, number][] = [
      [-8, -9 - k],
      [-1, -16 - k],
      [8, -15 + k],
      [-11, -6],
    ];
    for (const [x, y] of chunks) {
      d.rect(x, y + (f % 2), 2, 2, '#4a3426');
      d.px(x, y + (f % 2), '#9a7a56');
    }
    d.px(10, -13 - (f % 2), '#ffe070');
    d.px(2, -17 + (f % 2), '#fff6b0');
    d.px(-5, -12 + (f % 2), '#ffb040');
  },
});

// ------------------------------------------------------------------ projectiles

sprites.define({
  name: 'bm6_shell',
  w: 11,
  h: 6,
  ox: 5,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 5, 3, 0);
    d.rect(-5, -2, 7, 5, BC.steelD);
    d.rect(-5, -2, 7, 1, BC.steelL);
    d.rect(-1, -2, 2, 5, BC.brass);
    d.px(-1, -2, BC.brassL);
    d.poly([2, -2, 4, -1.5, 6, 0.5, 4, 2.5, 2, 3], f ? '#ff7a3a' : '#e04a2a');
    d.px(3, -1, '#ffc0a0');
    d.rect(-6, -1, 1, 3, f ? '#ffd060' : '#ff9a30');
  },
});

sprites.define({
  name: 'bm6_missile',
  w: 16,
  h: 7,
  ox: 8,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 8, 3, 0);
    // exhaust
    d.poly([-8, 0.5, -5, -1.5, -5, 2.5], f ? '#ffe070' : '#ff9a30');
    d.px(-6, 0, '#ffffff');
    // fins
    d.poly([-5, -3, -2, -1, -2, 2, -5, 4], BC.steelD);
    // body
    d.rect(-4, -1, 8, 3, '#d8d4c8');
    d.rect(-4, -1, 8, 1, '#f4f0e6');
    d.rect(-4, 1, 8, 1, '#9a968c');
    hazardStripes(d, -1, -1, 3, 3, BC.hazard, BC.black, 2);
    // warhead
    d.poly([4, -1.5, 7, 0.5, 4, 2.5], '#d83a2a');
    d.px(5, 0, '#ff8a6a');
  },
});

/** Pod rocket flame (pointing down from the origin). */
sprites.define({
  name: 'bm6_flame',
  w: 9,
  h: 14,
  ox: 4,
  oy: 0,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, 4, 0, 0);
    const L = f ? 13 : 10;
    d.poly([-3.5, 0, 3.5, 0, 0.5, L], '#ff7a20');
    d.poly([-2.5, 0, 2.5, 0, 0, L - 3], '#ffd040');
    d.poly([-1.2, 0, 1.2, 0, 0, L - 6], '#ffffff');
  },
});

// ------------------------------------------------------------------ escape pod + parachute

const POD_EXPRS: DomeExpr[] = ['shout', 'fist', 'panic'];

/** The cockpit dome on a stubby rocket nozzle. Origin = dome base centre (as bm6_dome). */
sprites.define({
  name: 'bm6_eject',
  w: DOME_W,
  h: DOME_OY + 12,
  ox: DOME_OX,
  oy: DOME_OY,
  frames: POD_EXPRS.length,
  draw: (p, f) => {
    drawDome(p, POD_EXPRS[f]);
    const d = new JPen(p, DOME_OX, DOME_OY, 0);
    // under-hull: steel bowl with a nozzle
    d.poly([-16, 0, 16, 0, 11, 6, -11, 6], BC.steelD);
    d.poly([-15, 0, 15, 0, 13, 2, -13, 2], BC.steel);
    d.rect(-15, 0, 30, 1, BC.steelL);
    d.poly([-4, 6, 4, 6, 6, 10, -6, 10], BC.ironL);
    d.rect(-6, 9, 12, 1, BC.ironD);
    hazardStripes(d, -10, 3, 20, 2, BC.hazard, BC.black, 4);
  },
});

/** Parachute (0 = popping out, 1-2 = open, swaying). Origin = where the lines meet (pod top). */
sprites.define({
  name: 'bm6_chute',
  w: 46,
  h: 36,
  ox: 23,
  oy: 35,
  frames: 3,
  draw: (p, f) => {
    const d = new JPen(p, 23, 35, 0);
    if (f === 0) {
      d.line(0, 0, -3, -12, '#e8e0d0');
      d.line(0, 0, 3, -12, '#e8e0d0');
      d.ellipse(0, -16, 6, 5, '#e8e0d0');
      d.ellipse(-1, -17, 3, 2.5, '#ffffff');
      d.ellipse(2, -15, 2.5, 2, '#d83a2a');
      return;
    }
    const sway = f === 2 ? 2 : 0;
    const cy = -26;
    const rx = 21;
    const ry = 9;
    // lines
    for (const lx of [-19, -10, 0, 10, 19]) d.line(0, 0, lx + sway, cy + 3, '#c8c0b0');
    // canopy with red / white gores
    d.shape(-rx - 1, cy - ry - 1, rx + 1 + sway, cy + 4, '#f2ece0', (x, y) => {
      const xx = x - sway;
      return y <= cy + 3 && (xx / rx) ** 2 + ((y - cy - 3) / (ry + 3)) ** 2 <= 1;
    });
    d.shape(-rx - 1, cy - ry - 1, rx + 1 + sway, cy + 4, '#d83a2a', (x, y) => {
      const xx = x - sway;
      const inC = y <= cy + 3 && (xx / rx) ** 2 + ((y - cy - 3) / (ry + 3)) ** 2 <= 1;
      const gore = Math.floor((Math.atan2(y - cy - 6, xx) + Math.PI) / 0.42) % 2 === 0;
      return inC && gore;
    });
    // shading on the lower rim, highlight top-left
    d.shape(-rx - 1, cy - ry - 1, rx + 1 + sway, cy + 4, '#9a2418', (x, y) => {
      const xx = x - sway;
      const e = (xx / rx) ** 2 + ((y - cy - 3) / (ry + 3)) ** 2;
      return y <= cy + 3 && y > cy + 1 && e <= 1;
    });
    d.px(-9 + sway, cy - 6, '#ffffff');
    d.px(-8 + sway, cy - 7, '#ffffff');
  },
});

// ------------------------------------------------------------------ debris

/** 0-1 crimson plate shards, 2 brass gear, 3 steel rod, 4 riveted strip, 5 glass shard. */
sprites.define({
  name: 'bm6_debris',
  w: 14,
  h: 10,
  ox: 7,
  oy: 5,
  frames: 6,
  draw: (p, f) => {
    const d = new Pen(p, 0, 0, 0);
    if (f === 0) {
      d.poly([0, 3, 10, 0, 14, 4, 11, 9, 2, 8], JC.mrD);
      d.poly([1, 3, 10, 1, 12, 4, 2, 5], JC.mr);
      d.px(4, 3, JC.mrLL);
      d.px(9, 6, BC.brass);
    } else if (f === 1) {
      d.poly([1, 1, 9, 2, 12, 8, 3, 9], JC.mr);
      d.poly([1, 1, 9, 2, 9, 4, 2, 4], JC.mrL);
      d.rect(1, 6, 10, 1, BC.brass);
    } else if (f === 2) {
      cog(d, 7, 5, 3.6);
    } else if (f === 3) {
      d.rect(0, 3, 14, 3, BC.steelD);
      d.rect(0, 3, 14, 1, BC.steelL);
      d.rect(10, 2, 2, 5, BC.brass);
    } else if (f === 4) {
      d.poly([0, 2, 13, 4, 12, 7, 0, 5], BC.steel);
      d.rect(0, 2, 13, 1, BC.steelL);
      for (let x = 2; x < 12; x += 3) d.px(x, 4, BC.steelLL);
    } else {
      d.poly([2, 1, 8, 2, 11, 8, 4, 6], '#7cc4e4');
      d.poly([2, 1, 8, 2, 6, 4], '#d2f0ff');
    }
  },
});

// ------------------------------------------------------------------ wreck

/** The burnt-out Juggernaut: hull slumped on its folded legs, cockpit socket empty. */
sprites.define({
  name: 'bm6_wreck',
  w: 150,
  h: 90,
  ox: 75,
  oy: 88,
  draw: (p) => {
    const d = new JPen(p, 75, 88, 0);
    // folded legs (far then near): thighs back, shins along the floor, feet splayed
    for (const [dx, dark] of [
      [-4, true],
      [0, false],
    ] as const) {
      const c = dark ? BC.steelDD : BC.steelD;
      const a = dark ? JC.mrDD : JC.mrD;
      d.cap(dx, -22, dx - 30, -10, 7, a);
      d.cap(dx - 30, -10, dx + 6, -6, 4.5, c);
      d.poly([dx + 2, -12, dx + 30, -6, dx + 32, 0, dx - 12, 0, dx - 16, -6], a);
      d.circle(dx - 30, -10, 5, c);
    }
    // hull slumped nose-down, resting on the floor
    drawHull(p, 3, 0.1, 75, 68);
    // empty, smashed cockpit socket
    const h = new JPen(p, 75, 68, 0.1);
    h.ellipse(21, -58, 14, 4, BC.ironDD);
    h.rect(7, -59, 28, 2, BC.steelD);
    h.px(10, -61, BC.brass);
    h.px(28, -62, '#7cc4e4');
    h.px(16, -60, '#7cc4e4');
    // Burnt, not blackened: darken towards soot but keep the structure, sprinkle embers.
    p.mapPixels((v, x, y) => {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (n % 233 === 0) return n % 2 ? 0xff3aa0ff : 0xff1a4ad8;
      const k = 0.52;
      const m = (s2: number, t: number) => Math.round(((v >>> s2) & 255) * (1 - k) + t * k);
      return ((255 << 24) | (m(16, 0x10) << 16) | (m(8, 0x14) << 8) | m(0, 0x1a)) >>> 0;
    });
  },
});
