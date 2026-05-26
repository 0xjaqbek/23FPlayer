import { createHmac } from "node:crypto";
import { z } from "zod";
import type { AudioRelay, BroadcastTokenInput, BroadcastTokenResult } from "./audio-relay";

const tokenTtlSeconds = 60;
const listenerTokenTtlSeconds = 5 * 60;
const broadcastTokenResultSchema = z.object({
  token: z.string().min(1),
  websocketUrl: z.string().url().or(z.string().startsWith("ws://")).or(z.string().startsWith("wss://")),
  expiresIn: z.number().int().positive(),
});

function signBroadcastToken(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getRelaySecret() {
  const secret = process.env.RELAY_SHARED_SECRET;

  if (!secret) {
    throw new Error("Relay shared secret is not configured.");
  }

  return secret;
}

function getListenerSecret() {
  const secret = process.env.RELAY_LISTENER_SECRET;

  if (!secret) {
    throw new Error("Relay listener secret is not configured.");
  }

  return secret;
}

export class CustomAudioRelayClient implements AudioRelay {
  async createBroadcastToken(input: BroadcastTokenInput): Promise<BroadcastTokenResult> {
    const internalUrl = process.env.RELAY_INTERNAL_URL;

    if (internalUrl) {
      const response = await fetch(`${internalUrl}/broadcast/token`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${getRelaySecret()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error("Relay rejected broadcast token request.");
      }

      return broadcastTokenResultSchema.parse(await response.json());
    }

    return createLocalBroadcastToken(input);
  }

  async endBroadcast(_broadcastSessionId: string) {
    const internalUrl = process.env.RELAY_INTERNAL_URL;

    if (!internalUrl) {
      return;
    }

    await fetch(`${internalUrl}/broadcast/end`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${getRelaySecret()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ broadcastSessionId: _broadcastSessionId }),
    });
  }

  getStreamUrl() {
    const streamUrl = process.env.RELAY_PUBLIC_STREAM_URL;

    if (!streamUrl) {
      return null;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + listenerTokenTtlSeconds;
    const payload = `listener.${expiresAt}`;
    const signature = signBroadcastToken(payload, getListenerSecret());
    const url = new URL(streamUrl);
    url.searchParams.set("token", `${payload}.${signature}`);

    return url.toString();
  }
}

function createLocalBroadcastToken(input: BroadcastTokenInput): BroadcastTokenResult {
  const expiresAt = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const payload = `${input.broadcastSessionId}.${input.djProfileId}.${expiresAt}`;
  const signature = signBroadcastToken(payload, getRelaySecret());

  return {
    token: `${payload}.${signature}`,
    websocketUrl: process.env.RELAY_PUBLIC_WS_URL ?? "ws://localhost:4010/broadcast",
    expiresIn: tokenTtlSeconds,
  };
}

export const audioRelay = new CustomAudioRelayClient();
