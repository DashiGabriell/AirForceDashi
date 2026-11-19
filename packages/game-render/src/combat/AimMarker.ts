import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";

/** Ground CCIP cross — Godot `AimMarker` (thin + arms, unshaded). */
export function createAimMarker(): {
  group: Group;
  setColor: (hex: number, opacity: number) => void;
  dispose: () => void;
} {
  const group = new Group();
  const mat = new MeshBasicMaterial({
    color: 0x59ff73,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false,
  });

  const bar = (sx: number, sy: number, sz: number) => {
    const geo = boxGeo(sx, sy, sz);
    const mesh = new Mesh(geo, mat);
    mesh.renderOrder = 10;
    group.add(mesh);
    return geo;
  };

  const g1 = bar(6, 0.08, 0.35);
  const g2 = bar(0.35, 0.08, 6);
  group.visible = false;

  return {
    group,
    setColor(hex, opacity) {
      mat.color.setHex(hex);
      mat.opacity = opacity;
    },
    dispose() {
      g1.dispose();
      g2.dispose();
      mat.dispose();
    },
  };
}

function boxGeo(sx: number, sy: number, sz: number): BufferGeometry {
  const hx = sx * 0.5;
  const hy = sy * 0.5;
  const hz = sz * 0.5;
  const y = 0.5;
  const positions = [
    -hx, y - hy, -hz, hx, y - hy, -hz, hx, y + hy, -hz, -hx, y + hy, -hz,
    -hx, y - hy, hz, hx, y - hy, hz, hx, y + hy, hz, -hx, y + hy, hz,
  ];
  const idx = [
    0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 1, 5, 6, 1, 6, 2, 3, 2,
    6, 3, 6, 7, 4, 5, 1, 4, 1, 0,
  ];
  const geo = new BufferGeometry();
  const verts: number[] = [];
  for (let i = 0; i < idx.length; i++) {
    const vi = idx[i]! * 3;
    verts.push(positions[vi]!, positions[vi + 1]!, positions[vi + 2]!);
  }
  geo.setAttribute("position", new Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}
