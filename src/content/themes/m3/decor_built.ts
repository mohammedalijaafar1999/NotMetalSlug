// FROSTBITE PASS scenery sprites, part 2: built things - log cabin, Legion watchtower, cable
// pylon, cable-car terminal, walker hangar, ice-fishing hut, fortress wall, frozen truck, signs,
// warning lights, ski rack, banner, drums, crates, lamp post, boom gate, radio mast.

import { sprites } from '../../../engine/sprites';
import { mixColor } from '../../../engine/pixelart';
import { P3 } from './palette';
import { hash01 } from './layers';
import { icicles, legionEmblem, pxText, shadedBox, snowCap, textWidth } from './art';

const OUT = P3.outline;

// ------------------------------------------------------------------ log cabin

sprites.define({
  name: 'm3_cabin',
  w: 84,
  h: 62,
  frames: 2,
  outline: OUT,
  draw: (p, f) => {
    // Stone chimney (behind the roof).
    shadedBox(p, 58, 4, 8, 22, '#8a8e98', '#a8acb4', '#5e626c');
    for (let y = 7; y < 24; y += 4) p.rect(59, y, 6, 1, '#6e727c');
    snowCap(p, 57, 67, 4, 2, 11, false);
    // Log walls.
    for (let row = 0; row < 8; row++) {
      const y = 28 + row * 4;
      p.rect(8, y, 66, 4, P3.wood);
      p.rect(8, y, 66, 1, P3.woodHi);
      p.rect(8, y + 3, 66, 1, P3.woodD);
      // Knots.
      if (row % 2 === 0) p.px(20 + row * 5, y + 2, P3.woodD);
      // Log ends at the corners.
      for (const lx of [6, 74]) {
        p.circle(lx + 0.5, y + 2, 2.2, P3.woodHi);
        p.circle(lx + 0.8, y + 2.2, 1.2, P3.woodM);
      }
    }
    // Window with warm light.
    p.rect(16, 34, 16, 13, P3.woodDD);
    p.rect(18, 36, 12, 9, f ? '#f8c050' : P3.lamp);
    p.rect(18, 36, 12, 2, f ? P3.lamp : P3.lampHi);
    p.rect(23, 36, 2, 9, P3.woodDD);
    p.rect(18, 40, 12, 1, P3.woodDD);
    p.px(18, 44, P3.snowHi);
    p.px(19, 44, P3.snow);
    p.px(29, 36, P3.snowHi);
    snowCap(p, 15, 33, 47, 2, 5, true);
    // Door.
    p.rect(46, 38, 14, 22, P3.woodDD);
    p.rect(47, 39, 12, 21, P3.woodM);
    for (let x = 50; x < 59; x += 3) p.rect(x, 39, 1, 21, P3.woodD);
    p.rect(47, 44, 12, 1, P3.woodD);
    p.rect(47, 53, 12, 1, P3.woodD);
    p.px(56, 49, P3.gold);
    // Roof: a heavy snow blanket with an overhang and icicles.
    p.poly([0, 30, 41, 6, 84, 30, 80, 31, 41, 10, 4, 31], P3.woodD);
    p.poly([1, 29, 41, 4, 83, 29, 79, 30, 41, 9, 5, 30], P3.woodM);
    for (let x = 0; x <= 84; x++) {
      const ridge = 4 + Math.abs(x - 41) * (24 / 42);
      const thick = 4 + Math.round(Math.sin(x * 0.35) * 0.8 + (hash01(x) > 0.75 ? 1 : 0));
      for (let k = 0; k < thick; k++) {
        const y = Math.round(ridge - 2 + k);
        p.px(x, y, k === 0 ? P3.snowHi : x > 41 ? (k > 2 ? P3.snowS : P3.snowM) : k > 2 ? P3.snowM : P3.snow);
      }
    }
    icicles(p, 3, 82, 31, 5, 0.4, 7);
    // Snow drift against the wall.
    p.ellipse(20, 61, 18, 3, P3.snow);
    p.ellipse(66, 61, 12, 2.5, P3.snowM);
    p.rect(4, 60, 76, 2, P3.snowS);
  },
});

