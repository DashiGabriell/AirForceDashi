import { Color, type MeshLambertMaterial } from "three";

/**
 * Detailed meshes soft-blend into haze before the square chunk ring
 * (~1536 m at the nearest side). Distant silhouette continues past this.
 */
export const HORIZON_NEAR = 1180;
export const HORIZON_FAR = 1520;

type HorizonUniforms = {
  uHorizonNear: { value: number };
  uHorizonFar: { value: number };
  uHaze: { value: Color };
};

const HORIZON_KEY = "afd-radial-horizon-v5-soft";

/**
 * Soft atmospheric dissolve: albedo → haze, then discard only when fully fogged.
 * Shared by terrain, buildings and vegetation so the ring edge never pops.
 */
export function applyRadialHorizon(
  mat: MeshLambertMaterial,
  haze: Color,
  near = HORIZON_NEAR,
  far = HORIZON_FAR,
  cacheKey = HORIZON_KEY,
): void {
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    const u = shader.uniforms as unknown as HorizonUniforms & typeof shader.uniforms;
    u.uHorizonNear = { value: near };
    u.uHorizonFar = { value: far };
    u.uHaze = { value: haze };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHorizonWorld;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
        vHorizonWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
        vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
uniform float uHorizonNear;
uniform float uHorizonFar;
uniform vec3 uHaze;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, hFog * 0.92);`,
      )
      .replace(
        "#include <colorspace_fragment>",
        `float hDistOut = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFogOut = smoothstep(uHorizonNear, uHorizonFar, hDistOut);
float hNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
if (hFogOut > 0.97 + hNoise * 0.03) discard;
#include <colorspace_fragment>`,
      );
  };
  mat.needsUpdate = true;
}

/** Extra near-field detail for terrain (procedural splat + micro-relief). */
export function applyTerrainDetail(mat: MeshLambertMaterial, haze: Color): void {
  mat.customProgramCacheKey = () => "afd-terrain-detail-v1";
  mat.onBeforeCompile = (shader) => {
    const u = shader.uniforms as unknown as HorizonUniforms &
      typeof shader.uniforms & {
        uDetailAmp: { value: number };
      };
    u.uHorizonNear = { value: HORIZON_NEAR };
    u.uHorizonFar = { value: HORIZON_FAR };
    u.uHaze = { value: haze };
    u.uDetailAmp = { value: 1 };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainWorld = vHorizonWorld;
        vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
uniform float uHorizonNear;
uniform float uHorizonFar;
uniform vec3 uHaze;

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
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * valueNoise(p);
    p = p * 2.07 + 17.0;
    a *= 0.5;
  }
  return v;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 xz = vTerrainWorld.xz;
float macro = fbm(xz * 0.018);
float micro = fbm(xz * 0.11);
float grit = fbm(xz * 0.45);
float slope = 1.0 - clamp(normalize(vTerrainNormal).y, 0.0, 1.0);
vec3 grass = vec3(0.28, 0.42, 0.24);
vec3 dirt = vec3(0.42, 0.34, 0.24);
vec3 rock = vec3(0.48, 0.46, 0.44);
vec3 sand = vec3(0.55, 0.52, 0.40);
vec3 splat = mix(grass, dirt, smoothstep(0.35, 0.7, macro + grit * 0.25));
splat = mix(splat, rock, smoothstep(0.35, 0.75, slope + micro * 0.2));
splat = mix(splat, sand, step(vTerrainWorld.y, 6.0) * (1.0 - slope));
float detail = mix(0.88, 1.12, micro) * mix(0.94, 1.06, grit);
diffuseColor.rgb = mix(diffuseColor.rgb, splat, 0.38) * detail;
float terrace = floor(vTerrainWorld.y * 0.09) * 0.012;
diffuseColor.rgb *= 1.0 - terrace;
float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, hFog * 0.92);`,
      )
      .replace(
        "#include <colorspace_fragment>",
        `float hDistOut = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFogOut = smoothstep(uHorizonNear, uHorizonFar, hDistOut);
float hNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
if (hFogOut > 0.97 + hNoise * 0.03) discard;
#include <colorspace_fragment>`,
      );
  };
  mat.needsUpdate = true;
}

