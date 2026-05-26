import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { verifyBroadcastToken, verifyListenerToken } from "./auth.js";
import { SessionManager, type RelayClient } from "./session-manager.js";
import { createHttpListener } from "./stream-endpoint.js";

type RelayServerOptions = {
  relaySecret: string;
  appHandoverUrl?: string;
  gracePeriodMs?: number;
  maxPayloadBytes?: number;
};

export function createRelayServer(options: RelayServerOptions) {
  const gracePeriodMs = options.gracePeriodMs ?? 15_000;
  const maxPayloadBytes = options.maxPayloadBytes ?? 256_000;

  async function notifyGraceExpired(broadcastSessionId: string) {
    if (!options.appHandoverUrl) {
      return;
    }

    await fetch(options.appHandoverUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.relaySecret}`,
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

      if (!verifyListenerToken(listenerToken ?? undefined, options.relaySecret)) {
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

  const websocketServer = new WebSocketServer({ server, path: "/broadcast", maxPayload: maxPayloadBytes });

  websocketServer.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const claims = verifyBroadcastToken(url.searchParams.get("token") ?? undefined, options.relaySecret);
    const client = toRelayClient(socket);

    if (!claims || !sessionManager.acceptBroadcaster(claims, client)) {
      socket.close(1008, "Unauthorized broadcaster");
      return;
    }

    socket.on("message", (data) => {
      const chunk = normalizeWebSocketData(data);

      if (chunk.length > maxPayloadBytes) {
        socket.close(1009, "Audio chunk too large");
        return;
      }

      sessionManager.broadcastChunk(chunk);
    });
    socket.on("close", () => sessionManager.disconnectBroadcaster(client));
  });

  return { server, websocketServer, sessionManager };
}

function toRelayClient(socket: WebSocket): RelayClient {
  return {
    send(data) {
      if (socket.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        socket.send(data);
        return true;
      } catch {
        return false;
      }
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
