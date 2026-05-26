import type { ServerResponse } from "node:http";
import type { RelayClient } from "./session-manager";

export function createHttpListener(response: ServerResponse): RelayClient {
  response.writeHead(200, {
    "content-type": "audio/webm",
    "cache-control": "no-store",
    connection: "keep-alive",
  });

  return {
    send(data) {
      response.write(data);
    },
    close() {
      response.end();
    },
  };
}
