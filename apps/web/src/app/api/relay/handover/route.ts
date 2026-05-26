import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isRelayAuthorized(authorization: string | null) {
  const secret = process.env.RELAY_SHARED_SECRET;
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isRelayAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { broadcastSessionId?: string };

  if (!body.broadcastSessionId) {
    return NextResponse.json({ error: "broadcastSessionId is required" }, { status: 400 });
  }

  await prisma.$transaction(
    async (tx) => {
      const streamState = await tx.streamState.findFirst({
        where: {
          status: "LIVE",
          activeBroadcastSessionId: body.broadcastSessionId,
        },
      });

      if (!streamState?.activeDjProfileId) {
        return;
      }

      await tx.broadcastSession.update({
        where: { id: body.broadcastSessionId },
        data: {
          status: "INTERRUPTED",
          endedAt: new Date(),
          endReason: "relay_disconnect",
        },
      });

      await tx.djQueueEntry.updateMany({
        where: {
          djProfileId: streamState.activeDjProfileId,
          status: "ACTIVE",
        },
        data: {
          status: "COMPLETED",
        },
      });

      const nextEntry = await tx.djQueueEntry.findFirst({
        where: { status: "WAITING" },
        orderBy: { queuedAt: "asc" },
      });

      if (nextEntry) {
        await tx.djQueueEntry.update({
          where: { id: nextEntry.id },
          data: { status: "ACTIVE" },
        });

        await tx.streamState.update({
          where: { id: "global" },
          data: {
            status: "WAITING_FOR_DJ",
            activeBroadcastSessionId: null,
            activeDjProfileId: nextEntry.djProfileId,
          },
        });
        return;
      }

      await tx.streamState.update({
        where: { id: "global" },
        data: {
          status: "IDLE",
          activeBroadcastSessionId: null,
          activeDjProfileId: null,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return NextResponse.json({ ok: true });
}
