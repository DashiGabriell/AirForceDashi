import {
  Aircraft,
  AntiDroneCourse,
  AttackCourse,
  Cam,
  CheckpointCourse,
  JetSimulation,
  MissileSystem,
  PlayMode,
  MAP_SPAWN,
  WATER_LEVEL,
  Vec3,
  CONTROL_TOWER,
  buildingHitQuery,
  controlTowerAabb,
  cycleCamera,
  internalHeightForQuality,
  resolveLoadoutPerformance,
  sampleAim,
  sampleHeight,
  viewCamera,
  weaponById,
  type AimSample,
  type AntiDroneState,
  type AttackState,
  type CheckpointState,
  type FlightInput,
  type GameSession,
  type JetTelemetry,
  type PlaceOfInterest,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { AdaptiveScale } from "./AdaptiveScale";
import { FlightCamera } from "./cameras/FlightCamera";
import { createAimMarker } from "./combat/AimMarker";
import { DebrisField } from "./combat/DebrisField";
import { MissileFx } from "./combat/MissileFx";
import { ExhaustFx } from "./jet/ExhaustFx";
import { setJetAfterburner, setJetExternalVisible } from "./jet/JetMesh";
import { attachFlightJet } from "./jet/JetModel";
import { DestructibleField } from "./missions/DestructibleField";
import { DroneField } from "./missions/DroneField";
import { RingField } from "./missions/RingField";
import { TrailPool } from "./trails/TrailPool";
import { WorldSystem } from "./world/WorldSystem";

/** Pose do jato para radar / cues em heading-up (eixos = Basis local). */
export interface JetPose {
  x: number;
  y: number;
  z: number;
  /** Basis.x (direita) */
  rx: number;
  ry: number;
  rz: number;
  /** Basis.y (cima) */
  ux: number;
  uy: number;
  uz: number;
  /** Basis.z (traseira; nariz = -Z) */
  bx: number;
  by: number;
  bz: number;
}

export type FlightSfxEvent =
  | "missile"
  | "boom"
  | "boom_water"
  | "roll"
  | "checkpoint_ok"
  | "level_clear";

/** Screen-space CCIP / FPM / bore — CSS pixels relative to canvas. */
export interface AimHudState {
  valid: boolean;
  ready: boolean;
  inDlz: boolean;
  range: number;
  /** Hide ground CCIP + A/G pipper (CheckPoint race). */
  raceMode: boolean;
  aim: { x: number; y: number; on: boolean };
  fpm: { x: number; y: number; on: boolean };
  bore: { x: number; y: number; on: boolean };
}

export interface RadarHudContact {
  x: number;
  y: number;
  z: number;
  primary?: boolean;
}

export interface FlightFrameState {
  telemetry: JetTelemetry;
  session: GameSession;
  view: Cam;
  /** Segurando Q — órbita próxima do jato. */
  inspecting: boolean;
  place: PlaceOfInterest | null;
  dayFactor: number;
  missilesReady: number;
  aim: AimSample | null;
  aimHud: AimHudState | null;
  jet: JetPose;
  sfx: FlightSfxEvent[];
  /** Free-flight radar blips (POIs + traffic). */
  radarContacts: RadarHudContact[];
  checkpoint: CheckpointState | null;
  antidrone: AntiDroneState | null;
  attack: AttackState | null;
}

export interface FlightSceneOptions {
  quality?: QualityProfile;
  mouseSens?: number;
  /** Livrea do material Paint. Default: factory. */
  skinId?: string;
  /** ID do armamento AA equipado (visual do míssil em voo). */
  aaWeaponId?: string;
  /** ID do armamento AG equipado (reservado para modo A/G). */
  agWeaponId?: string;
}

export interface FlightVfxStats {
  particles: number;
  booms: number;
  dropped: number;
}

export interface FlightSceneHandle {
  resize: (w: number, h: number) => void;
  tick: (dt: number, input: FlightInput) => FlightFrameState;
  setPaused: (paused: boolean) => void;
  dispose: () => void;
  renderer: WebGLRenderer;
  vfxStats: () => FlightVfxStats;
  /** Current adaptive internal-resolution scale (0.6–1). */
  adaptiveScale: () => number;
}

export function createFlightScene(
  canvas: HTMLCanvasElement,
  session: GameSession,
  options: FlightSceneOptions = {},
): FlightSceneHandle {
  const quality = options.quality ?? "medium";
  const mouseSens = options.mouseSens ?? 1;
  const baseInternalH = internalHeightForQuality(quality);
  const adaptive = new AdaptiveScale();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setClearColor(new Color(0x1a222c), 1);
  renderer.autoClear = true;
  renderer.setPixelRatio(1);

  const scene = new Scene();
  const world = new WorldSystem(scene);

  const spawnX = MAP_SPAWN.x;
  const spawnZ = MAP_SPAWN.z;
  const groundY = sampleHeight(spawnX, spawnZ);
  let spawnY = Math.max(groundY, WATER_LEVEL) + 280;
  let heading = MAP_SPAWN.heading;

  if (session.playMode === PlayMode.CHECKPOINT) {
    spawnY = groundY + 280;
  } else if (session.playMode === PlayMode.ANTI_DRONE) {
    spawnY = groundY + 400;
  } else if (session.playMode === PlayMode.ATTACK) {
    spawnY = groundY + 360;
  }

  const aircraft = session.aircraft ?? Aircraft.F22_RAPTOR;

  const jetRoot = new Group();
  jetRoot.name = "JetRoot";
  const flightJet = attachFlightJet(
    jetRoot,
    aircraft,
    options.skinId ?? "factory",
  );
  scene.add(jetRoot);

  const shadow = new Mesh(
    new PlaneGeometry(10, 14),
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI * 0.5;
  scene.add(shadow);

  const abTrails = new TrailPool(2, 36, 0xffa040, 0.55);
  const contrails = new TrailPool(2, 64, 0xddeeff, 0.45);
  scene.add(abTrails.group);
  scene.add(contrails.group);
  const abL = abTrails.acquire();
  const abR = abTrails.acquire();
  const ctL = contrails.acquire();
  const ctR = contrails.acquire();
  const exhaust = new ExhaustFx(aircraft);
  jetRoot.add(exhaust.group);

  const loadoutPerf = resolveLoadoutPerformance(aircraft, {
    aaWeaponId: options.aaWeaponId ?? "",
    agWeaponId: options.agWeaponId ?? "",
  });
  const combatProfile =
    session.playMode === PlayMode.ATTACK
      ? loadoutPerf.agCombat
      : loadoutPerf.aaCombat;
  const fxWeapon =
    session.playMode === PlayMode.ATTACK
      ? loadoutPerf.ag ?? loadoutPerf.aa
      : loadoutPerf.aa ?? weaponById(options.aaWeaponId ?? "aim-9-sidewinder");

  const missileFx = new MissileFx(12, quality);
  scene.add(missileFx.group);
  missileFx.setModelUrl(fxWeapon?.modelUrl ?? null);
  const debris = new DebrisField();
  scene.add(debris.group);
  const missiles = new MissileSystem();
  missiles.setProfile(combatProfile);

  const aimFx = createAimMarker();
  scene.add(aimFx.group);
  const projectTmp = new Vector3();
  let aimHud: AimHudState | null = null;

  const rings = new RingField();
  scene.add(rings.group);
  const drones = new DroneField();
  scene.add(drones.group);
  const destructibles = new DestructibleField();
  scene.add(destructibles.group);

  const checkpoint =
    session.playMode === PlayMode.CHECKPOINT ? new CheckpointCourse() : null;
  const antidrone =
    session.playMode === PlayMode.ANTI_DRONE ? new AntiDroneCourse() : null;
  const attack =
    session.playMode === PlayMode.ATTACK ? new AttackCourse() : null;

  const jet = new JetSimulation();
  jet.setHandling(loadoutPerf.handling);
  jet.setGroundSampler(world.sampleFloor);
  jet.resetPose(
    new Vec3(spawnX, spawnY, spawnZ),
    heading,
    jet.getHandling().baseSpeed,
  );
  world.warm(spawnX, spawnZ, {
    vx: jet.velocity.x,
    vz: jet.velocity.z,
    altitude: spawnY - groundY,
  });

  if (checkpoint) {
    checkpoint.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
      world.sampleFloor,
    );
    rings.setGates(checkpoint.state.gates);
  }
  if (antidrone) {
    antidrone.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
    );
  }
  if (attack) {
    attack.start(
      session.missionLevel,
      { x: spawnX, y: spawnY, z: spawnZ },
      heading,
    );
    for (const t of attack.state.targets) {
      world.buildings.hideBuilding(t.buildingId);
    }
    destructibles.sync(attack.state.targets);
  }

  const flightCam = new FlightCamera();
  flightCam.setMode(session.cameraMode);
  const fwdX = -Math.sin(heading);
  const fwdZ = -Math.cos(heading);
  flightCam.chasePivot.set(spawnX - fwdX * 18, spawnY + 5, spawnZ - fwdZ * 18);
  flightCam.lookAhead.set(spawnX + fwdX * 24, spawnY, spawnZ + fwdZ * 24);

  let cssW = 1;
  let cssH = 1;
  let rt: WebGLRenderTarget | null = null;
  const quadScene = new Scene();
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMat = new MeshBasicMaterial({ depthTest: false, depthWrite: false });
  const quad = new Mesh(new PlaneGeometry(2, 2), quadMat);
  quadScene.add(quad);

  const worldNozzle = new Vector3();
  let place: PlaceOfInterest | null = null;
  let dayFactor = 1;
  let aim: AimSample | null = null;
  let radarContacts: RadarHudContact[] = [];

  const projectWorld = (
    wx: number,
    wy: number,
    wz: number,
  ): { x: number; y: number; on: boolean } => {
    projectTmp.set(wx, wy, wz).project(flightCam.camera);
    const on =
      projectTmp.z > -1 &&
      projectTmp.z < 1 &&
      Math.abs(projectTmp.x) <= 1.15 &&
      Math.abs(projectTmp.y) <= 1.15;
    return {
      x: (projectTmp.x * 0.5 + 0.5) * cssW,
      y: (-projectTmp.y * 0.5 + 0.5) * cssH,
      on: on && projectTmp.x >= -1 && projectTmp.x <= 1 && projectTmp.y >= -1 && projectTmp.y <= 1,
    };
  };

  const rebuildRt = (w: number, h: number) => {
    const aspect = w / Math.max(1, h);
    const ih = Math.max(180, Math.round(baseInternalH * adaptive.scale));
    const iw = Math.max(2, Math.round(ih * aspect));
    if (rt) rt.dispose();
    rt = new WebGLRenderTarget(iw, ih, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });
    quadMat.map = rt.texture;
    quadMat.needsUpdate = true;
    flightCam.camera.aspect = aspect;
    flightCam.camera.updateProjectionMatrix();
  };

  const resize = (w: number, h: number) => {
    cssW = Math.max(1, w);
    cssH = Math.max(1, h);
    renderer.setSize(cssW, cssH, false);
    rebuildRt(cssW, cssH);
  };

  let telemetry: JetTelemetry = jet.tickTelemetry(1 / 60);
  let trailAcc = 0;
  let frameSfx: FlightSfxEvent[] = [];
  let prevCpRing = checkpoint?.state.ringIndex ?? 0;
  let prevCpStatus = checkpoint?.state.status ?? "IDLE";
  let prevAdKills = antidrone?.state.kills ?? 0;
  let prevAdStatus = antidrone?.state.status ?? "IDLE";
  let prevAtDestroyed = attack?.state.destroyed ?? 0;
  let prevAtStatus = attack?.state.status ?? "IDLE";

  const nozzleWorld = (localX: number, localY: number, localZ: number) => {
    const b = jet.basis;
    const p = jet.position;
    worldNozzle.set(
      p.x + b.x.x * localX + b.y.x * localY + b.z.x * localZ,
      p.y + b.x.y * localX + b.y.y * localY + b.z.y * localZ,
      p.z + b.x.z * localX + b.y.z * localY + b.z.z * localZ,
    );
    return worldNozzle;
  };

  const pushBoom = (y: number) => {
    frameSfx.push(y <= WATER_LEVEL + 4 ? "boom_water" : "boom");
  };

  /** Classifica impacto: água / solo / ar (para VFX distinto). */
  const resolveBoomSurface = (
    x: number,
    y: number,
    z: number,
  ): "air" | "ground" | "water" => {
    const floor = world.sampleFloor(x, z);
    if (y <= WATER_LEVEL + 3.5 && floor <= WATER_LEVEL + 1.5) return "water";
    if (y <= floor + 3.5) return "ground";
    return "air";
  };

  const detonate = (x: number, y: number, z: number) => {
    let sx = x;
    let sy = y;
    let sz = z;
    const surface = resolveBoomSurface(sx, sy, sz);
    if (surface === "ground") sy = world.sampleFloor(sx, sz) + 0.55;
    else if (surface === "water") sy = WATER_LEVEL + 0.45;
    missileFx.boom(sx, sy, sz, surface);
    pushBoom(sy);
  };

  const tick = (dt: number, input: FlightInput): FlightFrameState => {
    frameSfx = [];
    if (input.pause) session.paused = !session.paused;

    if (session.paused) {
      flightCam.setInspect(false);
      renderFrame();
      return frameState();
    }

    const camTarget = {
      position: jet.position,
      basis: jet.basis,
      telemetry,
    };
    const wantInspect =
      input.inspectHold && session.cameraMode !== Cam.FREE && !session.paused;

    if (input.cycleCamera && !wantInspect) {
      cycleCamera(session);
      if (session.cameraMode === Cam.FREE) {
        flightCam.enterFree(camTarget);
      } else {
        flightCam.setMode(session.cameraMode);
      }
    }
    session.lookBackHold = input.lookBack && !wantInspect;

    const missionOver =
      (checkpoint && checkpoint.state.status !== "RUN" && checkpoint.state.status !== "IDLE") ||
      (antidrone && antidrone.state.status !== "RUN" && antidrone.state.status !== "IDLE") ||
      (attack && attack.state.status !== "RUN" && attack.state.status !== "IDLE");

    if (session.cameraMode === Cam.FREE) {
      flightCam.setInspect(false);
      flightCam.update(
        dt,
        Cam.FREE,
        camTarget,
        {
          x: input.bank,
          y: (input.freeUp ? 1 : 0) - (input.freeDown ? 1 : 0),
          z: -input.pitch,
          boost: input.freeBoost,
        },
        {
          dx: input.mouseDx * mouseSens,
          dy: input.mouseDy * mouseSens,
          wheel: input.wheel,
        },
      );
    } else if (
      !missionOver ||
      checkpoint?.state.status === "RUN" ||
      antidrone?.state.status === "RUN" ||
      attack?.state.status === "RUN"
    ) {
      jet.updateInput(dt, input.bank, input.pitch, input.afterburner);
      if (input.barrelRoll && !wantInspect) {
        jet.triggerBarrelRoll();
        frameSfx.push("roll");
      }
      jet.integrate(dt);
      telemetry = jet.tickTelemetry(dt);
      const liveTarget = {
        position: jet.position,
        basis: jet.basis,
        telemetry,
      };
      flightCam.setInspect(wantInspect, liveTarget);
      flightCam.update(
        dt,
        viewCamera(session),
        liveTarget,
        undefined,
        wantInspect
          ? {
              dx: input.mouseDx * mouseSens,
              dy: input.mouseDy * mouseSens,
              wheel: input.wheel,
            }
          : undefined,
      );
    } else {
      flightCam.setInspect(wantInspect, camTarget);
      flightCam.update(
        dt,
        viewCamera(session),
        { position: jet.position, basis: jet.basis, telemetry },
        undefined,
        wantInspect
          ? {
              dx: input.mouseDx * mouseSens,
              dy: input.mouseDy * mouseSens,
              wheel: input.wheel,
            }
          : undefined,
      );
    }

    const nose = jet.basis.nose();
    const aimOrigin = {
      x: jet.position.x + nose.x * 4,
      y: jet.position.y + nose.y * 4,
      z: jet.position.z + nose.z * 4,
    };
    const cityBoxesEarly = world.buildings.getCollisionAabbs(
      { x: jet.position.x, z: jet.position.z },
      1100,
    );
    cityBoxesEarly.push(
      controlTowerAabb(sampleHeight(CONTROL_TOWER.x, CONTROL_TOWER.z)),
    );
    const raceMode = session.playMode === PlayMode.CHECKPOINT;
    aim = sampleAim(aimOrigin, nose, world.sampleFloor, {
      velocity: jet.velocity,
      missilesReady: missiles.ready,
      buildings: cityBoxesEarly,
      waterLevel: WATER_LEVEL,
    });

    const showGroundMark = aim.valid && !raceMode && !session.paused;
    aimFx.group.visible = showGroundMark;
    if (showGroundMark) {
      aimFx.group.position.set(aim.x, aim.y, aim.z);
      if (aim.inDlz) aimFx.setColor(0x59ff73, 0.7);
      else if (aim.ready) aimFx.setColor(0xffd93d, 0.55);
      else aimFx.setColor(0xff4d40, 0.45);
    }

    aimHud = {
      valid: aim.valid,
      ready: aim.ready,
      inDlz: aim.inDlz,
      range: aim.range,
      raceMode,
      aim: projectWorld(aim.x, aim.y, aim.z),
      fpm: projectWorld(aim.fpmX, aim.fpmY, aim.fpmZ),
      bore: projectWorld(aim.boreX, aim.boreY, aim.boreZ),
    };

    if (input.fire && !missionOver) {
      const dir = aim.valid
        ? { x: aim.x - aimOrigin.x, y: aim.y - aimOrigin.y, z: aim.z - aimOrigin.z }
        : nose;
      const bay = nozzleWorld(0, -0.2, 2.5);
      const fired = missiles.tryFire({ x: bay.x, y: bay.y, z: bay.z }, dir);
      if (fired) frameSfx.push("missile");
    }

    const cam = flightCam.camera.position;
    missileFx.setViewOrigin(cam.x, cam.y, cam.z);

    const impacts = missiles.tick(dt, world.sampleFloor);
    for (const m of impacts) {
      detonate(m.x, m.y, m.z);
      antidrone?.tryBlast(m.x, m.y, m.z, m.blastRadius);
      if (attack) {
        const n = attack.tryBlast(m.x, m.y, m.z, m.blastRadius, m.damage);
        if (n) {
          debris.burst(m.x, m.y, m.z, 10);
          destructibles.sync(attack.state.targets);
        }
      }
    }
    const cityBoxes = cityBoxesEarly;
    for (const m of missiles.missiles) {
      if (!m.active) continue;
      antidrone?.tryHitSegment(m.px, m.py, m.pz, m.x, m.y, m.z, m.hitRadius);

      if (attack) {
        const r = attack.tryHitSegment(
          m.px,
          m.py,
          m.pz,
          m.x,
          m.y,
          m.z,
          m.damage,
        );
        if (r.hit) {
          m.active = false;
          detonate(m.x, m.y, m.z);
          if (r.destroyed && r.target) {
            debris.burst(r.target.aabb.cx, r.target.aabb.cy, r.target.aabb.cz, 16);
          } else {
            debris.burst(m.x, m.y, m.z, 6);
          }
          destructibles.sync(attack.state.targets);
          continue;
        }
      }

      const cityHit = buildingHitQuery(
        { x: m.px, y: m.py, z: m.pz },
        { x: m.x, y: m.y, z: m.z },
        cityBoxes,
      );
      if (cityHit) {
        m.active = false;
        m.x = cityHit.x;
        m.y = cityHit.y;
        m.z = cityHit.z;
        detonate(m.x, m.y, m.z);
      }
    }
    missileFx.sync(missiles.missiles);
    missileFx.tick(dt);
    debris.tick(dt);

    if (checkpoint?.state.active) {
      checkpoint.tick(dt, jet.position);
      rings.update(checkpoint.state.ringIndex, dt);
      if (checkpoint.state.ringIndex > prevCpRing) {
        frameSfx.push("checkpoint_ok");
      }
      prevCpRing = checkpoint.state.ringIndex;
    }
    if (checkpoint && checkpoint.state.status === "WIN" && prevCpStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (checkpoint) prevCpStatus = checkpoint.state.status;

    if (antidrone?.state.active) {
      antidrone.tick(dt);
      drones.sync(antidrone.state.drones);
      if (antidrone.state.kills > prevAdKills) {
        frameSfx.push("checkpoint_ok");
      }
      prevAdKills = antidrone.state.kills;
    }
    if (antidrone && antidrone.state.status === "WIN" && prevAdStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (antidrone) prevAdStatus = antidrone.state.status;

    if (attack?.state.active) {
      attack.tick(dt);
      destructibles.sync(attack.state.targets);
      if (attack.state.destroyed > prevAtDestroyed) {
        frameSfx.push("boom");
      }
      prevAtDestroyed = attack.state.destroyed;
    }
    if (attack && attack.state.status === "WIN" && prevAtStatus !== "WIN") {
      frameSfx.push("level_clear");
    }
    if (attack) prevAtStatus = attack.state.status;

    const worldInfo = world.update(
      dt,
      jet.position.x,
      jet.position.z,
      jet.position.y,
      {
        vx: jet.velocity.x,
        vz: jet.velocity.z,
        altitude: telemetry.radarHeight,
      },
    );
    place = worldInfo.place;
    dayFactor = worldInfo.dayFactor;
    radarContacts = worldInfo.radarContacts;

    if (adaptive.tick(dt, dt * 1000)) {
      rebuildRt(cssW, cssH);
    }

    const b = jet.basis;
    jetRoot.matrixAutoUpdate = false;
    jetRoot.matrix.set(
      b.x.x, b.y.x, b.z.x, jet.position.x,
      b.x.y, b.y.y, b.z.y, jet.position.y,
      b.x.z, b.y.z, b.z.z, jet.position.z,
      0, 0, 0, 1,
    );
    jetRoot.matrixWorldNeedsUpdate = true;

    setJetAfterburner(jetRoot, telemetry.afterburner);
    exhaust.setActive(telemetry.afterburner);
    exhaust.update(dt);
    const view = viewCamera(session);
    setJetExternalVisible(jetRoot, view !== Cam.COCKPIT);
    exhaust.group.visible = exhaust.group.visible && view !== Cam.COCKPIT;

    const floorY = world.sampleFloor(jet.position.x, jet.position.z);
    shadow.position.set(jet.position.x + 8, floorY + 0.5, jet.position.z + 6);
    const s = Math.min(1.6, Math.max(0.4, 1.5 - telemetry.radarHeight / 200));
    shadow.scale.set(s, s, s);
    shadow.visible = view !== Cam.COCKPIT;

    trailAcc += dt;
    if (trailAcc >= 1 / 40) {
      trailAcc = 0;
      if (telemetry.afterburner) {
        // Wake trail behind the near-field plume (subtler — plume owns the AB read).
        const l = nozzleWorld(-0.58, -0.08, 5.2);
        abTrails.push(abL, l.x, l.y, l.z);
        const r = nozzleWorld(0.58, -0.08, 5.2);
        abTrails.push(abR, r.x, r.y, r.z);
      }
      if (jet.position.y > 900) {
        const l = nozzleWorld(-0.58, -0.08, 4.15);
        contrails.push(ctL, l.x, l.y, l.z);
        const r = nozzleWorld(0.58, -0.08, 4.15);
        contrails.push(ctR, r.x, r.y, r.z);
      }
    }

    renderFrame();
    return frameState();
  };

  const frameState = (): FlightFrameState => {
    const b = jet.basis;
    const sfx = frameSfx;
    frameSfx = [];
    return {
      telemetry,
      session,
      view: viewCamera(session),
      inspecting: flightCam.isInspecting,
      place,
      dayFactor,
      missilesReady: missiles.ready,
      aim,
      aimHud,
      radarContacts,
      jet: {
        x: jet.position.x,
        y: jet.position.y,
        z: jet.position.z,
        rx: b.x.x,
        ry: b.x.y,
        rz: b.x.z,
        ux: b.y.x,
        uy: b.y.y,
        uz: b.y.z,
        bx: b.z.x,
        by: b.z.y,
        bz: b.z.z,
      },
      sfx,
      checkpoint: checkpoint?.state ?? null,
      antidrone: antidrone?.state ?? null,
      attack: attack?.state ?? null,
    };
  };

  const renderFrame = () => {
    if (!rt) return;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, flightCam.camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  };

  const setPaused = (paused: boolean) => {
    session.paused = paused;
  };

  const dispose = () => {
    flightJet.dispose();
    rt?.dispose();
    exhaust.dispose();
    abTrails.dispose();
    contrails.dispose();
    missileFx.dispose();
    debris.dispose();
    rings.dispose();
    drones.dispose();
    destructibles.dispose();
    world.dispose();
    shadow.geometry.dispose();
    (shadow.material as MeshBasicMaterial).dispose();
    aimFx.dispose();
    quad.geometry.dispose();
    quadMat.dispose();
    renderer.dispose();
  };

  const vfxStats = (): FlightVfxStats => {
    const s = missileFx.stats();
    return {
      particles: s.particles,
      booms: s.booms,
      dropped: s.dropped,
    };
  };

  return {
    resize,
    tick,
    setPaused,
    dispose,
    renderer,
    vfxStats,
    adaptiveScale: () => adaptive.scale,
  };
}
