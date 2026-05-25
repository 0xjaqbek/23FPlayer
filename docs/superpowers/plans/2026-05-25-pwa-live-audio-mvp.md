# PWA Live Audio MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working MVP of a closed-login PWA where one active DJ broadcasts browser-captured audio and logged-in users listen, view the queue, and vote to hand over the antenna.

**Architecture:** Use a Next.js app for UI, auth, API routes, queue/vote/presence state, and PWA shell. Use Postgres through Prisma for durable app data. Run a separate Node audio relay service on a VPS-compatible process boundary, with the app talking to it through an `AudioRelay` adapter so the relay can later be replaced with Icecast, Liquidsoap, or FFmpeg.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, Postgres, NextAuth/Auth.js or equivalent credentials auth, Vitest, Playwright, Node WebSocket relay, Web Audio API, MediaRecorder.

---

## File Structure

Create the project as a small monorepo-style app:

- `package.json`: root scripts for app, relay, tests, lint, build.
- `apps/web`: Next.js PWA app.
- `apps/web/src/app`: App Router pages and API routes.
- `apps/web/src/features/auth`: registration gate, login, session helpers.
- `apps/web/src/features/listener`: logged-in player, queue, voting UI.
- `apps/web/src/features/dj`: DJ profile and broadcast panel.
- `apps/web/src/features/antenna`: queue, vote, presence, and state domain logic.
- `apps/web/src/features/relay`: app-side `AudioRelay` interface and client.
- `apps/web/prisma`: schema and migrations.
- `apps/web/tests`: Vitest unit/integration tests.
- `apps/web/e2e`: Playwright browser tests.
- `apps/relay`: standalone Node audio relay service.
- `apps/relay/src`: relay server, authorization client, stream session manager.
- `apps/relay/tests`: relay tests.

Keep domain logic in focused files under `features/*/server` so API routes stay thin.

## Task 1: Scaffold Workspace And Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/package.json`
- Create: `apps/relay/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/relay/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/relay/vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize root package scripts**

Create `package.json`:

```json
{
  "name": "23fplayer",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "dev:relay": "pnpm --filter relay dev",
    "build": "pnpm --filter web build && pnpm --filter relay build",
    "lint": "pnpm --filter web lint",
    "test": "pnpm --filter web test && pnpm --filter relay test",
    "test:web": "pnpm --filter web test",
    "test:relay": "pnpm --filter relay test",
    "e2e": "pnpm --filter web e2e"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Define workspace packages**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
```

- [ ] **Step 3: Add web package**

Create `apps/web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.10.0",
    "@prisma/client": "^6.8.2",
    "bcryptjs": "^3.0.2",
    "clsx": "^2.1.1",
    "lucide-react": "^0.511.0",
    "next": "^15.3.2",
    "next-auth": "^5.0.0-beta.28",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.25.20"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@tailwindcss/postcss": "^4.1.7",
    "@testing-library/react": "^16.3.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.15.21",
    "@types/react": "^19.1.5",
    "@types/react-dom": "^19.1.5",
    "jsdom": "^26.1.0",
    "prisma": "^6.8.2",
    "tailwindcss": "^4.1.7",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 4: Add relay package**

Create `apps/relay/package.json`:

```json
{
  "name": "relay",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "ws": "^8.18.2",
    "zod": "^3.25.20"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "@types/ws": "^8.18.1",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
pnpm install
```

Expected: packages install and a lockfile is created.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml apps/web/package.json apps/relay/package.json .gitignore
git commit -m "chore: scaffold workspace"
```

If the directory is still not a git repository, run `git init` before the commit.

## Task 2: Database Schema And Domain Types

**Files:**
- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/src/features/antenna/server/types.ts`
- Create: `apps/web/src/features/antenna/server/vote-threshold.ts`
- Test: `apps/web/tests/antenna/vote-threshold.test.ts`

- [ ] **Step 1: Write vote threshold test**

Create `apps/web/tests/antenna/vote-threshold.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasReachedChangeThreshold } from "@/features/antenna/server/vote-threshold";

describe("hasReachedChangeThreshold", () => {
  it("requires 60 percent of present logged-in listeners", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 10, votes: 5 })).toBe(false);
    expect(hasReachedChangeThreshold({ presentListeners: 10, votes: 6 })).toBe(true);
  });

  it("does not allow a vote change when nobody is present", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 0, votes: 1 })).toBe(false);
  });

  it("rounds up fractional thresholds", () => {
    expect(hasReachedChangeThreshold({ presentListeners: 7, votes: 4 })).toBe(false);
    expect(hasReachedChangeThreshold({ presentListeners: 7, votes: 5 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test apps/web/tests/antenna/vote-threshold.test.ts
```

Expected: FAIL because `vote-threshold` does not exist.

- [ ] **Step 3: Implement threshold logic**

Create `apps/web/src/features/antenna/server/vote-threshold.ts`:

```ts
type VoteThresholdInput = {
  presentListeners: number;
  votes: number;
};

export function hasReachedChangeThreshold(input: VoteThresholdInput) {
  if (input.presentListeners <= 0) {
    return false;
  }

  const requiredVotes = Math.ceil(input.presentListeners * 0.6);
  return input.votes >= requiredVotes;
}
```

- [ ] **Step 4: Add Prisma schema**

Create `apps/web/prisma/schema.prisma` with models for `User`, `DjProfile`, `BroadcastSession`, `DjQueueEntry`, `ListenerPresence`, `ChangeVote`, and `StreamState`. Use enums for `BroadcastStatus`, `QueueStatus`, and `StreamStatus`.

- [ ] **Step 5: Run test**

Run:

```bash
pnpm --filter web test apps/web/tests/antenna/vote-threshold.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/src/features/antenna/server/vote-threshold.ts apps/web/tests/antenna/vote-threshold.test.ts
git commit -m "feat: add antenna data model and vote threshold"
```

## Task 3: Registration Gate And Credentials Auth

**Files:**
- Create: `apps/web/src/features/auth/server/registration-gate.ts`
- Create: `apps/web/tests/auth/registration-gate.test.ts`
- Create: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/register/actions.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/auth.ts`

- [ ] **Step 1: Write gate tests**

Create `apps/web/tests/auth/registration-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateRegistrationAccessPassword } from "@/features/auth/server/registration-gate";

