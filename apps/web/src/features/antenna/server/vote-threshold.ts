type VoteThresholdInput = {
  presentListeners: number;
  votes: number;
};

export function hasReachedChangeThreshold(input: VoteThresholdInput) {
  if (input.presentListeners <= 0) {
    return false;
  }

  const requiredVotes = Math.ceil(input.presentListeners * 0.6);
  return input.votes >= requiredVotes;
}
