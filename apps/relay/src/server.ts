import http from "node:http";
import { createHmac } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { verifyBroadcastToken, verifyListenerToken } from "./auth.js";
import { SessionManager, type RelayClient } from "./session-manager.js";
import { createHttpListener } from "./stream-endpoint.js";

type RelayServerOptions = {
  relaySecret: string;
  listenerSecret: string;
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
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "POST" && url.pathname === "/broadcast/token") {
      if (!isInternalRequestAuthorized(request.headers.authorization, options.relaySecret)) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      readJsonBody(request)
        .then((body) => {
          const broadcastSessionId = typeof body.broadcastSessionId === "string" ? body.broadcastSessionId : "";
          const djProfileId = typeof body.djProfileId === "string" ? body.djProfileId : "";

          if (!broadcastSessionId || !djProfileId) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "Invalid token request" }));
            return;
          }

          const expiresAt = Math.floor(Date.now() / 1000) + 60;
          const token = createRelayBroadcastToken({ broadcastSessionId, djProfileId, expiresAt }, options.relaySecret);
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              token,
              websocketUrl: process.env.RELAY_PUBLIC_WS_URL ?? "ws://localhost:4010/broadcast",
              expiresIn: 60,
            }),
          );
        })
        .catch(() => {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "Invalid JSON" }));
        });
      return;
    }

    if (request.method === "POST" && url.pathname === "/broadcast/end") {
      if (!isInternalRequestAuthorized(request.headers.authorization, options.relaySecret)) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      readJsonBody(request)
        .then((body) => {
          const broadcastSessionId = typeof body.broadcastSessionId === "string" ? body.broadcastSessionId : "";

          if (!broadcastSessionId) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "broadcastSessionId is required" }));
            return;
          }

          sessionManager.endBroadcastSession(broadcastSessionId);
          response.writeHead(204);
          response.end();
        })
        .catch(() => {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "Invalid JSON" }));
        });
      return;
    }

    if (url.pathname === "/stream") {
      const listenerToken = url.searchParams.get("token") ?? request.headers.authorization?.replace(/^Bearer\s+/i, "");

      if (!verifyListenerToken(listenerToken ?? undefined, options.listenerSecret)) {
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

function isInternalRequestAuthorized(authorization: string | undefined, relaySecret: string) {
  return authorization === `Bearer ${relaySecret}` && Boolean(relaySecret);
}

function createRelayBroadcastToken(
  input: { broadcastSessionId: string; djProfileId: string; expiresAt: number },
  relaySecret: string,
) {
  const payload = `${input.broadcastSessionId}.${input.djProfileId}.${input.expiresAt}`;
  const signature = createHmac("sha256", relaySecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