describe("validateRegistrationAccessPassword", () => {
  it("accepts the configured access password", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "secret-scene-key",
        configuredPassword: "secret-scene-key",
      }),
    ).toBe(true);
  });

  it("rejects an incorrect access password", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "wrong",
        configuredPassword: "secret-scene-key",
      }),
    ).toBe(false);
  });

  it("rejects empty config", () => {
    expect(
      validateRegistrationAccessPassword({
        submittedPassword: "anything",
        configuredPassword: "",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm --filter web test apps/web/tests/auth/registration-gate.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement gate validator**

Create `apps/web/src/features/auth/server/registration-gate.ts`:

```ts
type ValidateRegistrationAccessPasswordInput = {
  submittedPassword: string;
  configuredPassword: string | undefined;
};

export function validateRegistrationAccessPassword(input: ValidateRegistrationAccessPasswordInput) {
  if (!input.configuredPassword) {
    return false;
  }

  return input.submittedPassword === input.configuredPassword;
}
```

- [ ] **Step 4: Implement registration page**

Create `apps/web/src/app/register/page.tsx` with a first-step special access password form. Only render account fields after a server action confirms the password and sets a short-lived signed cookie such as `registration_gate_passed=true`.

- [ ] **Step 5: Add rate-limit hook**

In `apps/web/src/app/register/actions.ts`, validate the gate password against `process.env.REGISTRATION_ACCESS_PASSWORD`. Add a simple per-IP in-memory limiter for MVP with 5 attempts per 10 minutes, returning the same generic error for wrong password and rate-limited attempts.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter web test apps/web/tests/auth/registration-gate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/auth/server/registration-gate.ts apps/web/tests/auth/registration-gate.test.ts apps/web/src/app/register apps/web/src/app/login apps/web/src/auth.ts
git commit -m "feat: add protected registration gate"
```

## Task 4: Protected App Shell And Listener Player

**Files:**
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/app/(app)/player/page.tsx`
- Create: `apps/web/src/features/listener/components/player.tsx`
- Create: `apps/web/src/features/listener/server/get-listener-state.ts`

- [ ] **Step 1: Implement route protection**

Create an app layout that calls the auth session helper. Redirect unauthenticated users to `/login`. Keep `/login` and `/register` outside the protected route group.

- [ ] **Step 2: Implement listener state query**

Create `get-listener-state.ts` returning current stream state, active DJ metadata, listener count, queue entries, and current user's vote state.

- [ ] **Step 3: Build logged-in player**

Create `player.tsx` with play/pause, active DJ name, city, description, live status, listener count, full queue, and vote button visible only when queue length is greater than zero.

- [ ] **Step 4: Add smoke test**

Add a Playwright test that verifies `/player` redirects to `/login` without a session.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app apps/web/src/features/listener apps/web/e2e
git commit -m "feat: add protected listener player"
```

## Task 5: DJ Profile And Queue

**Files:**
- Create: `apps/web/src/app/(app)/profile/page.tsx`
- Create: `apps/web/src/app/(app)/dj/page.tsx`
- Create: `apps/web/src/features/dj/components/dj-panel.tsx`
- Create: `apps/web/src/features/dj/server/dj-profile-actions.ts`
- Create: `apps/web/src/features/antenna/server/queue-service.ts`
- Test: `apps/web/tests/antenna/queue-service.test.ts`

- [ ] **Step 1: Write queue transition tests**

Test that a DJ can join an empty queue, cannot join twice, and becomes eligible when no DJ is live.

- [ ] **Step 2: Implement queue service**

Create functions `joinQueue`, `leaveQueue`, `getQueue`, and `promoteNextDj`. Keep all write operations transactional.

- [ ] **Step 3: Implement DJ profile form**

Profile fields: display name, city, soundsystem, description, active status.

- [ ] **Step 4: Implement DJ panel layout**

Show audio device selector, always-visible level meter area, connection state, queue position, join queue, start broadcast when eligible, and hand over while live.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter web test apps/web/tests/antenna/queue-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(app)/profile apps/web/src/app/(app)/dj apps/web/src/features/dj apps/web/src/features/antenna/server/queue-service.ts apps/web/tests/antenna/queue-service.test.ts
git commit -m "feat: add dj profiles and queue"
```

## Task 6: Presence And Voting

**Files:**
- Create: `apps/web/src/features/antenna/server/presence-service.ts`
- Create: `apps/web/src/features/antenna/server/vote-service.ts`
- Create: `apps/web/src/app/api/presence/route.ts`
- Create: `apps/web/src/app/api/vote/change-dj/route.ts`
- Test: `apps/web/tests/antenna/presence-service.test.ts`
- Test: `apps/web/tests/antenna/vote-service.test.ts`

- [ ] **Step 1: Write presence expiry tests**

Test that listeners with heartbeats within 30 seconds count as present and older records do not.

- [ ] **Step 2: Implement presence service**

Create `recordHeartbeat(userId)` and `countPresentListeners(now)` using the 30-second window.

- [ ] **Step 3: Write vote service tests**

Test one vote per user per broadcast session, no voting when the queue is empty, and promotion when 60% is reached.

- [ ] **Step 4: Implement vote service**

Create `voteToChangeDj(userId)` that validates session, queue, presence, existing vote, threshold, and promotes the next DJ when threshold is reached.

- [ ] **Step 5: Wire API routes**

`POST /api/presence` records heartbeats. `POST /api/vote/change-dj` records a vote and returns current vote progress.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/antenna/server/presence-service.ts apps/web/src/features/antenna/server/vote-service.ts apps/web/src/app/api apps/web/tests/antenna
git commit -m "feat: add presence and dj change voting"
```

## Task 7: Browser Audio Capture In DJ Panel

**Files:**
- Create: `apps/web/src/features/dj/hooks/use-audio-inputs.ts`
- Create: `apps/web/src/features/dj/hooks/use-input-level-meter.ts`
- Create: `apps/web/src/features/dj/hooks/use-browser-broadcast.ts`
- Modify: `apps/web/src/features/dj/components/dj-panel.tsx`

- [ ] **Step 1: Implement audio input listing**

Use `navigator.mediaDevices.enumerateDevices()` and filter `audioinput`. Request mic permission before listing labels.

- [ ] **Step 2: Implement level meter**

Use `AudioContext`, `AnalyserNode`, and `requestAnimationFrame` to compute RMS level. Keep it running whenever an input device is selected, including before broadcast starts.

- [ ] **Step 3: Implement browser broadcast hook**

Use `MediaRecorder` on the selected audio stream and send chunks through a WebSocket to the relay URL with a short-lived broadcast token.

- [ ] **Step 4: Add UI states**

Show `input missing`, `ready`, `connecting`, `broadcasting`, `reconnecting`, and `disconnected`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/dj/hooks apps/web/src/features/dj/components/dj-panel.tsx
git commit -m "feat: add browser audio capture"
```

## Task 8: App-Side Audio Relay Adapter

**Files:**
- Create: `apps/web/src/features/relay/server/audio-relay.ts`
- Create: `apps/web/src/features/relay/server/custom-relay-client.ts`
- Create: `apps/web/src/app/api/broadcast/token/route.ts`
- Test: `apps/web/tests/relay/audio-relay.test.ts`

- [ ] **Step 1: Define adapter interface**

Create `AudioRelay` with methods `createBroadcastToken`, `endBroadcast`, and `getStreamUrl`.

- [ ] **Step 2: Implement custom relay client**

Use `RELAY_INTERNAL_URL` and `RELAY_SHARED_SECRET` to call the relay service.

- [ ] **Step 3: Add broadcast token route**

Only the active DJ can request a broadcast token. Return relay WebSocket URL and token.

- [ ] **Step 4: Test authorization**

Write tests proving non-active DJs cannot get tokens and active DJs can.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/relay apps/web/src/app/api/broadcast/token apps/web/tests/relay
git commit -m "feat: add audio relay adapter"
```

## Task 9: Custom Node Audio Relay MVP

**Files:**
- Create: `apps/relay/src/server.ts`
- Create: `apps/relay/src/auth.ts`
- Create: `apps/relay/src/session-manager.ts`
- Create: `apps/relay/src/stream-endpoint.ts`
- Test: `apps/relay/tests/session-manager.test.ts`

- [ ] **Step 1: Write session manager tests**

Test that only one active broadcaster is accepted, unauthorized tokens are rejected, listener clients receive chunks, and disconnect starts a 15-second grace timer.

- [ ] **Step 2: Implement token validation**

Validate signed tokens from the web app using `RELAY_SHARED_SECRET`. Include active broadcast session ID and DJ profile ID.

- [ ] **Step 3: Implement broadcaster WebSocket**

Accept audio chunks from the authorized active DJ. Reject any second broadcaster or invalid token.

- [ ] **Step 4: Implement listener endpoint**

Expose a protected stream endpoint that requires an authenticated listener token from the app. For MVP, forward the active audio chunk stream with radio-style buffering.

- [ ] **Step 5: Implement grace period**

If the active broadcaster disconnects, keep the session recoverable for 15 seconds. After that, call the app backend handover endpoint.

- [ ] **Step 6: Run relay tests**

Run:

```bash
pnpm --filter relay test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/relay/src apps/relay/tests
git commit -m "feat: add custom audio relay"
```

## Task 10: End-To-End MVP Verification

**Files:**
- Create: `apps/web/e2e/auth-registration.spec.ts`
- Create: `apps/web/e2e/listener-player.spec.ts`
- Create: `apps/web/e2e/dj-panel.spec.ts`
- Create: `apps/web/README.md`
- Create: `apps/relay/README.md`
- Modify: `README.md`

- [ ] **Step 1: Add registration gate e2e**

Verify that `/register` hides account fields before the special password is accepted and shows a generic error for wrong password.

- [ ] **Step 2: Add listener e2e**

Verify login is required, player loads after login, queue is visible, and voting appears only when queue is not empty.

- [ ] **Step 3: Add DJ panel e2e**

Mock media devices, verify the level meter renders, queue controls render, and start broadcast only appears when eligible.

- [ ] **Step 4: Add local run docs**

Document env vars:

```text
DATABASE_URL=
AUTH_SECRET=
REGISTRATION_ACCESS_PASSWORD=
RELAY_INTERNAL_URL=
RELAY_PUBLIC_WS_URL=
RELAY_PUBLIC_STREAM_URL=
RELAY_SHARED_SECRET=
```

- [ ] **Step 5: Run full verification**

Run:

```bash
pnpm build
pnpm test
pnpm e2e
```

Expected: build succeeds, unit tests pass, e2e tests pass.

- [ ] **Step 6: Commit**

```bash
git add README.md apps/web/README.md apps/relay/README.md apps/web/e2e
git commit -m "test: verify live audio mvp flows"
```

## Self-Review

Spec coverage:

- Closed registration and login-only listening are covered in Tasks 3 and 4.
- DJ profile, soundsystem, queue, and panel are covered in Task 5.
- 60% present-listener voting is covered in Tasks 2 and 6.
- Continuous audio level meter and browser capture are covered in Task 7.
- Relay abstraction and future Icecast/Liquidsoap readiness are covered in Task 8.
- Custom MVP relay is covered in Task 9.
- End-to-end verification is covered in Task 10.

No placeholders are intentionally left. The largest risk is browser audio and stream format compatibility; Task 9 must validate the practical audio container/codec choice before expanding UI polish.
