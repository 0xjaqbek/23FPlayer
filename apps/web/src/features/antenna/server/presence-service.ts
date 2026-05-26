export const presenceWindowMs = 30 * 1000;

export type PresenceRecord = {
  userId: string;
  lastHeartbeatAt: Date;
};

export type PresenceRepository = {
  upsertHeartbeat(userId: string, now: Date): Promise<void>;
  findPresenceSince(cutoff: Date): Promise<PresenceRecord[]>;
};

export async function recordHeartbeat(repository: PresenceRepository, userId: string, now = new Date()) {
  await repository.upsertHeartbeat(userId, now);
}

export async function countPresentListeners(repository: PresenceRepository, now = new Date()) {
  const cutoff = new Date(now.getTime() - presenceWindowMs);
  const presentListeners = await repository.findPresenceSince(cutoff);

  return presentListeners.length;
}
