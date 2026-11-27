// Legion airships of the STORMFRONT fleet: rigid olive envelopes (skiff, gunship, frigate,
// cruiser) with a flat steel dorsal deck on top, and patched canvas cargo blimps with a dorsal
// catwalk. Every top is a deck you can land on; hanging gondolas carry bottom turret mounts.
//
// The same spec drives the art (one baked sprite per ship class, drawn by the 'm5_ship' decor)
// and the collision (shipColliders: solid rects inside the drawn silhouette, used by the level),
// so the two can never drift apart. Local coordinates: origin = deck surface at the ship's
// centre, +x toward the nose (art faces right; the decor flips it for ships facing left).

import { PixelArt, mixColor, shade } from '../../../engine/pixelart';
import { sprites } from '../../../engine/sprites';
import { Rng } from '../../../engine/rng';
import { cog, Pen } from '../../machines/common';
import { P5 } from './palette';
import { bayer } from './sky';

export type ShipId = 'skiff' | 'gunship' | 'frigate' | 'cruiser' | 'blimp';

export interface ShipSpec {
  id: ShipId;
  /** Envelope length (tail tip to nose tip). */
  len: number;
  /** Envelope height (deck line to the bottom of the belly). */
  bodyH: number;
  /** Dorsal deck span (local x). */
  deck: [number, number];
  /** Hanging gondola under the belly (local x range, height). */
  gondola?: { x0: number; x1: number; h: number };
  /** Engine pod centres (local), pusher propeller behind each. */
  engines: [number, number][];
  /** Tail fin size. */
  fin: number;
  /** Deck house (bridge) drawn on the deck (non-solid): local x range + height. */
  cabin?: { x0: number; x1: number; h: number };
  /** Soft canvas blimp instead of a rigid olive envelope. */
  soft?: boolean;
}

export const SHIPS: Record<ShipId, ShipSpec> = {
  skiff: { id: 'skiff', len: 176, bodyH: 30, deck: [-62, 58], engines: [[-58, 18]], fin: 12 },
  gunship: {
    id: 'gunship',
    len: 262,
    bodyH: 40,
    deck: [-96, 90],
    gondola: { x0: -30, x1: 40, h: 14 },
    engines: [
      [-88, 24],
      [70, 30],
    ],
    fin: 16,
    cabin: { x0: 40, x1: 72, h: 15 },
  },
  frigate: {
    id: 'frigate',
    len: 360,
    bodyH: 46,
    deck: [-134, 128],
    gondola: { x0: -56, x1: 62, h: 16 },
    engines: [
      [-126, 26],
      [-30, 52],
      [96, 32],
    ],
    fin: 20,
    cabin: { x0: 70, x1: 112, h: 18 },
  },
  cruiser: {
    id: 'cruiser',
    len: 620,
    bodyH: 56,
    deck: [-240, 232],
    gondola: { x0: -150, x1: 150, h: 18 },
    engines: [
      [-224, 30],
      [-120, 66],
      [120, 66],
      [196, 36],
    ],
    fin: 26,
    cabin: { x0: 150, x1: 206, h: 22 },
  },
  blimp: {
    id: 'blimp',
    len: 236,
    bodyH: 50,
    deck: [-72, 72],
    gondola: { x0: -54, x1: 50, h: 16 },
    engines: [[-92, 28]],
    fin: 18,
    soft: true,
  },
};

// ------------------------------------------------------------------ shape

/** Envelope half height at local x (blunt nose, long tapering tail). */
export function halfH(s: ShipSpec, x: number): number {
  const u = Math.max(-1, Math.min(1, x / (s.len / 2)));
  const hh = s.bodyH / 2;
  if (u >= 0) {
    const p = s.soft ? 2.1 : 2.8;
    return hh * Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
  }
  const a = -u;
  const p = s.soft ? 2.0 : 1.75;
  return hh * Math.pow(Math.max(0, 1 - Math.pow(a, p)), 1 / p) * (1 - 0.12 * a);
}

