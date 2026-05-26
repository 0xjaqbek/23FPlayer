"use client";

import { useCallback, useEffect, useState } from "react";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

export function useAudioInputs() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError("Audio input devices are not available in this browser.");
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const nextDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Audio input ${index + 1}`,
        }));

      setDevices(nextDevices);
      setSelectedDeviceId((currentDeviceId) => currentDeviceId || nextDevices[0]?.deviceId || "");
      setError(null);
    } catch {
      setError("Microphone or line-in permission is required.");
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    error,
  };
}
