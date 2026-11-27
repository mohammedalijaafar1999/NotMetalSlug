// bosstest_m5 (mission 0): THUNDERHEAD test arena. The players start in a DRAGONFLY gyro, the sky
// auto-scrolls for a few seconds, then the camera locks on open sky and the airship moves in.
// Geometry mirrors what the mission-5 boss arena needs: no terrain in view, a kill floor far below
// (ground at height + 160 only exists so falls end the life), fixed camera y, lock announce WARNING!.
// Also registers a small stormy-sky test theme (the real look comes from the mission's own theme).

import { registerLevel } from '../../../game/level';
import { registerTheme } from '../../../game/theme';
import { PixelArt } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { cloudLayer } from '../../../art/textures';

/** Tileable band of cloud tops (a cloud sea far below). */
function cloudSea(w: number, h: number, top: string, body: string, shade: string, seed: number): PixelArt {
  const p = new PixelArt(w, h);
  const r = new Rng(seed);
  p.rect(0, 12, w, h - 12, body);
  for (let i = 0; i < 26; i++) {
    const cx = r.int(0, w - 1);
    const cy = r.range(10, 18);
    const rad = r.range(5, 12);
    for (const k of [-w, 0, w]) {
      p.circle(cx + k, cy + 2, rad, shade);
      p.circle(cx + k, cy, rad - 1, body);
      p.circle(cx + k - rad * 0.3, cy - rad * 0.3, rad * 0.45, top);
    }
  }
  for (let y = 26; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 2 === 0 && y > 30) p.px(x, y, shade);
  return p;
}

registerTheme({
  id: 'bosstest_m5_sky',
  sky: ['#262c4a', '#34406a', '#4c628e', '#7890b4', '#a8bcd2'],
  layers: [
    { art: () => cloudLayer(360, 50, '#6a7aa0', '#55648a', 61, 5), factor: 0.03, y: 30, speed: 2 },
    { art: () => cloudLayer(300, 60, '#9aaccc', '#7a8cb0', 62, 6), factor: 0.08, y: 96, speed: 9 },
    { art: () => cloudSea(256, 50, '#ffffff', '#dfe6f0', '#b4c0d4', 63), factor: 0.25, y: 178, speed: 34 },
  ],
  groundTile: () => {
    const p = new PixelArt(32, 32);
    p.rect(0, 0, 32, 32, '#dfe6f0');
    return p;
  },
});

export const BOSSTEST_M5_LOCK_X = 420;

registerLevel({
  id: 'bosstest_m5',
  mission: 0,
  name: 'THUNDERHEAD TEST',
  subtitle: 'Boss test arena',
  theme: 'bosstest_m5_sky',
  music: 'boss',
  width: BOSSTEST_M5_LOCK_X + 384,
  height: 216,
  start: { x: 80 },
  startVehicle: 'gyro',
  // Kill floor only: nothing to land on inside the view.
  ground: [
    [
      [0, 376],
      [BOSSTEST_M5_LOCK_X + 384, 376],
    ],
  ],
  camera: [[0, 0, 0]],
  autoScroll: [{ x1: 0, x2: BOSSTEST_M5_LOCK_X, speed: 70 }],
  bossName: 'THUNDERHEAD',
  locks: [
    {
      x: BOSSTEST_M5_LOCK_X,
      boss: true,
      announce: 'WARNING!',
      waves: [{ spawns: [{ type: 'boss_m5', x: BOSSTEST_M5_LOCK_X + 300, y: 100 }] }],
    },
  ],
});
