import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DjPanel } from "@/features/dj/components/dj-panel";
import { prisma } from "@/lib/prisma";

export default async function DjPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  const [queueEntries, streamState] = await Promise.all([
    prisma.djQueueEntry.findMany({
      where: { status: { in: ["WAITING", "ACTIVE"] } },
      orderBy: { queuedAt: "asc" },
    }),
    prisma.streamState.findUnique({
      where: { id: "global" },
    }),
  ]);

  const queueEntry = profile ? queueEntries.find((entry) => entry.djProfileId === profile.id) ?? null : null;
  const waitingEntries = queueEntries.filter((entry) => entry.status === "WAITING");
  const waitingIndex = queueEntry?.status === "WAITING" ? waitingEntries.findIndex((entry) => entry.id === queueEntry.id) : -1;
  const queuePosition = waitingIndex >= 0 ? waitingIndex + 1 : null;
  const isActiveDj = Boolean(profile && streamState?.activeDjProfileId === profile.id && streamState.status === "LIVE");
  const streamStatus = streamState?.status ?? "IDLE";
  const connectionStatus = isActiveDj ? "ready for browser broadcast" : "not connected";

  return (
    <DjPanel
      profile={profile}
      queueEntry={queueEntry}
      queuePosition={queuePosition}
      isActiveDj={isActiveDj}
      streamStatus={streamStatus}
      connectionStatus={connectionStatus}
    />
  );
}
