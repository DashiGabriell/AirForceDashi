import type {
  MetroBuilding,
  MetroBuildingKind,
  MetroSlab,
  MetroSlabKind,
} from "@afd/game-core";
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
  terminal: 0xc6d4e2,
  control: 0xf2f2f2,
  hangar: 0x9a9184,
  warehouse: 0xa39a8c,
  container: 0xc0392b,
  crane: 0xd9541e,
  ship: 0x3d4a5c,
  superstructure: 0xeeeeea,
  stadium: 0xd8d4cc,
  canopy: 0xf6f6f2,
  mast: 0x6d7178,
  resort: 0xf0e6d2,
};

/** Container stacks pick one of these by id, so the yard reads as mixed boxes. */
const CONTAINER_COLORS = [0xc0392b, 0x2e6fb5, 0xe67e22, 0x27ae60, 0x7f8c8d, 0xd4ac0d];

function buildingColor(b: MetroBuilding): number {
  if (b.kind !== "container") return KIND_COLOR[b.kind];
  let h = 0;
  for (let i = 0; i < b.id.length; i++) h = (Math.imul(h, 31) + b.id.charCodeAt(i)) | 0;
  return CONTAINER_COLORS[Math.abs(h) % CONTAINER_COLORS.length]!;
}

const SLAB_COLOR: Record<MetroSlabKind, number> = {
  runway: 0x3a3d42,
  taxiway: 0x55585e,
  apron: 0x8d9096,
  marking: 0xf4f4f0,
  pier: 0x7d7f84,
  pitch: 0x3f8f3a,
  sand: 0xe8d8a8,
  road: 0x4a4d52,
};

/** Default slab thickness above the ground. Markings stand proud of the runway. */
const SLAB_THICKNESS: Record<MetroSlabKind, number> = {
  runway: 1,
  taxiway: 0.8,
  apron: 0.6,
  marking: 1.3,
  pier: 4,
  pitch: 0.3,
  sand: 0.4,
  road: 0.5,
};

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  base: number;
  yaw?: number;
}

const UP = new Vector3(0, 1, 0);

function instancedBoxes<T extends Box>(
  name: string,
  items: readonly T[],
  material: MeshLambertMaterial,
  height: (item: T) => number,
  color: (item: T) => number,
): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const mesh = new InstancedMesh(geometry, material, Math.max(items.length, 1));
  mesh.name = name;
  mesh.count = items.length;

  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const tint = new Color();
  items.forEach((item, i) => {
    position.set(item.x, item.base, item.z);
    scale.set(item.w, height(item), item.d);
    rotation.setFromAxisAngle(UP, item.yaw ?? 0);
    mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
    mesh.setColorAt(i, tint.set(color(item)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** All blockout volumes in one instanced draw. Unit box with its base at y = 0. */
export function buildBlockoutMesh(buildings: readonly MetroBuilding[]): InstancedMesh {
  return instancedBoxes(
    "MetropolitanBlockout",
    buildings,
    new MeshLambertMaterial(),
    (b) => b.h,
    buildingColor,
  );
}

/**
 * Paved surfaces in one instanced draw. Polygon offset keeps them from
 * flickering against the terrain and against each other from far away.
 */
export function buildSlabMesh(
  name: string,
  slabs: readonly MetroSlab[],
  offset: number,
): InstancedMesh {
  return instancedBoxes(
    name,
    slabs,
    new MeshLambertMaterial({
      polygonOffset: true,
      polygonOffsetFactor: -offset,
      polygonOffsetUnits: -offset,
    }),
    (s) => s.h ?? SLAB_THICKNESS[s.kind],
    (s) => SLAB_COLOR[s.kind],
  );
}
