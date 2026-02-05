#!/usr/bin/env node
/**
 * SuperOps.ai MCP Server
 *
 * This MCP server provides tools for interacting with SuperOps.ai PSA/RMM API.
 * It uses a decision tree architecture for tool loading - Claude first navigates
 * to a domain, then domain-specific tools become available.
 *
 * Features:
 * - Decision tree tool loading for reduced cognitive load
 * - Lazy loading of domain modules for faster startup
 * - GraphQL-based API communication
 * - Bearer token authentication
 *
 * Environment Variables:
 * - SUPEROPS_API_TOKEN: Your SuperOps.ai API token
 * - SUPEROPS_SUBDOMAIN: Your SuperOps.ai subdomain
 * - SUPEROPS_REGION: API region (us or eu, default: us)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { Domain, DomainTools, ToolDefinition } from "./types.js";
import { getCredentials } from "./client.js";

// Current active domain (null = navigation mode)
let currentDomain: Domain | null = null;

// Lazy-loaded domain modules
const domainCache = new Map<Domain, DomainTools>();

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

// Navigation tool definition
const navigationTool: ToolDefinition = {
  name: "superops_navigate",
  description:
    "Navigate to a SuperOps.ai domain to access its tools. Available domains: clients (accounts/companies), tickets (service desk), assets (endpoints/devices), technicians (agents/teams), custom (advanced GraphQL queries).",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "The domain to navigate to",
        enum: ["clients", "tickets", "assets", "technicians", "custom"],
      },
    },
    required: ["domain"],
  },
};

// Back/reset tool definition
const backTool: ToolDefinition = {
  name: "superops_back",
  description:
    "Return to the main navigation menu to select a different domain.",
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

// List available tools based on current domain state
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: ToolDefinition[] = [testConnectionTool];

  if (currentDomain === null) {
    // Navigation mode - show navigation tool
    tools.push(navigationTool);
  } else {
    // Domain mode - show domain tools plus back tool
    tools.push(backTool);
    const domainTools = await loadDomain(currentDomain);
    tools.push(...domainTools.tools);
  }

  return { tools };
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
      // Try to load clients domain and make a simple query
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

  // Handle navigation
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

    currentDomain = domain as Domain;
    const domainTools = await loadDomain(currentDomain);

    return {
      content: [
        {
          type: "text",
          text: `Navigated to ${domain} domain. Available tools:\n\n${domainTools.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}\n\nUse superops_back to return to the main menu.`,
        },
      ],
    };
  }

  // Handle back
  if (name === "superops_back") {
    currentDomain = null;
    return {
      content: [
        {
          type: "text",
          text: "Returned to main navigation. Use superops_navigate to select a domain:\n\n- clients: Manage client accounts and contacts\n- tickets: Service desk and ticket management\n- assets: Endpoint inventory and RMM\n- technicians: Agent and team management\n- custom: Advanced GraphQL queries",
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

  // Handle domain-specific tools
  if (currentDomain) {
    const domainTools = await loadDomain(currentDomain);

    // Check if the tool belongs to this domain
    const toolBelongsToDomain = domainTools.tools.some((t) => t.name === name);
    if (toolBelongsToDomain) {
      return domainTools.handleCall(name, (args ?? {}) as Record<string, unknown>);
    }
  }

  // Try to find the tool in any domain (for direct access)
  const allDomains: Domain[] = [
    "clients",
    "tickets",
    "assets",
    "technicians",
    "custom",
  ];

  for (const domain of allDomains) {
    const domainTools = await loadDomain(domain);
    const toolExists = domainTools.tools.some((t) => t.name === name);
    if (toolExists) {
      // Auto-navigate to the domain
      currentDomain = domain;
      return domainTools.handleCall(name, (args ?? {}) as Record<string, unknown>);
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}. Use superops_navigate to explore available tools.`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SuperOps.ai MCP server running on stdio");
}

main().catch(console.error);
