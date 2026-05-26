import { describe, expect, it, vi } from "vitest";
import { createBroadcastTokenForTest, verifyBroadcastToken } from "../src/auth";
import { SessionManager, type RelayClient } from "../src/session-manager";

function createClient() {
  return {
    sent: [] as Buffer[],
    closed: false,
    send(data: Buffer) {
      this.sent.push(data);
    },
    close() {
      this.closed = true;
    },
  } satisfies RelayClient & { sent: Buffer[]; closed: boolean };
}

describe("verifyBroadcastToken", () => {
  it("accepts a valid signed token", () => {
    const token = createBroadcastTokenForTest(
      {
        broadcastSessionId: "session-1",
        djProfileId: "dj-1",
        expiresAt: 1_000,
      },
      "secret",
    );

    expect(verifyBroadcastToken(token, "secret", 999)).toEqual({
      broadcastSessionId: "session-1",
      djProfileId: "dj-1",
      expiresAt: 1_000,
    });
  });

  it("rejects an invalid token", () => {
    expect(verifyBroadcastToken("bad", "secret", 999)).toBeNull();
  });
});

describe("SessionManager", () => {
  it("accepts only one active broadcaster for a session", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const first = createClient();
    const second = createClient();

    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, first)).toBe(true);
    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-2", djProfileId: "dj-2", expiresAt: 1_000 }, second)).toBe(false);
  });

  it("sends broadcaster chunks to listeners", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const listener = createClient();

    manager.addListener(listener);
    manager.broadcastChunk(Buffer.from("audio"));

    expect(listener.sent).toEqual([Buffer.from("audio")]);
  });

  it("starts grace timer when broadcaster disconnects", () => {
    vi.useFakeTimers();
    const onGraceExpired = vi.fn();
    const manager = new SessionManager(15_000, onGraceExpired);
    const broadcaster = createClient();

    manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, broadcaster);
    manager.disconnectBroadcaster(broadcaster);
    vi.advanceTimersByTime(15_000);

    expect(onGraceExpired).toHaveBeenCalledWith("session-1");
    vi.useRealTimers();
  });
});
