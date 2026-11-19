import {
  DayClock,
  WATER_LEVEL,
  buildPlaces,
  nearestPlace,
  solidFloor,
  type PlaceOfInterest,
} from "@afd/game-core";
import {
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { AirTraffic } from "./AirTraffic";
import { BuildingField } from "./BuildingField";
import { CloudField } from "./CloudField";
import { SkySystem } from "./SkySystem";
import { TerrainStreamer } from "./TerrainStreamer";
import { VegetationField } from "./VegetationField";

export interface WorldFrameInfo {
  place: PlaceOfInterest | null;
  dayFactor: number;
}

export class WorldSystem {
  readonly terrain = new TerrainStreamer();
  readonly buildings = new BuildingField();
  readonly vegetation = new VegetationField();
  readonly clouds = new CloudField();
  readonly traffic = new AirTraffic();
  readonly sky: SkySystem;
  readonly clock = new DayClock();
  readonly places = buildPlaces();
  private water: Mesh;
  private refreshAcc = 0;

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    scene.add(this.terrain.group);
    scene.add(this.buildings.mesh);
    scene.add(this.vegetation.mesh);
    scene.add(this.clouds.group);
    scene.add(this.traffic.group);

    this.water = new Mesh(
      new PlaneGeometry(WORLD_WATER, WORLD_WATER),
      new MeshStandardMaterial({
        color: 0x2a4a5c,
        roughness: 0.28,
        metalness: 0.15,
        transparent: true,
        opacity: 0.92,
      }),
    );
    this.water.rotation.x = -Math.PI * 0.5;
    this.water.position.y = WATER_LEVEL + 0.2;
    scene.add(this.water);
  }

  /** Sample height for jet ground clamp. */
  sampleFloor = (x: number, z: number): number => solidFloor(x, z);

  warm(wx: number, wz: number): void {
    this.terrain.warm(wx, wz, 16);
    this.buildings.update(wx, wz, true);
    this.vegetation.update(wx, wz, true);
    this.sky.update(this.clock);
  }

  update(dt: number, wx: number, wz: number): WorldFrameInfo {
    this.clock.tick(dt);
    this.sky.update(this.clock);
    this.terrain.update(wx, wz);
    this.refreshAcc += dt;
    if (this.refreshAcc > 0.2) {
      this.refreshAcc = 0;
      this.buildings.update(wx, wz);
      this.vegetation.update(wx, wz);
    }
    this.clouds.update(wx, wz, this.clock.dayFactor);
    this.traffic.update(dt, wx, wz);
    this.water.position.x = wx;
    this.water.position.z = wz;

    return {
      place: nearestPlace(wx, wz, this.places),
      dayFactor: this.clock.dayFactor,
    };
  }

  dispose(): void {
    this.terrain.dispose();
    this.buildings.dispose();
    this.vegetation.dispose();
    this.clouds.dispose();
    this.traffic.dispose();
    this.sky.dispose();
    this.water.geometry.dispose();
    (this.water.material as MeshStandardMaterial).dispose();
  }
}

const WORLD_WATER = 12000;
