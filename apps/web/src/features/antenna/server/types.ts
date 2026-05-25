export type BroadcastStatus = "PENDING" | "LIVE" | "ENDED" | "INTERRUPTED";

export type QueueStatus = "WAITING" | "ACTIVE" | "SKIPPED" | "COMPLETED" | "COOLDOWN";

export type StreamStatus = "IDLE" | "WAITING_FOR_DJ" | "LIVE" | "HANDOVER" | "RELAY_UNAVAILABLE";

export type VoteThresholdState = {
  presentListeners: number;
  votes: number;
  requiredVotes: number;
  reached: boolean;
};
