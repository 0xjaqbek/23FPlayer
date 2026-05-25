import { describe, expect, it } from "vitest";
import { hasReachedChangeThreshold } from "@/features/antenna/server/vote-threshold";

describe("hasReachedChangeThreshold", () => {
  it("requires 60 percent of present logged-in listeners", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 10, votes: 5 })).toBe(false);
    expect(hasReachedChangeThreshold({ presentListeners: 10, votes: 6 })).toBe(true);
  });

  it("does not allow a vote change when nobody is present", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 0, votes: 1 })).toBe(false);
  });

  it("rounds up fractional thresholds", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 7, votes: 4 })).toBe(false);
    expect(hasReachedChangeThreshold({ presentListeners: 7, votes: 5 })).toBe(true);
  });
});
