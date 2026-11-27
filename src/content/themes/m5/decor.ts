// STORMFRONT decor kinds (world space, drawn behind the actors). Static art is baked into sprites
// (visible in the spritesheet tool); per-frame work is a few drawImage calls plus tiny animations.
//   m5_ship        a Legion airship (props.ship: skiff|gunship|frigate|cruiser|blimp, facing)
//                  with spinning pusher props and blinking nav lights
//   m5_mast        radio mast with a blinking beacon and a Legion pennant in the wind (props.h)
//   m5_searchlight deck searchlight sweeping a faint beam
//   m5_lamp        signal lamp flashing Morse
//   m5_cargo       lashed cargo (crates, drums, tarp) - props.kind 0..2
//   m5_rotor       lift-rotor mast of a sky barge (spinning blades)
//   m5_cap         bow / stern of a sky-barge hull (props.end 'bow'|'stern', facing)
//   m5_banner      hanging Legion war banner fluttering (props.h)
//   m5_cable       sagging cable from (x, y) to (x + props.dx, y + props.dy)
//   m5_strut       gantry leg under a raised catwalk (props.h, facing = brace side)
// Anchors: (x, y) = bottom centre on the deck surface unless noted.

import { sprites } from '../../../engine/sprites';
import type { PixelArt } from '../../../engine/pixelart';
import type { DecorDef } from '../../../game/level';
import type { DecorRenderer } from '../../../game/theme';
import { cog, Pen } from '../../machines/common';
import { P5 } from './palette';
import { SHIPS, type ShipId } from './ships';
import { hash1 } from './sky';
import { staticDecor } from '../bake';

// ------------------------------------------------------------------ sprites

/** Nav / beacon lights: 0 red, 1 green, 2 white, 3 amber (glow halo included). */
sprites.define({
  name: 'm5_light',
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const c = ['#ff5a3a', '#7aff8a', '#f4f0ff', '#ffc85a'][f];
    const halo = ['#ff5a3a50', '#7aff8a50', '#f4f0ff50', '#ffc85a50'][f];
    p.circle(3.5, 3.5, 3.4, halo);
    p.circle(3.5, 3.5, 1.6, c);
    p.px(3, 3, '#ffffff');
  },
});

/** Radio mast (lattice), 34 px tall. Origin bottom centre. */
sprites.define({
  name: 'm5_mast',
  w: 9,
  h: 36,
  draw: (p) => {
    const d = new Pen(p);
    d.rect(1, 33, 7, 3, P5.hullD);
    d.rect(1, 33, 7, 1, P5.hullL);
    d.rect(3, 2, 1, 32, P5.hullL);
    d.rect(5, 2, 1, 32, P5.hullD);
    for (let y = 4; y < 33; y += 4) {
      d.px(4, y, P5.hull);
      d.px(4, y + 1, P5.hullD);
    }
    d.rect(1, 9, 7, 1, P5.brass);
    d.rect(2, 18, 5, 1, P5.brassD);
    d.rect(3, 0, 3, 2, P5.hullDD);
  },
});

/** Legion pennant: long swallow-tailed streamer, 3 flutter frames. Origin = hoist (left). */
sprites.define({
  name: 'm5_pennant',
  w: 22,
  h: 9,
  ox: 0,
  oy: 1,
  frames: 3,
  draw: (p, f) => {
    const wave = (x: number) => Math.round(Math.sin(x * 0.42 + f * 2.1) * (x / 22) * 2.2);
    for (let x = 0; x < 21; x++) {
      const y0 = 1 + wave(x);
      const hh = Math.max(1, Math.round(5 - x * 0.18));
      for (let y = 0; y < hh; y++) {
        if (x > 15 && y === Math.floor(hh / 2)) continue;
        p.px(x, y0 + y, y === 0 ? '#e8584a' : x < 6 ? '#b8302a' : '#c8402e');
      }
    }
    p.rect(1, 2 + wave(2), 3, 2, P5.brass);
  },
});

