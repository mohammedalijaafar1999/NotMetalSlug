// Background sprite baking. The boot screen bakes only what the title and the menus draw (its
// progress bar counts just that); everything else bakes a few milliseconds per frame while the
// title, the attract screens and the menus run (main.ts calls preload.step() once per frame), and
// GameplayScene calls preload.finish() before its first frame, so a gameplay frame never has to
// rasterize a sprite.

import { sprites, type Sprite } from '../engine/sprites';
import { characters } from '../game/characters';
import { faceSprite } from '../content/ui/art';

/** The title screen and its backdrop draw these: baked behind the boot progress bar. */
const BOOT_PREFIXES = ['ui_logo', 'ui_ribbon', 'ui_sparkle', 'ui_moon', 'ui_bg_', 'ui_sil_', 'explosion_'];
/**
 * First in line afterwards: the other menu screens' art, then the character select previews
 * (the players' sprites too). A menu opened before its art is baked bakes it on first draw.
 */
const EARLY_PREFIXES = ['ui_', 'char_', 'muzzle_flash'];
/** Background work per frame (ms): well inside a 60 Hz frame next to the menus' own work. */
export const PRELOAD_BUDGET_MS = 5;
/** A static screen right before play (the briefing card) can give it more. */
export const PRELOAD_BOOST_MS = 12;

const has = (prefixes: string[], s: Sprite) => prefixes.some((p) => s.name.startsWith(p));

class Preloader {
  private queue: Sprite[] = [];
  /** Next sprite in the queue, and its next frame. */
  private qi = 0;
  private fi = 0;
  private started = false;
  /** Set once the boot screen is done: background stepping begins. */
  running = false;
  /** Total background baking time so far (ms), and frames baked by finish() (diagnostics). */
  bakedMs = 0;
  forcedFrames = 0;

  /**
   * Split the sprite registry: returns the boot set (baked by the boot screen) and queues the
   * rest for the background, character sprites first.
   */
  start(): Sprite[] {
    // The HUD portraits are defined on first use: define them now so they are queued too.
    for (const c of characters()) {
      faceSprite(c.id);
      faceSprite(c.id, true);
    }
    const all = sprites.all();
    const boot = all.filter((s) => has(BOOT_PREFIXES, s));
    const rest = all.filter((s) => !has(BOOT_PREFIXES, s));
    const rank = (s: Sprite) => {
      const i = EARLY_PREFIXES.findIndex((p) => s.name.startsWith(p));
      return i < 0 ? EARLY_PREFIXES.length : i;
    };
    // Stable: registry order within each rank.
    this.queue = rest.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
    this.qi = 0;
    this.fi = 0;
    this.started = true;
    this.running = false;
    return boot;
  }

  /** Sprites still waiting in the background queue. */
  get remaining(): number {
    return this.queue.length - this.qi;
  }

  get done(): boolean {
    return this.qi >= this.queue.length;
  }

  /** Bake queued frames for up to `budgetMs` (one frame of one sprite at a time). */
  step(budgetMs = PRELOAD_BUDGET_MS): void {
    if (!this.running || this.done) return;
    const t0 = performance.now();
    while (!this.done && performance.now() - t0 < budgetMs) this.bakeNext();
    this.bakedMs += performance.now() - t0;
  }

  /** Bake everything still queued, now (gameplay is about to start). */
  finish(): void {
    if (!this.started) return;
    while (!this.done) {
      this.bakeNext();
      this.forcedFrames++;
    }
  }

  private bakeNext(): void {
    const s = this.queue[this.qi];
    try {
      s.canvas(this.fi);
    } catch (e) {
      console.error('[preload] failed to bake sprite', s.name, e);
      this.fi = s.frameCount;
    }
    if (++this.fi >= s.frameCount) {
      this.qi++;
      this.fi = 0;
    }
  }
}

export const preload = new Preloader();