// ------------------------------------------------------------------ Legion watchtower
// Deck (where a level puts a one-way platform) is 64 px above the ground.

export const TOWER_DECK = 64;

sprites.define({
  name: 'm3_tower',
  w: 52,
  h: 112,
  outline: OUT,
  draw: (p) => {
    const G = 112;
    const deck = G - TOWER_DECK;
    // Legs (slanting out) with cross braces.
    p.line(12, deck, 4, G - 1, P3.woodD, 3);
    p.line(40, deck, 48, G - 1, P3.woodM, 3);
    p.line(12, deck, 4, G - 1, P3.wood);
    for (let k = 0; k < 3; k++) {
      const y0 = deck + 4 + k * 20;
      const y1 = y0 + 18;
      const xl0 = 12 - (8 * (y0 - deck)) / TOWER_DECK;
      const xr0 = 40 + (8 * (y0 - deck)) / TOWER_DECK;
      const xl1 = 12 - (8 * (y1 - deck)) / TOWER_DECK;
      const xr1 = 40 + (8 * (y1 - deck)) / TOWER_DECK;
      p.line(xl0, y0, xr1, y1, P3.woodD, 2);
      p.line(xr0, y0, xl1, y1, P3.woodM, 2);
      p.rect(xl1, y1, xr1 - xl1, 2, P3.woodD);
    }
    // Ladder.
    p.rect(23, deck, 1, TOWER_DECK, P3.woodDD);
    p.rect(29, deck, 1, TOWER_DECK, P3.woodDD);
    for (let y = deck + 4; y < G; y += 6) p.rect(23, y, 7, 1, P3.woodM);
    // Deck beam (the level's platform draws the planks on top).
    p.rect(6, deck + 1, 40, 4, P3.woodD);
    p.rect(6, deck + 1, 40, 1, P3.wood);
    // Hut on the deck: back wall + side posts + roof.
    p.rect(8, deck - 30, 36, 30, '#5e3e26');
    for (let y = deck - 28; y < deck; y += 4) p.rect(8, y, 36, 1, '#4c3020');
    p.rect(12, deck - 24, 28, 10, '#2a2430');
    p.rect(12, deck - 24, 28, 1, '#1c1820');
    shadedBox(p, 6, deck - 31, 3, 31, P3.wood, P3.woodHi, P3.woodD);
    shadedBox(p, 43, deck - 31, 3, 31, P3.wood, P3.woodHi, P3.woodD);
    // Railing (front, low).
    p.rect(6, deck - 9, 40, 2, P3.wood);
    p.rect(6, deck - 9, 40, 1, P3.woodHi);
    // Roof with snow.
    p.poly([1, deck - 30, 26, deck - 44, 51, deck - 30], P3.redD);
    p.poly([3, deck - 31, 26, deck - 43, 49, deck - 31], P3.red);
    snowCap(p, 2, 50, deck - 33, 2, 21, false);
    for (let x = 6; x < 47; x++) {
      const y = Math.round(deck - 43 + Math.abs(x - 26) * (12 / 22));
      p.px(x, y, P3.snowHi);
      p.px(x, y + 1, x > 26 ? P3.snowS : P3.snow);
    }
    icicles(p, 2, 50, deck - 30, 4, 0.35, 23);
    // Searchlight on the roof edge.
    p.rect(44, deck - 36, 6, 5, P3.steelD);
    p.rect(45, deck - 35, 4, 3, P3.lampHi);
    p.rect(43, deck - 31, 2, 3, P3.steelD);
    // Legion pennant on a pole.
    p.rect(26, deck - 56, 1, 13, P3.steelM);
    p.poly([27, deck - 56, 36, deck - 53, 27, deck - 50], P3.red);
    p.px(28, deck - 54, P3.gold);
    // Snow at the feet.
    p.ellipse(4, G - 1, 6, 2, P3.snow);
    p.ellipse(48, G - 1, 6, 2, P3.snowM);
  },
});

// ------------------------------------------------------------------ cable pylon (origin at the top)

