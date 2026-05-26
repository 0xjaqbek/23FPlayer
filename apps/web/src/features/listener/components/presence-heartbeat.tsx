"use client";

import { useEffect } from "react";

export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;

    async function sendHeartbeat() {
      if (stopped) {
        return;
      }

      await fetch("/api/presence", {
        method: "POST",
      });
    }

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 20_000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
