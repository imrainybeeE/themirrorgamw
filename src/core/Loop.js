// requestAnimationFrame loop with delta clamping and hitstop (freeze-frame) support.
export class Loop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.last = 0;
    this.time = 0;
    this.freezeUntil = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }
  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }
  hitstop(ms) {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }
  _tick(now) {
    if (!this.running) return;
    const raw = Math.min((now - this.last) / 1000, 1 / 20); // clamp so tab-switches don't explode
    this.last = now;
    const dt = now < this.freezeUntil ? 0 : raw;
    this.time += dt;
    this.update(dt, this.time, raw);
    this.render(dt, this.time);
    requestAnimationFrame(this._tick);
  }
}