sprites.define({
  name: 'm3_pylon',
  w: 44,
  h: 172,
  oy: 2,
  outline: OUT,
  draw: (p) => {
    const H = 172;
    const haze = '#5a6c88';
    const steel = (y: number, c: string) => mixColor(c, haze, Math.min(0.85, Math.max(0, (y - 40) / 150)));
    // Legs: taper from 12 px wide at the head to 38 at the bottom.
    for (let y = 10; y < H; y++) {
      const hw = 6 + (y - 10) * 0.08;
      p.px(Math.round(22 - hw), y, steel(y, P3.steelHi));
      p.px(Math.round(22 - hw) + 1, y, steel(y, P3.steel));
      p.px(Math.round(22 + hw), y, steel(y, P3.steelD));
      p.px(Math.round(22 + hw) - 1, y, steel(y, P3.steelM));
    }
    // Lattice.
    for (let y = 12; y < H - 8; y += 14) {
      const hw0 = 6 + (y - 10) * 0.08;
      const hw1 = 6 + (y + 14 - 10) * 0.08;
      p.line(22 - hw0 + 1, y, 22 + hw1 - 1, y + 14, steel(y, P3.steelM));
      p.line(22 + hw0 - 1, y, 22 - hw1 + 1, y + 14, steel(y, P3.steelD));
      p.rect(22 - hw0, y, hw0 * 2, 1, steel(y, P3.steel));
    }
    // Head: crossarm + sheave wheels.
    shadedBox(p, 2, 6, 40, 5, P3.steel, P3.steelHi, P3.steelD);
    for (const wx of [8, 36]) {
      p.circle(wx, 4, 3.5, P3.steelDD);
      p.circle(wx, 4, 2.5, P3.steelM);
      p.px(wx, 4, P3.steelHi);
    }
    snowCap(p, 2, 42, 6, 1, 31, true);
    // Warning light.
    p.rect(21, 0, 3, 3, P3.red);
    p.px(21, 0, P3.redHi);
  },
});

// ------------------------------------------------------------------ cable-car terminal

sprites.define({
  name: 'm3_terminal',
  w: 150,
  h: 112,
  outline: OUT,
  draw: (p) => {
    const G = 112;
    // Concrete ground floor.
    shadedBox(p, 4, G - 46, 142, 46, P3.concrete, P3.concreteHi, P3.concreteD);
    for (let y = G - 40; y < G; y += 8) p.rect(5, y, 140, 1, '#8c949e');
    for (let x = 20; x < 146; x += 24) p.rect(x, G - 45, 1, 44, '#8c949e');
    // Big dark machine-hall opening.
    p.rect(52, G - 38, 74, 38, '#2a2e3a');
    p.rect(52, G - 38, 74, 2, '#1c1f28');
    for (let x = 56; x < 124; x += 8) p.rect(x, G - 36, 1, 3, '#3a404e');
    // Hazard stripes on the opening frame.
    for (let x = 52; x < 126; x += 4) p.rect(x, G - 42, 2, 3, (x / 4) % 2 ? P3.gold : '#2a2e3a');
    // Upper floor: steel-framed control room.
    shadedBox(p, 10, G - 84, 130, 38, '#6e7a8a', '#8a96a6', '#4e5868');
    for (let k = 0; k < 5; k++) {
      const wx = 18 + k * 24;
      p.rect(wx, G - 76, 18, 16, '#283040');
      p.rect(wx + 1, G - 75, 16, 14, '#7ea6c8');
      p.rect(wx + 1, G - 75, 16, 3, '#b8d4ea');
      p.rect(wx + 8, G - 75, 1, 14, '#283040');
      p.px(wx + 2, G - 74, '#ffffff');
      snowCap(p, wx - 1, wx + 19, G - 60, 1, 40 + k, false);
    }
    // Sign board.
    const txt = 'CABLE CAR';
    const tw = textWidth(txt);
    shadedBox(p, 75 - tw / 2 - 5, G - 96, tw + 10, 11, P3.redD, P3.red, '#5a1420');
    pxText(p, 75 - tw / 2, G - 93, txt, '#f4e8d0');
    // Flat roof with snow + overhang.
    p.rect(4, G - 88, 142, 4, P3.steelD);
    p.rect(4, G - 88, 142, 1, P3.steel);
    snowCap(p, 2, 148, G - 90, 3, 51, true);
    // Legion emblem plate.
    legionEmblem(p, 26, G - 26, 7);
    // Snow drifts.
    p.ellipse(18, G - 1, 16, 3, P3.snow);
    p.ellipse(140, G - 1, 10, 2, P3.snowM);
  },
});

