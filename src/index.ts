#!/usr/bin/env node
/**
 * SuperOps.ai MCP Server
 *
 * This MCP server provides tools for interacting with SuperOps.ai PSA/RMM API.
 * All tools are listed upfront so they work with every MCP client, including
 * remote connectors (claude.ai, mcp-remote) that do not support dynamic
 * tool-list changes. A helper `superops_navigate` tool provides domain
 * discovery and guidance.
 *
 * Features:
 * - All tools available immediately for broad MCP client compatibility
 * - Domain-based tool organization with navigation helper
 * - GraphQL-based API communication
 * - Bearer token authentication
 *
 * Supports both stdio and HTTP transports:
 * - stdio (default): For local Claude Desktop / CLI usage
 * - http: For hosted deployment with optional gateway auth
 *
 * Auth modes:
 * - env (default): Credentials from environment variables
 * - gateway: Credentials injected from request headers by the MCP gateway
 *   - Header: X-SuperOps-API-Token
 *   - Header: X-SuperOps-Subdomain
 *
 * Environment Variables:
 * - SUPEROPS_API_TOKEN: Your SuperOps.ai API token
 * - SUPEROPS_SUBDOMAIN: Your SuperOps.ai subdomain
 * - SUPEROPS_REGION: API region (us or eu, default: us)
 * - MCP_TRANSPORT: Transport mode (stdio or http, default: stdio)
 * - MCP_HTTP_PORT: HTTP port (default: 8080)
 * - MCP_HTTP_HOST: HTTP host (default: 0.0.0.0)
 * - AUTH_MODE: Authentication mode (env or gateway, default: env)
 */

import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { Domain, DomainTools, ToolDefinition } from "./types.js";
import { getCredentials, resetClient, runWithCredentials } from "./client.js";
import { setServerRef } from "./utils/server-ref.js";

// Lazy-loaded domain modules
const domainCache = new Map<Domain, DomainTools>();

// All domain tools, collected once at startup
let allDomainTools: ToolDefinition[] | null = null;

async function loadDomain(domain: Domain): Promise<DomainTools> {
  const cached = domainCache.get(domain);
  if (cached) {
    return cached;
  }

  let tools: DomainTools;
  switch (domain) {
    case "clients": {
      const { getClientsTools } = await import("./domains/clients.js");
      tools = getClientsTools();
      break;
    }
    case "tickets": {
      const { getTicketsTools } = await import("./domains/tickets.js");
      tools = getTicketsTools();
      break;
    }
    case "assets": {
      const { getAssetsTools } = await import("./domains/assets.js");
      tools = getAssetsTools();
      break;
    }
    case "technicians": {
      const { getTechniciansTools } = await import("./domains/technicians.js");
      tools = getTechniciansTools();
      break;
    }
    case "custom": {
      const { getCustomTools } = await import("./domains/custom.js");
      tools = getCustomTools();
      break;
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }

  domainCache.set(domain, tools);
  return tools;
}

/**
 * Domain metadata for navigation
 */
const domainDescriptions: Record<Domain, string> = {
  clients: "Client/company management - list, get, search accounts and company information",
  tickets: "Ticket management - list, get, create tickets and manage support workflow",
  assets: "Asset management - list and get hardware/software assets, endpoint inventory",
  technicians: "Technician management - list and get support staff and technician information",
  custom: "Custom queries - execute advanced GraphQL queries with full API access",
};

/**
 * Load all domain tools (lazy-loaded on first access)
 */
async function getAllDomainTools(): Promise<ToolDefinition[]> {
  if (allDomainTools !== null) {
    return allDomainTools;
  }

  const domains: Domain[] = ["clients", "tickets", "assets", "technicians", "custom"];
  const tools: ToolDefinition[] = [];

  for (const domain of domains) {
    const domainTools = await loadDomain(domain);
    tools.push(...domainTools.tools);
  }

  allDomainTools = tools;
  return tools;
}

// Navigation / discovery tool - helps the LLM find the right tools
const navigationTool: ToolDefinition = {
  name: "superops_navigate",
  description:
    "Discover available SuperOps.ai tools by domain. Returns tool names and descriptions for the selected domain. All tools are callable at any time — this is a help/discovery aid, not a prerequisite.",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: `The domain to explore:
- clients: ${domainDescriptions.clients}
- tickets: ${domainDescriptions.tickets}
- assets: ${domainDescriptions.assets}
- technicians: ${domainDescriptions.technicians}
- custom: ${domainDescriptions.custom}`,
        enum: ["clients", "tickets", "assets", "technicians", "custom"],
      },
    },
    required: ["domain"],
  },
};

