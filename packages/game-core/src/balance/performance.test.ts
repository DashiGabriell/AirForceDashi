import { describe, expect, it } from "vitest";
import { Aircraft } from "@afd/shared-types";
import { FLEET } from "../progress/fleet";
import {
  defaultLoadoutFor,
  weaponsForAircraft,
} from "../progress/weapons";
import { aircraftProfile } from "./aircraftProfiles";
import { resolveLoadoutPerformance } from "./performance";

describe("aircraft profiles", () => {
  it("covers every fleet aircraft", () => {
    for (const entry of FLEET) {
      expect(aircraftProfile(entry.aircraft).aircraft).toBe(entry.aircraft);
    }
  });

  it("has origin lore for the fleet sheet", () => {
    for (const entry of FLEET) {
      const o = aircraftProfile(entry.aircraft).origin;
      expect(o.flag.length).toBeGreaterThan(0);
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.year).toBeGreaterThan(1940);
    }
  });
});

describe("weapons catalog", () => {
  it("gives every fleet jet at least one AA option", () => {
    for (const entry of FLEET) {
      expect(
        weaponsForAircraft(entry.aircraft, "aa").length,
        entry.id,
      ).toBeGreaterThan(0);
    }
  });

  it("defaults to compatible racks", () => {
    for (const entry of FLEET) {
      const lo = defaultLoadoutFor(entry.aircraft);
      if (lo.aaWeaponId) {
        expect(
          weaponsForAircraft(entry.aircraft, "aa").some(
            (w) => w.id === lo.aaWeaponId,
          ),
        ).toBe(true);
      }
      if (lo.agWeaponId) {
        expect(
          weaponsForAircraft(entry.aircraft, "ag").some(
            (w) => w.id === lo.agWeaponId,
          ),
        ).toBe(true);
      }
    }
  });
});

describe("resolveLoadoutPerformance", () => {
  it("keeps F-22 + AIM-9 lighter/faster than F-22 + AIM-120C", () => {
    const light = resolveLoadoutPerformance(Aircraft.F22_RAPTOR, {
      aaWeaponId: "aim-9-sidewinder",
      agWeaponId: "",
    });
    const heavy = resolveLoadoutPerformance(Aircraft.F22_RAPTOR, {
      aaWeaponId: "aim-120c-amraam",
      agWeaponId: "jdam",
    });
    expect(light.handling.baseSpeed).toBeGreaterThan(heavy.handling.baseSpeed);
    expect(light.handling.turnRate).toBeGreaterThan(heavy.handling.turnRate);
    expect(heavy.aaCombat.damage).toBeGreaterThan(light.aaCombat.damage);
    expect(heavy.loadFraction).toBeGreaterThan(light.loadFraction);
  });

  it("gives A-10 slower handling than F-22 with default loadouts", () => {
    const f22 = resolveLoadoutPerformance(
      Aircraft.F22_RAPTOR,
      defaultLoadoutFor(Aircraft.F22_RAPTOR),
    );
    const a10 = resolveLoadoutPerformance(
      Aircraft.A10,
      defaultLoadoutFor(Aircraft.A10),
    );
    expect(a10.handling.baseSpeed).toBeLessThan(f22.handling.baseSpeed * 0.85);
  });

  it("exposes display stats and blurbs for UI", () => {
    const perf = resolveLoadoutPerformance(
      Aircraft.SU35,
      defaultLoadoutFor(Aircraft.SU35),
    );
    expect(perf.roleLabel.length).toBeGreaterThan(0);
    expect(perf.aircraftBlurb.length).toBeGreaterThan(10);
    expect(perf.displayStats.length).toBeGreaterThanOrEqual(6);
    expect(perf.aa?.id).toBeTruthy();
  });
});
