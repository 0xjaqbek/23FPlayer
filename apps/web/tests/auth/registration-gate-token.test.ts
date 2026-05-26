import { describe, expect, it } from "vitest";
import { createRegistrationGateToken, verifyRegistrationGateToken } from "@/features/auth/server/registration-gate-token";

describe("registration gate token", () => {
  it("verifies a freshly signed token", () => {
    const token = createRegistrationGateToken({ secret: "test-secret", now: 1_000 });

    expect(
      verifyRegistrationGateToken({
        token,
        secret: "test-secret",
        maxAgeMs: 60_000,
        now: 2_000,
      }),
    ).toBe(true);
  });

  it("rejects a forged boolean cookie value", () => {
    expect(
      verifyRegistrationGateToken({
        token: "true",
        secret: "test-secret",
        maxAgeMs: 60_000,
        now: 2_000,
      }),
    ).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createRegistrationGateToken({ secret: "test-secret", now: 1_000 });

    expect(
      verifyRegistrationGateToken({
        token,
        secret: "test-secret",
        maxAgeMs: 60_000,
        now: 70_001,
      }),
    ).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createRegistrationGateToken({ secret: "test-secret", now: 1_000 });

    expect(
      verifyRegistrationGateToken({
        token,
        secret: "other-secret",
        maxAgeMs: 60_000,
        now: 2_000,
      }),
    ).toBe(false);
  });
});
