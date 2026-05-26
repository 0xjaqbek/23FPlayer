import type { DjProfile, DjQueueEntry } from "@prisma/client";
import { handOverAntenna, joinDjQueue, startBroadcast } from "@/features/dj/server/dj-profile-actions";

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

      <section className="audio-input-panel">
        <h2>Audio Input</h2>
        <p>Connection: {connectionStatus}</p>
        <p>Stream: {streamStatus}</p>
        <label htmlFor="audioInput">Input device</label>
        <select id="audioInput" name="audioInput" disabled>
          <option>Audio device selection arrives in the broadcast task</option>
        </select>
        <div aria-label="Input level meter" className="level-meter">
          <div className="level-meter-fill" style={{ width: "0%" }} />
        </div>
      </section>

      <section className="queue-status-panel">
        <h2>Queue</h2>
        {isActiveDj ? <p>You have the antenna.</p> : null}
        {queueEntry?.status === "WAITING" && queuePosition ? <p>Queue position: {queuePosition}</p> : null}
        {queueEntry?.status === "ACTIVE" ? <p>You are next to broadcast.</p> : null}
        {!queueEntry ? (
          <form action={joinDjQueue}>
            <button type="submit">Join queue</button>
          </form>
        ) : null}
        {queueEntry?.status === "ACTIVE" ? (
          <form action={startBroadcast}>
            <button type="submit">Start broadcast</button>
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
