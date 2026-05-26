import { prisma } from "@/lib/prisma";
import { audioRelay } from "@/features/relay/server/custom-relay-client";

export type ListenerQueueEntry = {
  id: string;
  displayName: string;
  city: string;
  soundsystem: string;
  queuedAt: string;
};

export type ListenerState = {
  stream: {
    status: "idle" | "waiting_for_dj" | "live" | "handover" | "relay_unavailable";
    url: string | null;
  };
  activeDj: {
    displayName: string;
    city: string;
    soundsystem: string;
    description: string;
  } | null;
  listenerCount: number;
  queue: ListenerQueueEntry[];
  vote: {
    canVote: boolean;
    hasVoted: boolean;
    votes: number;
    presentListeners: number;
    requiredVotes: number;
  };
};

const streamStatusMap = {
  IDLE: "idle",
  WAITING_FOR_DJ: "waiting_for_dj",
  LIVE: "live",
  HANDOVER: "handover",
  RELAY_UNAVAILABLE: "relay_unavailable",
} as const;

const presenceWindowMs = 30 * 1000;

export async function getListenerState(userId: string | undefined): Promise<ListenerState> {
  const now = new Date();
  const presenceCutoff = new Date(now.getTime() - presenceWindowMs);

  if (userId) {
    await prisma.listenerPresence.upsert({
      where: { userId },
      create: {
        userId,
        lastHeartbeatAt: now,
        currentPage: "player",
        listeningState: "open",
      },
      update: {
        lastHeartbeatAt: now,
        currentPage: "player",
        listeningState: "open",
      },
    });
  }

  const [streamState, queue, listenerCount] = await Promise.all([
    prisma.streamState.findUnique({
      where: { id: "global" },
      include: {
        activeDjProfile: true,
        activeBroadcastSession: {
          include: {
            changeVotes: true,
          },
        },
      },
    }),
    prisma.djQueueEntry.findMany({
      where: { status: "WAITING" },
      orderBy: { queuedAt: "asc" },
      include: { djProfile: true },
    }),
    prisma.listenerPresence.count({
      where: {
        lastHeartbeatAt: {
          gte: presenceCutoff,
        },
      },
    }),
  ]);

  const votes = streamState?.activeBroadcastSession?.changeVotes.length ?? 0;
  const hasVoted = Boolean(
    userId && streamState?.activeBroadcastSession?.changeVotes.some((vote) => vote.userId === userId),
  );
  const requiredVotes = listenerCount > 0 ? Math.ceil(listenerCount * 0.6) : 0;
  const status = streamState ? streamStatusMap[streamState.status] : "idle";

  return {
    stream: {
      status,
      url: status === "live" ? audioRelay.getStreamUrl() : null,
    },
    activeDj: streamState?.activeDjProfile
      ? {
          displayName: streamState.activeDjProfile.displayName,
          city: streamState.activeDjProfile.city,
          soundsystem: streamState.activeDjProfile.soundsystem,
          description: streamState.activeDjProfile.description,
        }
      : null,
    listenerCount,
    queue: queue.map((entry) => ({
      id: entry.id,
      displayName: entry.djProfile.displayName,
      city: entry.djProfile.city,
      soundsystem: entry.djProfile.soundsystem,
      queuedAt: entry.queuedAt.toISOString(),
    })),
    vote: {
      canVote:
        status === "live" && queue.length > 0 && listenerCount > 0 && Boolean(streamState?.activeBroadcastSessionId),
      hasVoted,
      votes,
      presentListeners: listenerCount,
      requiredVotes,
    },
  };
}