/** Building facade windows / roof tiles (object-space grid). */
export function applyBuildingFacade(
  mat: MeshLambertMaterial,
  haze: Color,
  dayFactor: { value: number },
): void {
  mat.customProgramCacheKey = () => "afd-building-facade-v1";
  mat.onBeforeCompile = (shader) => {
    const u = shader.uniforms as unknown as HorizonUniforms &
      typeof shader.uniforms & {
        uDayFactor: { value: number };
      };
    u.uHorizonNear = { value: HORIZON_NEAR };
    u.uHorizonFar = { value: HORIZON_FAR };
    u.uHaze = { value: haze };
    u.uDayFactor = dayFactor;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying vec3 vBuildLocal;
varying vec3 vBuildNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vBuildLocal = transformed;
#ifdef USE_INSTANCING
vHorizonWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vBuildNormal = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
#else
vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vBuildNormal = normalize(mat3(modelMatrix) * objectNormal);
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying vec3 vBuildLocal;
varying vec3 vBuildNormal;
uniform float uHorizonNear;
uniform float uHorizonFar;
uniform vec3 uHaze;
uniform float uDayFactor;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 n = normalize(vBuildNormal);
float up = abs(n.y);
float night = 1.0 - clamp(uDayFactor, 0.0, 1.0);
float nightQ = floor(night * 16.0 + 0.001) / 16.0;
if (up < 0.55) {
  float uCoord = abs(n.x) > 0.5 ? vBuildLocal.z : vBuildLocal.x;
  float vCoord = vBuildLocal.y;
  float bay = fract((uCoord + 0.5) * 5.5);
  float floorY = fract((vCoord + 0.5) * 9.0);
  float pane = step(0.16, bay) * step(bay, 0.84) * step(0.14, floorY) * step(floorY, 0.80);
  pane *= step(-0.38, vCoord) * step(vCoord, 0.40);
  vec2 cellId = floor(vec2((uCoord + 0.5) * 5.5, (vCoord + 0.5) * 9.0));
  float cellH = fract(sin(dot(cellId, vec2(12.9898, 78.233))) * 43758.5453);
  float litThresh = mix(0.72, 0.34, nightQ);
  float lit = step(litThresh, cellH);
  float cool = step(0.82, cellH);
  vec3 glassDay = vec3(0.16, 0.22, 0.30);
  vec3 glassNight = vec3(1.0, 0.84, 0.48);
  vec3 glassCool = vec3(0.72, 0.86, 1.0);
  vec3 glow = mix(glassNight, glassCool, cool);
  vec3 glass = mix(glassDay, mix(glassDay * 0.45, glow, lit), night);
  diffuseColor.rgb = mix(diffuseColor.rgb, glass, pane * mix(0.55, 0.92, night));
  diffuseColor.rgb += glow * lit * pane * night * 0.55;
} else if (n.y > 0.5) {
  float tile = step(0.04, fract((vBuildLocal.x + 0.5) * 6.0))
             * step(0.04, fract((vBuildLocal.z + 0.5) * 6.0));
  diffuseColor.rgb *= mix(0.86, 1.0, tile);
}
float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, hFog * 0.92);`,
      )
      .replace(
        "#include <colorspace_fragment>",
        `float hDistOut = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFogOut = smoothstep(uHorizonNear, uHorizonFar, hDistOut);
float hNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
if (hFogOut > 0.97 + hNoise * 0.03) discard;
#include <colorspace_fragment>`,
      );
  };
  mat.needsUpdate = true;
}

/** Canopy gradient + soft haze for vegetation cones. */
export function applyVegetationDetail(mat: MeshLambertMaterial, haze: Color): void {
  mat.customProgramCacheKey = () => "afd-veg-detail-v1";
  mat.onBeforeCompile = (shader) => {
    const u = shader.uniforms as unknown as HorizonUniforms & typeof shader.uniforms;
    u.uHorizonNear = { value: HORIZON_NEAR };
    u.uHorizonFar = { value: HORIZON_FAR };
    u.uHaze = { value: haze };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying float vCanopyY;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCanopyY = transformed.y;
#ifdef USE_INSTANCING
vHorizonWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vHorizonWorld;
varying float vCanopyY;
uniform float uHorizonNear;
uniform float uHorizonFar;
uniform vec3 uHaze;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float tip = clamp(vCanopyY + 0.5, 0.0, 1.0);
vec3 dark = vec3(0.10, 0.22, 0.12);
vec3 mid = vec3(0.22, 0.42, 0.22);
vec3 light = vec3(0.34, 0.52, 0.28);
vec3 canopy = mix(dark, mid, smoothstep(0.0, 0.45, tip));
canopy = mix(canopy, light, smoothstep(0.55, 1.0, tip));
diffuseColor.rgb = mix(diffuseColor.rgb, canopy, 0.72);
float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, hFog * 0.92);`,
      )
      .replace(
        "#include <colorspace_fragment>",
        `float hDistOut = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFogOut = smoothstep(uHorizonNear, uHorizonFar, hDistOut);
float hNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
if (hFogOut > 0.97 + hNoise * 0.03) discard;
#include <colorspace_fragment>`,
      );
  };
  mat.needsUpdate = true;
}
