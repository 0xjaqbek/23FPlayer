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
  const connectionStateRef = useRef<BroadcastConnectionState>("input missing");

  function cleanupConnection() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }

  function setBroadcastState(nextState: BroadcastConnectionState) {
    connectionStateRef.current = nextState;
    setConnectionState(nextState);
  }

  useEffect(() => {
    if (connectionState === "input missing" || connectionState === "ready") {
      setBroadcastState(stream ? "ready" : "input missing");
    }
  }, [connectionState, stream]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      cleanupConnection();
    };
  }, [stream]);

  const stopBroadcast = useCallback(() => {
    stoppedRef.current = true;
    cleanupConnection();
    setBroadcastState(stream ? "ready" : "input missing");
  }, [stream]);

  const startBroadcast = useCallback(async () => {
    if (["connecting", "broadcasting", "reconnecting"].includes(connectionStateRef.current)) {
      return;
    }

    if (!stream) {
      setBroadcastState("input missing");
      return;
    }

    stoppedRef.current = false;

    async function connect(attempt: number) {
      setBroadcastState(attempt > 0 ? "reconnecting" : "connecting");
      const tokenResponse = await fetch("/api/broadcast/token", { method: "POST" });

      if (!tokenResponse.ok) {
        setBroadcastState("disconnected");
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
        setBroadcastState("broadcasting");
      };

      socket.onclose = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;

        if (stoppedRef.current) {
          setBroadcastState(stream ? "ready" : "input missing");
          return;
        }

        if (!stoppedRef.current && attempt === 0) {
          void connect(1);
          return;
        }

        setBroadcastState("disconnected");
      };

      socket.onerror = () => {
        setBroadcastState("reconnecting");
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
