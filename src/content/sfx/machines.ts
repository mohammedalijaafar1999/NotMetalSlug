// Enemy machines and world objects. Engine-type sounds (treads, rotors, engines, buzzing) are
// short bursts designed to be re-triggered periodically by the entity while it is active.

import { crack, crackles, gunshot, ping, rumble, sfx } from './kit';

// Tank main gun: big boom with a ringing barrel.
sfx(
  'tank_cannon',
  [
    ...gunshot({ crack: 0.7, crackHp: 800, crackDur: 0.04, bark: 520, barkVol: 0.6, barkDur: 0.18, body: [92, 34], bodyVol: 0.9, bodyDur: 0.36, tail: 0.6, tailVol: 0.3, tailCut: 1600 }),
    rumble(0.7, 0.36),
    ping(420, 0.32, 0.08, { fm: 2, fmEnd: 0.3 }),
  ],
  { poly: 3, priority: 2 },
);

// Clanking track links over an idling diesel rumble.
sfx(
  'tank_tread',
  [
    { wave: 'noise', freq: 18000, bandpass: 2400, q: 2, dur: 0.36, repeat: 0.045, attack: 0.001, decay: 0.022, vol: 0.32, seed: 191 },
    { wave: 'square', duty: 0.5, freq: 47, dur: 0.36, lowpass: 320, tremolo: 0.5, tremoloRate: 22, attack: 0.02, hold: 0.25, curve: 1.5, vol: 0.32 },
    { wave: 'metal', freq: 140, dur: 0.36, repeat: 0.09, attack: 0.001, decay: 0.04, lowpass: 1800, vol: 0.12 },
  ],
  { poly: 2, gain: 0.55 },
);

// Rotor chop "thwup-thwup" with a turbine whine.
sfx(
  'heli_rotor',
  [
    { wave: 'noise', freq: 9000, lowpass: 700, dur: 0.42, repeat: 0.07, attack: 0.005, decay: 0.05, vol: 0.55, seed: 201 },
    { wave: 'sine', freq: 72, dur: 0.42, repeat: 0.07, attack: 0.004, decay: 0.05, vol: 0.28 },
    { wave: 'saw', freq: 1900, dur: 0.42, lowpass: 3000, attack: 0.05, hold: 0.3, curve: 1.5, vol: 0.025 },
  ],
  { poly: 2, gain: 0.7 },
);

// Chin gun: one short heavy round (called per bullet).
sfx(
  'heli_gun',
  gunshot({ crack: 0.32, crackHp: 1800, crackDur: 0.015, bark: 1250, barkVol: 0.4, barkDur: 0.05, body: [185, 70], bodyVol: 0.36, bodyDur: 0.05, tail: 0.08, tailVol: 0.1, tailCut: 2800 }),
  { poly: 3, minGap: 0.025 },
);

// Emplacement gun: heavy "dunk".
sfx(
  'turret_fire',
  gunshot({ crack: 0.45, crackHp: 1200, crackDur: 0.025, bark: 620, barkVol: 0.55, barkDur: 0.1, body: [135, 50], bodyVol: 0.6, bodyDur: 0.12, tail: 0.25, tailVol: 0.16, tailCut: 2000 }),
  { poly: 3, gain: 0.78 },
);

// Small drone buzz.
sfx(
  'drone_buzz',
  [
    { wave: 'saw', freq: 172, dur: 0.3, jitter: 0.3, jitterRate: 20, tremolo: 0.4, tremoloRate: 45, lowpass: 2600, attack: 0.03, hold: 0.18, curve: 1.6, vol: 0.22 },
    { wave: 'square', duty: 0.3, freq: 344, dur: 0.3, attack: 0.03, hold: 0.18, curve: 1.6, lowpass: 3500, vol: 0.06 },
  ],
  { poly: 3, gain: 0.8 },
);