/** Searchlight on a pedestal: 0 = lamp, 1 = lamp (hot). Origin bottom centre. */
sprites.define({
  name: 'm5_searchlight',
  w: 14,
  h: 14,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    d.rect(4, 10, 6, 4, P5.hullD);
    d.rect(4, 10, 6, 1, P5.hullL);
    d.rect(6, 7, 2, 4, P5.hull);
    d.circle(7, 5, 4.4, P5.hullD);
    d.circle(6.6, 4.6, 3.6, P5.hull);
    d.rect(3, 2, 2, 2, P5.hullL);
    d.circle(9.2, 5, 2.4, f ? '#fff8d8' : '#f0d890');
    d.px(9, 4, '#ffffff');
    d.rect(2, 5, 2, 1, P5.brass);
  },
});

/** Signal lamp (Aldis) on a post: 0 dark, 1 lit. */
sprites.define({
  name: 'm5_lamp',
  w: 10,
  h: 20,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    d.rect(4, 7, 2, 13, P5.hullD);
    d.rect(4, 7, 1, 13, P5.hull);
    d.rect(2, 18, 6, 2, P5.hullDD);
    d.rect(1, 1, 7, 6, P5.brassD);
    d.rect(1, 1, 7, 1, P5.brassL);
    d.rect(2, 2, 5, 4, P5.brass);
    d.rect(7, 2, 2, 4, f ? '#fffbe0' : '#6a5a3a');
    d.rect(3, 0, 3, 1, P5.hullD);
  },
});

/** Lashed cargo: 0 crate stack, 1 drums, 2 tarp-covered load. Origin bottom centre. */
sprites.define({
  name: 'm5_cargo',
  w: 34,
  h: 22,
  frames: 3,
  draw: (p, f) => {
    const d = new Pen(p);
    const crate = (x: number, y: number, w: number, h: number, c: string) => {
      d.rect(x, y, w, h, c);
      d.rect(x, y, w, 1, '#c8a070');
      d.rect(x, y + h - 1, w, 1, P5.woodDD);
      d.rect(x, y, 1, h, '#b08458');
      d.rect(x + w - 1, y, 1, h, P5.woodD);
      d.line(x + 1, y + 1, x + w - 2, y + h - 2, P5.woodD);
    };
    if (f === 0) {
      crate(2, 8, 14, 14, P5.wood);
      crate(17, 11, 13, 11, '#946238');
      crate(7, 0, 12, 8, '#9c6a3c');
      cog(d, 9, 15, 2.5, P5.oliveDD);
      d.rect(1, 13, 31, 1, P5.rope);
    } else if (f === 1) {
      for (const [x, c] of [
        [3, P5.rust],
        [12, '#5a6a3a'],
        [21, P5.rust],
      ] as const) {
        d.rect(x, 6, 9, 16, c);
        d.rect(x, 6, 2, 16, '#d07a4a');
        d.rect(x + 7, 6, 2, 16, P5.rustD);
        d.rect(x, 10, 9, 1, P5.dark);
        d.rect(x, 17, 9, 1, P5.dark);
        d.rect(x + 1, 5, 7, 1, '#7a3a1a');
      }
    } else {
      d.poly([1, 22, 3, 6, 10, 2, 26, 3, 32, 9, 33, 22], P5.canvasD);
      d.poly([3, 21, 5, 7, 11, 3, 24, 4, 29, 9, 30, 21], P5.canvas);
      d.poly([6, 8, 11, 4, 20, 4, 14, 9], P5.canvasL);
      for (const x of [9, 22]) d.rect(x, 3, 1, 19, P5.rope);
      d.rect(2, 14, 30, 1, P5.ropeD);
    }
  },
});

/** Lift rotor seen from the side: 4 spin frames (mast drawn separately). Origin = hub. */
sprites.define({
  name: 'm5_rotor',
  w: 58,
  h: 5,
  ox: 29,
  oy: 2,
  frames: 4,
  outline: '#1e1a22',
  draw: (p, f) => {
    for (let x = 1; x <= 56; x++) if ((x + f) % 3 === 0) p.px(x, 2, '#a8a0b8');
    const ext = [27, 18, 6, 18][f];
    p.capsule(29 - ext, 2, 29 + ext, 2, 0.75, '#3c3a48');
    p.px(29 + ext - 1, 2, '#c4c0d4');
    p.px(29 - ext + 1, 2, '#c4c0d4');
    p.circle(29, 2, 1.6, P5.brass);
  },
});

