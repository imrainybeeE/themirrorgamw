import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureInterpreter } from '../src/input/GestureInterpreter.js';

// Build a fake 21-point hand. Palm is ~0.2 wide/tall; `pinch` sets the thumb-index gap; `roll` rotates the hand.
function hand({ cx = 0.5, cy = 0.5, pinch = 0.2, roll = 0 } = {}) {
  const pts = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  const rot = (dx, dy) => ({ x: cx + dx * Math.cos(roll) - dy * Math.sin(roll), y: cy + dx * Math.sin(roll) + dy * Math.cos(roll), z: 0 });
  pts[0] = rot(0, 0.2); // wrist below
  pts[9] = rot(0, 0); // middle knuckle
  pts[5] = rot(-0.08, 0);
  pts[17] = rot(0.08, 0);
  pts[4] = rot(-pinch / 2, -0.05);
  pts[8] = rot(pinch / 2, -0.05);
  return pts;
}

test('pinch has hysteresis', () => {
  const g = new GestureInterpreter();
  let t = 0;
  const step = (pinch) => g.update(hand({ pinch }), (t += 33));
  assert.equal(step(0.2).pinching, false);
  assert.equal(step(0.04).pinching, true); // ratio 0.2 < enter
  assert.equal(step(0.075).pinching, true); // between enter and exit: stays pinched
  assert.equal(step(0.12).pinching, false); // ratio 0.6 > exit
});

test('twist follows hand roll without wrapping jumps', () => {
  const g = new GestureInterpreter();
  let t = 0;
  const start = g.update(hand({ roll: 0 }), (t += 33)).twist;
  let last = start;
  for (let i = 1; i <= 60; i++) last = g.update(hand({ roll: (i / 60) * 1.2 }), (t += 33)).twist;
  for (let i = 0; i < 30; i++) last = g.update(hand({ roll: 1.2 }), (t += 33)).twist; // let the filter settle
  // Image is mirrored for selfie view, so the sign flips.
  assert.ok(Math.abs(Math.abs(last - start) - 1.2) < 0.05, `twist delta ${last - start}`);
});

test('pointer stays alive through a short tracking dropout, then disappears', () => {
  const g = new GestureInterpreter();
  g.update(hand({ pinch: 0.04 }), 0);
  assert.equal(g.update(null, 100).present, true);
  assert.equal(g.update(null, 100).pinching, true);
  assert.equal(g.update(null, 1000).present, false);
});

test('cursor x is mirrored for selfie view', () => {
  const g = new GestureInterpreter();
  const p = g.update(hand({ cx: 0.3 }), 0);
  assert.ok(p.sx > 0.5, `sx ${p.sx}`);
});
