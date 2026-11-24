import type { PracticeTargetState } from "@afd/game-core";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Prepared from `assets/3d/alvo/base_basic_pbr.glb`. */
export const PRACTICE_TARGET_URL = "/models/practice_target.glb";

/** Model unit radius after normalize (world units before gameplay scale). */
const MODEL_UNIT_R = 1;

const FALLBACK_ORANGE = new Color(0xff6b3d);
const FALLBACK_YELLOW = new Color(0xffd93d);
const SHARD_ORANGE = new Color(0xff5a2a);
const SHARD_YELLOW = new Color(0xffd23a);
const SHARD_STEEL = new Color(0x5a6068);

interface LiveNode {
  root: Group;
  radius: number;
}

interface Shard {
  mesh: Object3D;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

let protoLoad: Promise<Group | null> | null = null;

function loadProto(): Promise<Group | null> {
  if (!protoLoad) {
    protoLoad = new Promise((resolve) => {
      new GLTFLoader().load(
        PRACTICE_TARGET_URL,
        (gltf: GLTF) => {
          const root = normalizeProto(gltf.scene);
          resolve(root);
        },
        undefined,
        () => resolve(null),
      );
    });
  }
  return protoLoad;
}

/** Center at origin and scale so max half-extent ≈ MODEL_UNIT_R. */
function normalizeProto(scene: Object3D): Group {
  const root = new Group();
  root.name = "PracticeTargetProto";
  root.add(scene);

  const box = new Box3().setFromObject(root);
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  scene.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-3);
  const s = (MODEL_UNIT_R * 2) / maxDim;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  return root;
}

function cloneTarget(src: Group): Group {
  const clone = src.clone(true);
  clone.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry = obj.geometry.clone();
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => m.clone());
    } else if (obj.material) {
      obj.material = obj.material.clone();
    }
  });
  return clone;
}

function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

/**
 * Floating practice targets — GLB when available, procedural fallback.
 * `explode` launches mesh shards + leaves DebrisField to the scene.
 */
