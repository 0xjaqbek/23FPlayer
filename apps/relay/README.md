# Audio Relay

Standalone Node service for accepting one active browser broadcaster and forwarding audio chunks to authenticated listeners.

## Environment

```text
PORT=4010
RELAY_SHARED_SECRET=
APP_HANDOVER_URL=
```

`RELAY_SHARED_SECRET` must match the web app. Listeners call `/stream?token=<RELAY_SHARED_SECRET>` in the current MVP. Broadcasters connect to `/broadcast?token=<signed-broadcast-token>`.

## Commands

```bash
pnpm --filter relay dev
pnpm --filter relay test
pnpm --filter relay build
pnpm --filter relay start
```
