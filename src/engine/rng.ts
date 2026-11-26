// Deterministic seeded random number generator (mulberry32).
// Gameplay code must use `world.rng` so runs are reproducible for tests.
// Purely cosmetic code (particles) may use `fxRng`.

export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  seed(seed: number): void {
    this.s = seed >>> 0 || 1;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** Uniform integer in [a, b] (inclusive). */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Weighted pick: items as [value, weight][]. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) total += w;
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r <= 0) return v;
    }
    return items[items.length - 1][0];
  }
}

/** Cosmetic-only RNG (particles, screen effects). Never use for gameplay decisions. */
export const fxRng = new Rng(0x5eed);
