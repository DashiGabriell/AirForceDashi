import { PlayMode } from "@afd/shared-types";
import { describe, expect, it } from "vitest";
import { MapId, mapAllows, resolveMap } from "./maps";

describe("map catalog", () => {
  it("keeps attack on the Pacific", () => {
    expect(mapAllows(MapId.ARENA, PlayMode.ATTACK)).toBe(false);
    expect(resolveMap(MapId.ARENA, PlayMode.ATTACK)).toBe(MapId.PACIFIC);
  });

  it("lets free flight and air sorties use the arena", () => {
    expect(mapAllows(MapId.ARENA, PlayMode.FREE_FLIGHT)).toBe(true);
    expect(mapAllows(MapId.ARENA, PlayMode.CHECKPOINT)).toBe(true);
    expect(mapAllows(MapId.ARENA, PlayMode.ANTI_DRONE)).toBe(true);
    expect(mapAllows(MapId.ARENA, PlayMode.TARGET_PRACTICE)).toBe(true);
    expect(resolveMap(MapId.ARENA, PlayMode.FREE_FLIGHT)).toBe(MapId.ARENA);
  });

  it("defaults an unknown id to the Pacific", () => {
    expect(resolveMap(undefined, PlayMode.FREE_FLIGHT)).toBe(MapId.PACIFIC);
  });
});
