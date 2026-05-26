"use client";

import { useState, useTransition } from "react";
import type { ListenerState } from "@/features/listener/server/get-listener-state";
import { PresenceHeartbeat } from "./presence-heartbeat";

type PlayerProps = {
  state: ListenerState;
};

function formatStatus(status: ListenerState["stream"]["status"]) {
  switch (status) {
    case "live":
      return "Live";
    case "waiting_for_dj":
      return "Waiting for DJ";
    case "handover":
      return "Handover";
    case "relay_unavailable":
      return "Stream unavailable";
    case "idle":
      return "Idle";
  }
}

export function Player({ state }: PlayerProps) {
  const [vote, setVote] = useState(state.vote);
  const [isPending, startTransition] = useTransition();
  const voteProgress =
    vote.requiredVotes > 0 ? `${vote.votes}/${vote.requiredVotes}` : `${vote.votes}/0`;

  function submitVote() {
    void (async () => {
      const response = await fetch("/api/vote/change-dj", {
        method: "POST",
      });

      if (!response.ok) {
        return;
      }

      const nextVote = await response.json();
      startTransition(() => {
        setVote(nextVote);
      });
    })();
  }

  return (
    <main className="player-shell">
      <PresenceHeartbeat />
      <section className="player-now">
        <p>{formatStatus(state.stream.status)}</p>
        <h1>{state.activeDj?.displayName ?? "No DJ on air"}</h1>
        {state.activeDj ? (
          <div>
            <p>
              {state.activeDj.city} / {state.activeDj.soundsystem}
            </p>
            <p>{state.activeDj.description}</p>
          </div>
        ) : (
          <p>The antenna is quiet for now.</p>
        )}
        <p>{state.listenerCount} logged-in listeners</p>
        {state.stream.url ? (
          <audio aria-label="Live audio stream" controls src={state.stream.url} preload="none" />
        ) : (
          <p>Stream is not available.</p>
        )}
      </section>

      <section className="queue-panel">
        <h2>DJ Queue</h2>
        {state.queue.length > 0 ? (
          <ol>
            {state.queue.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.displayName}</strong>
                <span>
                  {entry.city} / {entry.soundsystem}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No DJs waiting.</p>
        )}
      </section>

      {vote.canVote ? (
        <section className="vote-panel">
          <h2>Change DJ</h2>
          <p>{voteProgress} votes needed for handover</p>
          <button type="button" disabled={vote.hasVoted || isPending} onClick={submitVote}>
            {vote.hasVoted ? "Vote recorded" : "Vote to change DJ"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