// ------------------------------------------------------------------ walker hangar

sprites.define({
  name: 'm3_hangar',
  w: 100,
  h: 74,
  outline: OUT,
  draw: (p) => {
    const G = 74;
    // Dark interior + back wall details.
    p.rect(8, G - 58, 84, 58, '#262a34');
    for (let x = 12; x < 90; x += 6) p.rect(x, G - 56, 1, 54, '#2e333f');
    legionEmblem(p, 50, G - 40, 8);
    // Tool rack + hoist chain.
    p.rect(16, G - 34, 14, 2, '#4a5262');
    p.rect(18, G - 32, 1, 6, '#5a6474');
    p.rect(23, G - 32, 1, 8, '#5a6474');
    p.rect(27, G - 32, 1, 5, '#5a6474');
    for (let y = G - 56; y < G - 30; y += 2) p.px(72, y, '#6c7686');
    p.rect(70, G - 30, 5, 3, P3.gold);
    // Frame pillars with hazard stripes.
    for (const x of [2, 90]) {
      shadedBox(p, x, G - 62, 8, 62, P3.steel, P3.steelHi, P3.steelD);
      for (let y = G - 20; y < G; y += 6) p.poly([x, y, x + 8, y - 4, x + 8, y, x, y + 4], P3.gold);
    }
    // Arched corrugated roof.
    for (let x = 0; x < 100; x++) {
      const t = (x - 50) / 50;
      const y = Math.round(G - 62 - (1 - t * t) * 10);
      for (let k = 0; k < 5; k++) p.px(x, y + k, x % 4 === 0 ? P3.steelD : k === 0 ? P3.steelHi : P3.steel);
      const sn = 2 + Math.round(hash01(x * 3) * 1.5);
      for (let k = 1; k <= sn; k++) p.px(x, y - k, k === sn ? P3.snowHi : x > 50 ? P3.snowM : P3.snow);
    }
    icicles(p, 2, 98, G - 57, 5, 0.3, 61);
    // Bay number.
    shadedBox(p, 38, G - 70 + 1, 24, 9, P3.olD, P3.ol, '#2a2c18');
    pxText(p, 41, G - 67, 'BAY3', P3.gold);
    // Snow at the threshold.
    p.rect(0, G - 2, 100, 2, P3.snowM);
  },
});

// ------------------------------------------------------------------ ice-fishing hut

sprites.define({
  name: 'm3_hut',
  w: 42,
  h: 40,
  outline: OUT,
  draw: (p) => {
    const G = 40;
    // Runners.
    p.rect(2, G - 3, 36, 2, P3.steelD);
    p.rect(1, G - 4, 2, 2, P3.steelD);
    // Body: faded red boards.
    shadedBox(p, 4, G - 28, 30, 25, '#a04438', '#c05a48', '#6e2a24');
    for (let x = 8; x < 33; x += 5) p.rect(x, G - 27, 1, 23, '#843630');
    // Door + window.
    p.rect(20, G - 21, 9, 17, '#5e241e');
    p.px(27, G - 13, P3.gold);
    p.rect(8, G - 22, 7, 6, '#2a2430');
    p.rect(9, G - 21, 5, 4, '#ffd060');
    // Stovepipe.
    p.rect(28, G - 38, 3, 10, P3.steelD);
    p.rect(27, G - 39, 5, 2, P3.steelDD);
    // Roof.
    p.poly([1, G - 27, 19, G - 35, 37, G - 27], P3.woodD);
    for (let x = 1; x < 38; x++) {
      const y = Math.round(G - 35 + Math.abs(x - 19) * (8 / 18));
      p.px(x, y - 1, P3.snowHi);
      p.px(x, y, x > 19 ? P3.snowS : P3.snow);
      p.px(x, y + 1, P3.snowM);
    }
    icicles(p, 2, 37, G - 27, 3, 0.35, 71);
    // Fishing rod leaning.
    p.line(37, G - 3, 41, G - 30, P3.woodD);
  },
});

