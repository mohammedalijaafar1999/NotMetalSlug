// Theme 'm6' - IRON CITADEL: the Rustcoat Legion's fortress-factory at night.
// Near-black ember sky, the citadel keep and smokestacks far away, foundry halls, lattice girders
// and steam mains up close; riveted steel decks, soot-stained firebrick, grated catwalks, molten
// metal (deep water styled orange), and an atmosphere of drifting embers, smog and alarm pulses.
// Art lives in ./m6/ (palette, tiles, layers, decor, overlay).

import { registerTheme } from '../../game/theme';
import { M6 } from './m6/palette';
import { farLayer, midLayer, nearLayer, smokeLayer } from './m6/layers';
import { brickSolidTile, drawPlatform, floorEdge, floorTile, solidEdge } from './m6/tiles';
import { M6_DECOR } from './m6/decor';
import { renderM6Overlay } from './m6/overlay';

registerTheme({
  id: 'm6',
  sky: [...M6.sky],
  layers: [
    // Citadel keep, towers and smokestacks (barely moves).
    { art: farLayer, factor: 0.06, y: 46, yFactor: 0.05 },
    // Smog banks drifting in front of the citadel.
    { art: smokeLayer, factor: 0.1, y: 58, yFactor: 0.08, speed: 5, alpha: 0.5 },
    // Foundry halls, chimneys, gas holders, gantry cranes.
    { art: midLayer, factor: 0.22, y: 70, yFactor: 0.14 },
    // Lattice girders, risers and hooks right behind the playfield.
    { art: nearLayer, factor: 0.42, y: 18, yFactor: 0.32 },
  ],
  groundTile: floorTile,
  groundEdge: floorEdge,
  groundEdgeUp: 1,
  solidTile: brickSolidTile,
  solidEdge,
  solidEdgeUp: 1,
  depthShade: [
    [20, 0.2],
    [56, 0.36],
    [120, 0.52],
  ],
  platform: drawPlatform,
  // Molten metal pools: LevelDef.water with deadly: true (the m6_molten entity does the killing).
  water: { color: M6.moltenD, surface: M6.moltenLL, alpha: 0.88 },
  decor: M6_DECOR,
  renderOverlay: renderM6Overlay,
});
