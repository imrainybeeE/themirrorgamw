import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG, PALETTE } from '../config.js';

// Balatro-ish retro finish: chunky pixels, ordered dithering into a limited palette,
// a gentle CRT curve, soft scanlines, a hint of chromatic fringe and a vignette.
// Runs after OutputPass, so it works on display (sRGB) colors and quantizes evenly.

/** CRT barrel warp, shared with input so the cursor lands where the curved image shows it. */
export function warpUv(u, v, k) {
  let x = u * 2 - 1, y = v * 2 - 1;
  const wx = x * (1 + y * y * k), wy = y * (1 + x * x * k);
  return [wx * 0.5 + 0.5, wy * 0.5 + 0.5];
}

export function createPixelPass() {
  const p = CONFIG.fx.pixel;
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      pixelSize: { value: p.size },
      levels: { value: p.levels },
      dither: { value: p.dither },
      scanlines: { value: p.scanlines },
      curvature: { value: p.curvature },
      vignette: { value: p.vignette },
      aberration: { value: p.aberration },
      border: { value: new THREE.Color(PALETTE.pink).convertLinearToSRGB() }, // this pass works in display space
      time: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 resolution;
      uniform float pixelSize, levels, dither, scanlines, curvature, vignette, aberration, time;
      uniform vec3 border;
      varying vec2 vUv;

      float bayer4(vec2 p) {
        p = mod(floor(p), 4.0);
        int i = int(p.x + p.y * 4.0);
        // 4x4 Bayer matrix, normalized to [0, 1)
        float m[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
        return m[i] / 16.0;
      }

      vec2 warp(vec2 uv) {
        vec2 c = uv * 2.0 - 1.0;
        c = vec2(c.x * (1.0 + c.y * c.y * curvature), c.y * (1.0 + c.x * c.x * curvature));
        return c * 0.5 + 0.5;
      }

      void main() {
        vec2 uv = warp(vUv);
        // Rounded-screen edge: outside the curved image show a soft pastel bezel.
        vec2 edge = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
        float inside = edge.x * edge.y;

        vec2 grid = resolution / pixelSize;
        vec2 cell = floor(uv * grid);
        vec2 puv = (cell + 0.5) / grid;
        vec2 ca = vec2(aberration / resolution.x, 0.0);
        vec3 col;
        col.r = texture2D(tDiffuse, puv + ca).r;
        col.g = texture2D(tDiffuse, puv).g;
        col.b = texture2D(tDiffuse, puv - ca).b;

        // Ordered dither into 'levels' steps per channel.
        float b = bayer4(cell) - 0.5;
        col = floor(col * (levels - 1.0) + 0.5 + b * dither) / (levels - 1.0);

        // Scanlines per pixel row, very soft so pastels stay pastel.
        float row = fract(uv.y * grid.y);
        col *= 1.0 - scanlines * smoothstep(0.55, 1.0, row);

        vec2 vc = uv - 0.5;
        col *= 1.0 - vignette * dot(vc, vc) * 1.6;

        gl_FragColor = vec4(mix(border, clamp(col, 0.0, 1.0), inside), 1.0);
      }`,
  });
  pass.enabled = p.enabled;
  return pass;
}