// Jet fly-by with a Doppler sweep.
sfx(
  'jet_flyby',
  [
    { wave: 'noise', freq: 18000, bandpass: 3600, bandpassEnd: 480, q: 0.9, dur: 1.3, attack: 0.5, hold: 0.1, curve: 1.5, vol: 0.55, seed: 211 },
    { wave: 'saw', freq: 2300, freqEnd: 880, dur: 1.3, attack: 0.5, hold: 0.1, curve: 1.6, lowpass: 5000, vol: 0.07 },
    rumble(1.3, 0.34, { attack: 0.45, curve: 1.5 }),
  ],
  { poly: 2, priority: 2, gain: 1.1 },
);

// Bullet on armor: bright "tink".
sfx('metal_hit', [ping(2100, 0.09, 0.3, { fm: 2.5 }), crack(0.3, { highpass: 3000, dur: 0.015 }), { wave: 'square', freq: 700, dur: 0.03, curve: 3, vol: 0.05 }], { poly: 3, minGap: 0.03 });

// Ricochet "pyeeew".
sfx(
  'ricochet',
  [{ wave: 'sine', freq: 3100, freqEnd: 1100, dur: 0.3, attack: 0.002, curve: 1.3, vibrato: 0.25, vibratoRate: 25, vol: 0.22 }, crack(0.2, { highpass: 4000, dur: 0.03 })],
  { poly: 2 },
);

// Landmine arming beep (re-triggered by the mine).
sfx('mine_beep', [{ wave: 'square', duty: 0.5, freq: 2093, dur: 0.07, attack: 0.002, hold: 0.04, curve: 2, lowpass: 6000, vol: 0.16 }], { poly: 2, priority: 2, gain: 0.75 });

// Wooden crate splintering.
sfx(
  'crate_break',
  [
    { wave: 'noise', freq: 16000, bandpass: 900, q: 1.2, dur: 0.12, attack: 0.0008, curve: 2.2, vol: 0.65, seed: 221 },
    { wave: 'square', duty: 0.45, freq: 210, freqEnd: 150, dur: 0.08, lowpass: 1200, curve: 2, vol: 0.28 },
    { wave: 'noise', freq: 16000, bandpass: 1800, q: 1.2, dur: 0.15, delay: 0.06, curve: 2, vol: 0.38, seed: 222 },
    crackles(70, 0.3, 0.26, { delay: 0.05, highpass: 700, lowpass: 2600, seed: 223 }),
  ],
  { poly: 3 },
);

// Glass shatter with tinkling shards.
sfx(
  'glass_break',
  [
    crack(0.5, { highpass: 3000, dur: 0.03 }),
    { wave: 'noise', freq: 20000, highpass: 3500, lowpass: 12000, dur: 0.25, attack: 0.001, curve: 2, vol: 0.35, seed: 231 },
    crackles(130, 0.55, 0.42, { delay: 0.03, highpass: 3500, lowpass: 11000, seed: 232 }),
    ping(4200, 0.18, 0.08, { delay: 0.06, fm: 1, fmRatio: 2.4 }),
    ping(5600, 0.14, 0.06, { delay: 0.14, fm: 1, fmRatio: 2.4 }),
    ping(3700, 0.16, 0.05, { delay: 0.22, fm: 1, fmRatio: 2.4 }),
  ],
  { poly: 2 },
);

// Vehicle engine rev burst.
sfx(
  'engine',
  [
    { wave: 'saw', freq: 52, freqEnd: 70, dur: 0.4, jitter: 0.2, jitterRate: 24, lowpass: 620, tremolo: 0.5, tremoloRate: 26, attack: 0.03, hold: 0.22, curve: 1.5, vol: 0.45 },
    { wave: 'square', duty: 0.5, freq: 104, freqEnd: 140, dur: 0.4, lowpass: 900, attack: 0.03, hold: 0.22, curve: 1.5, vol: 0.14 },
  ],
  { poly: 2, gain: 0.55 },
);
