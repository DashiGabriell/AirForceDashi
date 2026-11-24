import type { GatePoint } from "@afd/game-core";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Prepared from `assets/3d/checkpoint/` (PBR + emissive arrows). */
export const CHECKPOINT_GATE_URL = "/models/checkpoint_gate.glb";

/** Model clear aperture radius (see tools/prepare_checkpoint_asset.py). */
const MODEL_CLEAR_R = 1;

/** Clockwise arrow scroll on emissive UV (rev/sec). */
const ARROW_UV_SPEED = 0.28;

type GateState = "idle" | "active" | "done";

const NEON_IDLE = new Color(0x0dffc7);
const NEON_ACTIVE = new Color(0x0dffc7);
const NEON_DONE = new Color(0xff1e14);

let protoLoad: Promise<Group | null> | null = null;

function loadGateProto(): Promise<Group | null> {
  if (!protoLoad) {
    protoLoad = new Promise((resolve) => {
      new GLTFLoader().load(
        CHECKPOINT_GATE_URL,
        (gltf: GLTF) => {
          const root = new Group();
          root.name = "CheckpointGateProto";
          root.add(gltf.scene);
          // Ensure emissive maps can scroll
          root.traverse((obj) => {
            if (!(obj instanceof Mesh)) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of mats) prepNeonMaps(mat);
          });
          resolve(root);
        },
        undefined,
        () => resolve(null),
      );
    });
  }
  return protoLoad;
}

function isNeonMat(mat: Material | null | undefined): boolean {
  if (!mat) return false;
  const n = mat.name.toLowerCase();
  return n.includes("checkpointneon") || n.includes("neon");
}

function prepNeonMaps(mat: Material | null | undefined): void {
  if (!mat || !isNeonMat(mat)) return;
  if (!(mat instanceof MeshStandardMaterial) || !mat.emissiveMap) return;
  const tex = mat.emissiveMap;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
}

function cloneGate(src: Group): Group {
  const clone = src.clone(true);
  clone.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry = obj.geometry.clone();
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => {
        const c = m.clone();
        prepNeonMaps(c);
        return c;
      });
    } else if (obj.material) {
      obj.material = obj.material.clone();
      prepNeonMaps(obj.material);
    }
  });
  return clone;
}

function setNeonColor(root: Object3D, color: Color, intensity: number): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      // Metal stays gunmetal — never tint cyan/red
      if (!isNeonMat(mat)) continue;
      if (mat instanceof MeshStandardMaterial) {
        mat.emissive.copy(color);
        mat.emissiveIntensity = intensity;
        mat.needsUpdate = true;
      } else if (mat instanceof MeshBasicMaterial) {
        mat.color.copy(color);
        mat.needsUpdate = true;
      }
    }
  });
}

function scrollArrows(root: Object3D, dt: number, active: boolean): void {
  const speed = active ? ARROW_UV_SPEED : ARROW_UV_SPEED * 0.35;
  const delta = -dt * speed; // negative U ≈ clockwise on typical torus unwrap
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!isNeonMat(mat) || !(mat instanceof MeshStandardMaterial)) continue;
      const tex = mat.emissiveMap;
      if (!tex) continue;
      tex.offset.x = (tex.offset.x + delta) % 1;
    }
  });
}

interface GateVisual {
  root: Object3D;
  radius: number;
  fallback: boolean;
}

export class RingField {
  readonly group = new Group();
  private gates: GateVisual[] = [];
  private fallbackGeo = new TorusGeometry(1, 0.04, 8, 32);
  private activeMat = new MeshBasicMaterial({
    color: NEON_ACTIVE,
    transparent: true,
    opacity: 0.85,
  });
  private idleMat = new MeshBasicMaterial({
    color: 0x88aacc,
    transparent: true,
    opacity: 0.35,
  });
  private doneMat = new MeshBasicMaterial({
    color: NEON_DONE,
    transparent: true,
    opacity: 0.55,
  });
  private t = 0;
  private proto: Group | null = null;
  private pending: GatePoint[] | null = null;

