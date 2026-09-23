// Plain 2D vector math on the XZ plane. Points are {x, z}. No Three.js, so it runs in node tests.

export const EPS = 1e-6;

export const vec = (x, z) => ({ x, z });
export const add = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.z * b.z;
export const cross = (a, b) => a.x * b.z - a.z * b.x;
export const len = (a) => Math.hypot(a.x, a.z);
export const normalize = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, z: a.z / l };
};
export const fromAngle = (a) => ({ x: Math.cos(a), z: Math.sin(a) });
export const angleOf = (a) => Math.atan2(a.z, a.x);

/** Reflect direction d around unit normal n. */
export const reflect = (d, n) => sub(d, scale(n, 2 * dot(d, n)));

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Same as angleDiff but for lines (period PI), since a mirror at a and a+PI is identical. */
export function lineAngleDiff(a, b) {
  let d = (a - b) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d <= -Math.PI / 2) d += Math.PI;
  return d;
}

/** Ray (o + t*d) vs segment [a, b]. Returns t or null. */
export function raySegment(o, d, a, b) {
  const e = sub(b, a);
  const denom = cross(d, e);
  if (Math.abs(denom) < EPS) return null; // parallel
  const ao = sub(a, o);
  const t = cross(ao, e) / denom;
  const u = cross(ao, d) / denom;
  if (t > EPS && u >= 0 && u <= 1) return t;
  return null;
}

/** Ray vs circle. Returns [tEnter, tExit] (tEnter may be negative if origin inside) or null. */
export function rayCircle(o, d, c, r) {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const cc = dot(oc, oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/** Ray vs axis-aligned box centered at c with half-size (hw, hh). Returns {t, normal} or null. */
export function rayBox(o, d, c, hw, hh) {
  const minX = c.x - hw, maxX = c.x + hw, minZ = c.z - hh, maxZ = c.z + hh;
  let tmin = -Infinity, tmax = Infinity, nx = 0, nz = 0;
  if (Math.abs(d.x) < EPS) {
    if (o.x < minX || o.x > maxX) return null;
  } else {
    let t1 = (minX - o.x) / d.x, t2 = (maxX - o.x) / d.x;
    let n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; nz = 0; }
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(d.z) < EPS) {
    if (o.z < minZ || o.z > maxZ) return null;
  } else {
    let t1 = (minZ - o.z) / d.z, t2 = (maxZ - o.z) / d.z;
    let n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; nz = n; }
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < EPS) return null;
  if (tmin < EPS) return { t: EPS, normal: { x: -d.x, z: -d.z } }; // started inside
  return { t: tmin, normal: { x: nx, z: nz } };
}

/** Endpoints of a mirror-like segment centered at p with angle a and length L. */
export function segmentEnds(p, a, L) {
  const h = scale(fromAngle(a), L / 2);
  return [sub(p, h), add(p, h)];
}
