import {
  DayClock,
  buildPlaces,
  nearestPlace,
  solidFloor,
  type PlaceOfInterest,
} from "@afd/game-core";
import { Scene } from "three";
import { AirTraffic } from "./AirTraffic";
import { BuildingField } from "./BuildingField";
import { CloudField } from "./CloudField";
import { HorizonSilhouette } from "./HorizonSilhouette";
import { SkySystem } from "./SkySystem";
import { TerrainStreamer } from "./TerrainStreamer";
import { VegetationField } from "./VegetationField";
import { WaterSurface } from "./WaterSurface";

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
  private readonly water: WaterSurface;
  private readonly horizon: HorizonSilhouette;
  private refreshAcc = 0;

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    this.terrain.bindSky(this.sky.haze);
    this.buildings.bindSky(this.sky.haze);
    this.vegetation.bindSky(this.sky.haze);
    this.water = new WaterSurface(this.sky.haze);
    this.horizon = new HorizonSilhouette(this.sky.haze);

    scene.add(this.horizon.mesh);
    scene.add(this.terrain.group);
    scene.add(this.buildings.mesh);
    scene.add(this.vegetation.mesh);
    scene.add(this.vegetation.trunks);
    scene.add(this.clouds.group);
    scene.add(this.traffic.group);
    scene.add(this.water.mesh);
  }

  /** Sample height for jet ground clamp. */
  sampleFloor = (x: number, z: number): number => solidFloor(x, z);

  warm(wx: number, wz: number): void {
    this.terrain.warm(wx, wz, 16);
    this.buildings.update(wx, wz, true);
    this.vegetation.update(wx, wz, true);
    this.horizon.warm(wx, wz);
    this.sky.update(this.clock, wx, wz, 400);
    this.clouds.seed(wx, wz);
  }

  update(dt: number, wx: number, wz: number, wy = 400): WorldFrameInfo {
    this.clock.tick(dt);
    this.sky.update(this.clock, wx, wz, wy);
    this.terrain.update(wx, wz);
    this.horizon.update(dt, wx, wz, this.clock.dayFactor);
    this.buildings.setDayFactor(this.clock.dayFactor);
    this.refreshAcc += dt;
    if (this.refreshAcc > 0.2) {
      this.refreshAcc = 0;
      this.buildings.update(wx, wz);
      this.vegetation.update(wx, wz);
    }
    this.clouds.update(dt, wx, wz, this.clock.dayFactor, this.clock.sunDir, {
      color: this.sky.fogTint,
      near: this.sky.fogNear,
      far: this.sky.fogFar,
    });
    this.traffic.update(dt, wx, wz);
    this.water.update(dt, wx, wz, this.clock.sunDir, this.clock.dayFactor);

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
    this.water.dispose();
    this.horizon.dispose();
  }
}
