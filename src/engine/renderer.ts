// Renderer: all game drawing happens on a small low-resolution buffer (VIEW_W x VIEW_H)
// which is scaled up with nearest-neighbour filtering to the display canvas.

import { fxRng } from './rng';

export const VIEW_W = 384;
export const VIEW_H = 216;

export class Renderer {
  readonly display: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  readonly buffer: HTMLCanvasElement;
  /** Low-res drawing context. Draw everything here. */
  readonly g: CanvasRenderingContext2D;
  scale = 1;
  offX = 0;
  offY = 0;
  /** Integer scaling only (sharper, may leave borders). */
  pixelPerfect = false;
  crt = false;
  /** Allow screen shake. */
  shakeEnabled = true;
  shakeX = 0;
  shakeY = 0;
  private shakeMag = 0;
  private shakeTime = 0;
  private scanlines: HTMLCanvasElement | null = null;
  private scanScale = 0;
  /** Full-screen flash (e.g. big explosions). */
  private flashAlpha = 0;
  private flashColor = '#ffffff';

  constructor(container: HTMLElement) {
    this.display = document.createElement('canvas');
    this.display.tabIndex = 0;
    container.appendChild(this.display);
    this.dctx = this.display.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.buffer.width = VIEW_W;
    this.buffer.height = VIEW_H;
    this.g = this.buffer.getContext('2d', { alpha: false })!;
    this.g.imageSmoothingEnabled = false;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(1, window.innerWidth);
    const ch = Math.max(1, window.innerHeight);
    this.display.style.width = cw + 'px';
    this.display.style.height = ch + 'px';
    this.display.width = Math.floor(cw * dpr);
    this.display.height = Math.floor(ch * dpr);
    this.dctx.imageSmoothingEnabled = false;
    let s = Math.min(this.display.width / VIEW_W, this.display.height / VIEW_H);
    if (this.pixelPerfect && s >= 1) s = Math.floor(s);
    this.scale = s;
    this.offX = Math.floor((this.display.width - VIEW_W * s) / 2);
    this.offY = Math.floor((this.display.height - VIEW_H * s) / 2);
  }

  /** Start a screen shake. Magnitude in low-res pixels. */
  shake(mag: number, dur = 0.25): void {
    if (!this.shakeEnabled) return;
    if (mag >= this.shakeMag * (this.shakeTime > 0 ? 1 : 0)) {
      this.shakeMag = Math.max(mag, this.shakeMag * 0.5);
      this.shakeTime = Math.max(dur, this.shakeTime);
    }
  }

  flash(color = '#ffffff', alpha = 0.6): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const m = this.shakeMag * Math.min(1, this.shakeTime / 0.15 + 0.2);
      this.shakeX = Math.round((fxRng.next() * 2 - 1) * m);
      this.shakeY = Math.round((fxRng.next() * 2 - 1) * m);
      if (this.shakeTime <= 0) {
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4);
  }

  beginFrame(): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  present(): void {
    const g = this.g;
    if (this.flashAlpha > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = this.flashAlpha;
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalAlpha = 1;
    }
    // The letterbox bars never need repainting: resize() resets the display canvas (to opaque
    // black, alpha: false) and nothing draws outside the game rectangle.
    const d = this.dctx;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalAlpha = 1;
    d.imageSmoothingEnabled = false;
    const w = Math.round(VIEW_W * this.scale);
    const h = Math.round(VIEW_H * this.scale);
    d.drawImage(this.buffer, this.offX, this.offY, w, h);
    if (this.crt && this.scale >= 2.5) {
      const ov = this.crtOverlay(w, h);
      if (ov) d.drawImage(ov, this.offX, this.offY);
    }
  }

  /**
   * Scanlines + vignette baked once per display size. Each dark line sits at the bottom of a
   * low-res pixel row, so they stay aligned even when the scale is not a whole number (a
   * repeating pattern with a rounded period drifts across the rows and beats into moire bands).
   */
  private crtOverlay(w: number, h: number): HTMLCanvasElement | null {
    const s = this.scale;
    if (this.scanlines && this.scanScale === s && this.scanlines.width === w && this.scanlines.height === h) return this.scanlines;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!x) return null;
    x.fillStyle = 'rgba(0,0,0,0.28)';
    for (let r = 0; r < VIEW_H; r++) {
      const y0 = Math.round(r * s);
      const y1 = Math.round((r + 1) * s);
      const lh = Math.max(1, Math.floor((y1 - y0) / 3));
      x.fillRect(0, y1 - lh, w, lh);
    }
    const grd = x.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = grd;
    x.fillRect(0, 0, w, h);
    this.scanlines = c;
    this.scanScale = s;
    return c;
  }

  /** Convert a client (CSS px) position to buffer coordinates. */
  clientToView(cx: number, cy: number): { x: number; y: number } {
    const dpr = this.display.width / Math.max(1, this.display.clientWidth);
    return { x: (cx * dpr - this.offX) / this.scale, y: (cy * dpr - this.offY) / this.scale };
  }
}
