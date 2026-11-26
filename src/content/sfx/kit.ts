// Sound-design building blocks: small functions that return SfxLayers. Sounds are built by
// layering a transient (crack / click), a body (thump / filtered noise), and a tail.
// All recipes are deterministic (fixed noise seeds) so buffers are identical on every run.

import { audio, type SfxLayer, type SfxOptions } from '../../engine/audio';

export type L = SfxLayer;
type Opt = Partial<SfxLayer>;

/** Register an authoritative sound (wins over placeholder definitions in any import order). */
export function sfx(name: string, layers: SfxLayer[], opts: SfxOptions = {}): void {
  audio.defineSfx(name, layers, { ...opts, final: true });
}

/** Broadband transient: the "crack" of a shot or the click of an impact. */
export const crack = (vol: number, o: Opt = {}): L => ({ wave: 'noise', freq: 18000, dur: 0.025, attack: 0.0004, curve: 3, highpass: 1500, vol, seed: 1, ...o });

/** Pitched low "thump" (punch / body). The pitch drop happens in the first part of the layer. */
export const thump = (f0: number, f1: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'sine',
  freq: f0,
  freqEnd: f1,
  glide: Math.min(dur, 0.06),
  dur,
  attack: 0.0008,
  curve: 2.2,
  vol,
  ...o,
});

/** Filtered noise that darkens as it decays (explosion / shot body). */
export const body = (cut0: number, cut1: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'noise',
  freq: 12000,
  lowpass: cut0,
  lowpassEnd: cut1,
  dur,
  attack: 0.0015,
  curve: 1.6,
  vol,
  seed: 2,
  ...o,
});

/** Band-limited noise "bark" (mid character of a shot). */
export const bark = (center: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'noise',
  freq: 16000,
  bandpass: center,
  bandpassEnd: center * 0.55,
  q: 0.9,
  dur,
  attack: 0.0008,
  curve: 2,
  vol,
  seed: 3,
  ...o,
});

/** Low brown-noise rumble. */
export const rumble = (dur: number, vol: number, o: Opt = {}): L => ({ wave: 'brown', dur, attack: 0.012, curve: 1.4, lowpass: 420, vol, seed: 4, ...o });

/** Sparse crackle (debris, fire, sparks, droplets). density = pops per second. */
export const crackles = (density: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'crackle',
  freq: density,
  dur,
  attack: 0.01,
  curve: 1.2,
  highpass: 900,
  lowpass: 7000,
  vol,
  seed: 5,
  ...o,
});

/** Swept band-pass noise whoosh. */
export const whoosh = (f0: number, f1: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'noise',
  freq: 18000,
  bandpass: f0,
  bandpassEnd: f1,
  q: 1.3,
  dur,
  attack: dur * 0.35,
  curve: 1.6,
  vol,
  seed: 6,
  ...o,
});

/** High-passed hiss (rocket exhaust, steam). */
export const hiss = (dur: number, vol: number, o: Opt = {}): L => ({ wave: 'noise', freq: 20000, highpass: 3500, dur, attack: 0.01, curve: 1.5, vol, seed: 7, ...o });

/** Metallic ping (inharmonic FM): clinks, clangs, rings. */
export const ping = (f: number, dur: number, vol: number, o: Opt = {}): L => ({
  wave: 'sine',
  freq: f,
  fm: 3,
  fmEnd: 0.4,
  fmRatio: 1.414,
  dur,
  attack: 0.0006,
  curve: 2.6,
  vol,
  ...o,
});

/** Pulse-wave blip (UI, pickups). */
export const blip = (f: number, dur: number, vol: number, o: Opt = {}): L => ({ wave: 'square', duty: 0.25, freq: f, dur, attack: 0.002, curve: 1.4, vol, ...o });

/** Cartoon voice: a buzzy source through vowel formants with expressive vibrato. */
export const voice = (f0: number, f1: number, dur: number, vol: number, vowel: string, vowelEnd: string = vowel, o: Opt = {}): L => ({
  wave: 'saw',
  freq: f0,
  freqEnd: f1,
  dur,
  vowel,
  vowelEnd,
  vibrato: 0.6,
  vibratoRate: 7.5,
  attack: 0.018,
  curve: 1.3,
  vol,
  ...o,
});

/** Mechanical click (triggers, latches). */
export const click = (vol: number, o: Opt = {}): L => ({ wave: 'noise', freq: 20000, dur: 0.012, attack: 0.0003, curve: 3, highpass: 2500, bandpass: 3800, q: 1.2, vol, seed: 8, ...o });

/** A layered gunshot: crack + bark + low thump + darkening tail. */
export function gunshot(o: {
  crack: number;
  crackHp?: number;
  crackDur?: number;
  bark: number;
  barkVol: number;
  barkDur: number;
  body: [number, number];
  bodyVol: number;
  bodyDur: number;
  tail: number;
  tailVol: number;
  tailCut: number;
  grit?: number;
}): L[] {
  const layers: L[] = [
    crack(o.crack, { highpass: o.crackHp ?? 1500, dur: o.crackDur ?? 0.025 }),
    bark(o.bark, o.barkDur, o.barkVol),
    thump(o.body[0], o.body[1], o.bodyDur, o.bodyVol),
    body(o.tailCut, o.tailCut * 0.25, o.tail, o.tailVol, { delay: 0.006, attack: 0.004, curve: 1.8 }),
  ];
  if (o.grit) layers.push({ wave: 'square', duty: 0.4, freq: o.body[0] * 0.55, freqEnd: o.body[1] * 0.6, glide: 0.05, lowpass: 1100, dur: o.bodyDur * 0.8, curve: 2.4, vol: o.grit });
  return layers;
}

/** Explosion family: size 0 (small) .. 2 (big). */
export function explosionLayers(size: 0 | 1 | 2): L[] {
  if (size === 0)
    return [
      crack(0.7, { highpass: 700, dur: 0.035 }),
      body(3800, 260, 0.5, 0.8, { freq: 9000, curve: 1.9 }),
      thump(125, 40, 0.3, 0.75, { glide: 0.18 }),
      crackles(55, 0.42, 0.2, { delay: 0.04, highpass: 1400 }),
    ];
  if (size === 1)
    return [
      crack(0.8, { highpass: 500, dur: 0.045 }),
      body(3200, 150, 0.92, 0.85, { curve: 1.5 }),
      bark(320, 0.5, 0.45, { bandpassEnd: 140, q: 0.7 }),
      thump(98, 30, 0.62, 0.95, { glide: 0.35, curve: 1.8 }),
      rumble(0.9, 0.45, { lowpass: 520 }),
      crackles(45, 0.8, 0.22, { delay: 0.06 }),
    ];
  return [
    crack(0.85, { highpass: 400, dur: 0.06 }),
    body(2800, 100, 1.4, 0.95, { curve: 1.3 }),
    body(1900, 110, 1.05, 0.55, { delay: 0.09, seed: 12 }),
    bark(260, 0.75, 0.45, { bandpassEnd: 90, q: 0.7 }),
    thump(76, 24, 1.0, 1.0, { glide: 0.6, curve: 1.6, drive: 1.6 }),
    rumble(1.5, 0.6, { lowpass: 480, curve: 1.2 }),
    crackles(36, 1.3, 0.24, { delay: 0.1, seed: 13 }),
  ];
}
