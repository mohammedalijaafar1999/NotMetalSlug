// Player vehicles: chunky, satisfying, mechanical.

import { body, click, crack, gunshot, hiss, ping, rumble, sfx, thump, whoosh } from './kit';

// Hatch clunk, then the systems power up.
sfx(
  'vehicle_enter',
  [
    ping(600, 0.09, 0.22, { fm: 2.4 }),
    thump(140, 70, 0.09, 0.42),
    { wave: 'saw', freq: 90, freqEnd: 430, dur: 0.42, delay: 0.08, attack: 0.1, curve: 1.2, lowpass: 1500, vol: 0.24 },
    { wave: 'square', duty: 0.25, freq: 180, freqEnd: 860, dur: 0.42, delay: 0.08, attack: 0.1, curve: 1.3, lowpass: 3000, vol: 0.06 },
  ],
  { poly: 2, priority: 3 },
);

// Hatch pop and a power-down whir.
sfx(
  'vehicle_exit',
  [
    click(0.5, { bandpass: 2000 }),
    ping(520, 0.08, 0.18, { fm: 2.4 }),
    { wave: 'saw', freq: 420, freqEnd: 80, dur: 0.4, delay: 0.03, attack: 0.01, curve: 1.3, lowpass: 1400, vol: 0.22 },
    hiss(0.2, 0.1, { delay: 0.04, highpass: 4000 }),
  ],
  { poly: 2, priority: 3 },
);

// Heavy armor clang.
sfx('vehicle_hit', [ping(380, 0.2, 0.36, { fm: 3, fmEnd: 0.5 }), thump(165, 60, 0.09, 0.42), crack(0.3, { highpass: 1500, dur: 0.03 })], { poly: 2, priority: 2, minGap: 0.05, gain: 0.85 });

// Player tank cannon: the most satisfying boom in the game, with a recoil clunk.
sfx(
  'vehicle_cannon',
  [
    ...gunshot({ crack: 0.8, crackHp: 700, crackDur: 0.045, bark: 460, barkVol: 0.7, barkDur: 0.2, body: [102, 32], bodyVol: 1.0, bodyDur: 0.42, tail: 0.7, tailVol: 0.34, tailCut: 1800 }),
    rumble(0.8, 0.42),
    { wave: 'square', duty: 0.4, freq: 165, freqEnd: 95, dur: 0.07, delay: 0.13, lowpass: 900, curve: 2, vol: 0.2 },
    click(0.32, { delay: 0.13, bandpass: 1600 }),
  ],
  { poly: 2, priority: 3 },
);

// Vulcan: bright, short round (called per bullet, very rapid).
sfx(
  'vehicle_vulcan',
  gunshot({ crack: 0.32, crackHp: 2500, crackDur: 0.014, bark: 1650, barkVol: 0.36, barkDur: 0.045, body: [225, 92], bodyVol: 0.34, bodyDur: 0.05, tail: 0.07, tailVol: 0.08, tailCut: 4000 }),
  { poly: 3, minGap: 0.02, gain: 0.85 },
);

// Walker footstep: hydraulic stomp.
sfx(
  'mech_step',
  [
    thump(78, 38, 0.2, 0.75),
    body(900, 300, 0.1, 0.3),
    ping(260, 0.08, 0.12, { fm: 2.5 }),
    hiss(0.18, 0.12, { delay: 0.06, attack: 0.02, highpass: 3500 }),
  ],
  { poly: 2, gain: 0.45 },
);

// Walker missile salvo (one missile).
sfx(
  'mech_missile',
  [crack(0.32, { dur: 0.015, highpass: 1800 }), thump(170, 70, 0.08, 0.35), whoosh(700, 3300, 0.4, 0.42, { attack: 0.03, q: 1.4 }), hiss(0.34, 0.1, { delay: 0.04 })],
  { poly: 3 },
);

// Gyrocopter: lighter, faster rotor.
sfx(
  'gyro_rotor',
  [
    { wave: 'noise', freq: 9000, lowpass: 1100, dur: 0.3, repeat: 0.05, attack: 0.004, decay: 0.035, vol: 0.4, seed: 241 },
    { wave: 'sine', freq: 110, dur: 0.3, repeat: 0.05, attack: 0.003, decay: 0.035, vol: 0.18 },
    { wave: 'saw', freq: 1400, dur: 0.3, lowpass: 2500, attack: 0.04, hold: 0.2, curve: 1.4, vol: 0.02 },
  ],
  { poly: 2, gain: 0.75 },
);

// Critical damage: fast urgent beeping before the vehicle blows.
sfx(
  'alarm',
  [
    { wave: 'square', duty: 0.5, freq: 1397, dur: 0.9, repeat: 0.15, attack: 0.002, hold: 0.07, decay: 0.03, lowpass: 4500, vol: 0.2 },
    { wave: 'square', duty: 0.25, freq: 698.5, dur: 0.9, repeat: 0.15, attack: 0.002, hold: 0.07, decay: 0.03, lowpass: 3000, vol: 0.08 },
  ],
  { poly: 1, priority: 3 },
);
