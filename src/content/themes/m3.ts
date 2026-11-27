// FROSTBITE PASS (mission 3) theme: a cold blue sky over far alpine peaks, mid ridges dotted with
// pines, a near snowy forest edge and drifting valley mist; frozen rock ground under a snow cap,
// Legion granite masonry, snow-capped planks / steel girders / ice shelves / rock ledges, icy
// water, a gorge backdrop and frozen-lake ice, 25 decor kinds and parallax snowfall with gusts.
// The art lives in ./m3/ (palette, textures, sprites, platforms, weather).
//
// Decor kinds (DecorDef.kind; x/y = bottom-centre on the ground unless noted; props.flip mirrors,
// props.f picks a frame):
//   nature : pine (f 0..5 = 44/58/72/88/100/32 px), pine_far (f 0..2, muted, for depth), rock (f 0..2),
//            snowman, campfire (animated), fence (props.n segments), icefall (origin at the TOP: hangs
//            from a ledge), icebank (snow bank at a shore), drift (props.w wide snow drift)
//   built  : cabin, tower (Legion watchtower), pylon (cable pylon, origin at the cable sheaves),
//            terminal (cable-car station), hangar (walker hangar), hut (ice-fishing hut), fortwall,
//            truck (frozen truck), sign (f: 0 PASS, 1 DANGER, 2 weight limit, 3 cable car, 4 HALT, 5 FORT),
//            warnlight (props.color 'red'|'amber' blinks; props.off), skirack, banner (waving),
//            drums, crates, lamp (flickers), gate (boom gate), mast (radio mast, blinking light)
//   spans  : gorge (x = left edge, props.w; the far gorge wall sinking into the abyss - give it
//            props.behindTerrain so the cliff edges overlap it), lake (x = left edge, props.w;
//            glossy ice crust + dark frozen water from y down, drawn over the ground fill)

import { sprites } from '../../engine/sprites';
import { mixColor } from '../../engine/pixelart';
import { registerTheme, type DecorRenderer } from '../../game/theme';
import type { DecorDef } from '../../game/level';
import { P3 } from './m3/palette';
import { forestLayer, groundTile, mistLayer, peaksLayer, ridgeLayer, snowEdge, stoneTile, hash01 } from './m3/layers';
import { drawPlatform } from './m3/platforms';
import { renderSnow } from './m3/weather';
import './m3/decor_nature';
import './m3/decor_built';

/** Sprite-backed decor: frame from props.f (or an animation), mirrored with props.flip. */
function spr(name: string, anim?: (d: DecorDef, time: number) => number): DecorRenderer {
  return (g, d, time) => {
    const f = anim ? anim(d, time) : ((d.props?.f as number) ?? 0);
    sprites.get(name).draw(g, Math.round(d.x), Math.round(d.y), f, { flip: !!d.props?.flip });
  };
}

/** Per-instance phase so neighbouring lights/flames don't animate in lockstep. */
const phase = (d: DecorDef): number => hash01(Math.round(d.x) * 13 + Math.round(d.y));

const cssCache = new Map<string, HTMLCanvasElement>();
function tileCanvas(name: string): HTMLCanvasElement {
  let c = cssCache.get(name);
  if (!c) {
    c = sprites.get(name).pixelArt(0).toCanvas();
    cssCache.set(name, c);
  }
  return c;
}

/** Tile a backdrop sprite horizontally over [x, x + w) with its top at y; fill below with `deep`. */
function band(g: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, deep: string, depth: number): void {
  const c = tileCanvas(name);
  const x0 = Math.round(x);
  const x1 = Math.round(x + w);
  const y0 = Math.round(y);
  for (let tx = x0; tx < x1; tx += c.width) {
    const cw = Math.min(c.width, x1 - tx);
    g.drawImage(c, 0, 0, cw, c.height, tx, y0, cw, c.height);
  }
  g.fillStyle = deep;
  g.fillRect(x0, y0 + c.height, x1 - x0, depth);
}

