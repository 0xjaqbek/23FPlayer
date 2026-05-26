import { createHmac, timingSafeEqual } from "node:crypto";

const tokenSeparator = ".";

type CreateRegistrationGateTokenInput = {
  secret: string | undefined;
  now?: number;
};

type VerifyRegistrationGateTokenInput = {
  token: string | undefined;
  secret: string | undefined;
  maxAgeMs: number;
  now?: number;
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

export function createRegistrationGateToken(input: CreateRegistrationGateTokenInput) {
  if (!input.secret) {
    throw new Error("Registration gate token secret is not configured.");
  }

  const issuedAt = String(input.now ?? Date.now());
  const signature = sign(issuedAt, input.secret);

  return `${issuedAt}${tokenSeparator}${signature}`;
}

export function verifyRegistrationGateToken(input: VerifyRegistrationGateTokenInput) {
  if (!input.secret || !input.token) {
    return false;
  }

  const [issuedAt, signature, ...extraParts] = input.token.split(tokenSeparator);

  if (!issuedAt || !signature || extraParts.length > 0) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);

  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  const now = input.now ?? Date.now();
  const ageMs = now - issuedAtMs;

  if (ageMs < 0 || ageMs > input.maxAgeMs) {
    return false;
  }

  return safeEqual(signature, sign(issuedAt, input.secret));
}