  constructor() {
    void loadGateProto().then((p) => {
      this.proto = p;
      if (this.pending) {
        const gates = this.pending;
        this.pending = null;
        this.setGates(gates);
      }
    });
  }

  setGates(gates: GatePoint[]): void {
    this.clear();
    if (!this.proto) {
      this.pending = gates;
      for (let i = 0; i < gates.length; i++) {
        this.addFallback(gates[i]!, i === 0 ? "active" : "idle");
      }
      return;
    }
    for (let i = 0; i < gates.length; i++) {
      this.addDetailed(gates[i]!, i === 0 ? "active" : "idle");
    }
  }

  /**
   * Point the hole along the path.
   * GLB is Y-up (Blender +Z fly axis → local +Y). Fallback torus hole is +Z.
   */
  private orientGate(root: Object3D, g: GatePoint, flyAxis: "y" | "z"): void {
    const n = new Vector3(g.nx, g.ny, g.nz);
    if (n.lengthSq() < 1e-8) n.set(0, 0, -1);
    else n.normalize();
    const from = flyAxis === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
    root.quaternion.setFromUnitVectors(from, n);
  }

  private addDetailed(g: GatePoint, state: GateState): void {
    const root = cloneGate(this.proto!);
    root.position.set(g.x, g.y, g.z);
    this.orientGate(root, g, "y");
    root.scale.setScalar(g.radius / MODEL_CLEAR_R);
    this.applyState(root, state, false);
    this.group.add(root);
    this.gates.push({ root, radius: g.radius, fallback: false });
  }

  private addFallback(g: GatePoint, state: GateState): void {
    const mesh = new Mesh(
      this.fallbackGeo,
      state === "active"
        ? this.activeMat
        : state === "done"
          ? this.doneMat
          : this.idleMat,
    );
    mesh.position.set(g.x, g.y, g.z);
    this.orientGate(mesh, g, "z");
    mesh.scale.setScalar(g.radius);
    this.group.add(mesh);
    this.gates.push({ root: mesh, radius: g.radius, fallback: true });
  }

  private applyState(root: Object3D, state: GateState, fallback: boolean): void {
    if (fallback && root instanceof Mesh) {
      root.material =
        state === "active"
          ? this.activeMat
          : state === "done"
            ? this.doneMat
            : this.idleMat;
      return;
    }
    if (state === "done") setNeonColor(root, NEON_DONE, 6);
    else if (state === "active") setNeonColor(root, NEON_ACTIVE, 12);
    else setNeonColor(root, NEON_IDLE, 3.2);
  }

  update(ringIndex: number, dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i]!;
      const state: GateState =
        i < ringIndex ? "done" : i === ringIndex ? "active" : "idle";
      this.applyState(g.root, state, g.fallback);
      if (g.fallback) {
        const s =
          state === "active"
            ? g.radius * (1 + 0.04 * Math.sin(this.t * 8))
            : g.radius;
        g.root.scale.setScalar(s);
      } else {
        const base = g.radius / MODEL_CLEAR_R;
        const pulse = state === "active" ? 1 + 0.025 * Math.sin(this.t * 8) : 1;
        g.root.scale.setScalar(base * pulse);
        // Arrows rotate clockwise on luminous band
        scrollArrows(g.root, dt, state === "active");
      }
    }
  }

  clear(): void {
    for (const g of this.gates) {
      this.group.remove(g.root);
      g.root.traverse((obj) => {
        if (!(obj instanceof Mesh)) return;
        if (obj.geometry !== this.fallbackGeo) obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (
            mat &&
            mat !== this.activeMat &&
            mat !== this.idleMat &&
            mat !== this.doneMat
          ) {
            mat.dispose();
          }
        }
      });
    }
    this.gates = [];
  }

  dispose(): void {
    this.clear();
    this.fallbackGeo.dispose();
    this.activeMat.dispose();
    this.idleMat.dispose();
    this.doneMat.dispose();
  }
}
