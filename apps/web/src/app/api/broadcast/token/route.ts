import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

async function runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Serializable transaction retry failed.");
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

  const broadcastSession = await runSerializableTransaction(async (tx) => {
    const activeEntry = await tx.djQueueEntry.findFirst({
      where: {
        djProfileId: djProfile.id,
        status: "ACTIVE",
      },
    });

    if (!activeEntry) {
      return null;
    }

    const streamState = await tx.streamState.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        status: "WAITING_FOR_DJ",
        activeDjProfileId: djProfile.id,
      },
      update: {
        updatedAt: new Date(),
      },
      include: {
        activeBroadcastSession: true,
      },
    });

    if (streamState.status === "LIVE") {
      if (streamState.activeDjProfileId !== djProfile.id || !streamState.activeBroadcastSession) {
        return null;
      }

      return streamState.activeBroadcastSession;
    }

    if (streamState.status !== "WAITING_FOR_DJ" || streamState.activeDjProfileId !== djProfile.id) {
      return null;
    }

    const nextSession = await tx.broadcastSession.create({
      data: {
        djProfileId: djProfile.id,
        status: "LIVE",
        startedAt: new Date(),
      },
    });

    await tx.streamState.update({
      where: { id: "global" },
      data: {
        status: "LIVE",
        activeBroadcastSessionId: nextSession.id,
        activeDjProfileId: djProfile.id,
      },
    });

    return nextSession;
  });

  if (!broadcastSession) {
    return NextResponse.json({ error: "Antenna is not assigned to this DJ" }, { status: 403 });
  }

  return NextResponse.json({
    token: createBroadcastToken({
      broadcastSessionId: broadcastSession.id,
      djProfileId: djProfile.id,
    }),
    websocketUrl: process.env.RELAY_PUBLIC_WS_URL ?? "ws://localhost:4010/broadcast",
    expiresIn: tokenTtlSeconds,
  });
}
