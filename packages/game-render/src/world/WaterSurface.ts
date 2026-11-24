import { WATER_LEVEL } from "@afd/game-core";
import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { HORIZON_FAR, HORIZON_NEAR } from "./radialHorizon";

/**
 * Ocean v4 — solid sea color (no grey Fresnel bands).
 * Mild Gerstner height only; lighting uses a flat-up normal so crests
 * never wash to sky-grey strips on the low-res RT.
 */

const WAVE_FULL_ALT = 25;
const WAVE_FADE_ALT = 200;
const PLANE_HALF = HORIZON_FAR + 600;

const VERT = /* glsl */ `
// afd-ocean-v4
uniform float uTime;
uniform float uWaveAmp;
uniform vec2 uCamXZ;
varying vec3 vWorld;
varying float vDist;
varying float vHeight;

float swell(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2(0.028, 0.012)) - t * 0.55) * 0.55;
  h += sin(dot(p, vec2(-0.018, 0.031)) + t * 0.72) * 0.32;
  h += sin(dot(p, vec2(0.041, -0.009)) - t * 0.95) * 0.18;
  return h;
}

void main() {
  vec4 world0 = modelMatrix * vec4(position, 1.0);
  vec2 p = world0.xz;
  vDist = length(p - uCamXZ);

  float amp = mix(0.25, 0.85, clamp(uWaveAmp, 0.0, 1.0));
  float h = swell(p, uTime) * amp;
  vHeight = h;

  vec3 pos = position;
  pos.z += h;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
// afd-ocean-v4
precision highp float;
varying vec3 vWorld;
varying float vDist;
varying float vHeight;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uHaze;
uniform float uNear;
uniform float uFar;
uniform float uDay;
uniform float uWaveAmp;

void main() {
  // Base = same ocean blue everywhere. Only tiny darker troughs (still blue).
  float trough = clamp(-vHeight * 0.35 + 0.5, 0.0, 1.0);
  vec3 col = mix(uDeep, uMid, 0.55);
  col = mix(col, uDeep, (1.0 - trough) * 0.18);
  // Near shore-ish lift stays in the same teal-blue family, very weak.
  col = mix(col, mix(uMid, uShallow, 0.35), uWaveAmp * 0.06);

  // Flat lighting: gentle day brightness, NO Fresnel, NO grey specular path.
  col *= mix(0.88, 1.05, clamp(uDay, 0.0, 1.0));

  float fog = smoothstep(uNear + 40.0, uFar, vDist);
  // Horizon fade only — keep near water fully ocean-colored.
  col = mix(col, mix(col, uHaze, 0.55), fog * 0.85);
  float alpha = mix(0.98, 0.0, fog);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export class WaterSurface {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly sunDir = new Vector3(0.4, 0.7, 0.3);
  private readonly camXZ = new Vector2(0, 0);

  constructor(haze: Color) {
    this.mat = new ShaderMaterial({
      name: "AFD_Ocean_v4",
      transparent: true,
      depthWrite: true,
      depthTest: true,
      uniforms: {
        // Cohesive Pacific blue — no pale/grey accents in the palette.
        uDeep: { value: new Color(0x0c2744) },
        uMid: { value: new Color(0x1a4f72) },
        uShallow: { value: new Color(0x2a6a7a) },
        uHaze: { value: haze },
        uSunDir: { value: this.sunDir },
        uTime: { value: 0 },
        uNear: { value: HORIZON_NEAR },
        uFar: { value: HORIZON_FAR },
        uDay: { value: 1 },
        uWaveAmp: { value: 0 },
        uCamXZ: { value: this.camXZ },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    this.mesh = new Mesh(
      new PlaneGeometry(PLANE_HALF * 2, PLANE_HALF * 2, 64, 64),
      this.mat,
    );
    this.mesh.rotation.x = -Math.PI * 0.5;
    this.mesh.position.y = WATER_LEVEL + 0.2;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = "Ocean_v4";
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
    this.camXZ.set(wx, wz);
    this.sunDir.set(sun.x, sun.y, sun.z).normalize();
    this.mat.uniforms.uTime!.value += dt;
    this.mat.uniforms.uDay!.value = dayFactor;

    const alt = Math.max(0, wy - WATER_LEVEL);
    const t =
      alt <= WAVE_FULL_ALT
        ? 1
        : alt >= WAVE_FADE_ALT
          ? 0
          : 1 - (alt - WAVE_FULL_ALT) / (WAVE_FADE_ALT - WAVE_FULL_ALT);
    this.mat.uniforms.uWaveAmp!.value = t * t * (3 - 2 * t);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
