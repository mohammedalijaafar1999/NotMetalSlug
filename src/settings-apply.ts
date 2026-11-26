// Push persisted settings into engine services. Call after changing `settings`.
// Values are sanitized first (settings come from localStorage and may be stale or hand-edited).

import { app } from './app';
import { audio } from './engine/audio';
import { input, ACTIONS, DEFAULT_BINDINGS } from './engine/input';
import { settings, saveSettings, type Difficulty } from './engine/storage';

const clamp01 = (v: unknown, def: number): number => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : def);

/** Repair out-of-range or missing values in place. */
export function sanitizeSettings(): void {
  settings.masterVol = clamp01(settings.masterVol, 0.8);
  settings.musicVol = clamp01(settings.musicVol, 0.55);
  settings.sfxVol = clamp01(settings.sfxVol, 0.8);
  settings.voiceVol = clamp01(settings.voiceVol, 0.9);
  const d = Math.round(Number(settings.difficulty));
  settings.difficulty = (d >= 0 && d <= 2 ? d : 1) as Difficulty;
  const l = Math.round(Number(settings.lives));
  settings.lives = l >= 1 && l <= 5 ? l : 3;
  // Every action needs a key list (a remap may have stolen the only key of the other player).
  for (const who of ['p1', 'p2'] as const) {
    const b = settings.bindings?.[who];
    if (!b) {
      settings.bindings = settings.bindings ?? JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
      settings.bindings[who] = JSON.parse(JSON.stringify(DEFAULT_BINDINGS[who]));
      continue;
    }
    for (const a of ACTIONS) if (!Array.isArray(b[a])) b[a] = DEFAULT_BINDINGS[who][a].slice();
  }
}

export function applySettings(save = false): void {
  sanitizeSettings();
  audio.setVolumes({ master: settings.masterVol, music: settings.musicVol, sfx: settings.sfxVol, voice: settings.voiceVol });
  audio.voiceEnabled = settings.voice;
  input.bindings = settings.bindings;
  const r = app.renderer;
  if (r) {
    r.crt = settings.crt;
    r.pixelPerfect = settings.pixelPerfect;
    r.shakeEnabled = settings.shake;
    r.resize();
  }
  if (save) saveSettings();
}