export function envTop(s: ShipSpec, x: number): number {
  return s.bodyH / 2 - halfH(s, x);
}

export function envBottom(s: ShipSpec, x: number): number {
  return s.bodyH / 2 + halfH(s, x);
}

export interface LocalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Solid rects (local) inside the ship's drawn silhouette: deck slab, belly, gondola. */
export function shipColliders(s: ShipSpec): LocalRect[] {
  const [d0, d1] = s.deck;
  const slabBottom = Math.floor(Math.min(envBottom(s, d0), envBottom(s, d1)) - 2);
  const out: LocalRect[] = [{ x: d0, y: 0, w: d1 - d0, h: slabBottom }];
  // Belly: where the envelope still reaches 3 px above its lowest point.
  let b0 = 0;
  let b1 = 0;
  for (let x = 0; x > -s.len / 2; x--) {
    if (envBottom(s, x) < s.bodyH - 4) break;
    b0 = x;
  }
  for (let x = 0; x < s.len / 2; x++) {
    if (envBottom(s, x) < s.bodyH - 4) break;
    b1 = x;
  }
  if (b1 - b0 > 8 && s.bodyH - 4 > slabBottom) out.push({ x: b0 + 2, y: slabBottom, w: b1 - b0 - 4, h: s.bodyH - 4 - slabBottom });
  const g = s.gondola;
  if (g) out.push({ x: g.x0 + 2, y: s.bodyH - 4, w: g.x1 - g.x0 - 4, h: g.h + 2 });
  return out;
}

/** Local y of a bottom turret mount under the gondola (or the belly). */
export function shipKeelY(s: ShipSpec): number {
  return s.gondola ? s.bodyH - 2 + s.gondola.h : s.bodyH;
}

/** Canvas layout of a ship sprite. */
export function shipCanvas(s: ShipSpec): { w: number; h: number; ox: number; oy: number } {
  const above = Math.max(10, s.cabin ? s.cabin.h + 12 : 0);
  const below = Math.max(s.gondola ? s.gondola.h + 2 : 0, ...s.engines.map(([, y]) => y + 6 - s.bodyH), Math.ceil(s.fin * 0.3)) + 2;
  const w = Math.ceil(s.len + 16);
  return { w, h: Math.ceil(above + s.bodyH + below), ox: Math.floor(w / 2), oy: above };
}

// ------------------------------------------------------------------ art

const OLIVE_RAMP = [P5.oliveDD, P5.oliveD, P5.olive, P5.oliveL, P5.oliveLL];
const CANVAS_RAMP = [P5.canvasDD, P5.canvasD, P5.canvas, P5.canvasL, '#eee2bc'];

function pick(ramp: readonly string[], t: number, x: number, y: number): string {
  const s = Math.max(0, Math.min(0.9999, t)) * (ramp.length - 1);
  const i = Math.floor(s);
  return s - i > bayer(x, y) ? ramp[Math.min(ramp.length - 1, i + 1)] : ramp[i];
}

