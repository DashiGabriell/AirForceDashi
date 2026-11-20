import {
  Box3,
  Group,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();

const cache = new Map<string, Promise<GLTF>>();

function loadWeaponGltf(url: string): Promise<GLTF> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        resolve,
        undefined,
        (err) => {
          cache.delete(url);
          reject(err);
        },
      );
    });
    cache.set(url, pending);
  }
  return pending;
}

function cloneScene(src: Object3D): Object3D {
  const clone = src.clone(true);
  clone.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry = obj.geometry.clone();
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => m.clone());
    } else {
      obj.material = obj.material.clone();
    }
  });
  return clone;
}

/** Nose on −Z, length ~`targetLength` (game units). */
function normalizeWeapon(root: Object3D, targetLength = 1.45): void {
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  if (_box.isEmpty()) return;
  _box.getSize(_size);
  _box.getCenter(_center);
  root.position.sub(_center);
  const longest = Math.max(_size.x, _size.y, _size.z, 1e-4);
  const s = targetLength / longest;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  _box.getCenter(_center);
  root.position.sub(_center);
}

export async function createWeaponInstance(
  modelUrl: string,
  targetLength = 1.45,
): Promise<Group> {
  const gltf = await loadWeaponGltf(modelUrl);
  const wrap = new Group();
  wrap.name = "Weapon";
  const model = cloneScene(gltf.scene);
  normalizeWeapon(model, targetLength);
  wrap.add(model);
  return wrap;
}
