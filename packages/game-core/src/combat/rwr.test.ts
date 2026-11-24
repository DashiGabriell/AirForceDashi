import { describe, expect, it } from "vitest";
import { evaluateRwr } from "./rwr";

describe("evaluateRwr", () => {
  it("is quiet with no threats", () => {
    expect(evaluateRwr({ missileThreat: false, painted: false })).toBe("none");
  });

  it("reports lock while painted", () => {
    expect(evaluateRwr({ missileThreat: false, painted: true })).toBe("lock");
  });

  it("escalates to missile over lock", () => {
    expect(evaluateRwr({ missileThreat: true, painted: true })).toBe("missile");
    expect(evaluateRwr({ missileThreat: true, painted: false })).toBe(
      "missile",
    );
  });
});