// ------------------------------------------------------------------ fortress wall (background, muted)

sprites.define({
  name: 'm3_fortwall',
  w: 128,
  h: 104,
  outline: '#3a4660',
  draw: (p) => {
    const G = 104;
    const haze = (c: string) => mixColor(c, '#9fb2cc', 0.35);
    p.rect(0, 14, 128, G - 14, haze('#6c7a92'));
    // Masonry courses.
    for (let row = 0; row < 11; row++) {
      const y = 16 + row * 8;
      p.rect(0, y, 128, 1, haze('#4e5a72'));
      for (let x = (row % 2) * 8; x < 128; x += 16) p.rect(x, y, 1, 8, haze('#56627a'));
      p.rect(0, y + 1, 128, 1, haze('#7f8ca4'));
    }
    // Crenellations.
    for (let x = 0; x < 128; x += 16) {
      p.rect(x, 4, 10, 12, haze('#6c7a92'));
      p.rect(x, 4, 10, 1, haze('#8a98b0'));
      p.rect(x, 2, 10, 2, P3.snow);
    }
    p.rect(0, 13, 128, 2, P3.snowM);
    // Arrow slits + a banner.
    for (const x of [22, 104]) {
      p.rect(x, 40, 3, 12, haze('#2a3042'));
      p.rect(x - 1, 44, 5, 2, haze('#2a3042'));
    }
    p.rect(54, 20, 20, 44, haze(P3.redD));
    p.rect(55, 20, 18, 42, haze(P3.red));
    p.poly([55, 62, 64, 56, 73, 62, 73, 66, 55, 66], haze(P3.red));
    legionEmblem(p, 64, 36, 6);
    // Snow along the foot.
    p.rect(0, G - 3, 128, 3, P3.snowM);
  },
});

// ------------------------------------------------------------------ frozen truck

sprites.define({
  name: 'm3_truck',
  w: 88,
  h: 48,
  outline: OUT,
  draw: (p) => {
    const G = 48;
    // Cargo bed with a snowy tarp.
    shadedBox(p, 2, G - 24, 52, 14, P3.olM, P3.ol, P3.olD);
    p.poly([2, G - 24, 6, G - 40, 50, G - 40, 54, G - 24], '#7c7a52');
    for (let x = 12; x < 50; x += 10) p.rect(x, G - 39, 1, 15, '#5e5c3c');
    snowCap(p, 5, 51, G - 41, 3, 81, true);
    // Cab.
    shadedBox(p, 56, G - 34, 24, 24, P3.ol, P3.olHi, P3.olD);
    p.rect(60, G - 31, 13, 9, '#4a6a88');
    p.rect(61, G - 30, 11, 3, '#b8d4ea');
    p.line(62, G - 26, 69, G - 30, '#ffffff');
    // Hood + grille + bumper.
    shadedBox(p, 78, G - 24, 9, 14, P3.ol, P3.olHi, P3.olD);
    for (let y = G - 22; y < G - 12; y += 2) p.rect(85, y, 2, 1, P3.olD);
    p.rect(77, G - 11, 11, 3, P3.steelD);
    p.rect(84, G - 20, 3, 3, P3.lampHi);
    icicles(p, 77, 88, G - 8, 4, 0.5, 83);
    snowCap(p, 55, 81, G - 35, 3, 85, false);
    snowCap(p, 77, 88, G - 25, 2, 87, false);
    // Legion star on the door.
    legionEmblem(p, 66, G - 17, 3);
    // Wheels half-buried in drifts.
    for (const wx of [16, 40, 70]) {
      p.circle(wx, G - 8, 7, '#24242c');
      p.circle(wx, G - 8, 3, P3.steelM);
    }
    for (let x = 0; x < 88; x++) {
      const d = 6 + Math.round(Math.sin(x * 0.18) * 2 + Math.sin(x * 0.5) * 1);
      for (let k = 0; k < d; k++) p.px(x, G - 1 - k, k === d - 1 ? P3.snowHi : k > d - 3 ? P3.snow : P3.snowM);
    }
  },
});