/** Rotor mast (pylon) 22 px. Origin bottom centre. */
sprites.define({
  name: 'm5_rotor_mast',
  w: 11,
  h: 24,
  draw: (p) => {
    const d = new Pen(p);
    d.poly([1, 24, 4, 4, 7, 4, 10, 24], P5.hullD);
    d.poly([2, 23, 4.5, 5, 6, 5, 5, 23], P5.hull);
    d.rect(4, 0, 3, 5, P5.hullDD);
    d.rect(2, 12, 7, 1, P5.brass);
    d.rect(3, 4, 5, 2, P5.brassD);
  },
});

/** Barge hull caps for textured hull solids (24 px tall): 0 bow (prow, faces right), 1 stern. */
export const BARGE_H = 24;
sprites.define({
  name: 'm5_cap',
  w: 22,
  h: BARGE_H + 8,
  ox: 0,
  oy: 5,
  frames: 2,
  draw: (p: PixelArt, f) => {
    const d = new Pen(p, 0, 5);
    const H = BARGE_H;
    if (f === 0) {
      // Bow: raked prow with a brass cutwater, railing continued.
      d.poly([0, -1, 12, -1, 21, 4, 14, H - 4, 0, H], P5.hull);
      d.poly([0, -1, 12, -1, 21, 4, 18, 5, 11, 1, 0, 1], P5.hullLL);
      d.poly([16, 2, 21, 4, 14, H - 4, 12, H - 5], P5.brass);
      d.poly([19, 4, 21, 4, 14, H - 4, 13, H - 5], P5.brassD);
      d.rect(0, 9, 12, 1, P5.brassD);
      d.rect(0, H - 3, 12, 3, P5.hullD);
      d.circle(6.5, 6, 2.2, P5.brassD);
      d.circle(6.5, 6, 1.3, P5.window);
      for (let x = 0; x < 13; x += 1) d.px(x, -5, x % 2 ? P5.brass : P5.brassL);
      d.rect(12, -5, 1, 4, P5.brassD);
    } else {
      // Stern: rounded counter with a rudder and a stern lamp.
      d.poly([22, -1, 9, -1, 3, 4, 1, 12, 5, H - 2, 12, H, 22, H], P5.hull);
      d.poly([22, -1, 9, -1, 5, 3, 9, 2, 22, 1], P5.hullLL);
      d.poly([3, 4, 1, 12, 3, 13], P5.hullD);
      d.rect(9, 9, 13, 1, P5.brassD);
      d.rect(8, H - 3, 14, 3, P5.hullD);
      d.poly([4, H - 6, -0, H + 2, 6, H + 2, 9, H - 4], P5.rust);
      d.px(5, 6, '#ff5a3a');
      for (let x = 9; x < 22; x += 1) d.px(x, -5, x % 2 ? P5.brass : P5.brassL);
      d.rect(9, -5, 1, 4, P5.brassD);
    }
  },
});

/** Legion war banner (hangs down from its top centre), 3 flutter frames, 26 px. */
sprites.define({
  name: 'm5_banner',
  w: 14,
  h: 28,
  ox: 7,
  oy: 0,
  frames: 3,
  draw: (p, f) => {
    const d = new Pen(p);
    d.rect(0, 0, 14, 2, P5.brassD);
    d.rect(0, 0, 14, 1, P5.brass);
    for (let y = 2; y < 27; y++) {
      const sway = Math.round(Math.sin(y * 0.3 + f * 2) * (y / 26) * 1.6);
      const notch = y > 22 ? Math.abs(7 - 0) - (y - 22) * 1.4 : 99;
      for (let x = 1; x < 13; x++) {
        if (y > 22 && Math.abs(x - 6.5) < 6.5 - notch) continue;
        p.px(x + sway, y, x === 1 ? '#e0584a' : x > 10 ? '#8a2418' : '#b8302a');
      }
    }
    cog(new Pen(p, Math.round(Math.sin(1.2 + f * 2) * 0.6), 0), 7, 11, 3.6, P5.brass);
  },
});

