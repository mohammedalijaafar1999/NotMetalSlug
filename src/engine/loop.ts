// Fixed-timestep game loop (60 simulation steps per second) driven by requestAnimationFrame.

export const STEP = 1 / 60;

export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  running = false;
  /** Simulation speed multiplier (debug fast-forward). Integer >= 1 runs extra steps per frame. */
  speed = 1;
  /** When true, simulation steps only via stepOnce() (debug). */
  manual = false;
  fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  steps = 0;

  constructor(
    private onStep: (dt: number) => void,
    private onRender: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      let elapsed = (now - this.last) / 1000;
      this.last = now;
      if (elapsed > 0.25) elapsed = STEP; // tab was hidden / long hitch: don't spiral
      this.fpsAcc += elapsed;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = Math.round(this.fpsFrames / this.fpsAcc);
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
      if (!this.manual) {
        this.acc += elapsed * this.speed;
        let n = 0;
        const maxSteps = 5 * Math.max(1, this.speed);
        while (this.acc >= STEP && n < maxSteps) {
          this.stepOnce();
          this.acc -= STEP;
          n++;
        }
        if (n >= maxSteps) this.acc = 0;
      }
      this.onRender();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  stepOnce(): void {
    this.steps++;
    this.onStep(STEP);
  }
}
