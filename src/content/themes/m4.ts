// Theme 'm4' - RUSTWATER DOCKS: a ruined harbour city at dusk in the rain.
//  - Background (themes/m4/weather.ts): banded purple-to-orange dusk sky, drifting storm clouds with
//    sunset-lit undersides, a far skyline with lit windows and blinking beacons, the harbour (moored
//    freighters, gantry and jib cranes, the glinting basin) and near warehouse roofs, lamp posts and
//    container stacks; occasional lightning (gentle, respects the FLASHES option).
//  - Terrain (themes/m4/art.ts): wet granite quay walls topped with a concrete curb (puddle glints),
//    brick warehouse blocks with concrete coping, timber piers on pilings and steel catwalks.
//  - Decor (themes/m4/decor.ts): lamps, bollards, tyres, nets, wrecks, burning barrels, crates, signs,
//    a portal crane, containers, warehouse facades, canal walls, ship hulls, fences, the dry dock.
//  - Overlay: wind-driven rain, splash crowns on surfaces, ripples on water, lightning brightening.

import { registerTheme } from '../../game/theme';
import { P4, quayTile, curbEdge, EDGE_UP, warehouseBrick, copingEdge, m4Platform } from './m4/art';
import { renderM4Background, renderM4Overlay } from './m4/weather';
import { M4_DECOR } from './m4/decor';

registerTheme({
  id: 'm4',
  sky: [...P4.sky],
  renderBackground: renderM4Background,
  groundTile: quayTile,
  groundEdge: curbEdge,
  groundEdgeUp: EDGE_UP,
  solidTile: warehouseBrick,
  solidEdge: copingEdge,
  depthShade: [
    [40, 0.16],
    [96, 0.32],
    [150, 0.46],
  ],
  platform: m4Platform,
  water: { color: '#16243a', surface: '#8aa4c8', alpha: 0.72 },
  decor: M4_DECOR,
  renderOverlay: renderM4Overlay,
});
