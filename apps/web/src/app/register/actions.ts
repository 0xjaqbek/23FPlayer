"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearRegistrationGateCookie,
  getRegistrationGateSecret,
  hasValidRegistrationGateCookie,
  registrationGateCookieMaxAgeSeconds,
  registrationGateCookieName,
} from "@/features/auth/server/registration-gate-cookie";
import { validateRegistrationAccessPassword } from "@/features/auth/server/registration-gate";
import { createRegistrationGateToken } from "@/features/auth/server/registration-gate-token";
import { prisma } from "@/lib/prisma";

const maxGateAttempts = 5;
const gateAttemptWindowMs = 10 * 60 * 1000;
const gateAttempts = new Map<string, { count: number; resetAt: number }>();

const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export type RegisterActionState = {
  error?: string;
};

async function getClientKey() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "local";
}

function isRateLimited(clientKey: string, now = Date.now()) {
  const current = gateAttempts.get(clientKey);

  if (!current || current.resetAt <= now) {
    gateAttempts.set(clientKey, { count: 1, resetAt: now + gateAttemptWindowMs });
    return false;
  }

  current.count += 1;
  return current.count > maxGateAttempts;
}

export async function submitRegistrationGate(_state: RegisterActionState, formData: FormData) {
  const clientKey = await getClientKey();
  const submittedPassword = String(formData.get("accessPassword") ?? "");
  const rateLimited = isRateLimited(clientKey);
  const validPassword = validateRegistrationAccessPassword({
    submittedPassword,
    configuredPassword: process.env.REGISTRATION_ACCESS_PASSWORD,
  });

  if (rateLimited || !validPassword) {
    return { error: "Invalid registration access." };
  }

  const cookieStore = await cookies();
  cookieStore.set(registrationGateCookieName, createRegistrationGateToken({ secret: getRegistrationGateSecret() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: registrationGateCookieMaxAgeSeconds,
    path: "/register",
  });

  redirect("/register");
}

export async function createAccount(_state: RegisterActionState, formData: FormData) {
  const cookieStore = await cookies();

  if (!hasValidRegistrationGateCookie(cookieStore.get(registrationGateCookieName)?.value)) {
    return { error: "Registration access is required." };
  }

  const parsed = registrationSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Check the registration fields and try again." };
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return { error: "Unable to create account with those details." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      displayName: parsed.data.displayName,
      email,
      passwordHash,
    },
  });

  clearRegistrationGateCookie(cookieStore);
  redirect("/login");
}
