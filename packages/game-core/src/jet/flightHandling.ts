import { Aircraft } from "@afd/shared-types";
import {
  AB_MULT,
  BASE_SPEED,
  PITCH_RATE,
  ROLL_AMOUNT,
  ROLL_RESP,
  STEER_SMOOTH,
  TURN_RATE,
} from "../constants";

/**
 * Per-aircraft flight knobs. `DEFAULT_HANDLING` matches the historical
 * global constants so F-22 / unprofiled sims stay bit-identical.
 */
export interface FlightHandling {
  /** Cruise target speed (world units). */
  baseSpeed: number;
  /** Afterburner multiplier on baseSpeed. */
  abMult: number;
  turnRate: number;
  pitchRate: number;
  rollAmount: number;
  rollResp: number;
  steerSmooth: number;
  /** Speed lerp rate inside `exp(-accelRate * dt)`. */
  accelRate: number;
}

export const DEFAULT_HANDLING: FlightHandling = {
  baseSpeed: BASE_SPEED,
  abMult: AB_MULT,
  turnRate: TURN_RATE,
  pitchRate: PITCH_RATE,
  rollAmount: ROLL_AMOUNT,
  rollResp: ROLL_RESP,
  steerSmooth: STEER_SMOOTH,
  accelRate: 2,
};

function scale(
  mult: Partial<
    Record<
      | "baseSpeed"
      | "abMult"
      | "turnRate"
      | "pitchRate"
      | "rollAmount"
      | "rollResp"
      | "steerSmooth"
      | "accelRate",
      number
    >
  >,
): FlightHandling {
  return {
    baseSpeed: DEFAULT_HANDLING.baseSpeed * (mult.baseSpeed ?? 1),
    abMult: DEFAULT_HANDLING.abMult * (mult.abMult ?? 1),
    turnRate: DEFAULT_HANDLING.turnRate * (mult.turnRate ?? 1),
    pitchRate: DEFAULT_HANDLING.pitchRate * (mult.pitchRate ?? 1),
    rollAmount: DEFAULT_HANDLING.rollAmount * (mult.rollAmount ?? 1),
    rollResp: DEFAULT_HANDLING.rollResp * (mult.rollResp ?? 1),
    steerSmooth: DEFAULT_HANDLING.steerSmooth * (mult.steerSmooth ?? 1),
    accelRate: DEFAULT_HANDLING.accelRate * (mult.accelRate ?? 1),
  };
}

/**
 * Profiles from economia-v1 F-22/F-15 matrix + role silhouettes (Fase C).
 * Other fighters get light identity tweaks; specials diverge more.
 */
export function handlingFor(aircraft: Aircraft): FlightHandling {
  switch (aircraft) {
    case Aircraft.F22_RAPTOR:
      return DEFAULT_HANDLING;
    case Aircraft.F15_EAGLE:
      // Faster / less agile than Raptor (economia matrix).
      return scale({
        baseSpeed: 1.06,
        turnRate: 0.84,
        pitchRate: 0.88,
        rollAmount: 0.92,
        steerSmooth: 0.92,
        accelRate: 0.92,
      });
    case Aircraft.F16_FALCON:
    case Aircraft.GRIPEN:
    case Aircraft.F2:
      return scale({
        baseSpeed: 0.96,
        turnRate: 1.08,
        pitchRate: 1.06,
        rollResp: 1.05,
        accelRate: 1.05,
      });
    case Aircraft.FA18_SUPER_HORNET:
    case Aircraft.F14_TOMCAT:
    case Aircraft.F4_PHANTOM:
      return scale({
        baseSpeed: 1.02,
        turnRate: 0.9,
        pitchRate: 0.92,
        rollAmount: 0.95,
        accelRate: 0.95,
      });
    case Aircraft.TYPHOON:
    case Aircraft.RAFALE:
    case Aircraft.MIG35:
      return scale({
        turnRate: 1.04,
        pitchRate: 1.02,
        steerSmooth: 1.04,
      });
    case Aircraft.SU35:
    case Aircraft.MIG29:
    case Aircraft.SU57:
    case Aircraft.YF23:
      return scale({
        baseSpeed: 1.04,
        turnRate: 1.06,
        pitchRate: 1.05,
        abMult: 1.05,
        accelRate: 1.08,
      });
    case Aircraft.F35_LIGHTNING:
    case Aircraft.MIRAGE_2000:
      return scale({
        baseSpeed: 0.98,
        turnRate: 0.95,
        pitchRate: 0.96,
        steerSmooth: 1.06,
      });
    case Aircraft.SU34:
      return scale({
        baseSpeed: 0.88,
        abMult: 0.9,
        turnRate: 0.72,
        pitchRate: 0.75,
        rollAmount: 0.8,
        rollResp: 0.75,
        steerSmooth: 0.78,
        accelRate: 0.8,
      });
    case Aircraft.A10:
      return scale({
        baseSpeed: 0.72,
        abMult: 0.72,
        turnRate: 0.55,
        pitchRate: 0.58,
        rollAmount: 0.68,
        rollResp: 0.62,
        steerSmooth: 0.68,
        accelRate: 0.58,
      });
    case Aircraft.B2:
      return scale({
        baseSpeed: 0.9,
        abMult: 0.8,
        turnRate: 0.4,
        pitchRate: 0.42,
        rollAmount: 0.55,
        rollResp: 0.5,
        steerSmooth: 0.55,
        accelRate: 0.7,
      });
    case Aircraft.U2:
      return scale({
        baseSpeed: 0.68,
        abMult: 0.7,
        turnRate: 0.38,
        pitchRate: 0.4,
        rollAmount: 0.5,
        rollResp: 0.48,
        steerSmooth: 0.6,
        accelRate: 0.55,
      });
    default:
      return DEFAULT_HANDLING;
  }
}
