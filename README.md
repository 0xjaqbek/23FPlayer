# 23FPlayer

Closed-login PWA for one shared live audio antenna. One DJ broadcasts from the browser through a line-in or microphone input, logged-in users listen, see the queue, and can vote to hand over the antenna when another DJ is waiting.

## Packages

- `apps/web`: Next.js PWA, auth, DJ queue, presence, voting, browser capture UI.
- `apps/relay`: Node audio relay, broadcaster WebSocket, protected listener stream.

## Local Environment

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

## Development

```bash
pnpm install
pnpm dev
pnpm dev:relay
pnpm test
pnpm e2e
pnpm build
```

Current workspace note: dependency installation is blocked in this environment by a pnpm/Node runtime error, so verification commands cannot complete until `pnpm install` succeeds.
