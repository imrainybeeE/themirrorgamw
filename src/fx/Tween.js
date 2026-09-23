// Small animation helpers. Springs are the main source of "boing".

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

/**
 * Damped spring toward `target`. Call kick() to add velocity for a squash/boing.
 * stiffness ~ how snappy, damping ~ how quickly it settles (lower = wobblier).
 */
export class Spring {
  constructor(value = 0, stiffness = 180, damping = 12) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  kick(v) {
    this.velocity += v;
    return this;
  }
  update(dt) {
    // Semi-implicit Euler, sub-stepped so stiff springs stay stable.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

/** Squash & stretch that preserves volume: returns [sx, sy, sz] for a spring value around 1. */
export function squash(v) {
  const s = Math.max(0.2, v);
  const side = 1 / Math.sqrt(s);
  return [side, s, side];
}