// Status tool - shows credentials status and available domains
const statusTool: ToolDefinition = {
  name: "superops_status",
  description: "Show credentials status and available domains",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

// Connection test tool
const testConnectionTool: ToolDefinition = {
  name: "superops_test_connection",
  description:
    "Test the connection to SuperOps.ai API using configured credentials.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

/**
 * Create and configure an MCP Server instance with all request handlers.
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "superops-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  setServerRef(server);

  // List available tools - always returns ALL tools for MCP client compatibility
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const domainTools = await getAllDomainTools();
    return { tools: [navigationTool, statusTool, testConnectionTool, ...domainTools] };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle test connection
    if (name === "superops_test_connection") {
      const creds = getCredentials();
      if (!creds) {
        return {
          content: [
            {
              type: "text",
              text: "Error: No API credentials configured. Please set SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN environment variables.",
            },
          ],
          isError: true,
        };
      }

      try {
        const clientsTools = await loadDomain("clients");
        const result = await clientsTools.handleCall("superops_clients_list", {
          max: 1,
        });

        if (result.isError) {
          return result;
        }

        return {
          content: [
            {
              type: "text",
              text: `Connection successful!\n\nCredentials configured for:\n- Subdomain: ${creds.subdomain}\n- Region: ${creds.region ?? "us"}\n\nAPI is responding correctly.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Connection test failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle navigation / discovery helper
    if (name === "superops_navigate") {
      const { domain } = (args ?? {}) as { domain?: string };
      const validDomains: Domain[] = [
        "clients",
        "tickets",
        "assets",
        "technicians",
        "custom",
      ];

      if (!domain || !validDomains.includes(domain as Domain)) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid domain. Please choose from: ${validDomains.join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const domainTools = await loadDomain(domain as Domain);
      const toolSummary = domainTools.tools
        .map((t) => `- ${t.name}: ${t.description}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `${domainDescriptions[domain as Domain]}\n\nAvailable tools:\n${toolSummary}\n\nYou can call any of these tools directly.`,
          },
        ],
      };
    }

    // Handle status
    if (name === "superops_status") {
      const creds = getCredentials();
      const credStatus = creds
        ? `Configured (subdomain: ${creds.subdomain}, region: ${creds.region ?? "us"})`
        : "NOT CONFIGURED - Please set SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN environment variables";

      return {
        content: [
          {
            type: "text",
            text: `SuperOps.ai MCP Server Status\n\nCredentials: ${credStatus}\nAvailable domains: ${Object.keys(domainDescriptions).join(", ")}\n\nAll tools are available at all times. Use superops_navigate to discover tools by domain.`,
          },
        ],
      };
    }

    // Check for credential issues before domain calls
    const creds = getCredentials();
    if (!creds) {
      return {
        content: [
          {
            type: "text",
            text: "Error: No API credentials configured. Please set SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN environment variables.",
          },
        ],
        isError: true,
      };
    }

    // Route to appropriate domain handler based on tool name prefix
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    if (name.startsWith("superops_clients_")) {
      const domainTools = await loadDomain("clients");
      return domainTools.handleCall(name, toolArgs);
    }
    if (name.startsWith("superops_tickets_")) {
      const domainTools = await loadDomain("tickets");
      return domainTools.handleCall(name, toolArgs);
    }
    if (name.startsWith("superops_assets_")) {
      const domainTools = await loadDomain("assets");
      return domainTools.handleCall(name, toolArgs);
    }
    if (name.startsWith("superops_technicians_")) {
      const domainTools = await loadDomain("technicians");
      return domainTools.handleCall(name, toolArgs);
    }
    if (name.startsWith("superops_custom_")) {
      const domainTools = await loadDomain("custom");
      return domainTools.handleCall(name, toolArgs);
    }

    // Unknown tool
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}. Use superops_navigate to discover available tools by domain.`,
        },
      ],
      isError: true,
    };
  });

  return server;
}

/**
 * Start the server with stdio transport (default).
 */
async function startStdioTransport(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SuperOps.ai MCP server running on stdio (all tools available)");
}

/**
 * Start the server with HTTP Streamable transport.
 *
 * In gateway mode (AUTH_MODE=gateway), credentials are extracted from
 * request headers and isolated per-request via AsyncLocalStorage.
 * Credentials are NEVER stored in process.env or shared state.
 */
async function startHttpTransport(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const isGatewayMode = process.env.AUTH_MODE === "gateway";

  const httpServer = createHttpServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
      );

      // Health check - no auth required
      if (url.pathname === "/health") {
        const creds = getCredentials();
        const statusCode = isGatewayMode || creds ? 200 : 503;

        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: isGatewayMode || creds ? "ok" : "degraded",
            transport: "http",
            authMode: isGatewayMode ? "gateway" : "env",
            timestamp: new Date().toISOString(),
            credentials: {
              configured: isGatewayMode || !!creds,
            },
            version: "1.0.0",
          })
        );
        return;
      }

      // MCP endpoint - each request gets a fresh server + transport
      if (url.pathname === "/mcp") {
        // Gateway mode: extract credentials from headers
        if (isGatewayMode) {
          const apiToken = req.headers["x-superops-api-token"] as
            | string
            | undefined;
          const subdomain = req.headers["x-superops-subdomain"] as
            | string
            | undefined;

          if (!apiToken || !subdomain) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Missing credentials",
                message:
                  "Gateway mode requires X-SuperOps-API-Token and X-SuperOps-Subdomain headers",
                required: ["X-SuperOps-API-Token", "X-SuperOps-Subdomain"],
              })
            );
            return;
          }

          const creds = { apiToken, subdomain };

          // Run the entire MCP request inside AsyncLocalStorage context
          // so getCredentials()/getClient() pick up per-request creds
          await runWithCredentials(creds, async () => {
            const perRequestServer = createMcpServer();
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              enableJsonResponse: true,
            });
            await perRequestServer.connect(transport);
            await transport.handleRequest(req, res);
            await perRequestServer.close();
          });
          return;
        }

        // Non-gateway mode: single server, env-var credentials
        const perRequestServer = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });
        await perRequestServer.connect(transport);
        await transport.handleRequest(req, res);
        await perRequestServer.close();
        return;
      }

      // 404 for everything else
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Not found",
          endpoints: ["/mcp", "/health"],
        })
      );
    }
  );

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(
        `SuperOps.ai MCP server listening on http://${host}:${port}/mcp`
      );
      console.error(
        `Health check available at http://${host}:${port}/health`
      );
      console.error(
        `Authentication mode: ${isGatewayMode ? "gateway (X-SuperOps-API-Token + X-SuperOps-Subdomain headers)" : "env (SUPEROPS_API_TOKEN + SUPEROPS_SUBDOMAIN environment variables)"}`
      );
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error("Shutting down SuperOps.ai MCP server...");
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Main entry point - select transport based on MCP_TRANSPORT env var.
 */
async function main() {
  const transport = process.env.MCP_TRANSPORT || "stdio";

  if (transport === "http") {
    await startHttpTransport();
  } else {
    await startStdioTransport();
  }
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
