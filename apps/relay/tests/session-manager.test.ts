import { describe, expect, it, vi } from "vitest";
import { createBroadcastTokenForTest, verifyBroadcastToken, verifyListenerToken } from "../src/auth.js";
import { SessionManager, type RelayClient } from "../src/session-manager.js";

function createClient() {
  return {
    sent: [] as Buffer[],
    closed: false,
    writable: true,
    send(data: Buffer) {
      if (!this.writable) {
        return false;
      }
      this.sent.push(data);
      return true;
    },
    close() {
      this.closed = true;
    },
  } satisfies RelayClient & { sent: Buffer[]; closed: boolean; writable: boolean };
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

  it("validates listener tokens against the relay secret", () => {
    expect(verifyListenerToken("secret", "secret")).toBe(true);
    expect(verifyListenerToken("wrong", "secret")).toBe(false);
  });
});

describe("SessionManager", () => {
  it("accepts only one active broadcaster for a session", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const first = createClient();
    const second = createClient();

    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, first)).toBe(true);
    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, second)).toBe(false);
  });

  it("sends broadcaster chunks to listeners", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const listener = createClient();

    manager.addListener(listener);
    manager.broadcastChunk(Buffer.from("audio"));

    expect(listener.sent).toEqual([Buffer.from("audio")]);
  });

  it("replays recent buffered chunks to new listeners", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const listener = createClient();

    manager.broadcastChunk(Buffer.from("before"));
    manager.addListener(listener);

    expect(listener.sent).toEqual([Buffer.from("before")]);
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

  it("rejects a different session during grace recovery", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const broadcaster = createClient();

    manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, broadcaster);
    manager.disconnectBroadcaster(broadcaster);

    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-2", djProfileId: "dj-2", expiresAt: 1_000 }, createClient())).toBe(false);
    expect(manager.acceptBroadcaster({ broadcastSessionId: "session-1", djProfileId: "dj-1", expiresAt: 1_000 }, createClient())).toBe(true);
  });

  it("removes listeners that cannot accept chunks", () => {
    const manager = new SessionManager(15_000, vi.fn());
    const listener = createClient();
    listener.writable = false;
    manager.addListener(listener);

    manager.broadcastChunk(Buffer.from("audio"));

    expect(listener.closed).toBe(true);
    expect(manager.listenerCount()).toBe(0);
  });
});
