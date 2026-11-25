import { WATER_LEVEL } from "@afd/game-core";
import {
  CanvasTexture,
  Color,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
} from "three";
import { HORIZON_FAR, HORIZON_NEAR } from "./radialHorizon";

/**
 * Ocean — bright cyan ripples, fully opaque near the jet.
 * Soft CIRCULAR fade (not square corners) so the plane edge never reads as a
 * giant blue quad at altitude — the old "problema do quadrado".
 */

/** Mesh half-extent; visible disk is always smaller than this via shader fade. */
const PLANE_HALF = 12000;
const TEX_METRES = 160;

function makeOceanTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const hash = (x: number, y: number): number => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smoothNoise = (x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v * (1 - u) + (d - b) * u * v;
  };
  const fbm = (x: number, y: number): number => {
    let v = 0;
    let a = 0.5;
    let px = x;
    let py = y;
    for (let i = 0; i < 5; i++) {
      v += a * smoothNoise(px, py);
      px = px * 2.05 + 19.1;
      py = py * 2.05 + 7.3;
      a *= 0.5;
    }
    return v;
  };

  // Bright cyan / turquoise (photo tone) — teal troughs, light crests.
  const deepR = 8,
    deepG = 72,
    deepB = 110;
  const midR = 30,
    midG = 150,
    midB = 190;
  const hiR = 110,
    hiG = 210,
    hiB = 235;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.06, y * 0.06);
      const chop = fbm(x * 0.28, y * 0.28);
      const fine = fbm(x * 0.55, y * 0.55);
      const swell = Math.sin(x * 0.04 + y * 0.025 + n * 2.0) * 0.5 + 0.5;
      const t = Math.min(
        1,
        Math.max(0, n * 0.4 + chop * 0.35 + fine * 0.15 + swell * 0.1),
      );
      const t2 = t * t * (3 - 2 * t);

      let r: number;
      let g: number;
      let b: number;
      if (t2 < 0.45) {
        const k = t2 / 0.45;
        r = deepR + (midR - deepR) * k;
        g = deepG + (midG - deepG) * k;
        b = deepB + (midB - deepB) * k;
      } else {
        const k = (t2 - 0.45) / 0.55;
        r = midR + (hiR - midR) * k;
        g = midG + (hiG - midG) * k;
        b = midB + (hiB - midB) * k;
      }

      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.min(255, r));
      data[i + 1] = Math.round(Math.min(255, g));
      data[i + 2] = Math.round(Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
uniform vec2 uCamXZ;
varying vec2 vWorldXZ;
varying float vDist;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldXZ = worldPos.xz;
  vDist = length(worldPos.xz - uCamXZ);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uTexScale;
uniform float uFadeNear;
uniform float uFadeFar;

varying vec2 vWorldXZ;
varying float vDist;

void main() {
  // World-space UVs — locked to the map, no time animation.
  vec3 col = texture2D(uMap, vWorldXZ * uTexScale).rgb;

  // Circular dissolve: alpha only. Color stays cyan (never grey wash).
  // Fade band sits inside the square mesh so corners are fully discarded.
  float fog = smoothstep(uFadeNear, uFadeFar, vDist);
  float alpha = 1.0 - fog;
  if (alpha < 0.02) discard;

  gl_FragColor = vec4(col, alpha);
}
`;

export class WaterSurface {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly tex: CanvasTexture;
  private readonly camXZ = new Vector2(0, 0);

  constructor(_haze: Color) {
    this.tex = makeOceanTexture();
    this.mat = new ShaderMaterial({
      name: "AFD_Ocean_cyan_disk_v6",
      transparent: true,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
      uniforms: {
        uMap: { value: this.tex },
        uTexScale: { value: 1 / TEX_METRES },
        uCamXZ: { value: this.camXZ },
        uFadeNear: { value: HORIZON_NEAR },
        uFadeFar: { value: HORIZON_FAR },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    this.mesh = new Mesh(new PlaneGeometry(PLANE_HALF * 2, PLANE_HALF * 2, 1, 1), this.mat);
    this.mesh.rotation.x = -Math.PI * 0.5;
    this.mesh.position.y = WATER_LEVEL + 0.6;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = "Ocean";
  }

  update(
    _dt: number,
    wx: number,
    wz: number,
    _sun: { x: number; y: number; z: number },
    _dayFactor: number,
    wy = 400,
  ): void {
    this.mesh.position.x = wx;
    this.mesh.position.z = wz;
    this.camXZ.set(wx, wz);

    // Grow the visible disk with altitude so high flight never reveals square corners.
    const alt = Math.max(0, wy - WATER_LEVEL);
    const far = Math.min(PLANE_HALF * 0.92, Math.max(HORIZON_FAR, alt * 2.2 + 1800));
    const near = Math.max(HORIZON_NEAR, far * 0.72);
    this.mat.uniforms.uFadeFar!.value = far;
    this.mat.uniforms.uFadeNear!.value = near;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
