// Player movement and life cycle.

import { blip, sfx, thump, voice, whoosh } from './kit';

// Light cloth whoosh with a tiny upward chirp: heard constantly, so it stays soft.
sfx(
  'jump',
  [whoosh(800, 1900, 0.1, 0.2, { attack: 0.02, q: 1 }), blip(250, 0.08, 0.07, { freqEnd: 430, glide: 0.06, lowpass: 2600, duty: 0.25, curve: 1.8 })],
  { poly: 2, gain: 0.9 },
);

// Boots on gravel.
sfx(
  'land',
  [thump(115, 55, 0.07, 0.4), { wave: 'noise', freq: 9000, lowpass: 1300, lowpassEnd: 400, dur: 0.09, attack: 0.001, curve: 1.8, vol: 0.3, seed: 71 }],
  { poly: 2, gain: 0.7 },
);

// Cartoon "WAAAGH!" over a falling arcade tone, then a body thud.
sfx(
  'player_die',
  [
    voice(340, 175, 0.62, 1.15, 'a', 'o', { hold: 0.22, vibrato: 0.8, vibratoRate: 9, glide: 0.55 }),
    { wave: 'square', duty: 0.35, freq: 620, freqEnd: 95, dur: 0.72, attack: 0.004, curve: 1.2, lowpass: 2400, vibrato: 0.5, vibratoRate: 11, vol: 0.13 },
    thump(105, 48, 0.12, 0.45, { delay: 0.6 }),
    { wave: 'noise', freq: 8000, lowpass: 900, dur: 0.1, curve: 2, vol: 0.2, delay: 0.6, seed: 72 },
  ],
  { poly: 2, priority: 3, gain: 1.1 },
);

// Drop-in: rising sparkle arpeggio and a swoosh.
sfx(
  'respawn',
  [
    blip(523.25, 0.36, 0.17, { arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 0.045, curve: 0.9, duty: 0.25 }),
    { wave: 'triangle', freq: 261.63, dur: 0.36, arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 0.045, curve: 0.9, vol: 0.14 },
    { wave: 'sine', freq: 2093, freqEnd: 4186, dur: 0.5, attack: 0.1, curve: 1.3, tremolo: 0.8, tremoloRate: 24, vol: 0.06 },
    whoosh(300, 3200, 0.5, 0.14, { attack: 0.3, q: 1 }),
  ],
  { poly: 2, priority: 2 },
);
