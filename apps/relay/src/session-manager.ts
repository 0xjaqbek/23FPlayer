import type { BroadcastTokenClaims } from "./auth";

export type RelayClient = {
  send(data: Buffer): void;
  close(): void;
};

type HandoverCallback = (broadcastSessionId: string) => void | Promise<void>;

export class SessionManager {
  private broadcaster: { claims: BroadcastTokenClaims; client: RelayClient } | null = null;
  private listeners = new Set<RelayClient>();
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly gracePeriodMs: number,
    private readonly onGraceExpired: HandoverCallback,
  ) {}

  acceptBroadcaster(claims: BroadcastTokenClaims, client: RelayClient) {
    if (this.broadcaster && this.broadcaster.claims.broadcastSessionId !== claims.broadcastSessionId) {
      return false;
    }

    if (this.broadcaster) {
      this.broadcaster.client.close();
    }

    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }

    this.broadcaster = { claims, client };
    return true;
  }

  disconnectBroadcaster(client: RelayClient) {
    if (!this.broadcaster || this.broadcaster.client !== client) {
      return;
    }

    const sessionId = this.broadcaster.claims.broadcastSessionId;
    this.broadcaster = null;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      void this.onGraceExpired(sessionId);
    }, this.gracePeriodMs);
  }

  addListener(client: RelayClient) {
    this.listeners.add(client);
  }

  removeListener(client: RelayClient) {
    this.listeners.delete(client);
  }

  broadcastChunk(data: Buffer) {
    for (const listener of this.listeners) {
      listener.send(data);
    }
  }

  hasBroadcaster() {
    return Boolean(this.broadcaster);
  }

  listenerCount() {
    return this.listeners.size;
  }
}
