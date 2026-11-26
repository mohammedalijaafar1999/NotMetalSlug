// Global app context (set up by main.ts). Scenes and debug tools reach shared services here.

import type { SceneManager } from './engine/scene';
import type { Renderer } from './engine/renderer';
import type { GameLoop } from './engine/loop';

export interface DebugFlags {
  invincible: boolean;
  autopilot: boolean;
  /** Fixed RNG seed for worlds (null = time-based). */
  seed: number | null;
  showHitboxes: boolean;
  /** Skip intro banners / waits (tests). */
  fast: boolean;
}

export const app = {
  scenes: null as unknown as SceneManager,
  renderer: null as unknown as Renderer,
  loop: null as unknown as GameLoop,
  debug: { invincible: false, autopilot: false, seed: null, showHitboxes: false, fast: false } as DebugFlags,
  params: new URLSearchParams(typeof location !== 'undefined' ? location.search : ''),
  version: '1.0.0',
};
