"use client";

import { useCallback, useEffect, useState } from "react";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

export type MicrophonePermissionState = "prompt" | "granted" | "denied";

export function useAudioInputs() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>("prompt");

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError("Audio input devices are not available in this browser.");
      return;
    }

    const nextDevices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio input ${index + 1}`,
      }));

    setDevices(nextDevices);
    setSelectedDeviceId((currentDeviceId) => currentDeviceId || nextDevices[0]?.deviceId || "");
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
      setError("Audio input devices are not available in this browser.");
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      await loadDevices();
      setPermissionState("granted");
      setError(null);
    } catch {
      setPermissionState("denied");
      setError("Microphone or line-in permission is required.");
    }
  }, [loadDevices]);

  useEffect(() => {
    void loadDevices().catch(() => {
      setError("Audio input devices are not available in this browser.");
    });
  }, [loadDevices]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    permissionState,
    error,
  };
}