// ------------------------------------------------------------------ renderers

function spr(name: string) {
  return sprites.get(name);
}

const shipDecor: DecorRenderer = (g, d, time) => {
  const id = (d.props?.ship ?? 'gunship') as ShipId;
  const s = SHIPS[id] ?? SHIPS.gunship;
  const flip = d.props?.facing === -1;
  const dir = flip ? -1 : 1;
  spr(`m5_ship_${s.id}`).draw(g, d.x, d.y, 0, { flip });
  const big = s.bodyH >= 46;
  s.engines.forEach(([ex, ey], i) => {
    const lx = ex - 10;
    const f = Math.floor(time * 28 + i * 1.7) % 4;
    spr(big ? 'm5_prop_l' : 'm5_prop').draw(g, d.x + dir * lx, d.y + ey, f);
  });
  // Nav lights: blinking red beacon at the nose, steady amber stern light.
  const blink = (time * 1.25 + hash1(Math.round(d.x))) % 1 < 0.18;
  if (blink) spr('m5_light').draw(g, d.x + dir * (s.len / 2 - 1), d.y + s.bodyH / 2, 0);
  spr('m5_light').draw(g, d.x - dir * (s.len / 2 - 3), d.y + s.bodyH / 2, 3, { alpha: 0.75 });
};

const mastDecor: DecorRenderer = (g, d, time) => {
  const h = (d.props?.h as number) ?? 36;
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const mast = spr('m5_mast');
  // Taller masts: stack the lattice.
  if (h > 36) mast.draw(g, x, y - (h - 36), 0);
  mast.draw(g, x, y, 0);
  const top = y - h;
  const flip = d.props?.facing === -1;
  spr('m5_pennant').draw(g, x + (flip ? -1 : 1), top + 3, Math.floor(time * 7 + x * 0.1) % 3, { flip: !flip });
  if ((time * 0.9 + hash1(x)) % 1 < 0.35) spr('m5_light').draw(g, x, top, 0);
};

const searchlightDecor: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const flip = d.props?.facing === -1;
  const dir = flip ? -1 : 1;
  // Faint beam sweeping the sky (behind the actors).
  const a = -0.55 + Math.sin(time * 0.45 + x * 0.01) * 0.42;
  const len = 150;
  const ox = x + dir * 3;
  const oy = y - 9;
  g.save();
  g.globalAlpha = 0.07;
  g.fillStyle = '#fff4c8';
  g.beginPath();
  g.moveTo(ox, oy);
  g.lineTo(ox + dir * Math.cos(a - 0.07) * len, oy + Math.sin(a - 0.07) * len);
  g.lineTo(ox + dir * Math.cos(a + 0.07) * len, oy + Math.sin(a + 0.07) * len);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.09;
  g.beginPath();
  g.moveTo(ox, oy);
  g.lineTo(ox + dir * Math.cos(a - 0.025) * len * 0.8, oy + Math.sin(a - 0.025) * len * 0.8);
  g.lineTo(ox + dir * Math.cos(a + 0.025) * len * 0.8, oy + Math.sin(a + 0.025) * len * 0.8);
  g.closePath();
  g.fill();
  g.restore();
  spr('m5_searchlight').draw(g, x, y, Math.floor(time * 3) % 2, { flip });
};

/** Morse-ish pattern: on/off timeline repeating every 3.2 s. */
const MORSE = [0.15, 0.15, 0.15, 0.15, 0.45, 0.15, 0.45, 0.6];
const lampDecor: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  let t = (time + hash1(x) * 3) % 3.2;
  let on = false;
  for (let i = 0; i < MORSE.length; i++) {
    if (t < MORSE[i]) {
      on = i % 2 === 0;
      break;
    }
    t -= MORSE[i];
  }
  const flip = d.props?.facing === -1;
  spr('m5_lamp').draw(g, x, y, on ? 1 : 0, { flip });
  if (on) spr('m5_light').draw(g, x + (flip ? -4 : 4), y - 16, 2);
};