// ------------------------------------------------------------------ signs
// 0 arrow "PASS", 1 avalanche danger, 2 weight limit "2T", 3 cable car, 4 Legion "HALT",
// 5 "BASTION" arrow.

export const SIGN = { PASS: 0, DANGER: 1, WEIGHT: 2, CABLE: 3, HALT: 4, BASTION: 5 } as const;

sprites.define({
  name: 'm3_sign',
  w: 36,
  h: 36,
  frames: 6,
  outline: OUT,
  draw: (p, f) => {
    const G = 36;
    // Post.
    p.rect(16, 12, 4, G - 12, P3.wood);
    p.rect(16, 12, 1, G - 12, P3.woodHi);
    p.rect(19, 12, 1, G - 12, P3.woodD);
    p.ellipse(18, G - 1, 6, 2, P3.snow);
    if (f === 0 || f === 5) {
      const txt = f === 0 ? 'PASS' : 'FORT';
      p.poly([2, 4, 28, 4, 34, 10, 28, 16, 2, 16], P3.woodM);
      p.poly([3, 5, 28, 5, 32, 10, 28, 15, 3, 15], P3.woodHi);
      pxText(p, 6, 8, txt, P3.woodDD);
      snowCap(p, 3, 28, 4, 2, 90 + f, true);
    } else if (f === 1) {
      p.poly([18, 0, 34, 18, 18, 34 - 12, 2, 18], '#2a2430');
      p.poly([18, 2, 32, 18, 18, 20, 4, 18], P3.gold);
      p.rect(17, 7, 2, 7, '#2a2430');
      p.rect(17, 16, 2, 2, '#2a2430');
      p.rect(16, 0, 4, 1, P3.snowHi);
    } else if (f === 2) {
      p.circle(18, 10, 10, P3.red);
      p.circle(18, 10, 7.5, '#f4f0e8');
      pxText(p, 14, 8, '2T', '#2a2430');
      p.rect(12, 0, 12, 1, P3.snowHi);
      p.rect(10, 1, 16, 1, P3.snow);
    } else if (f === 3) {
      shadedBox(p, 4, 2, 28, 18, '#2e5a9a', '#4a7ab8', '#1e3a6a');
      p.line(5, 6, 31, 4, '#e8eef6');
      p.rect(17, 5, 1, 4, '#e8eef6');
      shadedBox(p, 12, 9, 12, 8, P3.red, P3.redHi, P3.redD);
      p.rect(14, 11, 3, 3, '#cfe4f4');
      p.rect(19, 11, 3, 3, '#cfe4f4');
      snowCap(p, 4, 32, 2, 1, 93, false);
    } else {
      shadedBox(p, 3, 2, 30, 14, P3.red, P3.redHi, P3.redD);
      pxText(p, 9, 7, 'HALT', '#f4f0e8');
      snowCap(p, 3, 33, 2, 2, 95, true);
    }
  },
});

// ------------------------------------------------------------------ warning light (frames: off, red, amber)

sprites.define({
  name: 'm3_warnlight',
  w: 12,
  h: 40,
  frames: 3,
  outline: OUT,
  draw: (p, f) => {
    const G = 40;
    p.rect(5, 8, 2, G - 8, P3.steelM);
    p.rect(5, 8, 1, G - 8, P3.steel);
    for (let y = G - 10; y < G; y += 4) p.rect(4, y, 4, 2, y % 8 ? P3.gold : '#2a2430');
    p.rect(3, G - 2, 6, 2, P3.steelD);
    // Lamp housing.
    const on = f > 0;
    const lit = f === 1 ? '#ff5040' : '#ffb030';
    const dim = f === 2 ? '#7a5420' : '#6a2420';
    p.rect(2, 6, 8, 3, P3.steelD);
    p.ellipse(6, 4, 3.6, 3.6, on ? lit : dim);
    if (on) {
      p.px(5, 2, '#ffffff');
      p.px(4, 3, '#fff0d0');
    }
    p.rect(2, 4, 8, 1, P3.steelDD);
    p.rect(1, 0, 10, 1, P3.snowHi);
  },
});

