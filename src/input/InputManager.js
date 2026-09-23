import { events } from '../core/events.js';
import { HandTracker } from './HandTracker.js';
import { GestureInterpreter } from './GestureInterpreter.js';
import { MouseInput } from './MouseInput.js';

// Chooses between hand and mouse each frame (whichever was used most recently) and exposes
// one Pointer plus its world-space position.
export class InputManager {
  constructor(stage, video) {
    this.stage = stage;
    this.mouse = new MouseInput(stage.renderer.domElement);
    this.hand = new HandTracker(video);
    this.gesture = new GestureInterpreter();
    this.active = this.mouse.pointer;
    this.world = null;
  }

  async startHand() {
    return this.hand.start((status, message) => events.emit('handStatus', { status, message }));
  }

  update(nowMs) {
    if (this.hand.poll(nowMs)) this.gesture.update(this.hand.landmarks, nowMs);

    const hp = this.gesture.pointer, mp = this.mouse.pointer;

    // Don't switch sources in the middle of a grab.
    let next = this.active;
    if (!this.active.pinching) {
      const mouseRecent = nowMs - this.mouse.lastMove < 600;
      if (hp.present && !mouseRecent) next = hp;
      else if (mp.present || mouseRecent) next = mp;
      else if (hp.present) next = hp;
    }
    if (next !== this.active) {
      this.active = next;
      events.emit('inputSource', { source: next.source });
    }
    const p = this.active;
    this.world = p.present ? this.stage.screenToWorld(p.sx, p.sy) : null;
    return p;
  }
}
