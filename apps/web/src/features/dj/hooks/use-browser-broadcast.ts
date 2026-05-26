"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BroadcastTokenResponse = {
  token: string;
  websocketUrl: string;
};

export type BroadcastConnectionState = "input missing" | "ready" | "connecting" | "broadcasting" | "reconnecting" | "disconnected";

export function useBrowserBroadcast(stream: MediaStream | null) {
  const [connectionState, setConnectionState] = useState<BroadcastConnectionState>("input missing");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (connectionState === "input missing" || connectionState === "ready") {
      setConnectionState(stream ? "ready" : "input missing");
    }
  }, [connectionState, stream]);

  const stopBroadcast = useCallback(() => {
    stoppedRef.current = true;
    recorderRef.current?.stop();
    recorderRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setConnectionState(stream ? "ready" : "input missing");
  }, [stream]);

  const startBroadcast = useCallback(async () => {
    if (!stream) {
      setConnectionState("input missing");
      return;
    }

    stoppedRef.current = false;

    async function connect(attempt: number) {
      setConnectionState(attempt > 0 ? "reconnecting" : "connecting");
      const tokenResponse = await fetch("/api/broadcast/token", { method: "POST" });

      if (!tokenResponse.ok) {
        setConnectionState("disconnected");
        return;
      }

      const { token, websocketUrl } = (await tokenResponse.json()) as BroadcastTokenResponse;
      const socket = new WebSocket(`${websocketUrl}?token=${encodeURIComponent(token)}`);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onopen = () => {
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
        });
        recorderRef.current = recorder;
        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(await event.data.arrayBuffer());
          }
        };
        recorder.start(1000);
        setConnectionState("broadcasting");
      };

      socket.onclose = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;

        if (!stoppedRef.current && attempt === 0) {
          void connect(1);
          return;
        }

        setConnectionState("disconnected");
      };

      socket.onerror = () => {
        setConnectionState("reconnecting");
      };
    }

    await connect(0);
  }, [stream]);

  return {
    connectionState,
    startBroadcast,
    stopBroadcast,
  };
}
