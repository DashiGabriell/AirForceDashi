import { jetSkinById } from "@afd/game-core";
import { Aircraft } from "@afd/shared-types";
import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createJetMesh } from "./JetMesh";

/** Served from `apps/web/public/models`. */
export const F22_MODEL_URL = "/models/f22_game.glb";

const PAINT_LENGTH = 9;
const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _v = new Vector3();
const _tint = new Color();

let f22Load: Promise<GLTF> | null = null;

function loadF22(): Promise<GLTF> {
  if (!f22Load) {
    f22Load = new Promise((resolve, reject) => {
      new GLTFLoader().load(F22_MODEL_URL, resolve, undefined, (err) => {
        f22Load = null;
        reject(err);
      });
    });
  }
  return f22Load;
}

function isPaintMaterial(mesh: Mesh, mat: Material): boolean {
  if (mat.name.toLowerCase().startsWith("paint")) return true;
  return mesh.name.toLowerCase().includes("airframe");
}

/** Multiplies the Paint albedo. Factory (`#ffffff`) keeps the baked texture. */
export function applyJetSkin(root: Object3D, skinId: string): void {
  const skin = jetSkinById(skinId);
  _tint.setHex(skin.tint);
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (!isPaintMaterial(obj, mat)) continue;
      const data = mat.userData as { skinBase?: Color };
      if (!data.skinBase) data.skinBase = mat.color.clone();
      mat.color.copy(data.skinBase).multiply(_tint);
      mat.metalness = skin.metalness;
      mat.roughness = skin.roughness;
      mat.needsUpdate = true;
    }
  });
}

function clonePainted(src: Object3D): Object3D {
  const clone = src.clone(true);
  clone.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry = obj.geometry.clone();
    if (Array.isArray(obj.material)) obj.material = obj.material.map((mat) => mat.clone());
    else obj.material = obj.material.clone();
  });
  return clone;
}

/** Nose on local −Z, length ~9, centered. Safe if the glTF axis drifts. */
function alignAirframe(model: Object3D): void {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  _box.getSize(_size);
  if (_size.x >= _size.y && _size.x >= _size.z) model.rotateY(Math.PI / 2);
  else if (_size.y >= _size.x && _size.y >= _size.z) model.rotateX(-Math.PI / 2);
  model.updateMatrixWorld(true);

  let z = 0;
  let n = 0;
  model.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const pos = obj.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 12) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      z += _v.z;
      n += 1;
    }
  });
  if (n > 0 && z / n < 0) model.rotateY(Math.PI);
  model.updateMatrixWorld(true);

  _box.setFromObject(model);
  _box.getSize(_size);
  model.scale.multiplyScalar(PAINT_LENGTH / Math.max(_size.z, 0.001));
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  _box.getCenter(_center);
  model.position.sub(_center);
  model.updateMatrixWorld(true);
}

function addNozzles(root: Group): void {
  const make = (name: string, x: number) => {
    const mesh = new Mesh(
      new BoxGeometry(0.55, 0.28, 0.16),
      new MeshStandardMaterial({
        name: "Nozzle",
        color: 0xff8c1e,
        emissive: 0xff6a0d,
        emissiveIntensity: 0.15,
        roughness: 0.4,
      }),
    );
    mesh.name = name;
    mesh.position.set(x, 0, 4.15);
    return mesh;
  };
  root.add(make("nozzleL", -0.42), make("nozzleR", 0.42));
}

function disposeContents(root: Group): void {
  for (const child of [...root.children]) {
    root.remove(child);
    child.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) mat.dispose();
    });
  }
}

function fillProcedural(root: Group, aircraft: Aircraft): void {
  disposeContents(root);
  const built = createJetMesh(aircraft);
  for (const child of [...built.children]) root.add(child);
}

export interface FlightJetHandle {
  setSkin: (skinId: string) => void;
  dispose: () => void;
}

/**
 * Puts a jet under `root` (procedural immediately, F-22 glb when it loads).
 * `setSkin` updates the Paint slot, including a model that finishes loading later.
 */
export function attachFlightJet(
  root: Group,
  aircraft: Aircraft,
  skinId: string,
): FlightJetHandle {
  let cancelled = false;
  let skin = skinId;
  fillProcedural(root, aircraft);
  applyJetSkin(root, skin);
  if (aircraft === Aircraft.F22_RAPTOR) {
    loadF22()
      .then((gltf) => {
        if (cancelled) return;
        const model = clonePainted(gltf.scene);
        model.name = "Airframe";
        alignAirframe(model);
        disposeContents(root);
        root.add(model);
        addNozzles(root);
        applyJetSkin(root, skin);
      })
      .catch(() => {
        /* procedural Paint mesh stays flyable */
      });
  }

  return {
    setSkin(next) {
      skin = next;
      applyJetSkin(root, skin);
    },
    dispose() {
      cancelled = true;
      disposeContents(root);
    },
  };
}
