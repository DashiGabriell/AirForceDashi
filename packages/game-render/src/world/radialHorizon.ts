import { Color, type MeshLambertMaterial } from "three";

/** Detailed meshes dissolve before the square chunk ring (~1536 m at the nearest side). */
export const HORIZON_NEAR = 920;
export const HORIZON_FAR = 1420;

/**
 * Flat stand-in for the ground past the streamed chunks.
 * Fades to haze by half the spherical horizon distance, which is the
 * depression angle of Earth's true horizon (radius 6371 km).
 */
export const HORIZON_COLOR_GLSL = /* glsl */ `
vec3 afdHorizonColor(vec2 xz, vec3 haze) {
  float dist = distance(xz, cameraPosition.xz);
  float h = max(cameraPosition.y, 2.0);
  float horizon = sqrt(12742000.0 * h + h * h);
  float aerial = smoothstep(horizon * 0.2, horizon * 0.5, dist);
  vec3 ground = vec3(0.34, 0.40, 0.33);
  return mix(ground, haze, aerial);
}
`;

/** Blend terrain, buildings and trees into the round horizon before the chunk square. */
export function applyRadialHorizon(mat: MeshLambertMaterial, haze: Color): void {
  mat.customProgramCacheKey = () => "afd-radial-horizon";
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHaze = { value: haze };
    shader.uniforms.uHorizonNear = { value: HORIZON_NEAR };
    shader.uniforms.uHorizonFar = { value: HORIZON_FAR };
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
uniform vec3 uHaze;
uniform float uHorizonNear;
uniform float uHorizonFar;
${HORIZON_COLOR_GLSL}`,
      )
      .replace(
        "#include <fog_fragment>",
        `float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
gl_FragColor.rgb = mix(gl_FragColor.rgb, afdHorizonColor(vHorizonWorld.xz, uHaze), hFog);`,
      );
  };
}
