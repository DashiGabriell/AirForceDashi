export {
  Cam,
  PlayMode,
  Aircraft,
  type QualityProfile,
  type PerfSnapshot,
} from "@afd/shared-types";

export {
  WORLD_SIZE,
  CRUISE_ALT,
  WATER_LEVEL,
  MAX_ALT,
  SAFE_AGL,
  CRITICAL_AGL,
  BASE_SPEED,
  AB_MULT,
  INTERNAL_BASE_H,
} from "./constants";

export { Vec3, clamp, lerp, wrap, radToDeg } from "./math/vec3";
export { Basis } from "./math/basis";
export { JetSimulation, type JetTelemetry } from "./jet/JetSimulation";
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
  checkpointDef,
  buildCheckpointPoints,
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
  DLZ_RMIN,
  DLZ_ROPT,
  DLZ_RPI,
  DLZ_RAERO,
  type Missile,
  type AimSample,
  type AimSampleOpts,
} from "./combat/MissilePool";
export {
  loadProgress,
  saveProgress,
  unlockCheckpoint,
  unlockAntidrone,
  unlockAttack,
  applyMissionReward,
  tryUnlockF15,
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
  type LocalProgress,
} from "./progress/localProgress";
export {
  WEAPONS,
  DEFAULT_F22_LOADOUT,
  DEFAULT_F15_LOADOUT,
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
  type WeaponDef,
  type WeaponId,
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
  CHUNK_SIZE,
  CHUNK_RES,
  STREAM_RADIUS,
  chunkKey,
  worldToChunk,
  neededChunks,
  generateChunkMesh,
  gatherBuildings,
  BUILDING_CELL,
  BUILDING_RADIUS,
  type ChunkMeshData,
  type BuildingInstance,
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
  type PlaceOfInterest,
} from "./world/places";
export { DayClock } from "./world/dayClock";
export { fbm2, noise2, hash2 } from "./world/noise";
