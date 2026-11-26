// Theme 'm2' - DUSTWIND CANYON: a desert canyon from noon to sunset. Sky, sun and parallax
// panoramas follow the camera (themes/m2/backdrop.ts), sedimentary sand ground with a loose crust,
// red-rock strata solids, scaffold / ledge / ruin / metal platforms, an oasis pool, desert, ruin and
// oil-field decor, and a sandstorm weather overlay with gusts and a warm sunset tint.

import { registerTheme } from '../../game/theme';
import { renderBackdrop } from './m2/backdrop';
import { M2_DECOR } from './m2/decor';
import { C } from './m2/palette';
import { drawPlatform, GROUND_EDGE_UP, groundEdge, groundTile, SOLID_EDGE_UP, solidEdge, solidTile } from './m2/terrain';
import { renderWeather } from './m2/weather';
import './m2/sprites';

registerTheme({
  id: 'm2',
  // Used only by code that reads the gradient directly; renderBackground draws the real sky.
  sky: ['#5a88bc', '#a8bcc4', '#e8d4a2'],
  groundTile,
  groundEdge,
  groundEdgeUp: GROUND_EDGE_UP,
  solidTile,
  solidEdge,
  solidEdgeUp: SOLID_EDGE_UP,
  depthShade: [
    [22, 0.1],
    [48, 0.2],
    [96, 0.32],
    [170, 0.44],
  ],
  platform: drawPlatform,
  water: { color: C.water, surface: C.waterHi, alpha: 0.62 },
  decor: M2_DECOR,
  renderBackground: renderBackdrop,
  renderOverlay: renderWeather,
});
