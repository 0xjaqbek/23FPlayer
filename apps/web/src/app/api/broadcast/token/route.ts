import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const tokenTtlSeconds = 60;

function signBroadcastToken(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createBroadcastToken(input: { broadcastSessionId: string; djProfileId: string }) {
  const secret = process.env.RELAY_SHARED_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Broadcast token secret is not configured.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const payload = `${input.broadcastSessionId}.${input.djProfileId}.${expiresAt}`;
  const signature = signBroadcastToken(payload, secret);

  return `${payload}.${signature}`;
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const djProfile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!djProfile?.active) {
    return NextResponse.json({ error: "DJ profile required" }, { status: 403 });
  }

  const activeEntry = await prisma.djQueueEntry.findFirst({
    where: {
      djProfileId: djProfile.id,
      status: "ACTIVE",
    },
  });

  if (!activeEntry) {
    return NextResponse.json({ error: "Antenna is not assigned to this DJ" }, { status: 403 });
  }

  const streamState = await prisma.streamState.findUnique({
    where: { id: "global" },
    include: { activeBroadcastSession: true },
  });

  if (
    streamState?.status === "LIVE" &&
    streamState.activeDjProfileId !== djProfile.id
  ) {
    return NextResponse.json({ error: "Another DJ is live" }, { status: 409 });
  }

  const broadcastSession =
    streamState?.status === "LIVE" && streamState.activeBroadcastSession?.djProfileId === djProfile.id
      ? streamState.activeBroadcastSession
      : await prisma.$transaction(async (tx) => {
          const nextSession = await tx.broadcastSession.create({
            data: {
              djProfileId: djProfile.id,
              status: "LIVE",
              startedAt: new Date(),
            },
          });

          await tx.streamState.upsert({
            where: { id: "global" },
            create: {
              id: "global",
              status: "LIVE",
              activeBroadcastSessionId: nextSession.id,
              activeDjProfileId: djProfile.id,
            },
            update: {
              status: "LIVE",
              activeBroadcastSessionId: nextSession.id,
              activeDjProfileId: djProfile.id,
            },
          });

          return nextSession;
        });

  return NextResponse.json({
    token: createBroadcastToken({
      broadcastSessionId: broadcastSession.id,
      djProfileId: djProfile.id,
    }),
    websocketUrl: process.env.RELAY_PUBLIC_WS_URL ?? "ws://localhost:4010/broadcast",
    expiresIn: tokenTtlSeconds,
  });
}
