import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trace } from '../src/physics/rayTracer.js';
import { idealMirrorAngle } from '../src/physics/aimAssist.js';
import { reflect, lineAngleDiff } from '../src/physics/geometry.js';

const bounds = { w: 20, h: 20 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('reflect mirrors the normal component', () => {
  const r = reflect({ x: 1, z: -1 }, { x: 0, z: 1 });
  close(r.x, 1); close(r.z, 1);
});

test('lineAngleDiff treats a and a+PI as equal', () => {
  close(lineAngleDiff(0.1 + Math.PI, 0.1), 0);
  close(lineAngleDiff(Math.PI / 2 - 0.05, -Math.PI / 2 + 0.05), -0.1, 1e-9);
});

test('straight beam with no elements exits at the field edge', () => {
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [], bounds });
  assert.equal(r.segments.length, 1);
  assert.equal(r.end.type, 'edge');
  close(r.end.point.x, 10);
});

test('45 degree mirror turns the beam 90 degrees', () => {
  const mirrors = [{ id: 'm', x: 5, z: 0, angle: Math.PI / 4, length: 2 }];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors, bounds });
  assert.equal(r.bounces.length, 1);
  close(r.bounces[0].point.x, 5);
  const last = r.segments.at(-1);
  close(last.to.x, 5, 1e-3);
  close(last.to.z, 10, 1e-3); // went +z to the edge
});

test('angle of incidence equals angle of reflection', () => {
  const mirrors = [{ id: 'm', x: 5, z: 0, angle: Math.PI / 2 + 0.3, length: 4 }];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors, bounds });
  const b = r.bounces[0];
  const seg = r.segments[1];
  const out = { x: seg.to.x - seg.from.x, z: seg.to.z - seg.from.z };
  const l = Math.hypot(out.x, out.z);
  const inDot = -(b.incoming.x * b.normal.x + b.incoming.z * b.normal.z);
  const outDot = (out.x * b.normal.x + out.z * b.normal.z) / l;
  close(inDot, outDot, 1e-6);
});

test('two mirrors chain', () => {
  const mirrors = [
    { id: 'a', x: 5, z: 0, angle: Math.PI / 4, length: 2 },
    { id: 'b', x: 5, z: 5, angle: (3 * Math.PI) / 4, length: 2 },
  ];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors, bounds });
  assert.deepEqual(r.bounces.map((b) => b.mirrorId), ['a', 'b']);
  close(r.end.point.x, -10, 1e-3);
});

test('beam passes through targets and records each once', () => {
  const targets = [{ id: 't1', x: 3, z: 0, r: 0.5 }, { id: 't2', x: 6, z: 0, r: 0.5 }];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [], targets, bounds });
  assert.deepEqual([...r.targets.keys()].sort(), ['t1', 't2']);
});

test('blockers stop the beam and hide targets behind them', () => {
  const blockers = [{ id: 'c', x: 4, z: 0, w: 1, h: 1 }];
  const targets = [{ id: 't', x: 7, z: 0, r: 0.5 }];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [], blockers, targets, bounds });
  assert.equal(r.end.type, 'blocker');
  close(r.end.point.x, 3.5);
  assert.equal(r.targets.size, 0);
});

test('bounce cap prevents infinite loops between parallel mirrors', () => {
  const mirrors = [
    { id: 'a', x: -2, z: 0, angle: Math.PI / 2, length: 4 },
    { id: 'b', x: 2, z: 0, angle: Math.PI / 2, length: 4 },
  ];
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors, bounds }, { maxBounces: 10, maxLength: 1000 });
  assert.equal(r.bounces.length, 10);
});

test('max length caps total path', () => {
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [], bounds }, { maxLength: 4 });
  assert.equal(r.end.type, 'length');
  close(r.end.point.x, 4);
});

test('aim assist finds the angle that hits the target', () => {
  const mirror = { id: 'm', x: 5, z: 0, angle: Math.PI / 4 + 0.04, length: 2 };
  const target = { id: 't', x: 5, z: 6, r: 0.3 };
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [mirror], bounds });
  const ideal = idealMirrorAngle(r.bounces[0], mirror, [target], 0.1);
  assert.ok(ideal !== null);
  close(lineAngleDiff(ideal, Math.PI / 4), 0, 1e-6);
  const r2 = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [{ ...mirror, angle: ideal }], targets: [target], bounds });
  assert.ok(r2.targets.has('t'));
});

test('aim assist ignores targets outside the window', () => {
  const mirror = { id: 'm', x: 5, z: 0, angle: Math.PI / 4 + 0.3, length: 2 };
  const r = trace({ x: 0, z: 0, angle: 0 }, { mirrors: [mirror], bounds });
  assert.equal(idealMirrorAngle(r.bounces[0], mirror, [{ x: 5, z: 6 }], 0.1), null);
});