const cargoDecor: DecorRenderer = (g, d) => {
  spr('m5_cargo').draw(g, d.x, d.y, ((d.props?.kind as number) ?? 0) % 3, { flip: d.props?.facing === -1 });
};

const rotorDecor: DecorRenderer = (g, d, time) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  spr('m5_rotor_mast').draw(g, x, y, 0);
  spr('m5_rotor').draw(g, x, y - 23, Math.floor(time * 26 + x * 0.3) % 4);
};

const capDecor: DecorRenderer = (g, d) => {
  const bow = d.props?.end !== 'stern';
  const flip = d.props?.facing === -1;
  // Anchored on the hull's deck corner: bow caps extend outward from x, stern caps end at x.
  spr('m5_cap').draw(g, d.x, d.y, bow ? 0 : 1, { flip });
};

const bannerDecor: DecorRenderer = (g, d, time) => {
  spr('m5_banner').draw(g, d.x, d.y, Math.floor(time * 5 + d.x * 0.07) % 3);
};

const cableDecor: DecorRenderer = (g, d) => {
  const dx = (d.props?.dx as number) ?? 40;
  const dy = (d.props?.dy as number) ?? 0;
  const sag = (d.props?.sag as number) ?? 6;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  g.fillStyle = (d.props?.color as string) ?? '#2a2632';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = d.x + dx * t;
    const y = d.y + dy * t + Math.sin(t * Math.PI) * sag;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
};

/** Gantry leg under a raised catwalk: a riveted steel post with a brace, from the deck (y) up props.h. */
const strutDecor: DecorRenderer = (g, d) => {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const h = Math.max(4, Math.round((d.props?.h as number) ?? 30));
  const top = y - h;
  const px = (c: string, xx: number, yy: number, w = 1, hh = 1) => {
    g.fillStyle = c;
    g.fillRect(xx, yy, w, hh);
  };
  // Outline, then the post (lit left edge) with a foot plate.
  px(P5.dark, x - 2, top, 5, h);
  px(P5.hullL, x - 1, top, 1, h);
  px(P5.hull, x, top, 1, h);
  px(P5.hullD, x + 1, top, 1, h);
  for (let yy = top + 3; yy < y - 2; yy += 6) px(P5.hullLL, x - 1, yy);
  px(P5.dark, x - 4, y - 3, 9, 3);
  px(P5.hullD, x - 3, y - 2, 7, 1);
  // Diagonal brace toward the catwalk's middle.
  const dir = d.props?.facing === -1 ? -1 : 1;
  const bl = Math.min(10, Math.floor(h / 2));
  for (let i = 0; i < bl; i++) {
    px(P5.dark, x + dir * (2 + i), top + 4 + i, 1, 2);
    px(P5.hullD, x + dir * (2 + i), top + 4 + i);
  }
};

export const STORM_DECOR: Record<string, DecorRenderer> = {
  // Static: baked once per strut (~20 fillRects apiece).
  m5_strut: staticDecor(strutDecor, (d) => {
    const h = Math.max(4, Math.round((d.props?.h as number) ?? 30));
    return [d.x - 16, d.y - h - 8, 32, h + 16];
  }),
  m5_ship: shipDecor,
  m5_mast: mastDecor,
  m5_searchlight: searchlightDecor,
  m5_lamp: lampDecor,
  m5_cargo: cargoDecor,
  m5_rotor: rotorDecor,
  m5_cap: capDecor,
  m5_banner: bannerDecor,
  m5_cable: cableDecor,
};

/** Decor margin (half extent) so the theme culls big ships correctly. */
export function shipDecorDef(ship: ShipId, x: number, y: number, facing: 1 | -1): DecorDef {
  const s = SHIPS[ship];
  return { kind: 'm5_ship', x, y, layer: 'back', props: { ship, facing, w: Math.ceil(s.len / 2 + 24) } };
}
