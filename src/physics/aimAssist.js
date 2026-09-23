// Aim assist: if the grabbed mirror is *almost* sending light into a sleepy puff,
// return the exact angle that would. The caller blends toward it for a magnetic feel.

import { sub, normalize, angleOf, lineAngleDiff } from './geometry.js';

/**
 * @param bounce   a bounce record from trace() on this mirror {point, incoming}
 * @param mirror   {angle}
 * @param targets  candidate puffs [{x, z}]
 * @param windowRad max angular distance to snap from
 * @returns {number|null} ideal mirror angle, or null if none within window
 */
export function idealMirrorAngle(bounce, mirror, targets, windowRad) {
  let best = null;
  let bestDiff = windowRad;
  for (const tg of targets) {
    const out = normalize(sub(tg, bounce.point));
    // For a reflection d -> o, the mirror normal is parallel to (o - d).
    const n = sub(out, bounce.incoming);
    if (Math.hypot(n.x, n.z) < 1e-6) continue; // would need to reflect straight back
    const angle = angleOf(n) + Math.PI / 2;
    const diff = Math.abs(lineAngleDiff(angle, mirror.angle));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = mirror.angle + lineAngleDiff(angle, mirror.angle);
    }
  }
  return best;
}
