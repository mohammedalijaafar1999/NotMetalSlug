// Theme 'm5' - STORMFRONT: a storm at dusk above the clouds (mission 5, flown in the gyro).
//  - Sky: deep indigo -> violet -> a glowing dusk horizon (retro bands).
//  - Background (custom renderer, src/content/themes/m5/sky.ts): far cumulonimbus towers with anvil
//    tops and rain shafts that flash from inside with lightning (and the odd distant bolt), a far
//    Legion fleet drifting along the horizon (the flagship's silhouette looms late in the mission),
//    mid cloud banks, and the cloud sea far below in two parallax depths.
//  - Overlay (weather.ts): faint slanted rain in two depths and sparse translucent wisps racing past;
//    both follow the storm's build-up along the mission and the wisps clear out before the boss.
//  - Terrain (terrain.ts): riveted gunmetal hull plating for solids with a steel deck edge (brass
//    railing above, lit portholes below), cloud-bank ground for the far-below kill floor, catwalk /
//    gangway / girder platforms.
//  - Decor (decor.ts + ships.ts): Legion airships (skiff, gunship, frigate, cruiser, cargo blimp),
//    radio masts with pennants, searchlights, signal lamps, lashed cargo, lift rotors, barge
//    bow/stern caps, war banners, cables.

import { registerTheme, type ParallaxLayer } from '../../game/theme';
import { P5 } from './m5/palette';
import { FLEET_FACTOR, MID_FACTOR, cloudSea, fleetLayer, midClouds, renderStormBackground } from './m5/sky';
import { renderStormOverlay } from './m5/weather';
import { CLOUD_UP, DECK_UP, cloudGroundEdge, cloudGroundTile, deckEdge, hullTile, stormPlatform } from './m5/terrain';
import { STORM_DECOR } from './m5/decor';

/** Parallax layers, far -> near (drawn by the custom background after the storm towers). */
const LAYERS: ParallaxLayer[] = [
  { art: fleetLayer, factor: FLEET_FACTOR, y: 52, yFactor: 0.08, speed: 2.2 },
  { art: midClouds, factor: MID_FACTOR, y: 100, yFactor: 0.18, speed: 4 },
  { art: () => cloudSea(512, 110, 63, false), factor: 0.32, y: 166, yFactor: 0.32, speed: 5 },
  { art: () => cloudSea(640, 60, 64, true), factor: 0.62, y: 192, yFactor: 0.5, speed: 9 },
];

registerTheme({
  id: 'm5',
  sky: [...P5.sky],
  layers: LAYERS,
  renderBackground: (g, camX, camY, time, level) => renderStormBackground(g, camX, camY, time, level, LAYERS),
  renderOverlay: renderStormOverlay,
  groundTile: cloudGroundTile,
  groundEdge: cloudGroundEdge,
  groundEdgeUp: CLOUD_UP,
  solidTile: hullTile,
  solidEdge: deckEdge,
  solidEdgeUp: DECK_UP,
  depthShade: [
    [20, 0.1],
    [32, 0.2],
    [48, 0.32],
  ],
  platform: stormPlatform,
  water: { color: '#4e4072', surface: '#e2acb2', alpha: 0.6 },
  decor: STORM_DECOR,
});