/** Paint the envelope (rigid olive or soft canvas) with top-left lighting and frame seams. */
function paintEnvelope(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const ramp = s.soft ? CANVAS_RAMP : OLIVE_RAMP;
  const L = s.len / 2;
  const cy = s.bodyH / 2;
  const rng = new Rng(s.len * 7 + s.bodyH);
  const patches: { x: number; y: number; w: number; h: number; c: string }[] = [];
  if (s.soft) {
    for (let i = 0; i < 7; i++) patches.push({ x: rng.range(-L * 0.7, L * 0.6), y: rng.range(cy - 14, cy + 8), w: rng.int(6, 11), h: rng.int(4, 7), c: rng.pick([P5.canvasD, '#a89060', '#c0b088']) });
  }
  for (let x = Math.ceil(-L); x <= Math.floor(L); x++) {
    const hh = halfH(s, x);
    if (hh < 0.5) continue;
    const u = x / L;
    const top = cy - hh;
    const bot = cy + hh;
    for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
      const v = (y + 0.5 - cy) / hh;
      if (Math.abs(v) > 1.02) continue;
      let light = 0.62 - v * 0.5 - Math.max(0, Math.abs(u) - 0.7) * 0.9 - (u > 0 ? 0 : 0.04);
      // Specular streak along the upper flank.
      if (v > -0.72 && v < -0.52 && Math.abs(u) < 0.62) light += 0.28;
      // Frame rings (rigid) / gores (soft).
      const ring = s.soft ? Math.round(x) % 22 === 0 : Math.round(x) % 16 === 0;
      if (ring && Math.abs(v) < 0.96) light -= 0.2;
      // Longitudinal girders.
      if (!s.soft && (Math.abs(v + 0.3) < 0.05 || Math.abs(v - 0.38) < 0.05)) light -= 0.12;
      const px = OX + x;
      const py = OY + y;
      let c = pick(ramp, light, px, py);
      for (const pt of patches) if (x >= pt.x && x < pt.x + pt.w && y >= pt.y && y < pt.y + pt.h) c = shade(pt.c, (light - 0.5) * 0.5);
      p.px(px, py, c);
    }
  }
  // Patch stitches + rope net on soft blimps.
  if (s.soft) {
    for (const pt of patches) {
      for (let k = 0; k < pt.w; k += 2) {
        p.px(OX + pt.x + k, OY + pt.y, P5.canvasDD);
        p.px(OX + pt.x + k, OY + pt.y + pt.h - 1, P5.canvasDD);
      }
    }
    for (let x = -L + 30; x < L - 24; x += 12) {
      for (let y = Math.ceil(cy - halfH(s, x) + 6); y < cy + halfH(s, x) - 2; y += 1) {
        const xx = x + Math.round((y - cy) * 0.35);
        if (y % 3 !== 0) p.px(OX + xx, OY + y, '#8a744c');
      }
    }
  }
}

function paintFins(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const L = s.len / 2;
  const cy = s.bodyH / 2;
  const f = s.fin;
  const tx = -L;
  const d = new Pen(p, OX, OY);
  const stripe = (pts: number[]) => {
    // Fill, then diagonal hazard stripes clipped to the fin polygon via a mask.
    const m = new PixelArt(p.w, p.h);
    new Pen(m, OX, OY).poly(pts, '#ffffff');
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (!m.opaque(x, y)) continue;
        const k = Math.floor((x + y) / 4) % 2;
        p.px(x, y, k ? P5.orange : P5.cream);
      }
    }
  };
  // Upper and lower fins (striped), then the side stabiliser (edge-on).
  stripe([tx + f * 1.9, cy - 2, tx + f * 0.7, cy - halfH(s, tx + f) - f * 0.85, tx - 1, cy - halfH(s, tx + f) - f * 0.85, tx + 2, cy - 2]);
  stripe([tx + f * 1.9, cy + 2, tx + f * 0.7, cy + halfH(s, tx + f) + f * 0.75, tx - 1, cy + halfH(s, tx + f) + f * 0.75, tx + 2, cy + 2]);
  d.rect(tx - 3, cy - 1, f * 2.2, 3, P5.oliveD);
  d.rect(tx - 3, cy - 1, f * 2.2, 1, P5.oliveL);
  d.rect(tx - 3, cy + 1, f * 2.2, 1, P5.oliveDD);
  // Fin trailing-edge spars.
  d.rect(tx - 1, cy - halfH(s, tx + f) - f * 0.85, 1, f * 0.85 + halfH(s, tx + f) - 1, P5.orangeD);
  d.rect(tx - 1, cy + 2, 1, f * 0.75 + halfH(s, tx + f) - 1, P5.orangeD);
}

