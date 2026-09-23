// Pure light tracer. Given an emitter and plain-data elements, returns the beam path.
// Elements are plain objects so this stays testable and independent of rendering:
//   mirrors:  {id, x, z, angle, length}
//   targets:  {id, x, z, r}        light passes THROUGH puffs (so one beam can wake several)
//   blockers: {id, x, z, w, h}     light stops
//   bounds:   {w, h}               field size centered on origin; light stops at the edge
//
// Adding a mechanic (prism, filter, portal): add an element list, test it in `nearestHit`,
// and decide in the main loop whether the beam stops, reflects, or spawns new rays.

import {
  EPS, add, scale, normalize, fromAngle, dot, reflect, raySegment, rayCircle, rayBox, segmentEnds,
} from './geometry.js';

const NUDGE = 1e-4;

function nearestHit(o, d, scene, skipId) {
  let best = { t: Infinity, type: 'none', element: null, normal: null };

  for (const m of scene.mirrors) {
    if (m.id === skipId) continue;
    const [a, b] = segmentEnds(m, m.angle, m.length);
    const t = raySegment(o, d, a, b);
    if (t !== null && t < best.t) {
      let n = fromAngle(m.angle + Math.PI / 2);
      if (dot(n, d) > 0) n = scale(n, -1); // face the incoming ray (mirrors are double-sided)
      best = { t, type: 'mirror', element: m, normal: n };
    }
  }

  for (const bl of scene.blockers) {
    const hit = rayBox(o, d, bl, bl.w / 2, bl.h / 2);
    if (hit && hit.t < best.t) best = { t: hit.t, type: 'blocker', element: bl, normal: hit.normal };
  }

  if (scene.bounds) {
    // We start inside the field; the exit point is where light leaves it.
    const hw = scene.bounds.w / 2, hh = scene.bounds.h / 2;
    const tx = d.x > EPS ? (hw - o.x) / d.x : d.x < -EPS ? (-hw - o.x) / d.x : Infinity;
    const tz = d.z > EPS ? (hh - o.z) / d.z : d.z < -EPS ? (-hh - o.z) / d.z : Infinity;
    const t = Math.min(tx, tz);
    if (t > 0 && t < best.t) best = { t, type: 'edge', element: null, normal: null };
  }

  return best;
}

/**
 * @returns {{
 *   segments: {from, to, bounce, endType, endId}[],
 *   bounces: {point, mirrorId, index, incoming, normal}[],
 *   targets: Map<id, {point, segment}>,   // first point where each puff is touched
 *   end: {point, type, id}
 * }}
 */
export function trace(emitter, scene, opts = {}) {
  const maxBounces = opts.maxBounces ?? 32;
  const maxLength = opts.maxLength ?? 60;
  const targetsList = scene.targets ?? [];
  const full = { mirrors: scene.mirrors ?? [], blockers: scene.blockers ?? [], bounds: scene.bounds };

  let o = { x: emitter.x, z: emitter.z };
  let d = normalize(fromAngle(emitter.angle));
  let skipId = null;
  let remaining = maxLength;

  const segments = [];
  const bounces = [];
  const targets = new Map();
  let end = { point: o, type: 'none', id: null };

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    const hit = nearestHit(o, d, full, skipId);
    let t = Math.min(hit.t, remaining);
    const capped = t < hit.t;
    const to = add(o, scale(d, t));
    const segIndex = segments.length;

    for (const tg of targetsList) {
      if (targets.has(tg.id)) continue;
      const hc = rayCircle(o, d, tg, tg.r);
      if (!hc) continue;
      const [t0, t1] = hc;
      if (t1 < 0 || t0 > t) continue;
      targets.set(tg.id, { point: add(o, scale(d, Math.max(t0, 0))), segment: segIndex });
    }

    const endType = capped ? 'length' : hit.type;
    segments.push({ from: o, to, bounce, endType, endId: hit.element?.id ?? null });
    remaining -= t;
    end = { point: to, type: endType, id: hit.element?.id ?? null };

    if (endType !== 'mirror' || bounce === maxBounces) break;

    bounces.push({ point: to, mirrorId: hit.element.id, index: bounces.length, incoming: d, normal: hit.normal });
    d = normalize(reflect(d, hit.normal));
    o = add(to, scale(d, NUDGE));
    skipId = hit.element.id;
  }

  return { segments, bounces, targets, end };
}
