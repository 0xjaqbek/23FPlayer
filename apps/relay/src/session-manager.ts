import type { BroadcastTokenClaims } from "./auth.js";

export type RelayClient = {
  send(data: Buffer): boolean;
  close(): void;
};

type HandoverCallback = (broadcastSessionId: string) => void | Promise<void>;

export class SessionManager {
  private broadcaster: { claims: BroadcastTokenClaims; client: RelayClient } | null = null;
  private listeners = new Set<RelayClient>();
  private headerChunk: Buffer | null = null;
  private chunkBuffer: Buffer[] = [];
  private bufferedBytes = 0;
  private recoveringSessionId: string | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly gracePeriodMs: number,
    private readonly onGraceExpired: HandoverCallback,
    private readonly maxBufferBytes = 1_000_000,
  ) {}

  acceptBroadcaster(claims: BroadcastTokenClaims, client: RelayClient) {
    if (this.broadcaster) {
      return false;
    }

    if (this.recoveringSessionId && this.recoveringSessionId !== claims.broadcastSessionId) {
      return false;
    }

    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }

    if (this.recoveringSessionId !== claims.broadcastSessionId) {
      this.clearBuffer();
    }

    this.recoveringSessionId = null;
    this.broadcaster = { claims, client };
    return true;
  }

  disconnectBroadcaster(client: RelayClient) {
    if (!this.broadcaster || this.broadcaster.client !== client) {
      return;
    }

    const sessionId = this.broadcaster.claims.broadcastSessionId;
    this.broadcaster = null;
    this.recoveringSessionId = sessionId;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.recoveringSessionId = null;
      this.clearBuffer();
      void this.onGraceExpired(sessionId);
    }, this.gracePeriodMs);
  }

  addListener(client: RelayClient) {
    this.listeners.add(client);
    if (this.headerChunk && !client.send(this.headerChunk)) {
      this.removeListener(client);
      client.close();
      return;
    }

    for (const chunk of this.chunkBuffer) {
      if (!client.send(chunk)) {
        this.removeListener(client);
        client.close();
        return;
      }
    }
  }

  removeListener(client: RelayClient) {
    this.listeners.delete(client);
  }

  broadcastChunk(data: Buffer) {
    this.bufferChunk(data);

    for (const listener of this.listeners) {
      if (!listener.send(data)) {
        this.removeListener(listener);
        listener.close();
      }
    }
  }

  hasBroadcaster() {
    return Boolean(this.broadcaster);
  }

  listenerCount() {
    return this.listeners.size;
  }

  private bufferChunk(data: Buffer) {
    if (data.length > this.maxBufferBytes) {
      return;
    }

    if (!this.headerChunk) {
      this.headerChunk = data;
      return;
    }

    this.chunkBuffer.push(data);
    this.bufferedBytes += data.length;

    while (this.bufferedBytes > this.maxBufferBytes) {
      const removedChunk = this.chunkBuffer.shift();
      this.bufferedBytes -= removedChunk?.length ?? 0;
    }
  }

  private clearBuffer() {
    this.headerChunk = null;
    this.chunkBuffer = [];
    this.bufferedBytes = 0;
  }
}
