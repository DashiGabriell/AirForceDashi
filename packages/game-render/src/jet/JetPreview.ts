import { Aircraft } from "@afd/shared-types";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { attachFlightJet } from "./JetModel";

export interface JetPreviewHandle {
  setAircraft: (aircraft: Aircraft) => void;
  setSkin: (skinId: string) => void;
  dispose: () => void;
}

export function createJetPreview(
  canvas: HTMLCanvasElement,
  aircraft: Aircraft,
  skinId: string,
): JetPreviewHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.add(new AmbientLight(0xb7c4d2, 0.55));
  const key = new DirectionalLight(0xfff4e8, 2.4);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new DirectionalLight(0x9eb4c8, 1.1);
  rim.position.set(-6, 2, -4);
  scene.add(rim);

  const camera = new PerspectiveCamera(28, 1, 0.1, 80);
  camera.position.set(11, 3.2, 12);

  const pivot = new Group();
  scene.add(pivot);
  const jet = new Group();
  pivot.add(jet);

  let currentAircraft = aircraft;
  let currentSkin = skinId;
  let jetHandle = attachFlightJet(jet, currentAircraft, currentSkin);

  let yaw = 0.6;
  let dragging = false;
  let lastX = 0;
  let alive = true;

  const resize = () => {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 240;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

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
    if (!dragging) yaw += 0.004;
    pivot.rotation.y = yaw;
    camera.lookAt(0, 0.2, 0);
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
    },
    setSkin(next) {
      currentSkin = next;
      jetHandle.setSkin(currentSkin);
    },
    dispose() {
      alive = false;
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      jetHandle.dispose();
      renderer.dispose();
    },
  };
}
