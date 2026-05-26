import type { DjProfile, DjQueueEntry } from "@prisma/client";
import { handOverAntenna, joinDjQueue } from "@/features/dj/server/dj-profile-actions";
import { DjAudioPanel } from "./dj-audio-panel";

type DjPanelProps = {
  profile: DjProfile | null;
  queueEntry: DjQueueEntry | null;
  queuePosition: number | null;
  isActiveDj: boolean;
  streamStatus: string;
  connectionStatus: string;
};

export function DjPanel({ profile, queueEntry, queuePosition, isActiveDj, streamStatus, connectionStatus }: DjPanelProps) {
  if (!profile) {
    return (
      <main className="dj-panel">
        <h1>DJ Panel</h1>
        <p>Create a DJ profile before joining the queue.</p>
        <a href="/profile">Create DJ profile</a>
      </main>
    );
  }

  return (
    <main className="dj-panel">
      <section>
        <h1>DJ Panel</h1>
        <p>
          {profile.displayName} / {profile.city} / {profile.soundsystem}
        </p>
      </section>

      <DjAudioPanel
        streamStatus={streamStatus}
        connectionStatus={connectionStatus}
        canStartBroadcast={queueEntry?.status === "ACTIVE" && !isActiveDj}
      />

      <section className="queue-status-panel">
        <h2>Queue</h2>
        {isActiveDj ? <p>You have the antenna.</p> : null}
        {queueEntry?.status === "WAITING" && queuePosition ? <p>Queue position: {queuePosition}</p> : null}
        {queueEntry?.status === "ACTIVE" && !isActiveDj ? <p>You are next to broadcast.</p> : null}
        {!queueEntry ? (
          <form action={joinDjQueue}>
            <button type="submit">Join queue</button>
          </form>
        ) : null}
        {isActiveDj ? (
          <form action={handOverAntenna}>
            <button type="submit">Hand over antenna</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
