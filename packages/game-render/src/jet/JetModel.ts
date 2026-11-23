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
export const F15_MODEL_URL = "/models/f15_game.glb";
export const F16_MODEL_URL = "/models/f16_game.glb";
export const FA18_MODEL_URL = "/models/fa18_game.glb";
export const TYPHOON_MODEL_URL = "/models/typhoon_game.glb";
export const RAFALE_MODEL_URL = "/models/rafale_game.glb";
export const SU35_MODEL_URL = "/models/su35_game.glb";
export const F35_MODEL_URL = "/models/f35_game.glb";
export const F14_MODEL_URL = "/models/f14_game.glb";
export const GRIPEN_MODEL_URL = "/models/gripen_game.glb";
export const MIRAGE2000_MODEL_URL = "/models/mirage2000_game.glb";
export const F2_MODEL_URL = "/models/f2_game.glb";
export const MIG29_MODEL_URL = "/models/mig29_game.glb";
export const MIG35_MODEL_URL = "/models/mig35_game.glb";
export const SU57_MODEL_URL = "/models/su57_game.glb";
export const YF23_MODEL_URL = "/models/yf23_game.glb";
export const F4_MODEL_URL = "/models/f4_game.glb";
export const SU34_MODEL_URL = "/models/su34_game.glb";
export const A10_MODEL_URL = "/models/a10_game.glb";
export const B2_MODEL_URL = "/models/b2_game.glb";
export const U2_MODEL_URL = "/models/u2_game.glb";

const MODEL_URL: Record<Aircraft, string> = {
  [Aircraft.F22_RAPTOR]: F22_MODEL_URL,
  [Aircraft.F15_EAGLE]: F15_MODEL_URL,
  [Aircraft.F16_FALCON]: F16_MODEL_URL,
  [Aircraft.FA18_SUPER_HORNET]: FA18_MODEL_URL,
  [Aircraft.TYPHOON]: TYPHOON_MODEL_URL,
  [Aircraft.RAFALE]: RAFALE_MODEL_URL,
  [Aircraft.SU35]: SU35_MODEL_URL,
  [Aircraft.F35_LIGHTNING]: F35_MODEL_URL,
  [Aircraft.F14_TOMCAT]: F14_MODEL_URL,
  [Aircraft.GRIPEN]: GRIPEN_MODEL_URL,
  [Aircraft.MIRAGE_2000]: MIRAGE2000_MODEL_URL,
  [Aircraft.F2]: F2_MODEL_URL,
  [Aircraft.MIG29]: MIG29_MODEL_URL,
  [Aircraft.MIG35]: MIG35_MODEL_URL,
  [Aircraft.SU57]: SU57_MODEL_URL,
  [Aircraft.YF23]: YF23_MODEL_URL,
  [Aircraft.F4_PHANTOM]: F4_MODEL_URL,
  [Aircraft.SU34]: SU34_MODEL_URL,
  [Aircraft.A10]: A10_MODEL_URL,
  [Aircraft.B2]: B2_MODEL_URL,
  [Aircraft.U2]: U2_MODEL_URL,
};

type NozzleLayout = { twin: boolean; x: number; z: number };

const NOZZLES: Record<Aircraft, NozzleLayout> = {
  [Aircraft.F22_RAPTOR]: { twin: true, x: 0.42, z: 4.15 },
  [Aircraft.F15_EAGLE]: { twin: true, x: 0.7, z: 4.2 },
  [Aircraft.F16_FALCON]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.FA18_SUPER_HORNET]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.TYPHOON]: { twin: true, x: 0.5, z: 4.1 },
  [Aircraft.RAFALE]: { twin: true, x: 0.5, z: 4.1 },
  [Aircraft.SU35]: { twin: true, x: 0.65, z: 4.2 },
  [Aircraft.F35_LIGHTNING]: { twin: false, x: 0, z: 4.1 },
  [Aircraft.F14_TOMCAT]: { twin: true, x: 0.55, z: 4.2 },
  [Aircraft.GRIPEN]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.MIRAGE_2000]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.F2]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.MIG29]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.MIG35]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.SU57]: { twin: true, x: 0.55, z: 4.2 },
  [Aircraft.YF23]: { twin: true, x: 0.45, z: 4.1 },
  [Aircraft.F4_PHANTOM]: { twin: true, x: 0.5, z: 4.15 },
  [Aircraft.SU34]: { twin: true, x: 0.6, z: 4.2 },
  [Aircraft.A10]: { twin: true, x: 0.7, z: 4.0 },
  [Aircraft.B2]: { twin: true, x: 0.8, z: 3.6 },
  [Aircraft.U2]: { twin: false, x: 0, z: 4.2 },
};

const PAINT_LENGTH = 9;
const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _v = new Vector3();
const _tint = new Color();

const loadCache = new Map<Aircraft, Promise<GLTF>>();

function loadAircraftGlb(aircraft: Aircraft): Promise<GLTF> {
  const cached = loadCache.get(aircraft);
  if (cached) return cached;
  const url = MODEL_URL[aircraft];
  const promise = new Promise<GLTF>((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, (err) => {
      loadCache.delete(aircraft);
      reject(err);
    });
  });
  loadCache.set(aircraft, promise);
  return promise;
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

function addNozzles(root: Group, aircraft: Aircraft): void {
  const layout = NOZZLES[aircraft] ?? NOZZLES[Aircraft.F22_RAPTOR]!;
  const make = (name: string, x: number) => {
    const mesh = new Mesh(
      new BoxGeometry(0.55, 0.28, 0.16),
      new MeshStandardMaterial({
        name: "Nozzle",
        color: 0xff8c1e,
        emissive: 0xff6a0d,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      }),
    );
    mesh.name = name;
    mesh.position.set(x, 0, layout.z);
    return mesh;
  };
  if (layout.twin) {
    root.add(make("nozzleL", -layout.x), make("nozzleR", layout.x));
  } else {
    root.add(make("nozzleC", 0));
  }
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
 * Puts a jet under `root` (procedural immediately, glb when it loads).
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

  loadAircraftGlb(aircraft)
    .then((gltf) => {
      if (cancelled) return;
      const model = clonePainted(gltf.scene);
      model.name = "Airframe";
      alignAirframe(model);
      disposeContents(root);
      root.add(model);
      addNozzles(root, aircraft);
      applyJetSkin(root, skin);
    })
    .catch(() => {
      /* procedural Paint mesh stays flyable */
    });

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
