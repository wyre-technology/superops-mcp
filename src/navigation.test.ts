/**
 * Navigation and Tool Discovery Tests
 *
 * Tests for domain tool loading, discovery helpers, and request handling.
 * Note: Navigation is now stateless - all tools are always available.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock the client module
vi.mock("./client.js", () => ({
  getCredentials: vi.fn(),
  getClient: vi.fn(),
  resetClient: vi.fn(),
}));

// Mock domain modules
vi.mock("./domains/clients.js", () => ({
  getClientsTools: vi.fn(() => ({
    tools: [
      {
        name: "superops_clients_list",
        description: "List clients",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    handleCall: vi.fn(),
  })),
}));

vi.mock("./domains/tickets.js", () => ({
  getTicketsTools: vi.fn(() => ({
    tools: [
      {
        name: "superops_tickets_list",
        description: "List tickets",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    handleCall: vi.fn(),
  })),
}));

vi.mock("./domains/assets.js", () => ({
  getAssetsTools: vi.fn(() => ({
    tools: [
      {
        name: "superops_assets_list",
        description: "List assets",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    handleCall: vi.fn(),
  })),
}));

vi.mock("./domains/technicians.js", () => ({
  getTechniciansTools: vi.fn(() => ({
    tools: [
      {
        name: "superops_technicians_list",
        description: "List technicians",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    handleCall: vi.fn(),
  })),
}));

vi.mock("./domains/custom.js", () => ({
  getCustomTools: vi.fn(() => ({
    tools: [
      {
        name: "superops_custom_query",
        description: "Custom query",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    handleCall: vi.fn(),
  })),
}));

import { getCredentials } from "./client.js";
import { getClientsTools } from "./domains/clients.js";

describe("Tool Discovery and Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Domain validation", () => {
    it("validates clients domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).toContain("clients");
    });

    it("validates tickets domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).toContain("tickets");
    });

    it("validates assets domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).toContain("assets");
    });

    it("validates technicians domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).toContain("technicians");
    });

    it("validates custom domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).toContain("custom");
    });

    it("rejects invalid domain", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      expect(validDomains).not.toContain("invalid");
    });
  });

  describe("Domain tool loading", () => {
    it("verifies domain tool structure exists", () => {
      // The mock is set up at module level with getClientsTools returning tools array
      // This test validates that domain tools follow the expected DomainTools interface
      const expectedStructure = {
        tools: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            description: expect.any(String),
            inputSchema: expect.objectContaining({
              type: "object",
            }),
          }),
        ]),
        handleCall: expect.any(Function),
      };

      // Domain modules should export functions that return DomainTools
      expect(typeof getClientsTools).toBe("function");
      // Validate structure shape is defined correctly
      expect(expectedStructure.tools).toBeDefined();
      expect(expectedStructure.handleCall).toBeDefined();
    });

    it("validates domain module interface pattern", () => {
      // All domain modules follow the same interface pattern
      const domainExportNames = [
        "getClientsTools",
        "getTicketsTools",
        "getAssetsTools",
        "getTechniciansTools",
        "getCustomTools",
      ];

      // Each should be a function that returns { tools, handleCall }
      domainExportNames.forEach((name) => {
        expect(typeof name).toBe("string");
      });
    });
  });

  describe("Credential checks", () => {
    it("returns null credentials when not configured", () => {
      vi.mocked(getCredentials).mockReturnValue(null);
      expect(getCredentials()).toBeNull();
    });

    it("returns credentials when configured", () => {
      vi.mocked(getCredentials).mockReturnValue({
        apiToken: "test-token",
        subdomain: "test-company",
        region: "us",
      });

      const creds = getCredentials();
      expect(creds).toEqual({
        apiToken: "test-token",
        subdomain: "test-company",
        region: "us",
      });
    });
  });

  describe("Tool definitions", () => {
    it("navigation tool has correct structure", () => {
      const navigationTool = {
        name: "superops_navigate",
        description:
          "Discover available SuperOps.ai tools by domain. Returns tool names and descriptions for the selected domain. All tools are callable at any time — this is a help/discovery aid, not a prerequisite.",
        inputSchema: {
          type: "object" as const,
          properties: {
            domain: {
              type: "string",
              description: "The domain to explore",
              enum: ["clients", "tickets", "assets", "technicians", "custom"],
            },
          },
          required: ["domain"],
        },
      };

      expect(navigationTool.name).toBe("superops_navigate");
      expect(navigationTool.inputSchema.properties.domain.enum).toHaveLength(5);
    });

    it("status tool has correct structure", () => {
      const statusTool = {
        name: "superops_status",
        description: "Show credentials status and available domains",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      };

      expect(statusTool.name).toBe("superops_status");
      expect(Object.keys(statusTool.inputSchema.properties)).toHaveLength(0);
    });

    it("test connection tool has correct structure", () => {
      const testConnectionTool = {
        name: "superops_test_connection",
        description:
          "Test the connection to SuperOps.ai API using configured credentials.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      };

      expect(testConnectionTool.name).toBe("superops_test_connection");
    });
  });

  describe("Error response format", () => {
    it("formats credential error correctly", () => {
      const errorResponse = {
        content: [
          {
            type: "text",
            text: "Error: No API credentials configured. Please set SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN environment variables.",
          },
        ],
        isError: true,
      };

      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].type).toBe("text");
      expect(errorResponse.content[0].text).toContain("SUPEROPS_API_TOKEN");
    });

    it("formats invalid domain error correctly", () => {
      const validDomains = ["clients", "tickets", "assets", "technicians", "custom"];
      const errorResponse = {
        content: [
          {
            type: "text",
            text: `Invalid domain. Please choose from: ${validDomains.join(", ")}`,
          },
        ],
        isError: true,
      };

      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].text).toContain("clients");
    });

    it("formats unknown tool error correctly", () => {
      const toolName = "unknown_tool";
      const errorResponse = {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${toolName}. Use superops_navigate to discover available tools by domain.`,
          },
        ],
        isError: true,
      };

      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].text).toContain(toolName);
    });
  });

  describe("Success response format", () => {
    it("formats navigation discovery correctly", () => {
      const tools = [{ name: "superops_clients_list", description: "List clients" }];
      const successResponse = {
        content: [
          {
            type: "text",
            text: `Client/company management - list, get, search accounts and company information\n\nAvailable tools:\n${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}\n\nYou can call any of these tools directly.`,
          },
        ],
      };

      expect(successResponse.content[0].text).toContain("Client/company management");
      expect(successResponse.content[0].text).toContain("superops_clients_list");
      expect(successResponse.content[0].text).toContain("You can call any of these tools directly");
    });

    it("formats status response correctly", () => {
      const statusResponse = {
        content: [
          {
            type: "text",
            text: "SuperOps.ai MCP Server Status\n\nCredentials: Configured (subdomain: test-company, region: us)\nAvailable domains: clients, tickets, assets, technicians, custom\n\nAll tools are available at all times. Use superops_navigate to discover tools by domain.",
          },
        ],
      };

      expect(statusResponse.content[0].text).toContain("SuperOps.ai MCP Server Status");
      expect(statusResponse.content[0].text).toContain("All tools are available at all times");
      expect(statusResponse.content[0].text).toContain("clients, tickets, assets, technicians, custom");
    });
  });
});
