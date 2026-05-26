import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { presenceWindowMs } from "@/features/antenna/server/presence-service";
import { voteToChangeDj, type VoteServiceRepository } from "@/features/antenna/server/vote-service";
import { prisma } from "@/lib/prisma";

function createPrismaVoteRepository(): VoteServiceRepository {
  return {
    async findLiveBroadcastSession() {
      const streamState = await prisma.streamState.findUnique({
        where: { id: "global" },
        include: { activeBroadcastSession: true },
      });

      if (streamState?.status !== "LIVE" || !streamState.activeBroadcastSession) {
        return null;
      }

      return {
        id: streamState.activeBroadcastSession.id,
        djProfileId: streamState.activeBroadcastSession.djProfileId,
      };
    },
    async hasWaitingQueueEntry() {
      return (
        (await prisma.djQueueEntry.count({
          where: { status: "WAITING" },
        })) > 0
      );
    },
    async hasUserVoted(broadcastSessionId, userId) {
      return Boolean(
        await prisma.changeVote.findUnique({
          where: {
            broadcastSessionId_userId: {
              broadcastSessionId,
              userId,
            },
          },
        }),
      );
    },
    async createVote(broadcastSessionId, userId) {
      try {
        await prisma.changeVote.create({
          data: {
            broadcastSessionId,
            userId,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return;
        }

        throw error;
      }
    },
    async countVotes(broadcastSessionId) {
      return prisma.changeVote.count({
        where: { broadcastSessionId },
      });
    },
    async countPresentListeners(now) {
      return prisma.listenerPresence.count({
        where: {
          lastHeartbeatAt: {
            gte: new Date(now.getTime() - presenceWindowMs),
          },
        },
      });
    },
    async promoteNextDjAfterVote(currentBroadcastSessionId, currentDjProfileId) {
      await prisma.$transaction(
        async (tx) => {
          await tx.broadcastSession.update({
            where: { id: currentBroadcastSessionId },
            data: {
              status: "INTERRUPTED",
              endedAt: new Date(),
              endReason: "listener_vote",
            },
          });

          await tx.djQueueEntry.updateMany({
            where: {
              djProfileId: currentDjProfileId,
              status: "ACTIVE",
            },
            data: {
              status: "COOLDOWN",
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
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
  };
}

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

  const progress = await voteToChangeDj(createPrismaVoteRepository(), session.user.id);

  return NextResponse.json({
    canVote: !progress.thresholdReached && progress.requiredVotes > 0,
    hasVoted: true,
    votes: progress.votes,
    presentListeners: progress.presentListeners,
    requiredVotes: progress.requiredVotes,
  });
}
