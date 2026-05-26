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
```

`REGISTRATION_ACCESS_PASSWORD` protects the registration gate. `RELAY_SHARED_SECRET` must match the relay service.

## Commands

```bash
pnpm --filter web dev
pnpm --filter web test
pnpm --filter web e2e
pnpm --filter web build
```
