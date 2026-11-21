import { Aircraft } from "@afd/shared-types";
import {
  MISSILE_LIFE,
  MISSILE_MAX,
  MISSILE_REARM,
  MISSILE_SPEED,
  type MissileFireProfile,
} from "../combat/MissilePool";
import {
  handlingFor,
  type FlightHandling,
} from "../jet/flightHandling";
import {
  type AircraftLoadout,
  type WeaponDef,
  weaponById,
} from "../progress/weapons";
import {
  AIRCRAFT_ROLE_LABEL,
  aircraftProfile,
  type AircraftAttrs,
  type AircraftProfile,
} from "./aircraftProfiles";

export interface DisplayStat {
  id: keyof AircraftAttrs;
  label: string;
  value: number;
}

export interface LoadoutPerformance {
  profile: AircraftProfile;
  roleLabel: string;
  handling: FlightHandling;
  /** Stats 0–100 já com peso/loadout. */
  displayStats: DisplayStat[];
  loadMass: number;
  loadFraction: number;
  aa: WeaponDef | null;
  ag: WeaponDef | null;
  aaCombat: MissileFireProfile;
  agCombat: MissileFireProfile;
  aircraftBlurb: string;
  strengths: string;
  limitations: string;
  loadoutSummary: string;
}

const ATTR_LABELS: { id: keyof AircraftAttrs; label: string }[] = [
  { id: "speed", label: "Velocidade" },
  { id: "acceleration", label: "Aceleração" },
  { id: "maneuver", label: "Manobra" },
  { id: "energy", label: "Energia" },
  { id: "payload", label: "Carga" },
  { id: "toughness", label: "Resistência" },
  { id: "precision", label: "Precisão" },
  { id: "radar", label: "Radar" },
  { id: "rcs", label: "Assinatura" },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function combatFromWeapon(w: WeaponDef | null): MissileFireProfile {
  if (!w) {
    return {
      maxReady: MISSILE_MAX,
      rearm: MISSILE_REARM,
      speed: MISSILE_SPEED,
      life: MISSILE_LIFE,
      damage: 1,
      blastRadius: 16,
      hitRadius: 12,
    };
  }
  return {
    maxReady: MISSILE_MAX,
    rearm: MISSILE_REARM * w.rearmMult,
    speed: MISSILE_SPEED * w.speedMult,
    life: MISSILE_LIFE * w.lifeMult,
    damage: w.damage,
    blastRadius: w.blastRadius,
    hitRadius: w.hitRadius,
  };
}

function applyBias(
  h: FlightHandling,
  bias: WeaponDef["handlingBias"] | undefined,
): FlightHandling {
  if (!bias) return h;
  return {
    baseSpeed: h.baseSpeed * (bias.baseSpeed ?? 1),
    abMult: h.abMult * (bias.abMult ?? 1),
    turnRate: h.turnRate * (bias.turnRate ?? 1),
    pitchRate: h.pitchRate * (bias.pitchRate ?? 1),
    rollAmount: h.rollAmount,
    rollResp: h.rollResp,
    steerSmooth: h.steerSmooth,
    accelRate: h.accelRate * (bias.accelRate ?? 1),
  };
}

/**
 * Une perfil da aeronave + racks equipados → handling de voo e combate.
 * Peso da munição reduz speed/turn/accel; bias por arma afina o feel.
 */
export function resolveLoadoutPerformance(
  aircraft: Aircraft,
  loadout: AircraftLoadout,
): LoadoutPerformance {
  const profile = aircraftProfile(aircraft);
  const aa = weaponById(loadout.aaWeaponId);
  const ag = weaponById(loadout.agWeaponId);
  const loadMass = (aa?.mass ?? 0) + (ag?.mass ?? 0);
  const loadFraction = clamp(loadMass / Math.max(1, profile.payloadCapacity), 0, 1.6);

  // Até ~24% de perda em carga cheia — decisão leve vs pesado.
  const drag = 1 - loadFraction * 0.15;
  let handling = handlingFor(aircraft);
  handling = {
    ...handling,
    baseSpeed: handling.baseSpeed * drag,
    turnRate: handling.turnRate * (0.97 + drag * 0.03) * (1 - loadFraction * 0.12),
    pitchRate: handling.pitchRate * (1 - loadFraction * 0.1),
    accelRate: handling.accelRate * (1 - loadFraction * 0.14),
    abMult: handling.abMult * (1 - loadFraction * 0.06),
  };
  handling = applyBias(handling, aa?.handlingBias);
  handling = applyBias(handling, ag?.handlingBias);

  const attrs = { ...profile.attrs };
  const speedPen = loadFraction * 18;
  const manPen = loadFraction * 22;
  const accelPen = loadFraction * 20;
  attrs.speed = clamp(attrs.speed - speedPen + (aa?.category === "wvr" ? 2 : 0), 5, 100);
  attrs.maneuver = clamp(attrs.maneuver - manPen, 5, 100);
  attrs.acceleration = clamp(attrs.acceleration - accelPen, 5, 100);
  attrs.energy = clamp(attrs.energy - loadFraction * 12, 5, 100);
  attrs.precision = clamp(
    attrs.precision + ((aa?.damage ?? 1) + (ag?.damage ?? 1) - 2) * 4,
    5,
    100,
  );
  // RCS display: lower is better — heavy external load raises signature slightly.
  attrs.rcs = clamp(attrs.rcs + loadFraction * 10, 5, 100);

  const displayStats: DisplayStat[] = ATTR_LABELS.map(({ id, label }) => ({
    id,
    label,
    value: Math.round(attrs[id]),
  }));

  const parts: string[] = [];
  if (aa) parts.push(`${aa.shortLabel} (${aa.category.toUpperCase()})`);
  if (ag) parts.push(`${ag.shortLabel} (AG)`);
  const loadoutSummary =
    parts.length > 0
      ? `${parts.join(" + ")} · carga ${Math.round(loadFraction * 100)}%`
      : "Loadout vazio";

  return {
    profile,
    roleLabel: AIRCRAFT_ROLE_LABEL[profile.role],
    handling,
    displayStats,
    loadMass,
    loadFraction,
    aa,
    ag,
    aaCombat: combatFromWeapon(aa),
    agCombat: combatFromWeapon(ag),
    aircraftBlurb: profile.blurb,
    strengths: profile.strengths,
    limitations: profile.limitations,
    loadoutSummary,
  };
}