const DECOR: Record<string, DecorRenderer> = {
  // ---------------------------------------------------------------- nature
  pine: spr('m3_pine'),
  pine_far: spr('m3_pine_far'),
  rock: spr('m3_rock'),
  snowman: spr('m3_snowman'),
  campfire: spr('m3_campfire', (d, t) => Math.floor(t * 9 + phase(d) * 4) % 4),
  fence: (g, d) => {
    const n = (d.props?.n as number) ?? 1;
    const s = sprites.get('m3_fence');
    for (let i = 0; i < n; i++) s.draw(g, Math.round(d.x + (i - (n - 1) / 2) * 30), Math.round(d.y), 0);
  },
  icefall: spr('m3_icefall'),
  icebank: spr('m3_icebank'),
  drift: (g, d) => {
    // A soft wind-blown snow drift banked against something (bottom-centre, props.w wide).
    const w = (d.props?.w as number) ?? 40;
    const h = (d.props?.h as number) ?? 6;
    const x = Math.round(d.x - w / 2);
    const y = Math.round(d.y);
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const k = Math.sin(Math.PI * Math.pow(t, d.props?.flip ? 1.6 : 0.6));
      const hh = Math.max(1, Math.round(h * k));
      g.fillStyle = P3.outline;
      g.fillRect(x + i, y - hh - 1, 1, 1);
      g.fillStyle = i < w * 0.45 ? P3.snowHi : P3.snow;
      g.fillRect(x + i, y - hh, 1, 1);
      g.fillStyle = P3.snowM;
      g.fillRect(x + i, y - hh + 1, 1, Math.max(0, hh - 1));
    }
  },

  // ---------------------------------------------------------------- built
  cabin: spr('m3_cabin', (d, t) => (Math.floor(t * 3 + phase(d) * 7) % 7 === 0 ? 1 : 0)),
  tower: spr('m3_tower'),
  pylon: spr('m3_pylon'),
  terminal: spr('m3_terminal'),
  hangar: spr('m3_hangar'),
  hut: spr('m3_hut'),
  fortwall: spr('m3_fortwall'),
  truck: spr('m3_truck'),
  sign: spr('m3_sign'),
  warnlight: spr('m3_warnlight', (d, t) => {
    if (d.props?.off) return 0;
    const on = Math.floor(t * 2.2 + phase(d) * 2) % 2 === 0;
    return on ? (d.props?.color === 'amber' ? 2 : 1) : 0;
  }),
  skirack: spr('m3_skirack'),
  banner: spr('m3_banner', (d, t) => Math.floor(t * 6 + phase(d) * 4) % 4),
  drums: spr('m3_drums'),
  crates: spr('m3_crates'),
  lamp: spr('m3_lamp', (d, t) => (Math.floor(t * 12 + phase(d) * 40) % 23 === 0 ? 1 : 0)),
  gate: spr('m3_gate'),
  mast: spr('m3_mast', (d, t) => (Math.floor(t * 1.6 + phase(d) * 2) % 2)),

  // ---------------------------------------------------------------- spans
  gorge: (g, d, time) => {
    const w = (d.props?.w as number) ?? 256;
    band(g, 'm3_gorge', d.x, d.y, w, '#232b40', 400);
    // Mist drifting low in the abyss.
    const x0 = Math.round(d.x);
    for (let k = 0; k < 3; k++) {
      const yy = Math.round(d.y + 58 + k * 16);
      g.globalAlpha = 0.16 + k * 0.05;
      g.fillStyle = mixColor('#9eb4d0', '#4a5a78', k / 3);
      for (let i = 0; i < 5; i++) {
        const len = 70 + ((i * 37 + k * 11) % 50);
        const span = w + len;
        const px = ((((i * 97 + k * 53 + time * (5 + k * 2)) % span) + span) % span) - len;
        g.fillRect(x0 + Math.round(px), yy + (i % 2) * 3, Math.min(len, Math.max(0, w - px)), 2 + (k % 2));
      }
    }
    g.globalAlpha = 1;
  },
  lake: (g, d) => {
    const w = (d.props?.w as number) ?? 256;
    band(g, 'm3_ice', d.x, d.y, w, '#28507a', 300);
  },
};

registerTheme({
  id: 'm3',
  sky: [...P3.sky],
  layers: [
    { art: () => peaksLayer(), factor: 0.04, y: 22, yFactor: 0.02 },
    { art: () => ridgeLayer(), factor: 0.12, y: 92, yFactor: 0.06 },
    { art: () => mistLayer(), factor: 0.18, y: 146, yFactor: 0.08, speed: 4, alpha: 0.3 },
    { art: () => forestLayer(), factor: 0.3, y: 126, yFactor: 0.14 },
  ],
  groundTile: () => groundTile(),
  groundEdge: () => snowEdge(32, 3, 8, 7),
  groundEdgeUp: 3,
  solidTile: () => stoneTile(),
  solidEdge: () => snowEdge(32, 2, 4, 19),
  solidEdgeUp: 2,
  depthShade: [
    [40, 0.12],
    [96, 0.26],
    [170, 0.4],
  ],
  platform: drawPlatform,
  water: { color: '#3a6e9a', surface: '#d6f0fc', alpha: 0.62 },
  decor: DECOR,
  renderOverlay: (g, camX, camY, time) => renderSnow(g, camX, camY, time),
});
