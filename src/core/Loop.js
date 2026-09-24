// requestAnimationFrame loop with delta clamping and hitstop (freeze-frame) support.
// In manual mode (video capture) nothing runs on its own: step(dt) advances one exact frame.
export class Loop {
  constructor(update, render, { manual = false } = {}) {
    this.update = update;
    this.render = render;
    this.manual = manual;
    this.last = 0;
    this.time = 0; // game time (stops during hitstop)
    this.clock = 0; // wall time in seconds (virtual in manual mode)
    this.freezeUntil = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }
  start() {
    this.running = true;
    if (this.manual) return;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }
  hitstop(ms) {
    this.freezeUntil = Math.max(this.freezeUntil, this.clock + ms / 1000);
  }
  /** Advance exactly one frame of `raw` seconds (manual mode). */
  step(raw) {
    this.clock += raw;
    this._frame(raw);
  }
  _tick(now) {
    if (!this.running) return;
    const raw = Math.min((now - this.last) / 1000, 1 / 20); // clamp so tab-switches don't explode
    this.last = now;
    this.clock = now / 1000;
    this._frame(raw);
    requestAnimationFrame(this._tick);
  }
  _frame(raw) {
    const dt = this.clock < this.freezeUntil ? 0 : raw;
    this.time += dt;
    this.update(dt, this.time, raw);
    this.render(dt, this.time);
  }
}
