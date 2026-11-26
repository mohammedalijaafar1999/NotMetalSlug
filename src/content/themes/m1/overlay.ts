// Palm Harbor atmosphere overlay (screen space, drawn over the world): a few palm leaflets / jungle
// leaves tumbling on the sea breeze and faint salt-spray motes on the beach. Deliberately sparse and
// small so it never hides bullets or soldiers. Deterministic from time (no RNG).

import { PixelArt } from '../../../engine/pixelart';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import type { LevelDef } from '../../../game/level';
import { M1, PH, h01, ramp01 } from './layout';

let leaves: HTMLCanvasElement[] | null = null;

/** Four tumble frames for two leaf colours: a slender leaflet seen at different angles. */
function leafFrames(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (const [c, d] of [
    [PH.grassL, PH.grassD],
    ['#c8d870', '#8aa040'],
  ]) {
    const shapes = [
      (p: PixelArt) => {
        p.rect(0, 1, 5, 1, c);
        p.px(1, 0, c);
        p.px(3, 2, d);
      },
      (p: PixelArt) => {
        p.line(0, 2, 4, 0, c);
        p.px(1, 2, d);
      },
      (p: PixelArt) => {
        p.rect(2, 0, 1, 3, c);
        p.px(3, 1, d);
      },
      (p: PixelArt) => {
        p.line(0, 0, 4, 2, c);
        p.px(3, 1, d);
      },
    ];
    for (const s of shapes) {
      const p = new PixelArt(5, 3);
      s(p);
      out.push(p.toCanvas());
    }
  }
  return out;
}

export function renderM1Overlay(g: CanvasRenderingContext2D, camX: number, _camY: number, time: number, _level: LevelDef): void {
  if (!leaves) leaves = leafFrames();
  const xw = camX + VIEW_W / 2;
  const jungle = ramp01(xw, M1.villageEnd - 200, M1.villageEnd + 200);
  const n = Math.round(3 + jungle * 3);
  for (let i = 0; i < n; i++) {
    const period = 9 + h01(i, 0, 401) * 6;
    const t = (time / period + h01(i, 1, 401)) % 1;
    // Drift down-left with the breeze, swaying.
    const x = VIEW_W + 12 - t * (VIEW_W + 40) - (camX * 0.15) % 40 + Math.sin(time * 1.3 + i * 2.1) * 10 + h01(i, 2, 401) * 60;
    const y = 36 + t * (VIEW_H - 70) + Math.sin(time * 2.1 + i) * 6;
    const frame = Math.floor(time * (5 + i) + i) % 4;
    const set = jungle > 0.5 ? 0 : 4;
    g.globalAlpha = Math.min(1, Math.min(t, 1 - t) * 8) * 0.85;
    g.drawImage(leaves[set + frame], Math.round(((x % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40)) - 20, Math.round(y));
  }
  // Salt spray motes over the beach and the lagoon.
  const sea = 1 - jungle;
  if (sea > 0.05) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const t = (time * (0.05 + h01(i, 3, 402) * 0.05) + h01(i, 4, 402)) % 1;
      const x = Math.round(t * (VIEW_W + 20) - 10 + Math.sin(time + i) * 4);
      const y = Math.round(120 + h01(i, 5, 402) * 60 - t * 30 + Math.sin(time * 1.7 + i * 3) * 3);
      g.globalAlpha = sea * 0.45 * Math.min(1, Math.min(t, 1 - t) * 6);
      g.fillRect(x, y, 1, 1);
    }
  }
  g.globalAlpha = 1;
}
