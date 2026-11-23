import { WATER_LEVEL } from "@afd/game-core";
import {
  CircleGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { HORIZON_FAR, HORIZON_NEAR } from "./radialHorizon";

/** Altitude (m above water) where waves are fully visible. */
const WAVE_FULL_ALT = 12;
/** Altitude where wave displacement fades out. */
const WAVE_FADE_ALT = 140;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uWaveAmp;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vChop;

float waveHeight(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 0.085 + t * 1.35) * cos(p.y * 0.062 - t * 1.05) * 0.55;
  h += sin(dot(p, vec2(0.12, 0.075)) + t * 1.85) * 0.38;
  h += sin(dot(p, vec2(-0.055, 0.14)) - t * 2.25) * 0.28;
  h += sin(dot(p, vec2(0.21, -0.09)) + t * 2.8) * 0.12;
  return h;
}

void main() {
  // CircleGeometry lies in XY; mesh rot -X maps local Z → world Y.
  vec3 pos = position;
  float amp = uWaveAmp;
  float h = waveHeight(pos.xy, uTime) * amp;
  pos.z += h;

  // Analytic normal from height field (local space).
  float e = 0.65;
  float hx = waveHeight(pos.xy + vec2(e, 0.0), uTime) * amp
           - waveHeight(pos.xy - vec2(e, 0.0), uTime) * amp;
  float hy = waveHeight(pos.xy + vec2(0.0, e), uTime) * amp
           - waveHeight(pos.xy - vec2(0.0, e), uTime) * amp;
  vec3 nLocal = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorld = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nLocal);
  vChop = clamp(h * 0.85 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vChop;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uHaze;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uNear;
uniform float uFar;
uniform float uDay;
uniform float uWaveAmp;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 xz = vWorld.xz;
  float lake = valueNoise(xz * 0.0042 + 17.0);
  float river = abs(valueNoise(xz * 0.0031 + vec2(3.1, 9.7)) - 0.5) * 2.0;
  float depthHint = mix(0.15, 1.0, smoothstep(0.35, 0.72, lake));
  depthHint *= mix(0.45, 1.0, smoothstep(0.08, 0.35, river));

  vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.4, depthHint));
  col = mix(col, uDeep, smoothstep(0.4, 1.0, depthHint));

  // Shore foam + proximity chop / whitecaps.
  float foam = 1.0 - smoothstep(0.0, 0.28, depthHint);
  float foamWave = sin(xz.x * 0.32 + uTime * 2.1) * sin(xz.y * 0.26 - uTime * 1.6);
  foam *= step(0.12, foamWave * 0.5 + 0.5);
  float chop = step(0.86, valueNoise(xz * 0.22 + uTime * 0.15));
  float nearCap = step(0.72, vChop) * uWaveAmp;
  float streak = step(0.9, valueNoise(xz * 0.55 + vec2(uTime * 0.4, -uTime * 0.25)));
  col = mix(col, vec3(0.90, 0.95, 0.98), foam * 0.75 + chop * 0.08 * (1.0 - depthHint));
  col = mix(col, vec3(0.92, 0.97, 1.0), (nearCap * 0.35 + streak * 0.18 * uWaveAmp) * depthHint);

  vec3 N = normalize(vNormalW);
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(view, N), 0.0), 3.0);
  // Boost fresnel when low — rolling faces catch sky harder.
  fresnel = mix(fresnel, min(fresnel * 1.35, 1.0), uWaveAmp);

  vec2 sunFlat = normalize(vec2(uSunDir.x, uSunDir.z) + 1e-5);
  vec2 viewFlat = normalize(view.xz + 1e-5);
  float towardSun = clamp(dot(viewFlat, sunFlat), 0.0, 1.0);
  vec3 skyRefl = mix(vec3(0.32, 0.52, 0.78), vec3(0.78, 0.90, 1.0), towardSun);
  skyRefl = mix(skyRefl * 0.35, skyRefl, clamp(uDay, 0.0, 1.0));
  col = mix(col, skyRefl, fresnel * mix(0.55, 0.72, uWaveAmp));

  vec3 halfV = normalize(view + normalize(uSunDir));
  float glitter = pow(max(dot(N, halfV), 0.0), mix(110.0, 48.0, uWaveAmp));
  col += vec3(1.0, 0.94, 0.75) * glitter * mix(0.7, 1.15, uWaveAmp) * uDay;

  float sparkle = step(0.975, hash21(floor(xz * 0.55 + uTime)));
  col += vec3(0.85, 0.92, 1.0) * sparkle * mix(0.22, 0.4, uWaveAmp) * uDay;

  float dist = distance(xz, cameraPosition.xz);
  float fog = smoothstep(uNear + 60.0, uFar, dist);
  col = mix(col, uHaze, fog * 0.88);
  float alpha = mix(0.94, 0.0, fog);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Sliding water disk — vertex waves + fresnel that intensify near the surface.
 */
export class WaterSurface {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly sunDir = new Vector3(0.4, 0.7, 0.3);

  constructor(haze: Color) {
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDeep: { value: new Color(0x0d1f3a) },
        uMid: { value: new Color(0x2a5a78) },
        uShallow: { value: new Color(0x5aa8a0) },
        uHaze: { value: haze },
        uSunDir: { value: this.sunDir },
        uTime: { value: 0 },
        uNear: { value: HORIZON_NEAR },
        uFar: { value: HORIZON_FAR },
        uDay: { value: 1 },
        uWaveAmp: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    // Denser radial tessellation so near-field displacement reads clearly.
    this.mesh = new Mesh(new CircleGeometry(HORIZON_FAR + 500, 192), this.mat);
    this.mesh.rotation.x = -Math.PI * 0.5;
    this.mesh.position.y = WATER_LEVEL + 0.15;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    sun: { x: number; y: number; z: number },
    dayFactor: number,
    wy = 400,
  ): void {
    this.mesh.position.x = wx;
    this.mesh.position.z = wz;
    this.sunDir.set(sun.x, sun.y, sun.z).normalize();
    this.mat.uniforms.uTime!.value += dt;
    this.mat.uniforms.uDay!.value = dayFactor;

    const alt = Math.max(0, wy - WATER_LEVEL);
    // 1 near water → 0 at cruise. Peak displacement ~1.1 m.
    const t =
      alt <= WAVE_FULL_ALT
        ? 1
        : alt >= WAVE_FADE_ALT
          ? 0
          : 1 - (alt - WAVE_FULL_ALT) / (WAVE_FADE_ALT - WAVE_FULL_ALT);
    const smooth = t * t * (3 - 2 * t);
    this.mat.uniforms.uWaveAmp!.value = smooth * 1.15;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
