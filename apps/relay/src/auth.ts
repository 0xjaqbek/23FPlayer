import { createHmac, timingSafeEqual } from "node:crypto";

export type BroadcastTokenClaims = {
  broadcastSessionId: string;
  djProfileId: string;
  expiresAt: number;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyBroadcastToken(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) {
    return null;
  }

  const [broadcastSessionId, djProfileId, expiresAtRaw, signature, ...extraParts] = token.split(".");

  if (!broadcastSessionId || !djProfileId || !expiresAtRaw || !signature || extraParts.length > 0) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    return null;
  }

  const payload = `${broadcastSessionId}.${djProfileId}.${expiresAtRaw}`;

  if (!safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  return {
    broadcastSessionId,
    djProfileId,
    expiresAt,
  } satisfies BroadcastTokenClaims;
}

export function createBroadcastTokenForTest(claims: BroadcastTokenClaims, secret: string) {
  const payload = `${claims.broadcastSessionId}.${claims.djProfileId}.${claims.expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}