function paintDeck(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const d = new Pen(p, OX, OY);
  const [d0, d1] = s.deck;
  // Girders down to the envelope where it curves away from the deck.
  for (let x = d0; x < d1; x++) {
    const t = Math.floor(envTop(s, x));
    if (t > 3) {
      for (let y = 4; y <= t; y++) d.px(x, y, (x - d0) % 6 === 0 ? P5.hullDD : y % 3 === 0 ? P5.hull : P5.hullD);
    }
  }
  // Steel deck plate + its beam (side face).
  d.rect(d0, -1, d1 - d0, 1, P5.hullLL);
  for (let x = d0; x < d1; x++) {
    d.px(x, 0, (x + 1) % 4 === 0 ? P5.hullLL : P5.hullL);
    d.px(x, 1, (x + 3) % 4 === 0 ? P5.hullL : P5.hull);
    d.px(x, 2, P5.hullD);
    d.px(x, 3, x % 6 === 2 ? P5.brassL : P5.brass);
    d.px(x, 4, P5.brassD);
  }
  // End caps of the deck plate.
  d.rect(d0 - 2, -1, 2, 6, P5.hullD);
  d.rect(d1, -1, 2, 6, P5.hullD);
  d.px(d0 - 2, -1, P5.hullL);
  d.px(d1, -1, P5.hullL);
  // Railing behind the deck (posts + brass handrail).
  for (let x = d0 + 2; x < d1 - 1; x++) {
    d.px(x, -7, x % 2 ? P5.brass : P5.brassL);
    if ((x - d0) % 10 === 4) {
      for (let y = -6; y < -1; y++) d.px(x, y, P5.brassD);
    } else if (x % 2 === 0) d.px(x, -4, '#6e5020');
  }
}

function paintCabin(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const c = s.cabin;
  if (!c) return;
  const d = new Pen(p, OX, OY);
  const w = c.x1 - c.x0;
  const h = c.h;
  const y0 = -1 - h;
  // Body.
  d.rect(c.x0, y0, w, h, P5.hull);
  d.rect(c.x0, y0, w, 1, P5.hullLL);
  d.rect(c.x0, y0, 1, h, P5.hullL);
  d.rect(c.x1 - 1, y0, 1, h, P5.hullD);
  // Roof with brass trim, slanted front (toward the nose).
  d.rect(c.x0 - 2, y0 - 2, w + 2, 2, P5.hullD);
  d.rect(c.x0 - 2, y0 - 2, w + 2, 1, P5.hullL);
  d.poly([c.x1 - 1, y0, c.x1 + 5, y0 + h * 0.55, c.x1 + 5, -1, c.x1 - 1, -1], P5.hullD);
  // Windows (lit) along the front, a door at the back.
  for (let x = c.x0 + 5; x < c.x1 - 4; x += 6) {
    d.rect(x, y0 + 3, 4, 4, P5.dark);
    d.rect(x, y0 + 3, 4, 3, P5.window);
    d.px(x, y0 + 3, '#fff4c8');
    d.rect(x, y0 + 6, 4, 1, P5.windowD);
  }
  d.poly([c.x1, y0 + 2, c.x1 + 4, y0 + h * 0.5, c.x1, y0 + h * 0.5], P5.glass);
  d.px(c.x1 + 1, y0 + 4, '#d2f0ff');
  d.rect(c.x0 + 2, y0 + h - 10, 5, 9, P5.hullDD);
  d.px(c.x0 + 5, y0 + h - 6, P5.brass);
  d.rect(c.x0, y0 + h - 2, w, 1, P5.brassD);
  // Antenna + periscope.
  d.rect(c.x0 + 8, y0 - 8, 1, 6, P5.hullD);
  d.rect(c.x0 + 6, y0 - 9, 5, 1, P5.brass);
}