// ------------------------------------------------------------------ ski rack

sprites.define({
  name: 'm3_skirack',
  w: 36,
  h: 30,
  outline: OUT,
  draw: (p) => {
    const G = 30;
    // Leaning skis (behind the rail).
    const skis = [
      [6, '#c83a2e'],
      [11, '#2e6ab8'],
      [17, '#e8c040'],
      [22, '#c83a2e'],
      [28, '#3a9a5a'],
    ] as const;
    for (const [x, c] of skis) {
      p.line(x, G - 2, x + 3, 2, c, 2);
      p.px(x + 3, 1, '#f4f0e8');
    }
    p.line(31, G - 2, 34, 8, P3.steelD);
    p.line(33, G - 2, 35, 10, P3.steelD);
    // Rack rail + posts.
    p.rect(2, 12, 32, 3, P3.wood);
    p.rect(2, 12, 32, 1, P3.woodHi);
    p.rect(3, 12, 3, G - 12, P3.woodM);
    p.rect(30, 12, 3, G - 12, P3.woodM);
    snowCap(p, 2, 34, 12, 2, 101, true);
    p.ellipse(18, G - 1, 17, 2, P3.snow);
  },
});

// ------------------------------------------------------------------ Legion banner (4 frames waving)

sprites.define({
  name: 'm3_banner',
  w: 24,
  h: 56,
  frames: 4,
  outline: OUT,
  draw: (p, f) => {
    const G = 56;
    p.rect(3, 4, 2, G - 4, P3.steelM);
    p.rect(3, 4, 1, G - 4, P3.steelHi);
    p.circle(4, 3, 2, P3.gold);
    p.rect(3, 7, 18, 2, P3.steelD);
    // Cloth: columns sway with the wind.
    for (let x = 4; x < 21; x++) {
      const sway = Math.round(Math.sin(x * 0.45 + f * 1.57) * 1.6 * ((x - 4) / 16));
      const len = 26 + Math.round(Math.sin(x * 0.7 + f) * 1.5);
      for (let y = 0; y < len; y++) {
        const c = (x + f) % 6 < 3 ? P3.red : '#a42c28';
        p.px(x, 9 + y + sway, y === len - 1 ? P3.redD : c);
      }
      p.px(x, 9 + sway + Math.floor(len / 2) + 6, P3.gold);
    }
    legionEmblem(p, 12.5, 20 + Math.round(Math.sin(f * 1.57) * 0.8), 4);
    p.ellipse(4, G - 1, 5, 2, P3.snow);
  },
});

// ------------------------------------------------------------------ drums / crates / lamp / gate / mast

sprites.define({
  name: 'm3_drums',
  w: 38,
  h: 30,
  outline: OUT,
  draw: (p) => {
    const G = 30;
    const drum = (x: number, y: number, c: string, cd: string, ch: string) => {
      shadedBox(p, x, y, 12, 15, c, ch, cd);
      p.rect(x, y + 4, 12, 1, cd);
      p.rect(x, y + 10, 12, 1, cd);
      p.rect(x + 2, y + 1, 1, 13, ch);
    };
    drum(2, G - 15, P3.ol, P3.olD, P3.olHi);
    drum(15, G - 15, '#9a4a2a', '#6a2e1a', '#c06a3a');
    drum(8, G - 30, P3.ol, P3.olD, P3.olHi);
    snowCap(p, 8, 20, G - 30, 2, 111, false);
    snowCap(p, 2, 8, G - 15, 1, 113, false);
    snowCap(p, 20, 27, G - 15, 1, 115, false);
    p.rect(26, G - 4, 10, 4, P3.snowM);
  },
});

