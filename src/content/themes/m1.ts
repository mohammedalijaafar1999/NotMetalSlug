// Theme 'm1' - PALM HARBOR: a sunny tropical harbor at morning. Turquoise sea and a smoking volcano
// behind a white beach, a fishing village on stilts over the lagoon, then red jungle soil under
// dense green canopy, a river crossing, the Legion fuel depot on a cliff and the Legion stockade.
// Backgrounds stay hazier and less saturated than the actors so soldiers and bullets always read.
// Helpers live in ./m1/ (layout + palette, backdrop panoramas, ground textures, platforms, decor,
// overlay).

import { registerTheme } from '../../game/theme';
import { renderM1Background } from './m1/backdrop';
import { m1GroundEdge, m1GroundTile, m1SolidEdge, m1SolidTile, EDGE_UP } from './m1/ground';
import { m1Platform } from './m1/platforms';
import { M1_DECOR } from './m1/decor';
import { renderM1Overlay } from './m1/overlay';
import { PH } from './m1/layout';

registerTheme({
  id: 'm1',
  sky: [...PH.sky],
  groundTile: m1GroundTile,
  groundEdge: m1GroundEdge,
  groundEdgeUp: EDGE_UP,
  solidTile: m1SolidTile,
  solidEdge: m1SolidEdge,
  solidEdgeUp: 2,
  depthShade: [
    [34, 0.14],
    [84, 0.28],
  ],
  platform: m1Platform,
  water: { color: '#1f9cb4', surface: '#c8fff2', alpha: 0.5 },
  decor: M1_DECOR,
  renderBackground: renderM1Background,
  renderOverlay: renderM1Overlay,
});
