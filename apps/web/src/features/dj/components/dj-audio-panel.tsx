"use client";

import { useAudioInputs } from "@/features/dj/hooks/use-audio-inputs";
import { useBrowserBroadcast } from "@/features/dj/hooks/use-browser-broadcast";
import { useInputLevelMeter } from "@/features/dj/hooks/use-input-level-meter";

type DjAudioPanelProps = {
  streamStatus: string;
  connectionStatus: string;
  canStartBroadcast: boolean;
};

export function DjAudioPanel({ streamStatus, connectionStatus, canStartBroadcast }: DjAudioPanelProps) {
  const audioInputs = useAudioInputs();
  const levelMeter = useInputLevelMeter(audioInputs.selectedDeviceId);
  const broadcast = useBrowserBroadcast(levelMeter.stream);

  return (
    <section className="audio-input-panel">
      <h2>Audio Input</h2>
      <p>Connection: {broadcast.connectionState}</p>
      <p>App connection: {connectionStatus}</p>
      <p>Stream: {streamStatus}</p>
      <button type="button" onClick={audioInputs.refreshDevices}>
        {audioInputs.permissionState === "denied" ? "Retry microphone access" : "Enable microphone"}
      </button>
      <label htmlFor="audioInput">Input device</label>
      <select
        id="audioInput"
        name="audioInput"
        value={audioInputs.selectedDeviceId}
        onChange={(event) => audioInputs.setSelectedDeviceId(event.target.value)}
      >
        {audioInputs.devices.length > 0 ? (
          audioInputs.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))
        ) : (
          <option value="">No audio inputs available</option>
        )}
      </select>
      {audioInputs.error ? <p role="alert">{audioInputs.error}</p> : null}
      {levelMeter.error ? <p role="alert">{levelMeter.error}</p> : null}
      <div aria-label="Input level meter" className="level-meter">
        <div className="level-meter-fill" style={{ width: `${Math.round(levelMeter.level * 100)}%` }} />
      </div>
      {canStartBroadcast ? (
        <button type="button" disabled={!levelMeter.stream || broadcast.connectionState !== "ready"} onClick={broadcast.startBroadcast}>
          Start broadcast
        </button>
      ) : null}
      {broadcast.connectionState === "broadcasting" ? (
        <button type="button" onClick={broadcast.stopBroadcast}>
          Stop browser stream
        </button>
      ) : null}
    </section>
  );
}
