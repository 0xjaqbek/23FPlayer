export type BroadcastTokenAuthInput = {
  djProfileActive: boolean;
  hasActiveQueueEntry: boolean;
  streamStatus: "IDLE" | "WAITING_FOR_DJ" | "LIVE" | "HANDOVER" | "RELAY_UNAVAILABLE";
  streamActiveDjProfileId: string | null;
  djProfileId: string;
};

export function canCreateBroadcastToken(input: BroadcastTokenAuthInput) {
  if (!input.djProfileActive || !input.hasActiveQueueEntry) {
    return false;
  }

  if (input.streamStatus === "LIVE") {
    return input.streamActiveDjProfileId === input.djProfileId;
  }

  return input.streamStatus === "WAITING_FOR_DJ" && input.streamActiveDjProfileId === input.djProfileId;
}
