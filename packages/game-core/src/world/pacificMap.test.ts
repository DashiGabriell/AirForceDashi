import { describe, expect, it } from "vitest";
import { MAP_SPAWN, WORLD_SIZE } from "../constants";
import { PACIFIC_MAP } from "./pacificMap";
import { buildPlaces } from "./places";

describe("Pacific map definition", () => {
  it("has the pacific id", () => {
    expect(PACIFIC_MAP.id).toBe("pacific");
  });

  it("feeds the legacy constants that existing callers read", () => {
    expect(WORLD_SIZE).toBe(PACIFIC_MAP.worldSize);
    expect(MAP_SPAWN).toEqual(PACIFIC_MAP.spawn);
  });

  it("has a full square heightmap grid", () => {
    const { res, u16 } = PACIFIC_MAP.heightfield;
    expect(res).toBe(513);
    expect(u16.length).toBe(res * res);
  });

  it("keeps every place inside the playfield", () => {
    expect(buildPlaces()).toHaveLength(PACIFIC_MAP.places.length);
  });
});
