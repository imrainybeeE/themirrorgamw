import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { flat } from '../fx/materials.js';

// Soft gradient floor, a rounded "play mat" and drifting background sparkles.
export class Background {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const { width: W, height: H } = CONFIG.field;

    const floorMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(PALETTE.bg) }, bottom: { value: new THREE.Color(PALETTE.bgBottom) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 1.0, vUv.y)), 1.0); }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.2;
    this.group.add(floor);

    // Play mat with rounded corners and a dotted pattern.
    const shape = roundedRect(W + 0.6, H + 0.6, 0.9);
    const mat = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), flat(PALETTE.cream));
    mat.rotation.x = -Math.PI / 2;
    this.group.add(mat);
    const border = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W + 1.0, H + 1.0, 1.1), 12), flat(PALETTE.pink));
    border.rotation.x = -Math.PI / 2;
    border.position.y = -0.01;
    this.group.add(border);

    const dots = [];
    for (let x = -W / 2 + 0.5; x <= W / 2 - 0.5; x += 1) {
      for (let z = -H / 2 + 0.5; z <= H / 2 - 0.5; z += 1) dots.push(x, 0.005, z);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.group.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: PALETTE.pink, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.35 })));

    // Floating sparkles around the mat.
    const n = 60;
    const pos = new Float32Array(n * 3);
    this.seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (W + 8);
      pos[i * 3 + 1] = -0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * (H + 8);
      this.seeds[i] = Math.random() * 100;
    }
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ color: PALETTE.lavender, size: 6, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    this.group.add(this.sparkles);
  }

  update(dt, t) {
    const p = this.sparkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = this.seeds[i];
      p.array[i * 3] += Math.sin(t * 0.3 + s) * dt * 0.2;
      p.array[i * 3 + 2] += Math.cos(t * 0.25 + s) * dt * 0.2;
    }
    p.needsUpdate = true;
    this.sparkles.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.2;
  }
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
