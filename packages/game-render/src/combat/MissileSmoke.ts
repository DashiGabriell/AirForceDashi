import {
  CanvasTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";

const PUFFS_PER = 40;
const PUFF_LIFE = 2.5;
const EMIT_DT = 0.045;

const VERT = /* glsl */ `
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float a = texture2D(map, vUv).a * vAlpha;
  if (a < 0.015) discard;
  vec3 col = vec3(0.78, 0.80, 0.82);
  gl_FragColor = vec4(col, a);
}
`;

interface Puff {
  x: number;
  y: number;
  z: number;
  age: number;
  alive: boolean;
}

interface Slot {
  cursor: number;
  emitAcc: number;
  hasLast: boolean;
  lx: number;
  ly: number;
  lz: number;
}

function smokeTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.45, "rgba(230,232,236,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft camera-facing smoke per missile slot.
 * Emission stops when the missile dies; puffs already in the air fade out.
 */
export class MissileSmoke {
  readonly mesh: InstancedMesh;
  private readonly geo: PlaneGeometry;
  private readonly mat: ShaderMaterial;
  private readonly tex: CanvasTexture;
  private readonly alpha: InstancedBufferAttribute;
  private readonly puffs: Puff[];
  private readonly slots: Slot[];
  private readonly dummy = new Object3D();
  private readonly cam = new Vector3();
  private readonly tmp = new Matrix4();
  private readonly per: number;

  constructor(poolSize: number) {
    this.per = PUFFS_PER;
    const count = poolSize * this.per;
    this.puffs = [];
    this.slots = [];
    for (let i = 0; i < poolSize; i++) {
      this.slots.push({ cursor: 0, emitAcc: 0, hasLast: false, lx: 0, ly: 0, lz: 0 });
      for (let p = 0; p < this.per; p++) {
        this.puffs.push({ x: 0, y: 0, z: 0, age: 0, alive: false });
      }
    }

    this.geo = new PlaneGeometry(1, 1);
    this.alpha = new InstancedBufferAttribute(new Float32Array(count), 1);
    this.alpha.setUsage(DynamicDrawUsage);
    this.geo.setAttribute("aAlpha", this.alpha);

    this.tex = smokeTexture();
    this.mat = new ShaderMaterial({
      uniforms: { map: { value: this.tex } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new InstancedMesh(this.geo, this.mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = count;
    this.hideAll();
  }

  setViewOrigin(x: number, y: number, z: number): void {
    this.cam.set(x, y, z);
  }

  sync(
    missiles: Array<{
      active: boolean;
      x: number;
      y: number;
      z: number;
      vx?: number;
      vy?: number;
      vz?: number;
    }>,
    dt: number,
  ): void {
    const n = Math.min(this.slots.length, missiles.length);
    for (let i = 0; i < this.slots.length; i++) {
      const src = i < n ? missiles[i] : undefined;
      const slot = this.slots[i]!;
      if (!src?.active) {
        slot.hasLast = false;
        slot.emitAcc = 0;
        continue;
      }
      slot.emitAcc += dt;
      const step = slot.hasLast
        ? Math.hypot(src.x - slot.lx, src.y - slot.ly, src.z - slot.lz)
        : 0;
      if (!slot.hasLast || slot.emitAcc >= EMIT_DT || step > 70) {
        slot.emitAcc = 0;
        this.emit(i, src);
      }
      slot.lx = src.x;
      slot.ly = src.y;
      slot.lz = src.z;
      slot.hasLast = true;
    }
  }

  tick(dt: number): void {
    const cam = this.cam;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i]!;
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= PUFF_LIFE) {
        p.alive = false;
        this.writeHidden(i);
        continue;
      }
      const u = p.age / PUFF_LIFE;
      const alpha = (1 - u) * (1 - u) * 0.5;
      const size = 5 + u * 26;
      this.alpha.setX(i, alpha);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.lookAt(cam);
      this.dummy.scale.setScalar(size);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.alpha.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }

  private emit(
    slot: number,
    src: { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number },
  ): void {
    const s = this.slots[slot]!;
    const idx = slot * this.per + s.cursor;
    s.cursor = (s.cursor + 1) % this.per;
    let vx = src.vx ?? 0;
    let vy = src.vy ?? 0;
    let vz = src.vz ?? 0;
    const len = Math.hypot(vx, vy, vz);
    if (len > 1e-3) {
      vx /= len;
      vy /= len;
      vz /= len;
    } else {
      vx = 0;
      vy = 0;
      vz = -1;
    }
    const puff = this.puffs[idx]!;
    puff.alive = true;
    puff.age = 0;
    puff.x = src.x - vx * 8;
    puff.y = src.y - vy * 8;
    puff.z = src.z - vz * 8;
  }

  private writeHidden(i: number): void {
    this.alpha.setX(i, 0);
    this.tmp.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this.tmp);
  }

  private hideAll(): void {
    for (let i = 0; i < this.puffs.length; i++) this.writeHidden(i);
    this.alpha.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
