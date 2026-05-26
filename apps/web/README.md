# Web App

Next.js PWA for logged-in listeners and DJs.

## Environment

```text
DATABASE_URL=
AUTH_SECRET=
REGISTRATION_ACCESS_PASSWORD=
REGISTRATION_GATE_TOKEN_SECRET=
RELAY_INTERNAL_URL=
RELAY_PUBLIC_WS_URL=
RELAY_PUBLIC_STREAM_URL=
RELAY_SHARED_SECRET=
RELAY_LISTENER_SECRET=
APP_HANDOVER_URL=
```

`REGISTRATION_ACCESS_PASSWORD` protects the registration gate. `RELAY_SHARED_SECRET` signs broadcaster tokens and `RELAY_LISTENER_SECRET` signs listener stream tokens; both must match the relay service.

## Commands

```bash
pnpm --filter web dev
pnpm --filter web test
pnpm --filter web e2e
pnpm --filter web build
```

Playwright uses `PLAYWRIGHT_BASE_URL` when provided and otherwise starts the local dev server on `http://127.0.0.1:3000`.
