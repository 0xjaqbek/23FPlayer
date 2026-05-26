export type QueueEntryRecord = {
  id: string;
  djProfileId: string;
  queuedAt: Date;
  status: "WAITING" | "ACTIVE" | "SKIPPED" | "COMPLETED" | "COOLDOWN";
};

export type QueueRepository = {
  findActiveOrWaitingByDjProfileId(djProfileId: string): Promise<QueueEntryRecord | null>;
  createWaitingEntry(djProfileId: string): Promise<QueueEntryRecord>;
  findWaitingEntries(): Promise<QueueEntryRecord[]>;
  findFirstWaitingEntry(): Promise<QueueEntryRecord | null>;
  markEntryActive(entryId: string): Promise<QueueEntryRecord>;
  markEntryCompleted(entryId: string): Promise<QueueEntryRecord>;
};

export async function joinQueue(repository: QueueRepository, djProfileId: string) {
  const existingEntry = await repository.findActiveOrWaitingByDjProfileId(djProfileId);

  if (existingEntry) {
    return existingEntry;
  }

  return repository.createWaitingEntry(djProfileId);
}

export async function getQueue(repository: QueueRepository) {
  return repository.findWaitingEntries();
}

export async function promoteNextDj(repository: QueueRepository) {
  const nextEntry = await repository.findFirstWaitingEntry();

  if (!nextEntry) {
    return null;
  }

  return repository.markEntryActive(nextEntry.id);
}

export async function leaveQueue(repository: QueueRepository, entryId: string) {
  return repository.markEntryCompleted(entryId);
}
