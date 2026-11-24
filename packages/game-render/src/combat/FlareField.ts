import type { FlarePellet } from "@afd/game-core";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { MissileSmoke } from "./MissileSmoke";

const MAX = 24;

/** Hot IR pellets — additive glow spheres + soft smoke trail. */
export class FlareField {
  readonly group = new Group();
  private readonly geo = new SphereGeometry(1, 8, 6);
  private readonly matCore = new MeshBasicMaterial({
    color: new Color(0xffc14d),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly matHalo = new MeshBasicMaterial({
    color: new Color(0xff6a2a),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly cores: Mesh[] = [];
  private readonly halos: Mesh[] = [];
  private readonly smoke = new MissileSmoke(MAX);
  private smokeDt = 0;

  constructor() {
    this.group.add(this.smoke.mesh);
    for (let i = 0; i < MAX; i++) {
      const core = new Mesh(this.geo, this.matCore);
      const halo = new Mesh(this.geo, this.matHalo);
      core.visible = false;
      halo.visible = false;
      this.group.add(halo);
      this.group.add(core);
      this.cores.push(core);
      this.halos.push(halo);
    }
  }

  setViewOrigin(x: number, y: number, z: number): void {
    this.smoke.setViewOrigin(x, y, z);
  }

  sync(pellets: readonly FlarePellet[]): void {
    let i = 0;
    for (const p of pellets) {
      if (!p.active || i >= MAX) continue;
      const core = this.cores[i]!;
      const halo = this.halos[i]!;
      const lifeT = Math.min(1, p.life / 2.2);
      const s = 1.1 + (1 - lifeT) * 2.2;
      core.visible = true;
      halo.visible = true;
      core.position.set(p.x, p.y, p.z);
      halo.position.set(p.x, p.y, p.z);
      core.scale.setScalar(s);
      halo.scale.setScalar(s * 2.4);
      i++;
    }
    for (; i < MAX; i++) {
      this.cores[i]!.visible = false;
      this.halos[i]!.visible = false;
    }
    // Smoke tracks pellet slots by index (same pool order as CountermeasureSystem).
    this.smoke.sync(pellets as FlarePellet[], this.smokeDt);
    this.smokeDt = 0;
  }

  tick(dt: number): void {
    this.smokeDt += dt;
    this.smoke.tick(dt);
  }

  dispose(): void {
    this.group.remove(this.smoke.mesh);
    this.smoke.dispose();
    this.geo.dispose();
    this.matCore.dispose();
    this.matHalo.dispose();
  }
}
