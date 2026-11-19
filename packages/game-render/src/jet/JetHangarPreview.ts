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
  WebGLRenderer,
} from "three";
import { attachFlightJet, type FlightJetHandle } from "./JetModel";

export interface JetPreviewLook {
  skinId: string;
  emblemId?: string;
  effectId?: string;
}

export interface JetHangarPreviewHandle {
  setAircraft: (aircraft: Aircraft) => void;
  setSkin: (skinId: string) => void;
  setEmblem: (emblemId: string) => void;
  setEffect: (effectId: string) => void;
  dispose: () => void;
}

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

/** Hangar Equipar preview: F-22/F-15 + skin + emblem + effect on a red pad. */
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
  scene.add(new AmbientLight(0xb7c4d2, 0.55));
  const key = new DirectionalLight(0xfff4e8, 2.4);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new DirectionalLight(0x9eb4c8, 1.15);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const fill = new DirectionalLight(0xd11e24, 0.35);
  fill.position.set(0, 4, -6);
  scene.add(fill);

  const camera = new PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(10.5, 3.4, 11.5);

  const pivot = new Group();
  scene.add(pivot);
  const pad = makePad();
  pivot.add(pad);

  const jet = new Group();
  pivot.add(jet);
  const cosmetics = new Group();
  pivot.add(cosmetics);

  let currentAircraft = aircraft;
  let currentSkin = look.skinId;
  let currentEmblem = look.emblemId ?? "wing";
  let currentEffect = look.effectId ?? "trail_off";
  let jetHandle: FlightJetHandle = attachFlightJet(jet, currentAircraft, currentSkin);

  let emblemRoot = makeEmblemDecals(currentEmblem);
  cosmetics.add(emblemRoot);
  let emberRoot: Group | null = null;

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

  let yaw = 0.55;
  let dragging = false;
  let lastX = 0;
  let alive = true;
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
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onUp);

  const frame = () => {
    if (!alive) return;
    t += 0.016;
    if (!dragging) yaw += 0.0035;
    pivot.rotation.y = yaw;
    (pad.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 1.6) * 0.06;
    if (emberRoot) {
      syncNozzles();
      for (const child of emberRoot.children) {
        if (!(child instanceof Mesh)) continue;
        const mat = child.material as MeshBasicMaterial;
        mat.opacity = 0.35 + Math.sin(t * 9 + child.position.x) * 0.2;
      }
    }
    camera.lookAt(0, 0.15, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    setAircraft(next) {
      if (next === currentAircraft) return;
      currentAircraft = next;
      jetHandle.dispose();
      jetHandle = attachFlightJet(jet, currentAircraft, currentSkin);
      applyEffect();
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
    dispose() {
      alive = false;
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      jetHandle.dispose();
      disposeObject3D(emblemRoot);
      if (emberRoot) disposeObject3D(emberRoot);
      pad.geometry.dispose();
      (pad.material as MeshBasicMaterial).dispose();
      renderer.dispose();
    },
  };
}
