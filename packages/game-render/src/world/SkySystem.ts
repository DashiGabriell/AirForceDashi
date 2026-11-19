import type { DayClock } from "@afd/game-core";
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Scene,
} from "three";

export class SkySystem {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  private fog: Fog;

  constructor(private scene: Scene) {
    this.sun = new DirectionalLight(0xffe6c8, 1.35);
    this.hemi = new HemisphereLight(0x9eb6d0, 0x3a4540, 0.55);
    this.fog = new Fog(0x6a8aaa, 500, 7000);
    scene.fog = this.fog;
    scene.background = new Color(0x6a8aaa);
    scene.add(this.sun);
    scene.add(this.hemi);
  }

  update(clock: DayClock): void {
    const d = clock.dayFactor;
    const dir = clock.sunDir;
    this.sun.position.set(dir.x * 200, dir.y * 200, dir.z * 200);
    this.sun.intensity = 0.25 + d * 1.2;
    this.hemi.intensity = 0.2 + d * 0.45;

    const day = new Color(0x6a8aaa);
    const dusk = new Color(0x3a2a45);
    const night = new Color(0x0a0e18);
    const sky = d > 0.35 ? day.clone().lerp(dusk, 1 - d) : dusk.clone().lerp(night, 1 - d / 0.35);
    this.scene.background = sky;
    this.fog.color.copy(sky);
    this.fog.near = 400 + (1 - d) * 200;
    this.fog.far = 5000 + d * 2500;
  }

  dispose(): void {
    this.scene.remove(this.sun);
    this.scene.remove(this.hemi);
    this.sun.dispose();
  }
}
