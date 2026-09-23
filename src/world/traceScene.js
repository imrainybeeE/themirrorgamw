// Converts level data (or live entities) into the plain structure rayTracer.trace() expects.
import { CONFIG } from '../config.js';

export function toTraceScene(level, angleOf = (m) => m.angle) {
  return {
    mirrors: level.mirrors.map((m, i) => ({
      id: m.id ?? `m${i}`, x: m.x, z: m.z, angle: angleOf(m), length: m.length ?? CONFIG.mirror.length,
    })),
    targets: level.targets.map((t, i) => ({ id: t.id ?? `t${i}`, x: t.x, z: t.z, r: t.r ?? CONFIG.target.radius })),
    blockers: (level.blockers ?? []).map((b, i) => ({ id: b.id ?? `b${i}`, ...b })),
    bounds: { w: CONFIG.field.width, h: CONFIG.field.height },
  };
}
