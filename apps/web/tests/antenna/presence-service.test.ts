import { describe, expect, it } from "vitest";
import { countPresentListeners, recordHeartbeat, type PresenceRecord, type PresenceRepository } from "@/features/antenna/server/presence-service";

function createPresenceRepository(initialRecords: PresenceRecord[] = []): PresenceRepository & { records: PresenceRecord[] } {
  const records = [...initialRecords];

  return {
    records,
    async upsertHeartbeat(userId, now) {
      const existingRecord = records.find((record) => record.userId === userId);

      if (existingRecord) {
        existingRecord.lastHeartbeatAt = now;
        return;
      }

      records.push({ userId, lastHeartbeatAt: now });
    },
    async findPresenceSince(cutoff) {
      return records.filter((record) => record.lastHeartbeatAt >= cutoff);
    },
  };
}

describe("presence service", () => {
  it("counts listeners with heartbeats inside the 30 second window", async () => {
    const now = new Date("2026-05-26T10:00:30.000Z");
    const repository = createPresenceRepository([
      { userId: "fresh", lastHeartbeatAt: new Date("2026-05-26T10:00:05.000Z") },
      { userId: "expired", lastHeartbeatAt: new Date("2026-05-26T09:59:59.000Z") },
    ]);

    expect(await countPresentListeners(repository, now)).toBe(1);
  });

  it("records a heartbeat for the current user", async () => {
    const now = new Date("2026-05-26T10:00:00.000Z");
    const repository = createPresenceRepository();

    await recordHeartbeat(repository, "user-1", now);

    expect(repository.records).toEqual([{ userId: "user-1", lastHeartbeatAt: now }]);
  });
});
