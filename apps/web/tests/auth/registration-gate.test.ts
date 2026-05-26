import { describe, expect, it } from "vitest";
import { validateRegistrationAccessPassword } from "@/features/auth/server/registration-gate";

describe("validateRegistrationAccessPassword", () => {
  it("accepts the configured access password", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "secret-scene-key",
        configuredPassword: "secret-scene-key",
      }),
    ).toBe(true);
  });

  it("rejects an incorrect access password", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "wrong",
        configuredPassword: "secret-scene-key",
      }),
    ).toBe(false);
  });

  it("rejects empty config", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "anything",
        configuredPassword: "",
      }),
    ).toBe(false);
  });
});
