/**
 * Cloudflare Workers entry point for the SuperOps.ai MCP Server.
 *
 * Serves the full MCP server over the Streamable HTTP transport using the SDK's
 * Web Standard transport (Request/Response), which runs natively on Workers.
 * It reuses the exact same `createMcpServer()` factory as the stdio / Node HTTP
 * entrypoints (see `mcp-server.ts`), so there is no second tool implementation
 * to maintain.
 *
 * Credentials are resolved per request, in order:
 * 1. Gateway headers (when AUTH_MODE=gateway):
 *    - X-SuperOps-API-Token
 *    - X-SuperOps-Subdomain
 * 2. Worker secrets / vars (env mode):
 *    - SUPEROPS_API_TOKEN
 *    - SUPEROPS_SUBDOMAIN
 *    - SUPEROPS_REGION (optional; us or eu)
 *
 * `process.env` is not populated on workerd, so even in env mode the resolved
 * credentials are propagated through the same AsyncLocalStorage store
 * (`runWithCredentials`) the Node HTTP transport uses. `nodejs_compat` provides
 * `async_hooks` on workerd.
 *
 * `tools/list` and `initialize` work without credentials; only `tools/call`
 * requires them.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runWithCredentials } from "./client.js";
import { createMcpServer, resolveGatewayCredentials } from "./mcp-server.js";
import type { SuperOpsCredentials } from "./types.js";

export interface Env {
  SUPEROPS_API_TOKEN?: string;
  SUPEROPS_SUBDOMAIN?: string;
  SUPEROPS_REGION?: string;
  AUTH_MODE?: string;
  LOG_LEVEL?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-SuperOps-API-Token, X-SuperOps-Subdomain",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Run the MCP request through a fresh server + Web Standard transport.
 * Stateless: a new server/transport pair is created per request.
 */
async function handleMcp(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request);
    return withCors(response);
  } finally {
    await transport.close();
    await server.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Shallow, unauthenticated liveness probe.
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return json({
        status: "ok",
        transport: "http",
        authMode: env.AUTH_MODE === "gateway" ? "gateway" : "env",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/mcp") {
      const isGatewayMode = (env.AUTH_MODE ?? "env") === "gateway";

      let creds: SuperOpsCredentials | undefined;
      if (isGatewayMode) {
        const resolved = resolveGatewayCredentials(
          (name) => request.headers.get(name) ?? undefined
        );
        if (resolved.error) {
          return json(
            {
              error: "Missing credentials",
              message: resolved.error,
              required: ["X-SuperOps-API-Token", "X-SuperOps-Subdomain"],
            },
            401
          );
        }
        creds = resolved.creds;
      } else if (env.SUPEROPS_API_TOKEN && env.SUPEROPS_SUBDOMAIN) {
        // env mode: build credentials from Worker secrets if present.
        // (Absent creds are fine — tools/list still works, tools/call errors.)
        creds = {
          apiToken: env.SUPEROPS_API_TOKEN,
          subdomain: env.SUPEROPS_SUBDOMAIN,
          region:
            env.SUPEROPS_REGION === "eu" ? "eu" : ("us" as "us" | "eu"),
        };
      }

      // Propagate credentials through AsyncLocalStorage so getCredentials()/
      // getClient() resolve them (process.env is unavailable on workerd).
      if (creds) {
        return runWithCredentials(creds, () => handleMcp(request));
      }
      return handleMcp(request);
    }

    return json({ error: "Not found", endpoints: ["/mcp", "/health"] }, 404);
  },
};
