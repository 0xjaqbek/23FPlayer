import { beforeEach, describe, expect, it } from "vitest";
import { getQueue, joinQueue, promoteNextDj, type QueueEntryRecord, type QueueRepository } from "@/features/antenna/server/queue-service";

function createInMemoryQueueRepository(): QueueRepository & { entries: QueueEntryRecord[]; liveBroadcast: boolean } {
  const entries: QueueEntryRecord[] = [];
  let liveBroadcast = false;

  return {
    entries,
    get liveBroadcast() {
      return liveBroadcast;
    },
    set liveBroadcast(value: boolean) {
      liveBroadcast = value;
    },
    async findActiveOrWaitingByDjProfileId(djProfileId) {
      return entries.find((entry) => entry.djProfileId === djProfileId && ["ACTIVE", "WAITING"].includes(entry.status)) ?? null;
    },
    async createWaitingEntry(djProfileId) {
      const entry = {
        id: `queue-${entries.length + 1}`,
        djProfileId,
        queuedAt: new Date(1_000 + entries.length),
        status: "WAITING" as const,
      };
      entries.push(entry);
      return entry;
    },
    async findWaitingEntries() {
      return entries.filter((entry) => entry.status === "WAITING").sort((left, right) => left.queuedAt.getTime() - right.queuedAt.getTime());
    },
    async findFirstWaitingEntry() {
      return (await this.findWaitingEntries())[0] ?? null;
    },
    async hasLiveBroadcast() {
      return liveBroadcast;
    },
    async markEntryActive(entryId) {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry) {
        throw new Error("Queue entry not found.");
      }
      entry.status = "ACTIVE";
      return entry;
    },
    async markEntryCompleted(entryId) {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry) {
        throw new Error("Queue entry not found.");
      }
      entry.status = "COMPLETED";
      return entry;
    },
  };
}

describe("queue service", () => {
  let repository: QueueRepository & { entries: QueueEntryRecord[]; liveBroadcast: boolean };

  beforeEach(() => {
    repository = createInMemoryQueueRepository();
  });

  it("lets a DJ join an empty queue", async () => {
    const entry = await joinQueue(repository, "dj-1");

    expect(entry.status).toBe("WAITING");
    expect(await getQueue(repository)).toHaveLength(1);
  });

  it("does not let a DJ join twice while waiting", async () => {
    const firstEntry = await joinQueue(repository, "dj-1");
    const secondEntry = await joinQueue(repository, "dj-1");

    expect(secondEntry.id).toBe(firstEntry.id);
    expect(repository.entries).toHaveLength(1);
  });

  it("promotes the first waiting DJ when the antenna is available", async () => {
    await joinQueue(repository, "dj-1");
    await joinQueue(repository, "dj-2");

    const promoted = await promoteNextDj(repository);

    expect(promoted?.djProfileId).toBe("dj-1");
    expect(promoted?.status).toBe("ACTIVE");
    expect((await getQueue(repository)).map((entry) => entry.djProfileId)).toEqual(["dj-2"]);
  });

  it("does not promote a waiting DJ while another DJ is live", async () => {
    await joinQueue(repository, "dj-1");
    repository.liveBroadcast = true;

    const promoted = await promoteNextDj(repository);

    expect(promoted).toBeNull();
    expect((await getQueue(repository)).map((entry) => entry.djProfileId)).toEqual(["dj-1"]);
  });
});