function paintGondola(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const g = s.gondola;
  if (!g) return;
  const d = new Pen(p, OX, OY);
  const y0 = s.bodyH - 4;
  const h = g.h;
  // Struts.
  for (const x of [g.x0 + 8, g.x1 - 10]) d.rect(x, y0 - 6, 2, 8, P5.hullD);
  // Hull box with a slanted bow (toward +x) and a rounded stern.
  d.poly([g.x0 + 4, y0, g.x1 - 2, y0, g.x1 + 6, y0 + h * 0.5, g.x1 - 2, y0 + h, g.x0 + 4, y0 + h, g.x0, y0 + h * 0.5], P5.hull);
  d.rect(g.x0 + 4, y0, g.x1 - g.x0 - 6, 1, P5.hullLL);
  d.rect(g.x0 + 4, y0 + 1, g.x1 - g.x0 - 6, 1, P5.hullL);
  d.rect(g.x0 + 2, y0 + h - 2, g.x1 - g.x0 - 4, 2, P5.hullD);
  // Orange band + windows.
  d.rect(g.x0 + 3, y0 + 3, g.x1 - g.x0 - 4, 2, P5.orange);
  d.rect(g.x0 + 3, y0 + 4, g.x1 - g.x0 - 4, 1, P5.orangeD);
  for (let x = g.x0 + 7; x < g.x1 - 6; x += 7) {
    d.rect(x, y0 + 7, 4, 3, P5.dark);
    d.rect(x, y0 + 7, 4, 2, (x / 7) % 3 < 1 ? P5.windowD : P5.window);
  }
  d.poly([g.x1 - 1, y0 + 3, g.x1 + 4, y0 + h * 0.5, g.x1 - 1, y0 + h * 0.5], P5.glass);
  // Keel plate (bottom turret mounts bolt on here).
  d.rect(g.x0 + 6, y0 + h, g.x1 - g.x0 - 12, 2, P5.hullDD);
  d.rect(g.x0 + 6, y0 + h, g.x1 - g.x0 - 12, 1, P5.hullD);
}

function paintEngines(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const d = new Pen(p, OX, OY);
  for (const [ex, ey] of s.engines) {
    // Strut to the envelope.
    const top = ey > s.bodyH - 2 ? s.bodyH - 6 : ey - 4;
    if (ey > s.bodyH - 6) d.rect(ex - 1, top, 3, ey - top, P5.hullD);
    else d.rect(ex - 1, ey - 5, 3, 3, P5.hullD);
    // Nacelle.
    d.cap(ex - 7, ey, ex + 6, ey, 3.2, P5.hullD);
    d.cap(ex - 7, ey - 0.5, ex + 6, ey - 0.5, 2.6, P5.hull);
    d.rect(ex - 6, ey - 3, 11, 1, P5.hullLL);
    d.rect(ex + 1, ey - 3, 2, 6, P5.brass);
    d.px(ex + 1, ey - 3, P5.brassL);
    d.circle(ex - 8, ey, 1.8, P5.hullDD);
  }
}

