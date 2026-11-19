import { Color, type MeshLambertMaterial } from "three";

/** Detailed meshes dissolve before the square chunk ring (~1536 m at the nearest side). */
export const HORIZON_NEAR = 1150;
export const HORIZON_FAR = 1500;

/** Dissolve terrain, buildings and trees into the real sky before the chunk square. */
export function applyRadialHorizon(mat: MeshLambertMaterial, _haze: Color): void {
  mat.customProgramCacheKey = () => "afd-radial-horizon-v4";
  mat.onBeforeCompile = (shader) => {
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
uniform float uHorizonNear;
uniform float uHorizonFar;`,
      )
      .replace(
        "#include <colorspace_fragment>",
        `float hDist = distance(vHorizonWorld.xz, cameraPosition.xz);
float hFog = smoothstep(uHorizonNear, uHorizonFar, hDist);
float hNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
if (hFog > hNoise) discard;
#include <colorspace_fragment>`,
      );
  };
}
