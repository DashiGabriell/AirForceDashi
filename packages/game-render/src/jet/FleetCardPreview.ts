import { Aircraft } from "@afd/shared-types";
import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { attachFlightJet, type FlightJetHandle } from "./JetModel";

export interface FleetCardPreviewHandle {
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

interface Slot {
  id: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  aircraft: Aircraft;
  skinId: string;
  visible: boolean;
  scene: Scene;
  camera: PerspectiveCamera;
  pivot: Group;
  jetHandle: FlightJetHandle;
  yaw: number;
  w: number;
  h: number;
}

interface Host {
  renderer: WebGLRenderer;
  glCanvas: HTMLCanvasElement;
  slots: Map<number, Slot>;
  nextId: number;
  raf: number;
  alive: boolean;
}

let host: Host | null = null;

function ensureHost(): Host {
  if (host) return host;
  const glCanvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({
    canvas: glCanvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(1);

  const state: Host = {
    renderer,
    glCanvas,
    slots: new Map(),
    nextId: 1,
    raf: 0,
    alive: true,
  };
  host = state;

  const tick = () => {
    if (!host || !host.alive) return;
    for (const slot of host.slots.values()) {
      if (!slot.visible) continue;
      const rect = slot.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (w !== slot.w || h !== slot.h) {
        slot.w = w;
        slot.h = h;
        slot.canvas.width = w;
        slot.canvas.height = h;
        slot.camera.aspect = w / h;
        slot.camera.updateProjectionMatrix();
      }
      slot.yaw += 0.006;
      slot.pivot.rotation.y = slot.yaw;
      host.renderer.setSize(w, h, false);
      host.renderer.render(slot.scene, slot.camera);
      slot.ctx.clearRect(0, 0, w, h);
      slot.ctx.drawImage(host.glCanvas, 0, 0, w, h);
    }
    host.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
  return state;
}

function teardownHostIfEmpty(): void {
  if (!host || host.slots.size > 0) return;
  host.alive = false;
  cancelAnimationFrame(host.raf);
  host.renderer.dispose();
  host = null;
}

function makeScene(): { scene: Scene; camera: PerspectiveCamera; pivot: Group } {
  const scene = new Scene();
  scene.add(new AmbientLight(0xb7c4d2, 0.65));
  const key = new DirectionalLight(0xfff4e8, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);
  const rim = new DirectionalLight(0x9eb4c8, 1.05);
  rim.position.set(-5, 2, -3);
  scene.add(rim);

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(9.5, 2.8, 10.5);
  camera.lookAt(0, 0.15, 0);

  const pivot = new Group();
  scene.add(pivot);
  return { scene, camera, pivot };
}

/**
 * Mini preview 3D para cards da Frota.
 * Um único WebGLRenderer compartilhado faz blit para canvases 2D (evita limite de contextos).
 */
export function createFleetCardPreview(
  canvas: HTMLCanvasElement,
  aircraft: Aircraft,
  skinId = "factory",
): FleetCardPreviewHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { setVisible() {}, dispose() {} };
  }

  const h = ensureHost();
  const id = h.nextId++;
  const { scene, camera, pivot } = makeScene();
  const jet = new Group();
  pivot.add(jet);
  const jetHandle = attachFlightJet(jet, aircraft, skinId);

  const slot: Slot = {
    id,
    canvas,
    ctx,
    aircraft,
    skinId,
    visible: false,
    scene,
    camera,
    pivot,
    jetHandle,
    yaw: 0.55 + (id % 7) * 0.15,
    w: 0,
    h: 0,
  };
  h.slots.set(id, slot);

  return {
    setVisible(visible) {
      slot.visible = visible;
      if (!visible) {
        slot.ctx.clearRect(0, 0, slot.canvas.width, slot.canvas.height);
      }
    },
    dispose() {
      slot.jetHandle.dispose();
      h.slots.delete(id);
      teardownHostIfEmpty();
    },
  };
}