function paintDetails(p: PixelArt, s: ShipSpec, OX: number, OY: number): void {
  const d = new Pen(p, OX, OY);
  const L = s.len / 2;
  const cy = s.bodyH / 2;
  // Nose cap (brass on rigid ships, a rope collar on blimps).
  for (let x = Math.floor(L * 0.93); x <= L; x++) {
    const hh = halfH(s, x);
    for (let y = Math.floor(cy - hh); y <= Math.ceil(cy + hh); y++) {
      const v = (y - cy) / Math.max(1, hh);
      if (Math.abs(v) > 1) continue;
      const lt = 0.6 - v * 0.5;
      d.px(x, y, s.soft ? pick(CANVAS_RAMP, lt - 0.2, x, y) : lt > 0.75 ? P5.brassL : lt > 0.4 ? P5.brass : P5.brassD);
    }
  }
  if (!s.soft) {
    // Orange band behind the nose cap and the Legion roundel.
    for (const bx of [Math.round(L * 0.62), Math.round(-L * 0.56)]) {
      const hh = halfH(s, bx);
      for (let y = Math.ceil(cy - hh + 1); y < cy + hh; y++) {
        d.px(bx, y, y < cy ? P5.orange : P5.orangeD);
        d.px(bx + 1, y, y < cy ? P5.orange : P5.orangeD);
        d.px(bx + 2, y, P5.orangeD);
      }
    }
    const rx = Math.round(L * 0.3);
    const rr = Math.max(4, Math.round(s.bodyH * 0.2));
    d.circle(rx, cy, rr + 1, P5.oliveDD);
    d.circle(rx, cy, rr, P5.cream);
    d.circle(rx, cy, rr - 1.4, P5.red);
    cog(d, rx, cy, rr - 2, P5.brass);
    // Rivet row under the deck beam.
    for (let x = s.deck[0] + 3; x < s.deck[1] - 2; x += 6) {
      const t = Math.max(5, Math.floor(envTop(s, x)) + 1);
      d.px(x, t + 1, P5.oliveLL);
      d.px(x + 1, t + 2, P5.oliveDD);
    }
  } else {
    // Cargo markings: big stencilled cog and a hazard stripe band.
    const rx = Math.round(L * 0.12);
    const rr = Math.max(5, Math.round(s.bodyH * 0.2));
    d.circle(rx, cy + 2, rr, P5.canvasD);
    cog(d, rx, cy + 2, rr - 1, P5.rust);
  }
  // Nav lights are drawn by the decor (blinking); mark a dark socket.
  d.px(Math.round(L) - 1, Math.round(cy), P5.dark);
}

/** Full ship art into a fresh canvas of the right size. */
export function drawShip(s: ShipSpec): PixelArt {
  const c = shipCanvas(s);
  const p = new PixelArt(c.w, c.h);
  const OX = c.ox;
  const OY = c.oy;
  paintGondola(p, s, OX, OY);
  paintFins(p, s, OX, OY);
  paintEnvelope(p, s, OX, OY);
  paintDetails(p, s, OX, OY);
  paintEngines(p, s, OX, OY);
  paintDeck(p, s, OX, OY);
  paintCabin(p, s, OX, OY);
  return p;
}

// One sprite per ship class (the decor draws it, flipped for ships facing left).
for (const s of Object.values(SHIPS)) {
  const c = shipCanvas(s);
  sprites.define({ name: `m5_ship_${s.id}`, w: c.w, h: c.h, ox: c.ox, oy: c.oy, draw: (p) => p.blit(drawShip(s), 0, 0) });
}

/** Pusher propeller seen edge-on (spinning blur), 4 frames. Origin = hub. Two sizes. */
for (const [name, len] of [
  ['m5_prop', 13],
  ['m5_prop_l', 19],
] as const) {
  sprites.define({
    name,
    w: 5,
    h: len,
    ox: 2,
    oy: Math.floor(len / 2),
    frames: 4,
    outline: null,
    draw: (p, f) => {
      const half = len / 2;
      for (let y = 0; y < len; y++) {
        const dy = (y + 0.5 - half) / half;
        const wv = Math.sqrt(Math.max(0, 1 - dy * dy)) * 2.2;
        for (let x = 0; x < 5; x++) if (Math.abs(x - 2) <= wv && (x + y + f) % 2 === 0) p.px(x, y, '#cfc6e0');
      }
      const yb = Math.round([0.1, 0.35, 0.62, 0.85][f] * (len - 3));
      p.rect(1, yb, 3, 3, '#3e3c48');
      p.px(2, yb, '#8a8898');
      p.rect(1, half - 1, 3, 2, '#2a2830');
    },
  });
}

/** Mixed tone helper for decor pieces drawn per frame. */
export function tone(a: string, b: string, t: number): string {
  return mixColor(a, b, t);
}
