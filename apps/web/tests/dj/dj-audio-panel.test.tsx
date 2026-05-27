import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DjAudioPanel } from "@/features/dj/components/dj-audio-panel";

const refreshDevices = vi.fn();

vi.mock("@/features/dj/hooks/use-audio-inputs", () => ({
  useAudioInputs: () => ({
    devices: [],
    selectedDeviceId: "",
    setSelectedDeviceId: vi.fn(),
    refreshDevices,
    error: null,
    permissionState: "prompt",
  }),
}));

vi.mock("@/features/dj/hooks/use-input-level-meter", () => ({
  useInputLevelMeter: () => ({
    level: 0,
    stream: null,
    error: null,
  }),
}));

vi.mock("@/features/dj/hooks/use-browser-broadcast", () => ({
  useBrowserBroadcast: () => ({
    connectionState: "input missing",
    startBroadcast: vi.fn(),
    stopBroadcast: vi.fn(),
  }),
}));

describe("DjAudioPanel", () => {
  beforeEach(() => {
    refreshDevices.mockClear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("asks for microphone access from an explicit user click", () => {
    render(<DjAudioPanel streamStatus="IDLE" connectionStatus="not connected" canStartBroadcast={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Enable microphone" }));

    expect(refreshDevices).toHaveBeenCalledTimes(1);
  });

  test("shows browser microphone settings helper with copy actions", async () => {
    render(<DjAudioPanel streamStatus="IDLE" connectionStatus="not connected" canStartBroadcast={false} />);

    expect(screen.getByText("Browser microphone settings")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy Chrome settings link" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("chrome://settings/content/siteDetails"));
    });
  });
});
