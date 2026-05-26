"use server";

import { redirect } from "next/navigation";
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

  const existingEntry = await prisma.djQueueEntry.findFirst({
    where: {
      djProfileId: djProfile.id,
      status: {
        in: ["WAITING", "ACTIVE"],
      },
    },
  });

  if (!existingEntry) {
    await prisma.djQueueEntry.create({
      data: {
        djProfileId: djProfile.id,
      },
    });
  }

  redirect("/dj");
}
