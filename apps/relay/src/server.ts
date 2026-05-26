import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { verifyBroadcastToken, verifyListenerToken } from "./auth";
import { SessionManager, type RelayClient } from "./session-manager";
import { createHttpListener } from "./stream-endpoint";

const port = Number(process.env.PORT ?? 4010);
const relaySecret = process.env.RELAY_SHARED_SECRET ?? "";
const appHandoverUrl = process.env.APP_HANDOVER_URL;
const gracePeriodMs = 15_000;

async function notifyGraceExpired(broadcastSessionId: string) {
  if (!appHandoverUrl) {
    return;
  }

  await fetch(appHandoverUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${relaySecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ broadcastSessionId }),
  });
}

const sessionManager = new SessionManager(gracePeriodMs, notifyGraceExpired);
const server = http.createServer((request, response) => {
  if (request.url?.startsWith("/stream")) {
    const url = new URL(request.url, "http://localhost");
    const listenerToken = url.searchParams.get("token") ?? request.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!verifyListenerToken(listenerToken ?? undefined, relaySecret)) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized listener" }));
      return;
    }

    const listener = createHttpListener(response);
    sessionManager.addListener(listener);
    request.on("close", () => sessionManager.removeListener(listener));
    return;
  }

  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404);
  response.end();
});

const websocketServer = new WebSocketServer({ server, path: "/broadcast" });

function toRelayClient(socket: WebSocket): RelayClient {
  return {
    send(data) {
      socket.send(data);
    },
    close() {
      socket.close();
    },
  };
}

function normalizeWebSocketData(data: WebSocket.RawData) {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return Buffer.from(data);
}

websocketServer.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost");
  const claims = verifyBroadcastToken(url.searchParams.get("token") ?? undefined, relaySecret);
  const client = toRelayClient(socket);

  if (!claims || !sessionManager.acceptBroadcaster(claims, client)) {
    socket.close(1008, "Unauthorized broadcaster");
    return;
  }

  socket.on("message", (data) => {
    sessionManager.broadcastChunk(normalizeWebSocketData(data));
  });
  socket.on("close", () => sessionManager.disconnectBroadcaster(client));
});

server.listen(port, () => {
  console.log(`Relay listening on ${port}`);
});
