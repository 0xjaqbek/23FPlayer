"use client";

import type { ListenerState } from "@/features/listener/server/get-listener-state";

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
  const voteProgress =
    state.vote.requiredVotes > 0 ? `${state.vote.votes}/${state.vote.requiredVotes}` : `${state.vote.votes}/0`;

  return (
    <main className="player-shell">
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

      {state.vote.canVote ? (
        <section className="vote-panel">
          <h2>Change DJ</h2>
          <p>{voteProgress} votes needed for handover</p>
          <button type="button" disabled>
            {state.vote.hasVoted ? "Vote recorded" : "Voting opens soon"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
