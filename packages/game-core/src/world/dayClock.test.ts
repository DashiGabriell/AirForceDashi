import { describe, expect, it } from "vitest";
import {
  DAY_CYCLE_SECONDS,
  DayClock,
  GAME_HOUR_SECONDS,
} from "./dayClock";

describe("DayClock scale", () => {
  it("uses 1 game hour = 1 real minute (24h = 24 min)", () => {
    expect(GAME_HOUR_SECONDS).toBe(60);
    expect(DAY_CYCLE_SECONDS).toBe(24 * 60);
    expect(new DayClock().period).toBe(DAY_CYCLE_SECONDS);
  });

  it("advances one game hour per real minute", () => {
    const c = new DayClock(0);
    expect(c.hour).toBeCloseTo(0, 5);
    c.tick(GAME_HOUR_SECONDS);
    expect(c.hour).toBeCloseTo(1, 5);
    c.tick(GAME_HOUR_SECONDS * 5);
    expect(c.hour).toBeCloseTo(6, 5);
  });

  it("wraps after a full 24-minute cycle", () => {
    const c = new DayClock(0);
    c.tick(DAY_CYCLE_SECONDS);
    expect(c.hour).toBeCloseTo(0, 5);
    c.tick(DAY_CYCLE_SECONDS * 2 + GAME_HOUR_SECONDS * 3);
    expect(c.hour).toBeCloseTo(3, 5);
  });
});

describe("DayClock phases", () => {
  it("labels morning / afternoon / night correctly", () => {
    const c = new DayClock(0);
    c.setHour(3);
    expect(c.phase).toBe("night");
    c.setHour(6);
    expect(c.phase).toBe("dawn");
    c.setHour(9);
    expect(c.phase).toBe("morning");
    c.setHour(12);
    expect(c.phase).toBe("noon");
    c.setHour(15);
    expect(c.phase).toBe("afternoon");
    c.setHour(18);
    expect(c.phase).toBe("dusk");
    c.setHour(22);
    expect(c.phase).toBe("night");
  });

  it("is bright at noon and dark at midnight", () => {
    const c = new DayClock(0);
    c.setHour(12);
    expect(c.dayFactor).toBeGreaterThan(0.85);
    expect(c.isNight).toBe(false);
    c.setHour(0);
    expect(c.dayFactor).toBeLessThan(0.2);
    expect(c.isNight).toBe(true);
  });

  it("places the sun high at noon and low at night", () => {
    const c = new DayClock(0);
    c.setHour(12);
    expect(c.sunDir.y).toBeGreaterThan(0.7);
    c.setHour(0);
    expect(c.sunDir.y).toBeLessThan(0.1);
  });

  it("peaks dusk near 18:00 and dawn near 06:00", () => {
    const c = new DayClock(0);
    c.setHour(18);
    const dusk = c.duskFactor;
    c.setHour(12);
    expect(dusk).toBeGreaterThan(c.duskFactor);
    c.setHour(6);
    const dawn = c.dawnFactor;
    c.setHour(12);
    expect(dawn).toBeGreaterThan(c.dawnFactor);
  });
});
