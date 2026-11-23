import {
  CONTROL_TOWER,
  DayClock,
  buildPlaces,
  controlTowerCeiling,
  nearbyPlaces,
  nearestPlace,
  sampleHeight,
  solidFloor,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import { Scene } from "three";
import { AirTraffic } from "./AirTraffic";
import { BuildingField } from "./BuildingField";
import { CityHlod } from "./CityHlod";
import { CloudField } from "./CloudField";
import { HorizonSilhouette } from "./HorizonSilhouette";
import { SkySystem } from "./SkySystem";
import { TerrainStreamer } from "./TerrainStreamer";
import { VegetationField } from "./VegetationField";
import { ControlTower } from "./ControlTower";
import { WaterSurface } from "./WaterSurface";

export interface RadarContact {
  x: number;
  y: number;
  z: number;
  /** Nearest ground POI / primary cue. */
  primary?: boolean;
}

export interface WorldFrameInfo {
  place: PlaceOfInterest | null;
  dayFactor: number;
  /** Free-flight / tourism radar contacts (POIs + traffic). */
  radarContacts: RadarContact[];
}

export class WorldSystem {
  readonly terrain = new TerrainStreamer();
  readonly buildings = new BuildingField();
  readonly cityHlod = new CityHlod();
  readonly vegetation = new VegetationField();
  readonly clouds = new CloudField();
  readonly traffic = new AirTraffic();
  readonly sky: SkySystem;
  readonly clock = new DayClock();
  readonly places = buildPlaces();
  readonly tower = new ControlTower();
  private readonly water: WaterSurface;
  private readonly horizon: HorizonSilhouette;
  private refreshAcc = 0;

  constructor(scene: Scene) {
    this.sky = new SkySystem(scene);
    this.terrain.bindSky(this.sky.haze);
    this.buildings.bindSky(this.sky.haze);
    this.cityHlod.bindSky(this.sky.haze);
    this.vegetation.bindSky(this.sky.haze);
    this.water = new WaterSurface(this.sky.haze);
    this.horizon = new HorizonSilhouette(this.sky.haze);

    this.tower.group.position.set(
      CONTROL_TOWER.x,
      sampleHeight(CONTROL_TOWER.x, CONTROL_TOWER.z),
      CONTROL_TOWER.z,
    );
    scene.add(this.horizon.mesh);
    scene.add(this.terrain.group);
    scene.add(this.tower.group);
    scene.add(this.cityHlod.mesh);
    scene.add(this.buildings.mesh);
    scene.add(this.vegetation.mesh);
    scene.add(this.vegetation.trunks);
    scene.add(this.clouds.group);
    scene.add(this.traffic.group);
    scene.add(this.water.mesh);
  }

  /** Terrain, and the control tower volume so the jet cannot fly through it. */
  sampleFloor = (x: number, z: number): number => {
    const ground = solidFloor(x, z);
    const pad = solidFloor(CONTROL_TOWER.x, CONTROL_TOWER.z);
    const top = controlTowerCeiling(x, z, pad);
    return top == null ? ground : Math.max(ground, top);
  };

  warm(wx: number, wz: number, motion?: StreamMotion): void {
    this.terrain.warm(wx, wz, 16, motion);
    this.buildings.update(wx, wz, true);
    this.cityHlod.update(wx, wz, true);
    this.vegetation.update(wx, wz, true);
    this.horizon.warm(wx, wz);
    this.sky.update(this.clock, wx, wz, 400);
    this.clouds.seed(wx, wz);
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    wy = 400,
    motion?: StreamMotion,
  ): WorldFrameInfo {
    this.clock.tick(dt);
    this.sky.update(this.clock, wx, wz, wy);
    this.terrain.update(wx, wz, motion);
    this.horizon.update(dt, wx, wz, this.clock.dayFactor);
    this.buildings.setDayFactor(this.clock.dayFactor);
    this.refreshAcc += dt;
    if (this.refreshAcc > 0.2) {
      this.refreshAcc = 0;
      this.buildings.update(wx, wz);
      this.cityHlod.update(wx, wz);
      this.vegetation.update(wx, wz);
    }
    this.clouds.update(dt, wx, wz, this.clock.dayFactor, this.clock.sunDir, {
      color: this.sky.fogTint,
      near: this.sky.fogNear,
      far: this.sky.fogFar,
    });
    this.traffic.update(dt, wx, wz);
    this.water.update(dt, wx, wz, this.clock.sunDir, this.clock.dayFactor);

    const near = nearbyPlaces(wx, wz, this.places, 3200, 8);
    const radarContacts: RadarContact[] = near.map((p, i) => ({
      x: p.x,
      y: sampleHeight(p.x, p.z) + (p.name === "Control Tower" ? 36 : 40),
      z: p.z,
      primary: i === 0,
    }));
    for (const t of this.traffic.contacts()) {
      radarContacts.push({ x: t.x, y: t.y, z: t.z });
    }

    return {
      place: nearestPlace(wx, wz, this.places),
      dayFactor: this.clock.dayFactor,
      radarContacts,
    };
  }

  dispose(): void {
    this.terrain.dispose();
    this.buildings.dispose();
    this.cityHlod.dispose();
    this.vegetation.dispose();
    this.clouds.dispose();
    this.traffic.dispose();
    this.sky.dispose();
    this.water.dispose();
    this.horizon.dispose();
    this.tower.dispose();
  }
}
