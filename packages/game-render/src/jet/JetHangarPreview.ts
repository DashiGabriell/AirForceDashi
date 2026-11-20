import { weaponById, type AircraftLoadout } from "@afd/game-core";
import { Aircraft } from "@afd/shared-types";
import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { createWeaponInstance } from "../combat/WeaponModel";
import { attachFlightJet, type FlightJetHandle } from "./JetModel";

export interface JetPreviewLook {
  skinId: string;
  emblemId?: string;
  effectId?: string;
  loadout?: AircraftLoadout;
}

export interface JetHangarPreviewHandle {
  setAircraft: (aircraft: Aircraft) => void;
  setSkin: (skinId: string) => void;
  setEmblem: (emblemId: string) => void;
  setEffect: (effectId: string) => void;
  setLoadout: (loadout: AircraftLoadout) => void;
  /** Destaca o modelo do armamento (null = volta para a aeronave). */
  focusWeapon: (weaponId: string | null) => void;
  dispose: () => void;
}

/** Estações externas visíveis (bay aberto / display hangar). */
const F22_AA_STATIONS = [
  { x: -2.05, y: -0.05, z: 0.55 },
  { x: 2.05, y: -0.05, z: 0.55 },
] as const;

const F22_AG_STATIONS = [
  { x: -0.55, y: -0.95, z: 0.35 },
  { x: 0.55, y: -0.95, z: 0.35 },
] as const;

const CAM_DIST_MIN = 5.5;
const CAM_DIST_MAX = 28;
const CAM_DIST_DEFAULT = 16.2;
const LOOK_AT = new Vector3(0, 0.2, 0);
const CAM_DIR = new Vector3(10.5, 3.4, 11.5).normalize();

function paintEmblem(kind: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 256, 256);
    g.translate(128, 128);
    g.fillStyle = "rgba(245,245,247,0.95)";
    g.strokeStyle = "rgba(209,30,36,0.95)";
    g.lineWidth = 10;
    if (kind === "signal") {
      g.beginPath();
      g.moveTo(0, -78);
      g.lineTo(70, 58);
      g.lineTo(-70, 58);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#d11e24";
      g.beginPath();
      g.arc(0, 8, 18, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(-90, 20);
      g.lineTo(0, -70);
      g.lineTo(90, 20);
      g.lineTo(58, 20);
      g.lineTo(0, -28);
      g.lineTo(-58, 20);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#d11e24";
      g.fillRect(-8, 28, 16, 42);
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function disposeObject3D(root: Group): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (mat instanceof MeshBasicMaterial) mat.map?.dispose();
      mat.dispose();
    }
  });
}

