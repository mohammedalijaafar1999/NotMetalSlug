// Interface sounds: quiet, short and crisp. Pitches come from one consistent scale (A major)
// so menu navigation sounds musical rather than random.

import { blip, click, ping, sfx, whoosh } from './kit';

sfx('menu_move', [blip(1760, 0.035, 0.13, { curve: 2, duty: 0.25 })], { poly: 2, priority: 3, minGap: 0.02 });

sfx(
  'menu_select',
  [blip(1318.5, 0.14, 0.16, { arp: [0, 7], arpRate: 0.05, curve: 1.2 }), { wave: 'triangle', freq: 659.26, dur: 0.14, arp: [0, 7], arpRate: 0.05, curve: 1.2, vol: 0.14 }],
  { poly: 2, priority: 3, gain: 0.8 },
);

sfx('menu_back', [blip(1108.7, 0.13, 0.14, { arp: [0, -5], arpRate: 0.06, curve: 1.3 }), { wave: 'triangle', freq: 554.37, dur: 0.13, arp: [0, -5], arpRate: 0.06, curve: 1.3, vol: 0.12 }], { poly: 2, priority: 3, gain: 0.8 });

sfx(
  'pause',
  [blip(1108.7, 0.24, 0.15, { arp: [0, 5, 12], arpRate: 0.06, curve: 1.1, duty: 0.5 }), { wave: 'triangle', freq: 554.37, dur: 0.24, arp: [0, 5, 12], arpRate: 0.06, curve: 1.1, vol: 0.12 }],
  { poly: 1, priority: 4, gain: 0.8 },
);

// Score bonus "ka-ching": a metallic ping then a shimmering major arpeggio.
sfx(
  'tally_bonus',
  [
    ping(2640, 0.12, 0.2, { fm: 2.2, fmRatio: 1.7 }),
    blip(1760, 0.5, 0.13, { delay: 0.03, arp: [0, 4, 7, 12], arpRate: 0.035, tremolo: 0.5, tremoloRate: 30, duty: 0.125, curve: 1.2 }),
    { wave: 'sine', freq: 3520, dur: 0.45, delay: 0.05, tremolo: 0.8, tremoloRate: 22, curve: 1.5, vol: 0.05 },
  ],
  { poly: 2, priority: 3 },
);

sfx('tally_tick', [blip(2217.5, 0.03, 0.1, { duty: 0.125, curve: 2 })], { poly: 2, priority: 3, minGap: 0.015 });

// Mission banner: rising whoosh into a bright stab.
sfx(
  'banner',
  [
    whoosh(300, 3000, 0.42, 0.24, { attack: 0.3, q: 1 }),
    { wave: 'triangle', freq: 220, dur: 0.38, delay: 0.26, attack: 0.003, curve: 1.6, vol: 0.2 },
    blip(440, 0.38, 0.1, { delay: 0.26, duty: 0.5, curve: 1.6 }),
    blip(659.26, 0.38, 0.08, { delay: 0.26, duty: 0.25, curve: 1.6 }),
    blip(1108.7, 0.38, 0.06, { delay: 0.26, duty: 0.25, curve: 1.6 }),
    { wave: 'noise', freq: 20000, highpass: 4000, dur: 0.35, delay: 0.26, curve: 2, vol: 0.12, seed: 281 },
  ],
  { poly: 1, priority: 4 },
);

// Start game: a fast two-octave A major run into a ringing chord.
sfx(
  'start_game',
  [
    blip(440, 0.38, 0.17, { arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 0.05, curve: 0.5, duty: 0.5 }),
    { wave: 'triangle', freq: 220, dur: 0.38, arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 0.05, curve: 0.5, vol: 0.15 },
    blip(880, 0.65, 0.1, { delay: 0.35, tremolo: 0.25, tremoloRate: 12, curve: 1.3 }),
    blip(1108.7, 0.65, 0.09, { delay: 0.35, tremolo: 0.25, tremoloRate: 12, curve: 1.3 }),
    blip(1318.5, 0.65, 0.09, { delay: 0.35, tremolo: 0.25, tremoloRate: 12, curve: 1.3 }),
    { wave: 'triangle', freq: 110, dur: 0.65, delay: 0.35, curve: 1.3, vol: 0.25 },
    { wave: 'noise', freq: 20000, highpass: 3500, dur: 0.6, delay: 0.35, curve: 2.2, vol: 0.13, seed: 282 },
  ],
  { poly: 1, priority: 5, gain: 0.9 },
);

// Briefing text: a tiny typebar click.
sfx('typewriter', [click(0.32, { bandpass: 3200, dur: 0.01 }), blip(1400, 0.012, 0.03, { curve: 3, duty: 0.5 })], { poly: 2, priority: 2, minGap: 0.015 });

// Continue countdown: woodblock "tock".
sfx(
  'countdown_tick',
  [{ wave: 'sine', freq: 1250, dur: 0.07, attack: 0.0008, curve: 2.4, vol: 0.28 }, { wave: 'triangle', freq: 625, dur: 0.05, attack: 0.0008, curve: 2.4, vol: 0.15 }, click(0.2, { bandpass: 2500 })],
  { poly: 1, priority: 4 },
);
