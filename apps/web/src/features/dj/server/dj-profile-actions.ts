"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const djProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  soundsystem: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(500),
  active: z.coerce.boolean().default(true),
});

export type DjProfileActionState = {
  error?: string;
};

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

export async function saveDjProfile(_state: DjProfileActionState, formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = djProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    city: formData.get("city"),
    soundsystem: formData.get("soundsystem"),
    description: formData.get("description"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: "Check the DJ profile fields and try again." };
  }

  await prisma.djProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...parsed.data,
    },
    update: parsed.data,
  });

  redirect("/dj");
}

export async function joinDjQueue() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const djProfile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!djProfile?.active) {
    redirect("/profile");
  }

  await runSerializableTransaction(async (tx) => {
    const existingEntry = await tx.djQueueEntry.findFirst({
      where: {
        djProfileId: djProfile.id,
        status: {
          in: ["WAITING", "ACTIVE"],
        },
      },
    });

    if (existingEntry) {
      return;
    }

    const streamState = await tx.streamState.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        status: "IDLE",
      },
      update: {
        updatedAt: new Date(),
      },
    });

    const activeQueueEntry = await tx.djQueueEntry.findFirst({
      where: { status: "ACTIVE" },
    });
    const antennaIsAvailable = streamState?.status !== "LIVE" && !activeQueueEntry;

    await tx.djQueueEntry.create({
      data: {
        djProfileId: djProfile.id,
        status: antennaIsAvailable ? "ACTIVE" : "WAITING",
      },
    });

    if (antennaIsAvailable) {
      await tx.streamState.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          status: "WAITING_FOR_DJ",
          activeDjProfileId: djProfile.id,
        },
        update: {
          status: "WAITING_FOR_DJ",
          activeDjProfileId: djProfile.id,
          activeBroadcastSessionId: null,
        },
      });
    }
  });

  redirect("/dj");
}

export async function startBroadcast() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const djProfile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!djProfile?.active) {
    redirect("/profile");
  }

  const activeEntry = await prisma.djQueueEntry.findFirst({
    where: {
      djProfileId: djProfile.id,
      status: "ACTIVE",
    },
  });

  if (!activeEntry) {
    redirect("/dj");
  }

  await runSerializableTransaction(async (tx) => {
    const streamState = await tx.streamState.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        status: "IDLE",
      },
      update: {
        updatedAt: new Date(),
      },
    });

    const txActiveEntry = await tx.djQueueEntry.findFirst({
      where: {
        id: activeEntry.id,
        djProfileId: djProfile.id,
        status: "ACTIVE",
      },
    });

    if (
      !txActiveEntry ||
      streamState.status === "LIVE" ||
      (streamState.activeDjProfileId && streamState.activeDjProfileId !== djProfile.id)
    ) {
      return;
    }

    const sessionRecord = await tx.broadcastSession.create({
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
        activeBroadcastSessionId: sessionRecord.id,
        activeDjProfileId: djProfile.id,
      },
      update: {
        status: "LIVE",
        activeBroadcastSessionId: sessionRecord.id,
        activeDjProfileId: djProfile.id,
      },
    });
  });

  redirect("/dj");
}

export async function handOverAntenna() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const djProfile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!djProfile) {
    redirect("/profile");
  }

  const streamState = await prisma.streamState.findUnique({
    where: { id: "global" },
  });

  if (streamState?.activeDjProfileId !== djProfile.id || !streamState.activeBroadcastSessionId) {
    redirect("/dj");
  }

  await runSerializableTransaction(async (tx) => {
    await tx.broadcastSession.update({
      where: { id: streamState.activeBroadcastSessionId! },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        endReason: "handed_over",
      },
    });

    await tx.djQueueEntry.updateMany({
      where: {
        djProfileId: djProfile.id,
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
    } else {
      await tx.streamState.update({
        where: { id: "global" },
        data: {
          status: "IDLE",
          activeBroadcastSessionId: null,
          activeDjProfileId: null,
        },
      });
    }
  });

  redirect("/dj");
}
