"use client";

import { useMemo, useState } from "react";
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
  const [copiedBrowser, setCopiedBrowser] = useState<string | null>(null);
  const settingsLinks = useMemo(() => getMicrophoneSettingsLinks(), []);

  async function copySettingsLink(browser: string, url: string) {
    await navigator.clipboard?.writeText(url);
    setCopiedBrowser(browser);
  }

  return (
    <section className="audio-input-panel">
      <h2>Audio Input</h2>
      <p>Connection: {broadcast.connectionState}</p>
      <p>App connection: {connectionStatus}</p>
      <p>Stream: {streamStatus}</p>
      <button type="button" onClick={audioInputs.refreshDevices}>
        {audioInputs.permissionState === "denied" ? "Retry microphone access" : "Enable microphone"}
      </button>
      <div className="permission-helper">
        <div>
          <h3>Browser microphone settings</h3>
          <p>Copy the address for your browser, paste it into the address bar, allow microphone access for this site, then refresh DJ panel.</p>
        </div>
        <ul>
          {settingsLinks.map((link) => (
            <li key={link.browser}>
              <span>{link.browser}</span>
              <code>{link.url}</code>
              <button type="button" onClick={() => copySettingsLink(link.browser, link.url)}>
                {copiedBrowser === link.browser ? "Copied" : `Copy ${link.browser} settings link`}
              </button>
            </li>
          ))}
        </ul>
      </div>
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

function getMicrophoneSettingsLinks() {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://23-f-player-web.vercel.app";
  const encodedOrigin = encodeURIComponent(origin);

  return [
    {
      browser: "Chrome",
      url: `chrome://settings/content/siteDetails?site=${encodedOrigin}`,
    },
    {
      browser: "Edge",
      url: `edge://settings/content/siteDetails?site=${encodedOrigin}`,
    },
    {
      browser: "Firefox",
      url: "about:preferences#privacy",
    },
  ];
}
