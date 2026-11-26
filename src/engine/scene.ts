// Scene stack with fade transitions.
//
// A Scene updates at the fixed step and renders into the low-res buffer.
// Overlay scenes (pause menu, dialogs) render on top of the scene below them.

import { VIEW_H, VIEW_W } from './renderer';

export interface Scene {
  /** Called when the scene becomes active (after a transition). */
  enter?(): void;
  /** Called when the scene is removed. */
  exit?(): void;
  /** Called when a pushed overlay above this scene is popped. */
  resume?(): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  /** If true, the scene below is rendered first (not updated). */
  overlay?: boolean;
  /** Debug name. */
  name?: string;
}

type Pending = { kind: 'set'; scene: Scene } | { kind: 'push'; scene: Scene } | { kind: 'pop' };

export class SceneManager {
  stack: Scene[] = [];
  private fade = 0; // 0 = clear, 1 = black
  private fadeDir: 0 | 1 | -1 = 0;
  private fadeSpeed = 4;
  private pending: Pending | null = null;
  /** Called whenever the active scene changes (input flush etc). */
  onChange: (() => void) | null = null;

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get transitioning(): boolean {
    return this.fadeDir !== 0;
  }

  /** Replace the whole stack with `scene`, fading through black (default). */
  set(scene: Scene, opts: { fade?: boolean; speed?: number } = {}): void {
    if (opts.fade === false || this.stack.length === 0) {
      this.apply({ kind: 'set', scene });
      this.fade = opts.fade === false ? 0 : 1;
      this.fadeDir = this.fade > 0 ? -1 : 0;
      return;
    }
    this.pending = { kind: 'set', scene };
    this.fadeSpeed = opts.speed ?? 4;
    this.fadeDir = 1;
  }

  push(scene: Scene): void {
    this.apply({ kind: 'push', scene });
  }

  pop(): void {
    this.apply({ kind: 'pop' });
  }

  private apply(p: Pending): void {
    if (p.kind === 'set') {
      while (this.stack.length) this.stack.pop()!.exit?.();
      this.stack.push(p.scene);
      p.scene.enter?.();
    } else if (p.kind === 'push') {
      this.stack.push(p.scene);
      p.scene.enter?.();
    } else {
      const s = this.stack.pop();
      s?.exit?.();
      this.current?.resume?.();
    }
    this.onChange?.();
  }

  update(dt: number): void {
    if (this.fadeDir === 1) {
      this.fade += dt * this.fadeSpeed;
      if (this.fade >= 1) {
        this.fade = 1;
        if (this.pending) {
          const p = this.pending;
          this.pending = null;
          this.apply(p);
        }
        this.fadeDir = -1;
      }
      return; // freeze during fade-out
    }
    if (this.fadeDir === -1) {
      this.fade -= dt * this.fadeSpeed;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    this.current?.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    // Find lowest scene that must be drawn.
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].overlay) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      this.stack[i].render(g);
    }
    if (this.fade > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = Math.min(1, this.fade);
      g.fillStyle = '#000';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalAlpha = 1;
    }
  }
}
