export {
  Cam,
  PlayMode,
  Aircraft,
  type QualityProfile,
  type PerfSnapshot,
} from "@afd/shared-types";

export {
  WORLD_SIZE,
  MAP_SPAWN,
  CRUISE_ALT,
  WATER_LEVEL,
  MAX_ALT,
  SAFE_AGL,
  CRITICAL_AGL,
  CAUTION_AGL,
  BASE_SPEED,
  AB_MULT,
  INTERNAL_BASE_H,
} from "./constants";

export { Vec3, clamp, lerp, wrap, radToDeg } from "./math/vec3";
export { Basis } from "./math/basis";
export {
  JetSimulation,
  evaluateAltWarn,
  type JetTelemetry,
  type AltWarnLevel,
} from "./jet/JetSimulation";
export {
  DEFAULT_HANDLING,
  handlingFor,
  maxSpeedOf,
  type FlightHandling,
} from "./jet/flightHandling";
export {
  emptyInput,
  KeyboardFlightInput,
  type FlightInput,
} from "./input";
export {
  createSession,
  createFreeFlightSession,
  viewCamera,
  cycleCamera,
  type GameSession,
} from "./session";

export {
  CP_LEVEL_COUNT,
  CHECKPOINT_START,
  CHECKPOINT_FIRST_LEAD,
  checkpointDef,
  buildCheckpointPoints,
  gateIsFlat,
  type CheckpointDef,
  type GatePoint,
} from "./missions/checkpointLevels";
export { CheckpointCourse, type CheckpointState } from "./missions/CheckpointCourse";
export {
  AD_LEVEL_COUNT,
  DroneKind,
  antidroneDef,
  type AntiDroneDef,
} from "./missions/antidroneLevels";
export { AntiDroneCourse, type AntiDroneState, type DroneState } from "./missions/AntiDroneCourse";
export {
  AT_LEVEL_COUNT,
  attackDef,
  type AttackDef,
} from "./missions/attackLevels";
export { AttackCourse, type AttackState } from "./missions/AttackCourse";
export {
  TP_LEVEL_COUNT,
  TP_AUTHORED_COUNT,
  targetPracticeDef,
  type LockPolicy,
  type PracticeTargetSpawn,
  type TargetPracticeDef,
} from "./missions/targetPracticeLevels";
export {
  TargetPracticeCourse,
  type TargetPracticeState,
  type PracticeTargetState,
  type PracticeHit,
} from "./missions/TargetPracticeCourse";
export {
  createDestructibleFromBuilding,
  damageDestructible,
  promoteToDestructible,
  type DestructibleTarget,
  type DestructibleDamage,
} from "./missions/DestructibleTarget";
export {
  MissileSystem,
  sampleAim,
  MISSILE_MAX,
  MISSILE_REARM,
  MISSILE_SPEED,
  MISSILE_LIFE,
  DEFAULT_MISSILE_PROFILE,
  DLZ_RMIN,
  DLZ_ROPT,
  DLZ_RPI,
  DLZ_RAERO,
  type Missile,
  type MissileFireProfile,
  type MissileGuideContext,
  type AimSample,
  type AimSampleOpts,
} from "./combat/MissilePool";
export {
  CountermeasureSystem,
  FLARE_MAX,
  FLARE_MODE_LABEL,
  normalizeFlareMode,
  type FlareMode,
  type FlarePellet,
  type CountermeasureState,
} from "./combat/countermeasures";
export {
  evaluateRwr,
  emptyRwr,
  RWR_LOCK_ACQUIRE,
  RWR_PAINT_MIN,
  RWR_PAINT_MAX,
  type RwrLevel,
  type RwrState,
} from "./combat/rwr";
export {
  TargetLockTracker,
  sensorFor,
  type SensorProfile,
  type LockCandidate,
  type LockKind,
  type LockPhase,
  type TargetLockState,
} from "./combat/targetLock";
export {
  AIRCRAFT_PROFILES,
  AIRCRAFT_ROLE_LABEL,
  aircraftProfile,
  type AircraftRole,
  type AircraftAttrs,
  type AircraftOrigin,
  type AircraftProfile,
} from "./balance/aircraftProfiles";
export {
  resolveLoadoutPerformance,
  type DisplayStat,
  type LoadoutPerformance,
} from "./balance/performance";
export {
  loadProgress,
  saveProgress,
  unlockCheckpoint,
  unlockAntidrone,
  unlockAttack,
  unlockTargetPractice,
  applyMissionReward,
  tryUnlockF15,
  tryUnlockAircraft,
  updateSettings,
  setAvatar,
  setSkin,
  setEmblem,
  setEffect,
  currentLoadout,
  setAaWeapon,
  setAgWeapon,
  DEFAULT_PROGRESS,
  F15_UNLOCK_COST,
  FLEET,
  fleetEntry,
  type LocalProgress,
} from "./progress/localProgress";
export {
  aircraftIdOf,
  aircraftFromId,
  aircraftLabel,
  fleetById,
  fleetByGeneration,
  FLEET_GENERATION_LABEL,
  FLEET_GENERATION_ORDER,
  isKnownAircraft,
  normalizeOwnedAircraft,
  normalizeSelectedAircraft,
  type FleetAircraftId,
  type FleetEntry,
  type FleetGenerationId,
} from "./progress/fleet";
export {
  WEAPONS,
  WEAPON_CATEGORY_LABEL,
  DEFAULT_F22_LOADOUT,
  DEFAULT_F15_LOADOUT,
  DEFAULT_EMPTY_LOADOUT,
  DEFAULT_LOADOUTS,
  aircraftLoadoutKey,
  weaponById,
  weaponsForAircraft,
  isWeaponCompatible,
  defaultLoadoutFor,
  normalizeAircraftLoadout,
  normalizeLoadoutMap,
  loadoutForAircraft,
  type WeaponRole,
  type WeaponCategory,
  type WeaponDef,
  type WeaponId,
  type WeaponHandlingBias,
  type AircraftLoadout,
  type AircraftLoadoutKey,
  type LoadoutMap,
} from "./progress/weapons";
export {
  AVATAR_COUNT,
  avatarIds,
  avatarLabel,
  avatarPublicPath,
  clampAvatarId,
} from "./progress/avatars";
export { medalPublicPath } from "./progress/medals";
export {
  JET_SKINS,
  jetSkinById,
  jetSkinSwatch,
  type JetSkin,
  type JetSkinId,
} from "./progress/skins";
export {
  JET_EMBLEMS,
  JET_EFFECTS,
  jetEmblemById,
  jetEffectById,
  type JetEmblemId,
  type JetEffectId,
} from "./progress/cosmetics";
export {
  DEFAULT_SETTINGS,
  internalHeightForQuality,
  normalizeSettings,
  type PlayerSettings,
} from "./progress/settings";
export {
  previewReward,
  type MissionRewardDto,
} from "@afd/shared-types";

