// MACHINE RANGE (mission 0, like the sandbox): a debug/test level for trying the machine
// enemies in the browser: ?level=machine_range&spawn=light_tank@300  (warp=X to jump).
// Flat ground, a gentle hill, a ledge for emplacements and a deep harbor pool for gunboats.

import { registerLevel } from '../../game/level';

registerLevel({
  id: 'machine_range',
  mission: 0,
  name: 'MACHINE RANGE',
  subtitle: 'Vehicle test range',
  theme: 'default',
  music: 'm1',
  width: 3600,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 184],
      [700, 184],
      [760, 164],
      [860, 164],
      [920, 184],
      [1500, 184],
      [1500, 150],
      [1640, 150],
      [1640, 184],
      [2200, 184],
      [2200, 214],
      [2700, 214],
      [2700, 184],
      [3600, 184],
    ],
  ],
  platforms: [{ x: 1180, y: 140, w: 90, style: 'metal' }],
  water: [{ x: 2200, y: 178, w: 500, h: 38, deadly: true }],
  checkpoints: [1000, 2000],
  endX: 3600 - 384,
  decor: [
    { kind: 'sign', x: 90, y: 184 },
    { kind: 'sign', x: 2150, y: 184 },
  ],
});
