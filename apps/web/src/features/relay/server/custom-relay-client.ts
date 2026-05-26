import { createHmac } from "node:crypto";
import type { AudioRelay, BroadcastTokenInput } from "./audio-relay";

const tokenTtlSeconds = 60;

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

export class CustomAudioRelayClient implements AudioRelay {
  async createBroadcastToken(input: BroadcastTokenInput) {
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

      return response.json();
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
    return process.env.RELAY_PUBLIC_STREAM_URL ?? null;
  }
}

function createLocalBroadcastToken(input: BroadcastTokenInput) {
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