export {
  HEIGHT_SCALE,
  Region,
  regionLabel,
  sampleHeight,
  sampleHeight01,
  sampleRegion,
  solidFloor,
  biomeColor,
} from "./world/heightfield";
export {
  CONTROL_TOWER,
  controlTowerAabb,
  controlTowerCeiling,
  controlTowerContains,
} from "./world/controlTower";
export {
  AIRBASE,
  AIRBASE_MARKERS,
  airbaseBuildingInstances,
  airbaseCeiling,
  airbaseCollisionAabbs,
  airbaseWorld,
  isInsideAirbase,
  type AirbaseMarker,
} from "./world/airbaseLayout";
export {
  CHUNK_SIZE,
  CHUNK_RES,
  CHUNK_RES_MID,
  CHUNK_RES_FAR,
  STREAM_RADIUS,
  chunkKey,
  worldToChunk,
  chunkResForDistance,
  chunkCenterDistance,
  neededChunks,
  neededChunksLookahead,
  sortChunksByPriority,
  generateChunkMesh,
  gatherBuildings,
  BUILDING_CELL,
  BUILDING_RADIUS,
  type ChunkMeshData,
  type BuildingInstance,
  type StreamMotion,
} from "./world/chunk";
export {
  buildingHitQuery,
  buildingToAabb,
  BUILDING_COLLISION_XZ,
  type BuildingAabb,
  type BuildingHit,
} from "./world/buildingHit";
export { ChunkCache, syncChunkKeys } from "./world/streaming";
export {
  buildPlaces,
  nearestPlace,
  nearbyPlaces,
  type PlaceOfInterest,
} from "./world/places";
export {
  radarCoastPolys,
  radarInstallPolys,
  type RadarPoly,
} from "./world/radarTerrain";
export {
  DayClock,
  DAY_CYCLE_SECONDS,
  GAME_HOUR_SECONDS,
  type DayPhase,
} from "./world/dayClock";
export { fbm2, noise2, hash2 } from "./world/noise";
