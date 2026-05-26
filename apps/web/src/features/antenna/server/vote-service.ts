import { hasReachedChangeThreshold } from "./vote-threshold";

export type VoteProgress = {
  votes: number;
  presentListeners: number;
  requiredVotes: number;
  thresholdReached: boolean;
};

export type VoteServiceRepository = {
  findLiveBroadcastSession(): Promise<{ id: string; djProfileId: string } | null>;
  hasWaitingQueueEntry(): Promise<boolean>;
  hasUserVoted(broadcastSessionId: string, userId: string): Promise<boolean>;
  createVote(broadcastSessionId: string, userId: string): Promise<void>;
  countVotes(broadcastSessionId: string): Promise<number>;
  countPresentListeners(now: Date): Promise<number>;
  promoteNextDjAfterVote(currentBroadcastSessionId: string, currentDjProfileId: string): Promise<void>;
};

export async function voteToChangeDj(repository: VoteServiceRepository, userId: string, now = new Date()): Promise<VoteProgress> {
  const liveSession = await repository.findLiveBroadcastSession();

  if (!liveSession || !(await repository.hasWaitingQueueEntry())) {
    return {
      votes: 0,
      presentListeners: 0,
      requiredVotes: 0,
      thresholdReached: false,
    };
  }

  if (!(await repository.hasUserVoted(liveSession.id, userId))) {
    await repository.createVote(liveSession.id, userId);
  }

  const [votes, presentListeners] = await Promise.all([
    repository.countVotes(liveSession.id),
    repository.countPresentListeners(now),
  ]);
  const requiredVotes = presentListeners > 0 ? Math.ceil(presentListeners * 0.6) : 0;
  const thresholdReached = hasReachedChangeThreshold({ votes, presentListeners });

  if (thresholdReached) {
    await repository.promoteNextDjAfterVote(liveSession.id, liveSession.djProfileId);
  }

  return {
    votes,
    presentListeners,
    requiredVotes,
    thresholdReached,
  };
}
