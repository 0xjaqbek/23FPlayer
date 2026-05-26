import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.listenerPresence.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      lastHeartbeatAt: new Date(),
      currentPage: "player",
      listeningState: "open",
    },
    update: {
      lastHeartbeatAt: new Date(),
      currentPage: "player",
      listeningState: "open",
    },
  });

  return NextResponse.json({ ok: true });
}
