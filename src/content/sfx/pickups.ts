// Pickups and rewards: bright, crisp, rising (always major-key / consonant intervals).

import { blip, click, crackles, ping, sfx } from './kit';

// E5 major arpeggio flick + a soft triangle doubling an octave below.
sfx(
  'pickup',
  [blip(659.26, 0.2, 0.22, { arp: [0, 4, 7, 12], arpRate: 0.04, curve: 1.1 }), { wave: 'triangle', freq: 329.63, dur: 0.2, arp: [0, 4, 7, 12], arpRate: 0.04, curve: 1.1, vol: 0.16 }],
  { poly: 2, priority: 2 },
);

// Gun-cock "chk-chak" then a power-up arpeggio (G major, rising two octaves).
sfx(
  'pickup_weapon',
  [
    click(0.6, { bandpass: 2400 }),
    ping(1500, 0.05, 0.14),
    click(0.7, { delay: 0.075, bandpass: 3300, seed: 81 }),
    ping(2100, 0.05, 0.14, { delay: 0.076 }),
    blip(392, 0.36, 0.2, { delay: 0.14, duty: 0.5, arp: [0, 7, 12, 16, 19, 24], arpRate: 0.05, curve: 0.8 }),
    { wave: 'triangle', freq: 196, dur: 0.36, delay: 0.14, arp: [0, 7, 12, 16, 19, 24], arpRate: 0.05, curve: 0.8, vol: 0.16 },
  ],
  { poly: 2, priority: 3 },
);

// Bell "ding!" with a sparkle on top.
sfx(
  'pickup_points',
  [
    { wave: 'sine', freq: 1567.98, dur: 0.38, fm: 1.6, fmEnd: 0, fmRatio: 2.76, attack: 0.001, curve: 2.2, vol: 0.3 },
    blip(2093, 0.1, 0.06, { arp: [0, 7], arpRate: 0.045, duty: 0.125 }),
  ],
  { poly: 3, priority: 2 },
);

// 1-up: quick major arpeggio, then a shimmering sustained third.
sfx(
  'extra_life',
  [
    blip(523.25, 0.3, 0.2, { arp: [0, 4, 7, 12, 7, 12], arpRate: 0.05, curve: 0.7, duty: 0.5 }),
    blip(1046.5, 0.5, 0.15, { delay: 0.3, arp: [0, 4], arpRate: 0.06, tremolo: 0.35, tremoloRate: 14, curve: 1.3, duty: 0.25 }),
    { wave: 'triangle', freq: 261.63, dur: 0.8, arp: [0, 7, 12, 16, 12, 7, 12, 16], arpRate: 0.1, curve: 1.2, vol: 0.18 },
  ],
  { poly: 1, priority: 3 },
);

// Freed hostage: happy rising arpeggio with a bell on the top note.
sfx(
  'rescue',
  [
    { wave: 'triangle', freq: 1046.5, dur: 0.32, arp: [0, 4, 7, 12], arpRate: 0.06, curve: 1, vol: 0.32 },
    blip(523.25, 0.32, 0.08, { arp: [4, 7, 12, 16], arpRate: 0.06, duty: 0.125, curve: 1 }),
    { wave: 'sine', freq: 2093, dur: 0.32, delay: 0.24, fm: 1.4, fmEnd: 0, fmRatio: 3.5, curve: 2, vol: 0.18 },
  ],
  { poly: 2, priority: 2 },
);

// Credit / player-join: metallic clink then a bright chime.
sfx(
  'coin',
  [ping(3000, 0.08, 0.16, { fm: 2, fmRatio: 1.7 }), blip(1046.5, 0.3, 0.16, { delay: 0.045, arp: [0, 7, 12], arpRate: 0.06, curve: 1.2 })],
  { poly: 2, priority: 3 },
);

// Fuel / repair: bubbly gurgle and a rising "refill" tone.
sfx(
  'fuel',
  [
    { wave: 'square', duty: 0.5, freq: 190, dur: 0.32, jitter: 5, jitterRate: 38, lowpass: 900, tremolo: 0.6, tremoloRate: 26, attack: 0.01, curve: 1.4, vol: 0.26, seed: 91 },
    { wave: 'triangle', freq: 330, freqEnd: 990, dur: 0.42, delay: 0.08, attack: 0.04, curve: 1.2, vol: 0.22 },
    crackles(60, 0.35, 0.12, { highpass: 600, lowpass: 2500, seed: 92 }),
  ],
  { poly: 2, priority: 2 },
);