function makePad(): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(14, 14),
    new MeshBasicMaterial({
      color: 0xd11e24,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.15;
  return mesh;
}

function makeEmblemDecals(emblemId: string): Group {
  const root = new Group();
  root.name = "Emblems";
  const tex = paintEmblem(emblemId);
  const geo = new PlaneGeometry(1.15, 1.15);
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const left = new Mesh(geo, mat);
  left.position.set(-1.05, 0.35, -0.35);
  left.rotation.y = Math.PI / 2;
  const right = new Mesh(geo, mat.clone());
  (right.material as MeshBasicMaterial).map = tex;
  right.position.set(1.05, 0.35, -0.35);
  right.rotation.y = -Math.PI / 2;
  root.add(left, right);
  return root;
}

function makeEmberFx(): Group {
  const root = new Group();
  root.name = "EmberFx";
  const glowGeo = new PlaneGeometry(0.7, 1.6);
  const glowMat = new MeshBasicMaterial({
    color: 0xff6a18,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  for (const x of [-0.42, 0.42]) {
    const plume = new Mesh(glowGeo, glowMat.clone());
    plume.position.set(x, 0.02, 4.95);
    plume.rotation.x = Math.PI / 2;
    root.add(plume);
  }
  return root;
}

function placeCamera(camera: PerspectiveCamera, dist: number): void {
  camera.position.copy(CAM_DIR).multiplyScalar(dist);
  camera.lookAt(LOOK_AT);
}

/** Hangar Equipar preview: F-22/F-15 + skin + emblem + effect + loadout. */
export function createJetHangarPreview(
  canvas: HTMLCanvasElement,
  aircraft: Aircraft,
  look: JetPreviewLook,
): JetHangarPreviewHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMappingExposure = 1.08;

  const scene = new Scene();
  scene.add(new AmbientLight(0xb7c4d2, 0.7));
  const key = new DirectionalLight(0xfff4e8, 2.6);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new DirectionalLight(0x9eb4c8, 1.35);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const fill = new DirectionalLight(0xd11e24, 0.4);
  fill.position.set(0, 4, -6);
  scene.add(fill);
  const under = new DirectionalLight(0xffffff, 0.55);
  under.position.set(0, -4, 2);
  scene.add(under);

  const camera = new PerspectiveCamera(30, 1, 0.1, 80);
  let camDist = CAM_DIST_DEFAULT;
  placeCamera(camera, camDist);

  const pivot = new Group();
  scene.add(pivot);
  const pad = makePad();
  pivot.add(pad);

  const jet = new Group();
  pivot.add(jet);
  const cosmetics = new Group();
  pivot.add(cosmetics);
  const weaponsRoot = new Group();
  weaponsRoot.name = "Loadout";
  jet.add(weaponsRoot);

  const inspectRoot = new Group();
  inspectRoot.name = "WeaponInspect";
  inspectRoot.visible = false;
  pivot.add(inspectRoot);

  let currentAircraft = aircraft;
  let currentSkin = look.skinId;
  let currentEmblem = look.emblemId ?? "wing";
  let currentEffect = look.effectId ?? "trail_off";
  let currentLoadout: AircraftLoadout = look.loadout ?? {
    aaWeaponId: "",
    agWeaponId: "",
  };
  let focusedWeaponId: string | null = null;
  let loadoutGen = 0;
  let inspectGen = 0;
  let alive = true;
  let jetHandle: FlightJetHandle = attachFlightJet(jet, currentAircraft, currentSkin);

  let emblemRoot = makeEmblemDecals(currentEmblem);
  cosmetics.add(emblemRoot);
  let emberRoot: Group | null = null;

  const clearGroup = (root: Group) => {
    while (root.children.length) {
      const child = root.children[0]!;
      root.remove(child);
      disposeObject3D(child as Group);
    }
  };

  const clearWeapons = () => clearGroup(weaponsRoot);
  const clearInspect = () => clearGroup(inspectRoot);

  const syncModeVisibility = () => {
    const inspecting = Boolean(focusedWeaponId);
    jet.visible = !inspecting;
    cosmetics.visible = !inspecting;
    pad.visible = !inspecting;
    inspectRoot.visible = inspecting;
  };

  const mountStations = async (
    weaponId: string,
    stations: readonly { x: number; y: number; z: number }[],
    gen: number,
    length = 1.85,
  ) => {
    const def = weaponById(weaponId);
    if (!def) return;
    try {
      const proto = await createWeaponInstance(def.modelUrl, length);
      if (gen !== loadoutGen || !alive) {
        disposeObject3D(proto);
        return;
      }
      for (let i = 0; i < stations.length; i++) {
        const station = stations[i]!;
        const inst = i === 0 ? proto : proto.clone(true);
        if (i > 0) {
          inst.traverse((obj) => {
            if (!(obj instanceof Mesh)) return;
            obj.geometry = obj.geometry.clone();
            if (Array.isArray(obj.material)) {
              obj.material = obj.material.map((m) => m.clone());
            } else {
              obj.material = obj.material.clone();
            }
          });
        }
        inst.position.set(station.x, station.y, station.z);
        weaponsRoot.add(inst);
      }
    } catch {
      /* modelo ausente — preview segue sem o rack */
    }
  };

  const applyLoadout = () => {
    const gen = ++loadoutGen;
    clearWeapons();
    if (currentAircraft !== Aircraft.F22_RAPTOR) return;
    void mountStations(currentLoadout.aaWeaponId, F22_AA_STATIONS, gen, 1.85);
    void mountStations(currentLoadout.agWeaponId, F22_AG_STATIONS, gen, 2.05);
  };

  const applyInspect = () => {
    const gen = ++inspectGen;
    clearInspect();
    syncModeVisibility();
    if (!focusedWeaponId) return;
    const def = weaponById(focusedWeaponId);
    if (!def) {
      focusedWeaponId = null;
      syncModeVisibility();
      return;
    }
    void createWeaponInstance(def.modelUrl, 4.6)
      .then((inst) => {
        if (gen !== inspectGen || !alive) {
          disposeObject3D(inst);
          return;
        }
        inst.position.set(0, 0.35, 0);
        inspectRoot.add(inst);
      })
      .catch(() => {
        /* ignore */
      });
  };

  const syncNozzles = () => {
    for (const name of ["nozzleL", "nozzleR"]) {
      const m = jet.getObjectByName(name) as Mesh | undefined;
      if (!m) continue;
      const mat = m.material as MeshStandardMaterial;
      if (!mat?.emissive) continue;
      mat.emissiveIntensity = currentEffect === "ember" ? 2.8 : 0.18;
      mat.needsUpdate = true;
    }
  };

  const applyEffect = () => {
    if (emberRoot) {
      cosmetics.remove(emberRoot);
      disposeObject3D(emberRoot);
      emberRoot = null;
    }
    syncNozzles();
    if (currentEffect === "ember") {
      emberRoot = makeEmberFx();
      cosmetics.add(emberRoot);
    }
  };

  const applyEmblem = () => {
    cosmetics.remove(emblemRoot);
    disposeObject3D(emblemRoot);
    emblemRoot = makeEmblemDecals(currentEmblem);
    cosmetics.add(emblemRoot);
  };

  applyEffect();
  applyLoadout();
  syncModeVisibility();

  let yaw = 0.55;
  let dragging = false;
  let lastX = 0;
  let t = 0;

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth || 640);
    const h = Math.max(1, canvas.clientHeight || 240);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement ?? canvas);

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  };
  const onUp = () => {
    dragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * Math.min(2.4, Math.abs(e.deltaY) * 0.02);
    camDist = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, camDist + delta));
    placeCamera(camera, camDist);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const frame = () => {
    if (!alive) return;
    t += 0.016;
    if (!dragging) yaw += focusedWeaponId ? 0.008 : 0.0035;
    pivot.rotation.y = yaw;
    (pad.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 1.6) * 0.06;
    if (emberRoot && !focusedWeaponId) {
      syncNozzles();
      for (const child of emberRoot.children) {
        if (!(child instanceof Mesh)) continue;
        const mat = child.material as MeshBasicMaterial;
        mat.opacity = 0.35 + Math.sin(t * 9 + child.position.x) * 0.2;
      }
    }
    if (focusedWeaponId && inspectRoot.children[0]) {
      inspectRoot.children[0].rotation.y = Math.sin(t * 0.7) * 0.12;
      inspectRoot.children[0].position.y = 0.35 + Math.sin(t * 1.4) * 0.06;
    }
    placeCamera(camera, camDist);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    setAircraft(next) {
      if (next === currentAircraft) return;
      currentAircraft = next;
      focusedWeaponId = null;
      jetHandle.dispose();
      jetHandle = attachFlightJet(jet, currentAircraft, currentSkin);
      applyEffect();
      applyLoadout();
      applyInspect();
    },
    setSkin(next) {
      currentSkin = next;
      jetHandle.setSkin(currentSkin);
    },
    setEmblem(next) {
      if (next === currentEmblem) return;
      currentEmblem = next;
      applyEmblem();
    },
    setEffect(next) {
      if (next === currentEffect) return;
      currentEffect = next;
      applyEffect();
    },
    setLoadout(next) {
      if (
        next.aaWeaponId === currentLoadout.aaWeaponId &&
        next.agWeaponId === currentLoadout.agWeaponId
      ) {
        return;
      }
      currentLoadout = { ...next };
      applyLoadout();
    },
    focusWeapon(weaponId) {
      const next = weaponId && weaponById(weaponId) ? weaponId : null;
      if (next === focusedWeaponId) return;
      focusedWeaponId = next;
      if (next) {
        camDist = Math.min(camDist, 12);
      } else {
        camDist = CAM_DIST_DEFAULT;
      }
      applyInspect();
    },
    dispose() {
      alive = false;
      loadoutGen += 1;
      inspectGen += 1;
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("wheel", onWheel);
      jetHandle.dispose();
      clearWeapons();
      clearInspect();
      disposeObject3D(emblemRoot);
      if (emberRoot) disposeObject3D(emberRoot);
      pad.geometry.dispose();
      (pad.material as MeshBasicMaterial).dispose();
      renderer.dispose();
    },
  };
}
