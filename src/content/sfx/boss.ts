// Boss sounds: big, low and mechanical.

import { body, crack, crackles, explosionLayers, ping, rumble, sfx, thump } from './kit';

// Mechanical monster roar: a growling, jittery low voice through "oh-ah" formants + grinding metal.
sfx(
  'boss_roar',
  [
    { wave: 'saw', freq: 98, freqEnd: 58, dur: 1.3, attack: 0.12, hold: 0.45, curve: 1.3, jitter: 0.7, jitterRate: 32, drive: 3, vowel: 'o', vowelEnd: 'a', vol: 1.25 },
    { wave: 'brown', dur: 1.25, attack: 0.1, hold: 0.4, curve: 1.3, tremolo: 0.45, tremoloRate: 17, lowpass: 900, vol: 0.5, seed: 251 },
    { wave: 'metal', freq: 61, freqEnd: 45, dur: 1.2, attack: 0.15, hold: 0.35, curve: 1.4, lowpass: 1500, vol: 0.14 },
  ],
  { poly: 1, priority: 4, gain: 1.3 },
);

// Boss destroyed: a long, multi-stage detonation with a metal groan.
sfx(
  'boss_die',
  [
    ...explosionLayers(2),
    body(2400, 120, 1.2, 0.6, { delay: 0.28, seed: 261 }),
    body(2000, 90, 1.3, 0.55, { delay: 0.62, seed: 262 }),
    thump(62, 20, 1.4, 0.9, { delay: 0.25, glide: 0.9, curve: 1.4 }),
    rumble(2.0, 0.5, { delay: 0.05, curve: 1.1 }),
    crackles(30, 1.7, 0.2, { delay: 0.3, seed: 263 }),
    { wave: 'saw', freq: 140, freqEnd: 55, dur: 1.4, delay: 0.3, attack: 0.2, curve: 1.3, lowpass: 600, vol: 0.12 },
  ],
  { poly: 1, priority: 5 },
);

// Boss-approach siren: a smooth two-cycle wail.
sfx(
  'warning',
  [
    { wave: 'square', duty: 0.5, freq: 880, dur: 1.45, attack: 0.06, hold: 1.2, decay: 0.19, vibrato: 4, vibratoRate: 1.4, lowpass: 2600, vol: 0.2 },
    { wave: 'sine', freq: 440, dur: 1.45, attack: 0.06, hold: 1.2, decay: 0.19, vibrato: 4, vibratoRate: 1.4, vol: 0.2 },
    { wave: 'square', duty: 0.5, freq: 55, dur: 1.45, repeat: 0.36, attack: 0.01, hold: 0.16, decay: 0.1, lowpass: 400, vol: 0.18 },
  ],
  { poly: 1, priority: 5 },
);

// Charging a big attack: a rising, accelerating whine.
sfx(
  'boss_charge',
  [
    { wave: 'saw', freq: 120, freqEnd: 900, dur: 0.92, attack: 0.55, hold: 0.25, decay: 0.12, tremolo: 0.6, tremoloRate: 18, lowpass: 4000, vol: 0.3 },
    { wave: 'sine', freq: 400, freqEnd: 2400, dur: 0.92, attack: 0.65, hold: 0.15, decay: 0.12, vol: 0.12 },
    { wave: 'noise', freq: 18000, bandpass: 500, bandpassEnd: 4000, q: 2, dur: 0.92, attack: 0.6, hold: 0.2, decay: 0.12, vol: 0.12, seed: 271 },
  ],
  { poly: 1, priority: 4, gain: 1.4 },
);

// Massive beam: ring-modulated low drone with a crackling sizzle.
sfx(
  'boss_laser',
  [
    crack(0.5, { highpass: 1500, dur: 0.03 }),
    { wave: 'saw', freq: 110, dur: 1.0, attack: 0.02, hold: 0.55, curve: 1.6, ring: 37, drive: 2, lowpass: 3000, vol: 0.42 },
    { wave: 'square', duty: 0.5, freq: 55, dur: 1.0, attack: 0.02, hold: 0.55, curve: 1.6, lowpass: 600, vol: 0.24 },
    { wave: 'noise', freq: 20000, highpass: 3000, dur: 1.0, attack: 0.02, hold: 0.5, curve: 1.5, tremolo: 0.4, tremoloRate: 60, vol: 0.15, seed: 272 },
    crackles(140, 0.9, 0.12, { highpass: 3000, seed: 273 }),
  ],
  { poly: 1, priority: 4 },
);

// Shot on boss armor: heavy, short "dunk" (frequent, so it stays compact).
sfx('boss_hit', [ping(520, 0.09, 0.3, { fm: 2 }), thump(180, 90, 0.05, 0.3), crack(0.2, { highpass: 2000, dur: 0.012 })], { poly: 2, minGap: 0.04, gain: 0.85 });
