import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";

export interface BootSceneHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  resize: (w: number, h: number) => void;
  render: (dt: number) => void;
  dispose: () => void;
}

/**
 * Empty cinematic clear — menu backdrop for M0.
 * Horizon-ish ground + soft fog; no world streaming yet.
 */
export function createBootScene(canvas: HTMLCanvasElement): BootSceneHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setClearColor(new Color(0x1a222c), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new Scene();
  scene.background = new Color(0x6a8aaa);
  scene.fog = new Fog(0x6a8aaa, 80, 420);

  const camera = new PerspectiveCamera(55, 1, 0.2, 4000);
  camera.position.set(18, 12, 28);
  camera.lookAt(0, 4, 0);

  const sun = new DirectionalLight(0xffe6c8, 1.35);
  sun.position.set(40, 80, 20);
  scene.add(sun);
  scene.add(new AmbientLight(0x8899aa, 0.45));

  const ground = new Mesh(
    new PlaneGeometry(800, 800, 1, 1),
    new MeshStandardMaterial({
      color: 0x3a4540,
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = 0;
  scene.add(ground);

  const grid = new GridHelper(200, 40, 0x55666a, 0x2e383c);
  grid.position.y = 0.02;
  scene.add(grid);

  // Soft “lake” disc
  const water = new Mesh(
    new PlaneGeometry(120, 80),
    new MeshStandardMaterial({
      color: 0x2a4a5c,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  water.rotation.x = -Math.PI * 0.5;
  water.position.set(-30, 0.05, -20);
  scene.add(water);

  let t = 0;

  const resize = (w: number, h: number) => {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = (dt: number) => {
    t += dt;
    camera.position.x = 18 + Math.sin(t * 0.12) * 2.5;
    camera.position.y = 12 + Math.sin(t * 0.09) * 0.6;
    camera.lookAt(0, 4 + Math.sin(t * 0.07) * 0.4, 0);
    renderer.render(scene, camera);
  };

  const dispose = () => {
    ground.geometry.dispose();
    (ground.material as MeshStandardMaterial).dispose();
    water.geometry.dispose();
    (water.material as MeshStandardMaterial).dispose();
    grid.geometry.dispose();
    renderer.dispose();
  };

  return { scene, camera, renderer, resize, render, dispose };
}
