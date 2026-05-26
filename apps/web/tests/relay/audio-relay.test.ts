import { describe, expect, it, vi } from "vitest";
import { canCreateBroadcastToken } from "@/features/relay/server/broadcast-token-auth";
import { CustomAudioRelayClient } from "@/features/relay/server/custom-relay-client";

describe("CustomAudioRelayClient", () => {
  it("creates a signed broadcast token and relay websocket URL", async () => {
    vi.stubEnv("RELAY_SHARED_SECRET", "test-secret");
    vi.stubEnv("RELAY_PUBLIC_WS_URL", "ws://relay.test/broadcast");
    vi.setSystemTime(new Date("2026-05-26T10:00:00.000Z"));

    const relay = new CustomAudioRelayClient();
    const result = await relay.createBroadcastToken({
      broadcastSessionId: "session-1",
      djProfileId: "dj-1",
    });

    expect(result.websocketUrl).toBe("ws://relay.test/broadcast");
    expect(result.expiresIn).toBe(60);
    expect(result.token.split(".")).toHaveLength(4);
  });

  it("returns the configured stream URL", () => {
    vi.stubEnv("RELAY_PUBLIC_STREAM_URL", "https://relay.test/live.webm");

    const relay = new CustomAudioRelayClient();

    expect(relay.getStreamUrl()).toBe("https://relay.test/live.webm");
  });
});

describe("canCreateBroadcastToken", () => {
  it("allows the active queued DJ to create a broadcast token", () => {
    expect(
      canCreateBroadcastToken({
        djProfileActive: true,
        hasActiveQueueEntry: true,
        streamStatus: "WAITING_FOR_DJ",
        streamActiveDjProfileId: "dj-1",
        djProfileId: "dj-1",
      }),
    ).toBe(true);
  });

  it("rejects a non-active DJ", () => {
    expect(
      canCreateBroadcastToken({
        djProfileActive: true,
        hasActiveQueueEntry: false,
        streamStatus: "WAITING_FOR_DJ",
        streamActiveDjProfileId: "dj-1",
        djProfileId: "dj-2",
      }),
    ).toBe(false);
  });
});
