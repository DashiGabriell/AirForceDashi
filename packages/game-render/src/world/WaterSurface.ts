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
  Vector3,
} from "three";
/**
 * Ocean — bright cyan ripples, fully opaque near the jet.
 * The disk follows the aircraft past the island so open water reads as endless.
 * Fade sits inside the square so the corners never show.
 */

/** Mesh half-extent; visible disk is always smaller than this via shader fade. */
const PLANE_HALF = 28000;
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

/**
 * Same disk as the static ocean, plus two world-locked wave layers and a
 * sun glint. One extra texture sample. No vertex displacement.
 */
const FRAG_ANIM = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uTexScale;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uTime;
uniform vec3 uSun;

varying vec2 vWorldXZ;
varying float vDist;

void main() {
  vec2 p = vWorldXZ;

  // Swell 40–80 m, slow. Chop 8–16 m, quicker. Derivatives build the normal.
  vec2 kS1 = vec2(0.90, 0.44);
  vec2 kS2 = vec2(-0.38, 0.92);
  vec2 kC1 = vec2(0.97, 0.24);
  vec2 kC2 = vec2(-0.28, 0.96);
  float fS1 = 0.105;
  float fS2 = 0.078;
  float fC1 = 0.52;
  float fC2 = 0.40;

  float s1 = sin(dot(p, kS1) * fS1 + uTime * 0.45);
  float s2 = sin(dot(p, kS2) * fS2 + uTime * 0.32);
  float c1 = sin(dot(p, kC1) * fC1 + uTime * 1.15);
  float c2 = sin(dot(p, kC2) * fC2 + uTime * 0.95);
  float dS1 = cos(dot(p, kS1) * fS1 + uTime * 0.45);
  float dS2 = cos(dot(p, kS2) * fS2 + uTime * 0.32);
  float dC1 = cos(dot(p, kC1) * fC1 + uTime * 1.15);
  float dC2 = cos(dot(p, kC2) * fC2 + uTime * 0.95);

  vec2 slope = kS1 * (fS1 * dS1 * 0.85);
  slope += kS2 * (fS2 * dS2 * 0.65);
  slope += kC1 * (fC1 * dC1 * 0.12);
  slope += kC2 * (fC2 * dC2 * 0.09);
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

  vec2 uvA = p * uTexScale + vec2(uTime * 0.012, uTime * 0.005);
  vec2 uvB = p * uTexScale * 1.65 + vec2(-uTime * 0.018, uTime * 0.008);
  vec3 col = texture2D(uMap, uvA).rgb;
  vec3 colB = texture2D(uMap, uvB).rgb;
  col = mix(col, colB, 0.38);

  float crest = clamp(s1 * 0.55 + s2 * 0.35 + c1 * 0.1, -1.0, 1.0) * 0.5 + 0.5;
  col = mix(col * vec3(0.82, 0.92, 0.98), col * vec3(1.18, 1.28, 1.32), crest);

  vec3 world = vec3(p.x, 0.0, p.y);
  vec3 viewDir = normalize(cameraPosition - world);
  vec3 L = normalize(uSun);
  vec3 H = normalize(L + viewDir);
  float spec = pow(max(dot(n, H), 0.0), 36.0);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  col += vec3(0.82, 0.93, 1.0) * spec * (0.35 + fres * 0.85);
  col = mix(col, col * vec3(1.2, 1.28, 1.32), fres * 0.22);

  float fog = smoothstep(uFadeNear, uFadeFar, vDist);
  float alpha = 1.0 - fog;
  if (alpha < 0.02) discard;

  gl_FragColor = vec4(col, alpha);
}
`;

export interface WaterSurfaceOptions {
  /** Arena: scroll, swell and sun glint. Pacific stays on the static shader. */
  animate?: boolean;
}

export class WaterSurface {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly tex: CanvasTexture;
  private readonly camXZ = new Vector2(0, 0);
  private readonly sun = new Vector3(0.2, 0.9, 0.3);
  private readonly animated: boolean;
  private time = 0;

  constructor(_haze: Color, options?: WaterSurfaceOptions) {
    this.animated = options?.animate === true;
    this.tex = makeOceanTexture();
    this.mat = new ShaderMaterial({
      name: this.animated ? "AFD_Ocean_arena_v1" : "AFD_Ocean_cyan_disk_v6",
      transparent: true,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
      uniforms: {
        uMap: { value: this.tex },
        uTexScale: { value: 1 / TEX_METRES },
        uCamXZ: { value: this.camXZ },
        uFadeNear: { value: 11000 },
        uFadeFar: { value: 14000 },
        uTime: { value: 0 },
        uSun: { value: this.sun },
      },
      vertexShader: VERT,
      fragmentShader: this.animated ? FRAG_ANIM : FRAG,
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
    if (this.animated) {
      this.time += _dt;
      this.mat.uniforms.uTime!.value = this.time;
      this.sun.set(_sun.x, _sun.y, _sun.z);
    }

    // Grow the visible disk with altitude so high flight never reveals square corners.
    const alt = Math.max(0, wy - WATER_LEVEL);
    const far = Math.min(PLANE_HALF * 0.9, Math.max(14000, alt * 2.4 + 9000));
    const near = far * 0.78;
    this.mat.uniforms.uFadeFar!.value = far;
    this.mat.uniforms.uFadeNear!.value = near;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