sprites.define({
  name: 'm3_crates',
  w: 44,
  h: 34,
  outline: OUT,
  draw: (p) => {
    const G = 34;
    const crate = (x: number, y: number, w: number, h: number) => {
      shadedBox(p, x, y, w, h, '#6a6a3a', '#86864c', '#4a4a28');
      p.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, '#4a4a28');
      p.line(x + 1, y + 1, x + w - 2, y + h - 2, '#56562e');
      p.rect(x + 2, y + 2, 5, 2, P3.redD);
    };
    crate(2, G - 16, 20, 16);
    crate(22, G - 14, 18, 14);
    crate(10, G - 30, 18, 14);
    pxText(p, 4, G - 9, 'LGN', '#c8c8a0');
    snowCap(p, 10, 28, G - 30, 2, 121, true);
    snowCap(p, 2, 10, G - 16, 1, 123, false);
    snowCap(p, 28, 40, G - 14, 1, 125, false);
  },
});

sprites.define({
  name: 'm3_lamp',
  w: 18,
  h: 48,
  frames: 2,
  outline: OUT,
  draw: (p, f) => {
    const G = 48;
    p.rect(4, 6, 2, G - 6, P3.steelD);
    p.rect(4, 6, 1, G - 6, P3.steelM);
    p.rect(3, G - 3, 4, 3, P3.steelDD);
    p.rect(4, 5, 9, 2, P3.steelD);
    // Lantern.
    p.rect(10, 7, 6, 2, P3.steelDD);
    p.rect(10, 9, 6, 6, f ? '#ffe9a0' : P3.lamp);
    p.rect(11, 10, 2, 3, P3.lampHi);
    p.rect(10, 15, 6, 1, P3.steelDD);
    p.rect(3, 3, 12, 2, P3.snowHi);
  },
});

sprites.define({
  name: 'm3_gate',
  w: 60,
  h: 36,
  outline: OUT,
  draw: (p) => {
    const G = 36;
    // Gate post + counterweight box.
    shadedBox(p, 2, G - 22, 9, 22, P3.concrete, P3.concreteHi, P3.concreteD);
    shadedBox(p, 0, G - 26, 13, 5, P3.steelM, P3.steel, P3.steelD);
    // Raised boom (angled up to the right), red/white.
    for (let k = 0; k < 50; k++) {
      const x = 8 + k * 0.94;
      const y = G - 24 - k * 0.34;
      p.rect(x, y, 2, 3, Math.floor(k / 6) % 2 ? '#f4f0e8' : P3.red);
    }
    snowCap(p, 0, 13, G - 26, 1, 131, false);
    p.ellipse(6, G - 1, 8, 2, P3.snow);
  },
});

sprites.define({
  name: 'm3_mast',
  w: 30,
  h: 96,
  frames: 2,
  outline: OUT,
  draw: (p, f) => {
    const G = 96;
    // Guy wires.
    p.line(15, 12, 1, G - 1, '#7a8494');
    p.line(15, 12, 29, G - 1, '#7a8494');
    // Lattice mast.
    for (let y = 6; y < G; y++) {
      p.px(13, y, P3.steel);
      p.px(17, y, P3.steelD);
    }
    for (let y = 8; y < G - 4; y += 6) {
      p.line(13, y, 17, y + 6, P3.steelM);
      p.line(17, y, 13, y + 6, P3.steelD);
    }
    // Dish + antenna bars.
    p.ellipse(10, 30, 3, 5, P3.steelHi);
    p.ellipse(10.5, 30, 1.5, 3.5, P3.steelM);
    p.rect(12, 20, 8, 1, P3.steelD);
    p.rect(12, 44, 8, 1, P3.steelD);
    // Tip light (blinks).
    p.rect(14, 2, 3, 3, f ? '#ff5040' : '#6a2420');
    if (f) p.px(14, 2, '#ffffff');
    p.rect(13, 0, 5, 1, P3.snowHi);
    p.ellipse(15, G - 1, 6, 2, P3.snow);
  },
});
