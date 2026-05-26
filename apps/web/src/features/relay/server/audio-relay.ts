export type BroadcastTokenInput = {
  broadcastSessionId: string;
  djProfileId: string;
};

export type BroadcastTokenResult = {
  token: string;
  websocketUrl: string;
  expiresIn: number;
};

export type AudioRelay = {
  createBroadcastToken(input: BroadcastTokenInput): Promise<BroadcastTokenResult>;
  endBroadcast(broadcastSessionId: string): Promise<void>;
  getStreamUrl(): string | null;
};
