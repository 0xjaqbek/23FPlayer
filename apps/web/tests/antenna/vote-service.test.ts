import { describe, expect, it } from "vitest";
import { voteToChangeDj, type VoteServiceRepository } from "@/features/antenna/server/vote-service";

function createVoteRepository(options: {
  liveSession?: { id: string; djProfileId: string } | null;
  hasQueue?: boolean;
  existingVotes?: string[];
  presentListeners?: number;
}): VoteServiceRepository & { votes: string[]; promoted: boolean } {
  const votes = [...(options.existingVotes ?? [])];
  let promoted = false;

  return {
    get votes() {
      return votes;
    },
    get promoted() {
      return promoted;
    },
    async findLiveBroadcastSession() {
      return options.liveSession ?? { id: "session-1", djProfileId: "dj-1" };
    },
    async hasWaitingQueueEntry() {
      return options.hasQueue ?? true;
    },
    async hasUserVoted(_broadcastSessionId, userId) {
      return votes.includes(userId);
    },
    async createVote(_broadcastSessionId, userId) {
      votes.push(userId);
    },
    async countVotes() {
      return votes.length;
    },
    async countPresentListeners() {
      return options.presentListeners ?? 10;
    },
    async promoteNextDjAfterVote() {
      promoted = true;
    },
  };
}

describe("voteToChangeDj", () => {
  it("records one vote per user per broadcast session", async () => {
    const repository = createVoteRepository({ existingVotes: ["user-1"], presentListeners: 10 });

    const progress = await voteToChangeDj(repository, "user-1");

    expect(repository.votes).toEqual(["user-1"]);
    expect(progress.votes).toBe(1);
  });

  it("does not allow voting when the queue is empty", async () => {
    const repository = createVoteRepository({ hasQueue: false, presentListeners: 10 });

    const progress = await voteToChangeDj(repository, "user-1");

    expect(repository.votes).toEqual([]);
    expect(progress.thresholdReached).toBe(false);
  });

  it("promotes the next DJ when 60 percent is reached", async () => {
    const repository = createVoteRepository({
      existingVotes: ["user-1", "user-2", "user-3", "user-4", "user-5"],
      presentListeners: 10,
    });

    const progress = await voteToChangeDj(repository, "user-6");

    expect(progress).toEqual({
      votes: 6,
      presentListeners: 10,
      requiredVotes: 6,
      thresholdReached: true,
    });
    expect(repository.promoted).toBe(true);
  });
});
