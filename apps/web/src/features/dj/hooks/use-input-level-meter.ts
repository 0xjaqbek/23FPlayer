"use client";

import { useEffect, useState } from "react";

export function useInputLevelMeter(deviceId: string) {
  const [level, setLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLevel(0);
      setStream(null);
      return;
    }

    let stopped = false;
    let animationFrameId = 0;
    let audioContext: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;

    async function startMeter() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
          },
        });

        if (stopped) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        setStream(mediaStream);
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const samples = new Uint8Array(analyser.fftSize);

        function tick() {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;

          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }

          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 2));
          animationFrameId = window.requestAnimationFrame(tick);
        }

        tick();
        setError(null);
      } catch {
        setError("Unable to open the selected audio input.");
        setLevel(0);
        setStream(null);
      }
    }

    void startMeter();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrameId);
      mediaStream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [deviceId]);

  return {
    level,
    stream,
    error,
  };
}
