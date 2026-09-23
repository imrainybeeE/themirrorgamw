import { CONFIG } from '../config.js';
import { OneEuroFilter } from './OneEuroFilter.js';
import { clamp } from '../fx/Tween.js';

// Landmark indices (MediaPipe hand model).
const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, INDEX_MCP = 5, MIDDLE_MCP = 9, PINKY_MCP = 17;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Turns noisy landmarks into a stable Pointer: {present, sx, sy, pinching, twist, pinchAmount}.
export class GestureInterpreter {
  constructor() {
    const f = CONFIG.input.filter, af = CONFIG.input.angleFilter;
    this.fx = new OneEuroFilter(f);
    this.fy = new OneEuroFilter(f);
    this.fa = new OneEuroFilter(af);
    this.pinching = false;
    this.lastSeen = -Infinity;
    this.prevRawAngle = null;
    this.unwrapped = 0;
    this.pointer = { present: false, sx: 0.5, sy: 0.5, pinching: false, twist: 0, pinchAmount: 0, source: 'hand' };
  }

  update(landmarks, nowMs) {
    const t = nowMs / 1000;
    const p = this.pointer;
    const cfg = CONFIG.input;

    if (!landmarks) {
      // Keep the pointer (and any grab) alive briefly through tracking dropouts.
      if (nowMs - this.lastSeen > cfg.lostHandGraceMs) {
        p.present = false;
        p.pinching = this.pinching = false;
        this.fx.reset(); this.fy.reset(); this.fa.reset();
        this.prevRawAngle = null;
      }
      return p;
    }
    this.lastSeen = nowMs;

    // Selfie view: mirror x so moving your hand right moves the cursor right.
    const L = landmarks.map((l) => ({ x: 1 - l.x, y: l.y }));

    // Cursor = between thumb and index tips, stable while pinching.
    const cx = (L[THUMB_TIP].x + L[INDEX_TIP].x) / 2;
    const cy = (L[THUMB_TIP].y + L[INDEX_TIP].y) / 2;
    const m = cfg.handAreaMargin;
    const sx = clamp((cx - m) / (1 - 2 * m), 0, 1);
    const sy = clamp((cy - m) / (1 - 2 * m), 0, 1);

    // Pinch, normalized by palm size so it works near or far from the camera.
    const palm = Math.max(1e-3, (dist(L[WRIST], L[MIDDLE_MCP]) + dist(L[INDEX_MCP], L[PINKY_MCP])) / 2);
    const ratio = dist(L[THUMB_TIP], L[INDEX_TIP]) / palm;
    if (!this.pinching && ratio < cfg.pinchEnter) this.pinching = true;
    else if (this.pinching && ratio > cfg.pinchExit) this.pinching = false;

    // Twist = roll of the hand (wrist -> middle knuckle), unwrapped so it never jumps by 2PI.
    const raw = Math.atan2(L[MIDDLE_MCP].y - L[WRIST].y, L[MIDDLE_MCP].x - L[WRIST].x);
    if (this.prevRawAngle !== null) {
      let d = raw - this.prevRawAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      this.unwrapped += d;
    } else {
      this.unwrapped = raw;
    }
    this.prevRawAngle = raw;

    p.present = true;
    p.sx = this.fx.filter(sx, t);
    p.sy = this.fy.filter(sy, t);
    p.twist = this.fa.filter(this.unwrapped, t);
    p.pinching = this.pinching;
    p.pinchAmount = clamp(1 - (ratio - cfg.pinchEnter) / (cfg.pinchExit * 2 - cfg.pinchEnter), 0, 1);
    return p;
  }
}
