import { sampleHeight } from "@afd/game-core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
} from "three";

/** Inner edge sits under the soft terrain fade; outer carries silhouette into sky haze. */
const INNER = 1450;
const OUTER = 4200;
const SEGMENTS = 96;
const RINGS = 4;

const VERT = /* glsl */ `
varying vec3 vWorld;
varying float vRing;
void main() {
  vWorld = position;
  vRing = uv.x;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying float vRing;
uniform vec3 uHaze;
uniform vec3 uNearTint;
uniform float uDay;

void main() {
  float elev = clamp(vWorld.y / 140.0, 0.0, 1.0);
  vec3 rock = vec3(0.38, 0.40, 0.42);
  vec3 green = vec3(0.22, 0.34, 0.24);
  vec3 base = mix(green, rock, smoothstep(0.25, 0.75, elev));
  base = mix(base * 0.45, base, clamp(uDay, 0.15, 1.0));
  float fog = smoothstep(0.05, 0.95, vRing);
  vec3 col = mix(mix(uNearTint, base, 0.55), uHaze, fog);
  float alpha = mix(0.72, 0.0, fog * fog);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Low-cost distant terrain ribbon. Samples height sparsely; no chunk meshes past STREAM_RADIUS.
 */
export class HorizonSilhouette {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly geo: BufferGeometry;
  private lastWx = Infinity;
  private lastWz = Infinity;
  private acc = 0;

  constructor(haze: Color) {
    const vertCount = (RINGS + 1) * (SEGMENTS + 1);
    this.positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(RINGS * SEGMENTS * 6);

    let vi = 0;
    for (let r = 0; r <= RINGS; r++) {
      const t = r / RINGS;
      for (let s = 0; s <= SEGMENTS; s++) {
        uvs[vi * 2] = t;
        uvs[vi * 2 + 1] = s / SEGMENTS;
        vi++;
      }
    }

    let ii = 0;
    const stride = SEGMENTS + 1;
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SEGMENTS; s++) {
        const a = r * stride + s;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices[ii++] = a;
        indices[ii++] = c;
        indices[ii++] = b;
        indices[ii++] = b;
        indices[ii++] = c;
        indices[ii++] = d;
      }
    }

    this.geo = new BufferGeometry();
    this.geo.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geo.setAttribute("uv", new BufferAttribute(uvs, 2));
    this.geo.setIndex(new BufferAttribute(indices, 1));

    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uHaze: { value: haze },
        uNearTint: { value: new Color(0x6a8498) },
        uDay: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -0.5;
  }

  update(dt: number, wx: number, wz: number, dayFactor: number): void {
    this.mat.uniforms.uDay!.value = dayFactor;
    this.acc += dt;
    const moved = Math.hypot(wx - this.lastWx, wz - this.lastWz);
    if (moved < 80 && this.acc < 0.35 && Number.isFinite(this.lastWx)) return;
    this.acc = 0;
    this.lastWx = wx;
    this.lastWz = wz;
    this.rebuild(wx, wz);
  }

  warm(wx: number, wz: number): void {
    this.lastWx = wx;
    this.lastWz = wz;
    this.rebuild(wx, wz);
  }

  private rebuild(wx: number, wz: number): void {
    let vi = 0;
    for (let r = 0; r <= RINGS; r++) {
      const t = r / RINGS;
      const radius = INNER + (OUTER - INNER) * t;
      for (let s = 0; s <= SEGMENTS; s++) {
        const ang = (s / SEGMENTS) * Math.PI * 2;
        const x = wx + Math.cos(ang) * radius;
        const z = wz + Math.sin(ang) * radius;
        const y = sampleHeight(x, z);
        this.positions[vi++] = x;
        this.positions[vi++] = y;
        this.positions[vi++] = z;
      }
    }
    const attr = this.geo.getAttribute("position") as BufferAttribute;
    attr.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
