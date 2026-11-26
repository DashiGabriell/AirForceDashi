import type { MetroBuilding, MetroBuildingKind } from "@afd/game-core";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from "three";

/** Blockout colors per kind, so the categories read apart in the test. */
const KIND_COLOR: Record<MetroBuildingKind, number> = {
  icon: 0xe4e8ee,
  tower: 0x8fa9c4,
  mid: 0x8c9096,
  low: 0xb8aa92,
};

/** All blockout volumes in one instanced draw. Unit box with its base at y = 0. */
export function buildBlockoutMesh(buildings: readonly MetroBuilding[]): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const mesh = new InstancedMesh(
    geometry,
    new MeshLambertMaterial(),
    Math.max(buildings.length, 1),
  );
  mesh.name = "MetropolitanBlockout";
  mesh.count = buildings.length;

  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const color = new Color();
  buildings.forEach((b, i) => {
    position.set(b.x, b.base, b.z);
    scale.set(b.w, b.h, b.d);
    mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
    mesh.setColorAt(i, color.set(KIND_COLOR[b.kind]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
