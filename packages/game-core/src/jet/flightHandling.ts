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
 * Per-aircraft flight knobs. Speeds are world m/s (≈ true airspeed).
 * HUD knots ≈ speed × 1.85; Mach readout uses knots / 629.
 */
export interface FlightHandling {
  /** Military / cruise target speed (m/s). */
  baseSpeed: number;
  /** Afterburner multiplier on baseSpeed → peak TAS. */
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

/** Peak TAS (m/s) for a handling profile. */
export function maxSpeedOf(h: FlightHandling): number {
  return h.baseSpeed * h.abMult;
}

type Agility = Partial<
  Record<
    | "turnRate"
    | "pitchRate"
    | "rollAmount"
    | "rollResp"
    | "steerSmooth"
    | "accelRate",
    number
  >
>;

/**
 * Absolute cruise + peak (m/s), with optional agility multipliers
 * relative to the F-22 baseline.
 */
function craft(cruiseMs: number, peakMs: number, ag: Agility = {}): FlightHandling {
  const peak = Math.max(peakMs, cruiseMs * 1.05);
  return {
    baseSpeed: cruiseMs,
    abMult: peak / cruiseMs,
    turnRate: DEFAULT_HANDLING.turnRate * (ag.turnRate ?? 1),
    pitchRate: DEFAULT_HANDLING.pitchRate * (ag.pitchRate ?? 1),
    rollAmount: DEFAULT_HANDLING.rollAmount * (ag.rollAmount ?? 1),
    rollResp: DEFAULT_HANDLING.rollResp * (ag.rollResp ?? 1),
    steerSmooth: DEFAULT_HANDLING.steerSmooth * (ag.steerSmooth ?? 1),
    accelRate: DEFAULT_HANDLING.accelRate * (ag.accelRate ?? 1),
  };
}

/**
 * Profiles keyed to approximate real-world cruise / Vmax (arcade TAS).
 * F-22 is the reference (`DEFAULT_HANDLING`).
 */
export function handlingFor(aircraft: Aircraft): FlightHandling {
  switch (aircraft) {
    case Aircraft.F22_RAPTOR:
      // ~M0.9 mil / ~M2.25 AB
      return DEFAULT_HANDLING;
    case Aircraft.F15_EAGLE:
      // Fastest classic Eagle energy fighter — ~M2.5
      return craft(320, 800, {
        turnRate: 0.84,
        pitchRate: 0.88,
        rollAmount: 0.92,
        steerSmooth: 0.92,
        accelRate: 0.92,
      });
    case Aircraft.F16_FALCON:
    case Aircraft.GRIPEN:
    case Aircraft.F2:
      return craft(300, 680, {
        turnRate: 1.08,
        pitchRate: 1.06,
        rollResp: 1.05,
        accelRate: 1.05,
      });
    case Aircraft.FA18_SUPER_HORNET:
      return craft(290, 600, {
        turnRate: 0.9,
        pitchRate: 0.92,
        rollAmount: 0.95,
        accelRate: 0.95,
      });
    case Aircraft.F14_TOMCAT:
      return craft(310, 780, {
        turnRate: 0.88,
        pitchRate: 0.9,
        rollAmount: 0.94,
        accelRate: 0.94,
      });
    case Aircraft.F4_PHANTOM:
      return craft(290, 740, {
        turnRate: 0.82,
        pitchRate: 0.85,
        rollAmount: 0.9,
        accelRate: 0.88,
      });
    case Aircraft.TYPHOON:
      return craft(310, 700, {
        turnRate: 1.04,
        pitchRate: 1.02,
        steerSmooth: 1.04,
      });
    case Aircraft.RAFALE:
      return craft(300, 620, {
        turnRate: 1.04,
        pitchRate: 1.02,
        steerSmooth: 1.04,
      });
    case Aircraft.MIG35:
      return craft(305, 740, {
        turnRate: 1.04,
        pitchRate: 1.02,
        steerSmooth: 1.04,
      });
    case Aircraft.SU35:
    case Aircraft.MIG29:
      return craft(310, 750, {
        turnRate: 1.06,
        pitchRate: 1.05,
        accelRate: 1.08,
      });
    case Aircraft.SU57:
      return craft(315, 700, {
        turnRate: 1.06,
        pitchRate: 1.05,
        accelRate: 1.08,
      });
    case Aircraft.YF23:
      return craft(320, 760, {
        turnRate: 0.95,
        pitchRate: 0.96,
        accelRate: 1.05,
      });
    case Aircraft.F35_LIGHTNING:
      return craft(280, 540, {
        turnRate: 0.95,
        pitchRate: 0.96,
        steerSmooth: 1.06,
      });
    case Aircraft.MIRAGE_2000:
      return craft(300, 720, {
        turnRate: 0.95,
        pitchRate: 0.96,
        steerSmooth: 1.06,
      });
    case Aircraft.SU34:
      return craft(260, 580, {
        turnRate: 0.72,
        pitchRate: 0.75,
        rollAmount: 0.8,
        rollResp: 0.75,
        steerSmooth: 0.78,
        accelRate: 0.8,
      });
    case Aircraft.A10:
      // ~420 mph class — no true AB; mild “power” bump only
      return craft(150, 190, {
        turnRate: 0.55,
        pitchRate: 0.58,
        rollAmount: 0.68,
        rollResp: 0.62,
        steerSmooth: 0.68,
        accelRate: 0.58,
      });
    case Aircraft.B2:
      return craft(220, 280, {
        turnRate: 0.4,
        pitchRate: 0.42,
        rollAmount: 0.55,
        rollResp: 0.5,
        steerSmooth: 0.55,
        accelRate: 0.7,
      });
    case Aircraft.U2:
      return craft(160, 200, {
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
