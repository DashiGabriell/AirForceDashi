import { WATER_LEVEL } from "@afd/game-core";
import {
  CircleGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { HORIZON_FAR, HORIZON_NEAR } from "./radialHorizon";

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uHaze;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uNear;
uniform float uFar;
uniform float uDay;

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

  // Animated normal-ish foam bands (stylized shoreline + chop).
  float foam = 1.0 - smoothstep(0.0, 0.28, depthHint);
  float foamWave = sin(xz.x * 0.32 + uTime * 2.1) * sin(xz.y * 0.26 - uTime * 1.6);
  foam *= step(0.12, foamWave * 0.5 + 0.5);
  float chop = step(0.86, valueNoise(xz * 0.22 + uTime * 0.15));
  col = mix(col, vec3(0.90, 0.95, 0.98), foam * 0.75 + chop * 0.08 * (1.0 - depthHint));

  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
  vec2 sunFlat = normalize(vec2(uSunDir.x, uSunDir.z));
  vec2 viewFlat = normalize(view.xz);
  float towardSun = clamp(dot(viewFlat, sunFlat), 0.0, 1.0);
  vec3 skyRefl = mix(vec3(0.32, 0.52, 0.78), vec3(0.78, 0.90, 1.0), towardSun);
  skyRefl = mix(skyRefl * 0.35, skyRefl, clamp(uDay, 0.0, 1.0));
  col = mix(col, skyRefl, fresnel * 0.55);

  vec3 halfV = normalize(view + normalize(uSunDir));
  float glitter = pow(max(dot(vec3(0.0, 1.0, 0.0), halfV), 0.0), 110.0);
  col += vec3(1.0, 0.94, 0.75) * glitter * 0.7 * uDay;

  float sparkle = step(0.975, hash21(floor(xz * 0.55 + uTime)));
  col += vec3(0.85, 0.92, 1.0) * sparkle * 0.22 * uDay;

  float dist = distance(xz, cameraPosition.xz);
  float fog = smoothstep(uNear + 60.0, uFar, dist);
  col = mix(col, uHaze, fog * 0.88);
  float alpha = mix(0.94, 0.0, fog);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Sliding water disk with fresnel, foam, glitter — cheap fragment work only.
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
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new Mesh(new CircleGeometry(HORIZON_FAR + 500, 96), this.mat);
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
  ): void {
    this.mesh.position.x = wx;
    this.mesh.position.z = wz;
    this.sunDir.set(sun.x, sun.y, sun.z).normalize();
    this.mat.uniforms.uTime!.value += dt;
    this.mat.uniforms.uDay!.value = dayFactor;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
