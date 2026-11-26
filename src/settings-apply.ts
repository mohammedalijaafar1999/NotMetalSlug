// Push persisted settings into engine services. Call after changing `settings`.

import { app } from './app';
import { audio } from './engine/audio';
import { input } from './engine/input';
import { settings, saveSettings } from './engine/storage';

export function applySettings(save = false): void {
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
