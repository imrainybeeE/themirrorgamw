import * as THREE from 'three';

// Shared toon ramp: 3 soft steps gives the cel-shaded, cozy look.
let ramp = null;
function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });
}

export function flat(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

/** A soft round glow sprite texture, generated once. */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Five-point star shape, used by the emitter, cursor and confetti. */
export function starShape(outer = 1, inner = 0.5, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

export function starGeometry(outer = 1, inner = 0.5, depth = 0.3) {
  const geo = new THREE.ExtrudeGeometry(starShape(outer, inner), {
    depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: outer * 0.12, bevelSegments: 4, curveSegments: 4,
  });
  geo.center();
  return geo;
}

/** Text sprite, e.g. floating "z" above sleepy puffs. */
export function textSprite(text, color = '#6b4a6e', px = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  const g = c.getContext('2d');
  g.font = `700 ${px * 1.3}px "Fredoka", "Baloo 2", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, px, px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  return new THREE.Sprite(mat);
}

/** Cached image textures (sprites drawn by hand live in assets/sprites). */
const texCache = new Map();
const loader = new THREE.TextureLoader();
export function spriteTexture(url) {
  if (!texCache.has(url)) {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(url, t);
  }
  return texCache.get(url);
}

/** Camera-facing textured quad material (tintable: white in the texture takes `color`). */
export function spriteMaterial(url, extra = {}) {
  return new THREE.MeshBasicMaterial({ map: spriteTexture(url), transparent: true, depthWrite: false, ...extra });
}
