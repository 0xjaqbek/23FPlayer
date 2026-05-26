import { cookies } from "next/headers";
import { verifyRegistrationGateToken } from "./registration-gate-token";

export const registrationGateCookieName = "registration_gate_passed";
export const registrationGateCookieMaxAgeSeconds = 15 * 60;
export const registrationGateCookieMaxAgeMs = registrationGateCookieMaxAgeSeconds * 1000;

export function getRegistrationGateSecret() {
  return process.env.REGISTRATION_GATE_TOKEN_SECRET || process.env.AUTH_SECRET || process.env.REGISTRATION_ACCESS_PASSWORD;
}

export function hasValidRegistrationGateCookie(token: string | undefined) {
  return verifyRegistrationGateToken({
    token,
    secret: getRegistrationGateSecret(),
    maxAgeMs: registrationGateCookieMaxAgeMs,
  });
}

export function clearRegistrationGateCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(registrationGateCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/register",
  });
}
