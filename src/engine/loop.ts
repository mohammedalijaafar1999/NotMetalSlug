// Fixed-timestep game loop (60 simulation steps per second) driven by requestAnimationFrame.

export const STEP = 1 / 60;

/**
 * Fixed-step accumulator for one rendered frame: how many simulation steps to run and the new
 * leftover time. The leftover is nudged toward half a step. requestAnimationFrame timestamps
 * jitter by a few ms, and a leftover sitting near a step boundary then makes some frames run 0
 * steps and the next one 2: a visible judder in scrolling, several times a second at 60 Hz.
 * Centred, the leftover absorbs up to +-8 ms of jitter. The nudge is at most 0.4 ms a frame: a
 * display within ~2% of 60 Hz locks to exactly one step per frame (like a vsync-locked console
 * game), at other refresh rates it averages out to nothing.
 */
export function accumulate(acc: number, elapsed: number, speed = 1): { steps: number; acc: number } {
  acc += elapsed * speed;
  const maxSteps = 5 * Math.max(1, speed);
  let steps = 0;
  while (acc >= STEP && steps < maxSteps) {
    acc -= STEP;
    steps++;
  }
  if (steps >= maxSteps) acc = 0;
  else if (speed === 1) acc += (STEP / 2 - acc) * 0.05;
  return { steps, acc };
}

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
    this.acc = STEP / 2;
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
        const r = accumulate(this.acc, elapsed, this.speed);
        this.acc = r.acc;
        for (let n = 0; n < r.steps; n++) this.stepOnce();
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
