import { Aircraft } from "@afd/shared-types";
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

/** Low-poly fighter — nose = local −Z. */
export function createJetMesh(aircraft: Aircraft = Aircraft.F22_RAPTOR): Group {
  return aircraft === Aircraft.F15_EAGLE ? buildF15() : buildF22();
}

function makeHelpers() {
  const mat = (hex: number, opts?: { metal?: number; rough?: number }) =>
    new MeshStandardMaterial({
      name: "Paint",
      color: new Color(hex),
      metalness: opts?.metal ?? 0.35,
      roughness: opts?.rough ?? 0.55,
    });

  const addBox = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    rx = 0,
  ) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    if (rx) m.rotation.z = rx;
    parent.add(m);
    return m;
  };

  return { mat, addBox };
}

function addNozzles(root: Group, lx: number, rx: number, z: number): void {
  const glowMat = new MeshStandardMaterial({
    name: "Nozzle",
    color: 0x1c2026,
    emissive: 0x000000,
    emissiveIntensity: 0,
    metalness: 0.88,
    roughness: 0.32,
    side: DoubleSide,
  });
  const geo = new CylinderGeometry(0.2, 0.24, 0.32, 12, 1, true);
  geo.rotateX(Math.PI * 0.5);
  const nl = new Mesh(geo, glowMat);
  nl.position.set(lx, -0.08, z);
  nl.name = "nozzleL";
  root.add(nl);
  const nr = new Mesh(geo.clone(), glowMat.clone());
  nr.position.set(rx, -0.08, z);
  nr.name = "nozzleR";
  root.add(nr);
}

function buildF22(): Group {
  const root = new Group();
  root.name = "JetMeshF22";
  const { addBox } = makeHelpers();

  addBox(root, 1.48, 0.72, 5.6, 0, 0.04, -0.25, 0xb0bdc6);
  addBox(root, 1.18, 0.58, 2.0, 0, 0.02, -2.55, 0xd1e0e8);
  addBox(root, 0.78, 0.44, 1.45, 0, 0.06, -3.65, 0xd1e0e8);
  addBox(root, 0.42, 0.3, 0.58, 0, 0.05, -4.45, 0x858f99);
  addBox(root, 4.2, 0.12, 2.4, -2.6, 0.08, 0.1, 0x9aabb4);
  addBox(root, 4.2, 0.12, 2.4, 2.6, 0.08, 0.1, 0x9aabb4);
  addBox(root, 0.92, 0.55, 2.9, -0.58, -0.14, 1.95, 0x616b73);
  addBox(root, 0.92, 0.55, 2.9, 0.58, -0.14, 1.95, 0x616b73);
  addBox(root, 0.86, 0.4, 0.58, -0.58, -0.08, 3.48, 0x383c42);
  addBox(root, 0.86, 0.4, 0.58, 0.58, -0.08, 3.48, 0x383c42);
  addBox(root, 0.1, 1.72, 1.7, -0.88, 0.92, 2.55, 0xb0bdc6, 0.52);
  addBox(root, 0.1, 1.72, 1.7, 0.88, 0.92, 2.55, 0xb0bdc6, -0.52);

  const canopy = new Mesh(
    new SphereGeometry(0.48, 8, 6),
    new MeshStandardMaterial({
      color: 0x8c7a47,
      transparent: true,
      opacity: 0.78,
      metalness: 0.35,
      roughness: 0.15,
    }),
  );
  canopy.position.set(0, 0.5, -1.72);
  canopy.scale.set(0.88, 0.62, 1.55);
  root.add(canopy);
  addNozzles(root, -0.58, 0.58, 3.95);
  return root;
}

function buildF15(): Group {
  const root = new Group();
  root.name = "JetMeshF15";
  const { addBox } = makeHelpers();

  // Longer tube fuselage, high twin tails, broader wings
  addBox(root, 1.55, 0.85, 6.4, 0, 0.05, -0.1, 0xc4ccd2);
  addBox(root, 1.1, 0.65, 2.2, 0, 0.02, -2.9, 0xd8dee4);
  addBox(root, 0.7, 0.45, 1.4, 0, 0.05, -4.1, 0xa8b0b8);
  addBox(root, 5.4, 0.14, 2.8, -3.1, 0.05, 0.2, 0xb0b8c0);
  addBox(root, 5.4, 0.14, 2.8, 3.1, 0.05, 0.2, 0xb0b8c0);
  addBox(root, 1.0, 0.55, 3.2, -0.7, -0.12, 2.1, 0x555b63);
  addBox(root, 1.0, 0.55, 3.2, 0.7, -0.12, 2.1, 0x555b63);
  addBox(root, 0.12, 2.1, 1.6, -0.55, 1.15, 2.7, 0xc4ccd2);
  addBox(root, 0.12, 2.1, 1.6, 0.55, 1.15, 2.7, 0xc4ccd2);
  addBox(root, 3.2, 0.1, 1.1, 0, 0.05, 2.9, 0xa8b0b8);

  const canopy = new Mesh(
    new SphereGeometry(0.52, 8, 6),
    new MeshStandardMaterial({
      color: 0x3a5060,
      transparent: true,
      opacity: 0.75,
      metalness: 0.4,
      roughness: 0.12,
    }),
  );
  canopy.position.set(0, 0.55, -1.9);
  canopy.scale.set(0.9, 0.7, 1.7);
  root.add(canopy);
  addNozzles(root, -0.7, 0.7, 4.2);
  return root;
}

export function setJetAfterburner(root: Group, drive: boolean | number): void {
  const t = typeof drive === "number" ? Math.min(1, Math.max(0, drive)) : drive ? 1 : 0.12;
  for (const name of ["nozzleL", "nozzleR", "nozzleC"]) {
    const m = root.getObjectByName(name) as Mesh | undefined;
    if (!m) continue;
    const mat = m.material as MeshStandardMaterial;
    // Keep metal dark; heat lives in emissive only (soft inner glow).
    mat.color.setHex(0x1c2026);
    mat.emissive.setHex(t > 0.2 ? 0xff6a18 : 0x000000);
    mat.emissiveIntensity = t * 2.2;
  }
}

export function setJetExternalVisible(root: Group, visible: boolean): void {
  root.visible = visible;
}
