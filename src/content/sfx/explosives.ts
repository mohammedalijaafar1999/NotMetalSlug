// Explosions (small / normal / big are clearly different in weight, pitch and length) and fire.

import { crack, crackles, explosionLayers, sfx, thump, whoosh } from './kit';

sfx('explosion_small', explosionLayers(0), { poly: 4, priority: 2, gain: 0.85 });
sfx('explosion', explosionLayers(1), { poly: 4, priority: 2 });
sfx('explosion_big', explosionLayers(2), { poly: 3, priority: 3 });

sfx(
  'fire_burst',
  [
    crack(0.25, { highpass: 1200, dur: 0.02 }),
    thump(95, 45, 0.18, 0.35),
    whoosh(300, 1300, 0.55, 0.55, { attack: 0.05, q: 0.75, curve: 1.3 }),
    { wave: 'brown', dur: 0.6, attack: 0.03, curve: 1.25, lowpass: 900, tremolo: 0.3, tremoloRate: 22, vol: 0.42, seed: 61 },
    crackles(90, 0.55, 0.26, { highpass: 2000, seed: 62 }),
  ],
  { poly: 3, priority: 2 },
);
