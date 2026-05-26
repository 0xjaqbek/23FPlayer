import { createRelayServer } from "./server.js";

const port = Number(process.env.PORT ?? 4010);
const relaySecret = process.env.RELAY_SHARED_SECRET ?? "";
const listenerSecret = process.env.RELAY_LISTENER_SECRET ?? "";
const appHandoverUrl = process.env.APP_HANDOVER_URL;

const { server } = createRelayServer({
  relaySecret,
  listenerSecret,
  appHandoverUrl,
});

server.listen(port, () => {
  console.log(`Relay listening on ${port}`);
});
