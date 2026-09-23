import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels/levels.js';
import { CONFIG } from '../src/config.js';
import { toTraceScene } from '../src/world/traceScene.js';
import { trace } from '../src/physics/rayTracer.js';

const opts = { maxBounces: CONFIG.beam.maxBounces, maxLength: CONFIG.beam.maxLength };

LEVELS.forEach((level, i) => {
  test(`level ${i + 1} "${level.name}" is solvable and starts unsolved`, () => {
    const solved = toTraceScene(level, (m) => m.solution ?? m.angle);
    const r = trace(level.emitter, solved, opts);
    assert.equal(r.targets.size, level.targets.length, 'solution should light every puff');

    const start = toTraceScene(level, (m) => m.angle);
    const r0 = trace(level.emitter, start, opts);
    assert.ok(r0.targets.size < level.targets.length, 'level should not start solved');
  });
});
