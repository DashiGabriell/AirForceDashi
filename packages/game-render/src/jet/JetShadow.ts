import {
  Box3,
  Color,
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

export interface JetPlanform {
  texture: WebGLRenderTarget["texture"];
  /** Largura da silhueta no eixo local X (asas), metros. */
  spanX: number;
  /** Comprimento no eixo local Z (cauda +Z, nariz −Z), metros. */
  spanZ: number;
  /** Centro da silhueta no espaço local do jato. */
  cx: number;
  cz: number;
  dispose: () => void;
}

const RES = 512;
const _box = new Box3();
const _size = new Vector3();
const _clear = new Color();

/**
 * Foto de cima da célula: branco no formato do avião, preto no resto.
 * A sombra usa o vermelho como alpha. O topo da textura é o nariz (−Z).
 */
export function bakeJetPlanform(
  renderer: WebGLRenderer,
  jetRoot: Object3D,
  skip: Object3D[] = [],
): JetPlanform | null {
  const savedAuto = jetRoot.matrixAutoUpdate;
  const savedMatrix = jetRoot.matrix.clone();
  const hidden = skip.map((obj) => obj.visible);
  for (const obj of skip) obj.visible = false;

  jetRoot.matrixAutoUpdate = true;
  jetRoot.position.set(0, 0, 0);
  jetRoot.quaternion.identity();
  jetRoot.scale.set(1, 1, 1);
  jetRoot.updateMatrixWorld(true);

  _box.setFromObject(jetRoot);
  _box.getSize(_size);
  if (_size.x < 0.2 || _size.z < 0.2) {
    restore();
    return null;
  }

  const cx = (_box.min.x + _box.max.x) * 0.5;
  const cz = (_box.min.z + _box.max.z) * 0.5;
  const halfX = _size.x * 0.5 * 1.08;
  const halfZ = _size.z * 0.5 * 1.08;

  const rt = new WebGLRenderTarget(RES, RES, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  rt.texture.generateMipmaps = false;
  rt.texture.minFilter = LinearFilter;
  rt.texture.magFilter = LinearFilter;

  const cam = new OrthographicCamera(-halfX, halfX, halfZ, -halfZ, 0.05, 80);
  cam.position.set(cx, 40, cz);
  cam.up.set(0, 0, -1);
  cam.lookAt(cx, 0, cz);
  cam.updateProjectionMatrix();

  const bakeScene = new Scene();
  const flat = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  bakeScene.overrideMaterial = flat;
  const parent = jetRoot.parent;
  bakeScene.add(jetRoot);

  const prevTarget = renderer.getRenderTarget();
  renderer.getClearColor(_clear);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, false);
  renderer.render(bakeScene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(_clear, prevAlpha);

  if (parent) parent.add(jetRoot);
  else bakeScene.remove(jetRoot);
  flat.dispose();
  restore();

  return {
    texture: rt.texture,
    spanX: halfX * 2,
    spanZ: halfZ * 2,
    cx,
    cz,
    dispose: () => rt.dispose(),
  };

  function restore(): void {
    for (let i = 0; i < skip.length; i++) {
      const obj = skip[i];
      if (obj) obj.visible = hidden[i] ?? true;
    }
    jetRoot.matrix.copy(savedMatrix);
    jetRoot.matrixAutoUpdate = savedAuto;
    jetRoot.updateMatrixWorld(true);
  }
}
