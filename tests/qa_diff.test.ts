// Regressions found by the final adversarial review of the post-integration changes.
import { afterEach, describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import { input } from '../src/engine/input';
import { VIEW_H } from '../src/engine/renderer';
import type { LevelDef } from '../src/game/level';
import type { Vehicle } from '../src/game/vehicle';

afterEach(() => {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
});

describe('flying vehicle squeezed by the rising view', () => {
  // THE CLIMB in m5 in miniature: the view rises past an airship hull with a keel and a gondola
  // slung under it while a gyro idles at the very bottom of the screen, right under the keel.
  const def: LevelDef = {
    id: 'qa_squeeze',
    mission: 0,
    name: 'SQUEEZE',
    width: 3000,
    height: 400,
    start: { x: 100, y: 300 },
    startVehicle: 'gyro',
    ground: [
      [
        [0, 560],
        [3000, 560],
      ],
    ],
    solids: [
      { x: 900, y: 150, w: 262, h: 33 },
      { x: 899, y: 183, w: 202, h: 9 },
      { x: 968, y: 192, w: 114, h: 18 },
    ],
    camera: [
      [0, 184, 184],
      [600, 184, 184],
      [900, 0, 0],
    ],
    autoScroll: [{ x1: 0, x2: 3000, speed: 40 }],
    theme: 'm5',
    entities: [{ type: 'm5_airspace', x: 0, y: 0, trigger: -9999 }],
  } as LevelDef;

  it('pops clear of the hull instead of being dragged through it (or stuck inside)', () => {
    const w = makeWorld(def, { god: true });
    const p = w.players[0];
    const g = p.vehicle as Vehicle;
    expect(g && g.flying).toBe(true);
    input.setVirtual(0, {});
    // Let the camera scroll until the view starts to rise, then park the gyro under the keel at
    // the bottom of the view (where the rising bottom edge squeezes it against the keel).
    for (let i = 0; i < 2000 && w.camera.x < 640; i++) step(w, 1);
    g.x = 950;
    g.y = w.camera.y + VIEW_H - 6;
    g.vx = g.vy = 0;
    let inside = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 12 && w.camera.y > 0.5; i++) {
      step(w, 1);
      g.x = Math.min(Math.max(g.x, 950), 950); // hold the line under the keel (no input)
      inside = g.bodyBlocked() ? inside + 1 : 0;
      worst = Math.max(worst, inside);
    }
    expect(w.camera.y).toBeLessThan(1);
    expect(worst).toBeLessThanOrEqual(2);
    expect(g.bodyBlocked()).toBe(false);
  });
});
