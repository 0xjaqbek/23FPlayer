import { hasReachedChangeThreshold } from "./vote-threshold";

export type VoteProgress = {
  votes: number;
  presentListeners: number;
  requiredVotes: number;
  thresholdReached: boolean;
  hasVoted: boolean;
  voteRecorded: boolean;
};

export type VoteServiceRepository = {
  findLiveBroadcastSession(): Promise<{ id: string; djProfileId: string } | null>;
  hasWaitingQueueEntry(): Promise<boolean>;
  isUserPresent(userId: string, now: Date): Promise<boolean>;
  hasUserVoted(broadcastSessionId: string, userId: string): Promise<boolean>;
  createVote(broadcastSessionId: string, userId: string): Promise<boolean>;
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
      hasVoted: false,
      voteRecorded: false,
    };
  }

  const present = await repository.isUserPresent(userId, now);

  if (!present) {
    const [votes, presentListeners] = await Promise.all([
      repository.countVotes(liveSession.id),
      repository.countPresentListeners(now),
    ]);

    return {
      votes,
      presentListeners,
      requiredVotes: presentListeners > 0 ? Math.ceil(presentListeners * 0.6) : 0,
      thresholdReached: false,
      hasVoted: false,
      voteRecorded: false,
    };
  }

  const alreadyVoted = await repository.hasUserVoted(liveSession.id, userId);
  let voteRecorded = false;

  if (!alreadyVoted) {
    voteRecorded = await repository.createVote(liveSession.id, userId);
  }

  const [votes, presentListeners] = await Promise.all([
    repository.countVotes(liveSession.id),
    repository.countPresentListeners(now),
  ]);
  const requiredVotes = presentListeners > 0 ? Math.ceil(presentListeners * 0.6) : 0;
  const thresholdReached = hasReachedChangeThreshold({ votes, presentListeners });

  if (thresholdReached && voteRecorded) {
    await repository.promoteNextDjAfterVote(liveSession.id, liveSession.djProfileId);
  }

  return {
    votes,
    presentListeners,
    requiredVotes,
    thresholdReached: thresholdReached && voteRecorded,
    hasVoted: true,
    voteRecorded,
  };
}
