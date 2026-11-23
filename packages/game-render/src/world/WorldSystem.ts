import {
  AIRBASE,
  CONTROL_TOWER,
  DayClock,
  airbaseCeiling,
  buildPlaces,
  controlTowerCeiling,
  nearestPlace,
  sampleHeight,
  solidFloor,
  type DayPhase,
  type PlaceOfInterest,
  type StreamMotion,
} from "@afd/game-core";
import { Scene } from "three";
import { AirbaseComplex } from "./AirbaseComplex";
import { AirTraffic } from "./AirTraffic";
import { BuildingField } from "./BuildingField";
import { CityHlod } from "./CityHlod";
import { CloudField } from "./CloudField";
import { ControlTower } from "./ControlTower";
import { HorizonSilhouette } from "./HorizonSilhouette";
import { SkySystem } from "./SkySystem";
import { TerrainStreamer } from "./TerrainStreamer";
import { VegetationField } from "./VegetationField";
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
  /** Game hour 0..24 (1h = 1 real minute). */
  hour: number;
  phase: DayPhase;
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
  readonly airbase = new AirbaseComplex();
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
    this.airbase.group.position.set(
      AIRBASE.x,
      sampleHeight(AIRBASE.x, AIRBASE.z),
      AIRBASE.z,
    );
    scene.add(this.horizon.mesh);
    scene.add(this.terrain.group);
    scene.add(this.tower.group);
    scene.add(this.airbase.group);
    scene.add(this.cityHlod.mesh);
    scene.add(this.buildings.mesh);
    scene.add(this.vegetation.mesh);
    scene.add(this.vegetation.trunks);
    scene.add(this.clouds.group);
    scene.add(this.traffic.group);
    scene.add(this.water.mesh);
  }

  /** Terrain plus authored tower / airbase volumes. */
  sampleFloor = (x: number, z: number): number => {
    const ground = solidFloor(x, z);
    const towerPad = solidFloor(CONTROL_TOWER.x, CONTROL_TOWER.z);
    const towerTop = controlTowerCeiling(x, z, towerPad);
    const afbPad = solidFloor(AIRBASE.x, AIRBASE.z);
    const afbTop = airbaseCeiling(x, z, afbPad);
    let y = ground;
    if (towerTop != null) y = Math.max(y, towerTop);
    if (afbTop != null) y = Math.max(y, afbTop);
    return y;
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
    this.clouds.update(
      dt,
      wx,
      wz,
      this.clock.dayFactor,
      this.clock.sunDir,
      {
        color: this.sky.fogTint,
        near: this.sky.fogNear,
        far: this.sky.fogFar,
      },
      {
        phase: this.clock.phase,
        duskFactor: this.clock.duskFactor,
        dawnFactor: this.clock.dawnFactor,
      },
    );
    this.traffic.update(dt, wx, wz);
    this.water.update(dt, wx, wz, this.clock.sunDir, this.clock.dayFactor, wy);

    // Installations are drawn as terrain linework on the HUD radar — only
    // airborne traffic remains as blips.
    const radarContacts: RadarContact[] = [];
    for (const t of this.traffic.contacts()) {
      radarContacts.push({ x: t.x, y: t.y, z: t.z });
    }

    return {
      place: nearestPlace(wx, wz, this.places),
      dayFactor: this.clock.dayFactor,
      hour: this.clock.hour,
      phase: this.clock.phase,
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
    this.airbase.dispose();
  }
}