export class TargetField {
  readonly group = new Group();
  private nodes = new Map<number, LiveNode>();
  private shards: Shard[] = [];
  private proto: Group | null = null;
  private ready = false;
  private fallbackCore = new SphereGeometry(1, 12, 10);
  private fallbackRing = new TorusGeometry(1.35, 0.08, 8, 24);
  private matCore = new MeshBasicMaterial({
    color: FALLBACK_ORANGE,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  private matRing = new MeshBasicMaterial({
    color: FALLBACK_YELLOW,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private shardMats = [
    new MeshStandardMaterial({
      color: SHARD_ORANGE,
      metalness: 0.25,
      roughness: 0.55,
      emissive: SHARD_ORANGE,
      emissiveIntensity: 0.35,
    }),
    new MeshStandardMaterial({
      color: SHARD_YELLOW,
      metalness: 0.35,
      roughness: 0.4,
      emissive: SHARD_YELLOW,
      emissiveIntensity: 0.45,
    }),
    new MeshStandardMaterial({
      color: SHARD_STEEL,
      metalness: 0.7,
      roughness: 0.35,
    }),
  ];

  constructor() {
    void loadProto().then((p) => {
      this.proto = p;
      this.ready = true;
      // Rebuild any placeholders with the real mesh.
      for (const [id, node] of this.nodes) {
        const pos = node.root.position.clone();
        const radius = node.radius;
        this.group.remove(node.root);
        this.disposeObject(node.root);
        const root = this.build(radius);
        root.position.copy(pos);
        this.nodes.set(id, { root, radius });
        this.group.add(root);
      }
    });
  }

  sync(targets: PracticeTargetState[]): void {
    const live = new Set<number>();
    for (const t of targets) {
      if (!t.alive) continue;
      live.add(t.id);
      let node = this.nodes.get(t.id);
      if (!node) {
        const root = this.build(t.radius);
        node = { root, radius: t.radius };
        this.nodes.set(t.id, node);
        this.group.add(root);
      } else if (Math.abs(node.radius - t.radius) > 0.01) {
        node.radius = t.radius;
        const s = this.gameScale(t.radius);
        node.root.scale.setScalar(s);
      }
      node.root.position.set(t.x, t.y, t.z);
      node.root.rotation.y += 0.012;
    }
    for (const [id, node] of this.nodes) {
      if (!live.has(id)) {
        this.group.remove(node.root);
        this.disposeObject(node.root);
        this.nodes.delete(id);
      }
    }
  }

  /**
   * Shatter FX at world point. Prefer calling before `sync` removes the live mesh.
   */
  explode(x: number, y: number, z: number, radius = 14): void {
    const scale = this.gameScale(radius);
    // Prefer ripping meshes from a temporary clone of the proto.
    const pieces = this.makeShards(scale);
    const speed = 28 + scale * 6;
    for (const mesh of pieces) {
      const dir = new Vector3(
        Math.random() - 0.5,
        Math.random() * 0.85 + 0.15,
        Math.random() - 0.5,
      ).normalize();
      mesh.position.set(
        x + dir.x * scale * 0.2,
        y + dir.y * scale * 0.15,
        z + dir.z * scale * 0.2,
      );
      mesh.scale.setScalar(0.35 + Math.random() * 0.55);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      this.group.add(mesh);
      this.shards.push({
        mesh,
        life: 1.4 + Math.random() * 1.1,
        vx: dir.x * speed * (0.7 + Math.random() * 0.8),
        vy: dir.y * speed * (0.9 + Math.random() * 0.7) + 12,
        vz: dir.z * speed * (0.7 + Math.random() * 0.8),
        spinX: (Math.random() - 0.5) * 10,
        spinY: (Math.random() - 0.5) * 10,
        spinZ: (Math.random() - 0.5) * 10,
      });
    }
  }

  tick(dt: number): void {
    if (!this.shards.length) return;
    const next: Shard[] = [];
    for (const s of this.shards) {
      s.life -= dt;
      s.vy -= 42 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += s.spinX * dt;
      s.mesh.rotation.y += s.spinY * dt;
      s.mesh.rotation.z += s.spinZ * dt;
      // Fade via scale collapse near end.
      if (s.life < 0.35) {
        const k = Math.max(0.05, s.life / 0.35);
        s.mesh.scale.multiplyScalar(0.92);
        void k;
      }
      if (s.life <= 0 || s.mesh.position.y < -80) {
        this.group.remove(s.mesh);
        this.disposeObject(s.mesh);
      } else {
        next.push(s);
      }
    }
    this.shards = next;
  }

  private gameScale(radius: number): number {
    // Gameplay radius → visual size (unit model has radius ≈ 1).
    return Math.max(3.5, radius * 0.72);
  }

  private build(radius: number): Group {
    const g = new Group();
    g.name = "PracticeTarget";
    if (this.proto) {
      g.add(cloneTarget(this.proto));
    } else if (this.ready) {
      // Load failed — procedural stand-in.
      g.add(new Mesh(this.fallbackCore, this.matCore));
      const ring = new Mesh(this.fallbackRing, this.matRing);
      ring.rotation.x = Math.PI * 0.5;
      g.add(ring);
    } else {
      // Still loading — temporary stand-in swapped when proto arrives.
      g.add(new Mesh(this.fallbackCore, this.matCore));
      const ring = new Mesh(this.fallbackRing, this.matRing);
      ring.rotation.x = Math.PI * 0.5;
      g.add(ring);
    }
    g.scale.setScalar(this.gameScale(radius));
    return g;
  }

  private makeShards(scale: number): Object3D[] {
    const count = 16;
    const out: Object3D[] = [];
    const meshes = this.proto ? collectMeshes(this.proto) : [];
    // Multi-part models → fling real mesh pieces. Single mesh → colored plates
    // (cloning the whole target 16× looks like mini balloons, not a shatter).
    if (meshes.length >= 3) {
      for (let i = 0; i < count; i++) {
        const src = meshes[i % meshes.length]!;
        const piece = src.clone(true);
        if (piece instanceof Mesh) {
          piece.geometry = piece.geometry.clone();
          if (Array.isArray(piece.material)) {
            piece.material = piece.material.map((m) => m.clone());
          } else if (piece.material) {
            piece.material = piece.material.clone();
          }
          const mats = Array.isArray(piece.material)
            ? piece.material
            : [piece.material];
          for (const m of mats) {
            if (m instanceof MeshStandardMaterial) {
              m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.6);
            }
          }
        }
        piece.position.set(0, 0, 0);
        piece.scale.setScalar(0.55 + Math.random() * 0.55);
        out.push(piece);
      }
      return out;
    }
    // Orange / yellow / steel plates scaled to the target.
    for (let i = 0; i < count; i++) {
      const mat = this.shardMats[i % this.shardMats.length]!;
      const mesh = new Mesh(this.fallbackCore, mat);
      const plate = 0.18 * scale;
      mesh.scale.set(
        plate * (0.6 + Math.random()),
        plate * (0.25 + Math.random() * 0.35),
        plate * (0.6 + Math.random()),
      );
      out.push(mesh);
    }
    return out;
  }

  private disposeObject(obj: Object3D): void {
    obj.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // Shared fallback / shard mats must not be disposed here.
        if (
          m === this.matCore ||
          m === this.matRing ||
          this.shardMats.includes(m as MeshStandardMaterial)
        ) {
          continue;
        }
        m.dispose();
      }
    });
  }

  dispose(): void {
    for (const node of this.nodes.values()) {
      this.group.remove(node.root);
      this.disposeObject(node.root);
    }
    this.nodes.clear();
    for (const s of this.shards) {
      this.group.remove(s.mesh);
      this.disposeObject(s.mesh);
    }
    this.shards = [];
    this.fallbackCore.dispose();
    this.fallbackRing.dispose();
    this.matCore.dispose();
    this.matRing.dispose();
    for (const m of this.shardMats) m.dispose();
  }
}
