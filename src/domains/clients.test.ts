/**
 * Clients Domain Tests
 *
 * Tests for client (account) management tools.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock the client module
vi.mock("../client.js", () => ({
  getClient: vi.fn(() => ({
    query: vi.fn(),
    mutate: vi.fn(),
  })),
}));

import { getClient } from "../client.js";
import { getClientsTools } from "./clients.js";

describe("Clients Domain", () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      mutate: vi.fn(),
    };
    vi.mocked(getClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getClient>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getClientsTools", () => {
    it("returns tools array with expected tools", () => {
      const domain = getClientsTools();
      expect(domain.tools).toHaveLength(3);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_clients_list",
        "superops_clients_get",
        "superops_clients_search",
      ]);
    });

    it("returns handleCall function", () => {
      const domain = getClientsTools();
      expect(typeof domain.handleCall).toBe("function");
    });
  });

  describe("superops_clients_list tool", () => {
    it("has correct definition", () => {
      const domain = getClientsTools();
      const tool = domain.tools.find((t) => t.name === "superops_clients_list");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("List clients");
      expect(tool?.inputSchema.properties).toHaveProperty("status");
      expect(tool?.inputSchema.properties).toHaveProperty("stage");
      expect(tool?.inputSchema.properties).toHaveProperty("max");
      expect(tool?.inputSchema.properties).toHaveProperty("cursor");
    });

    it("calls query with default parameters", async () => {
      const mockResponse = {
        getClientList: {
          clients: [{ accountId: "1", name: "Test Client" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      const result = await domain.handleCall("superops_clients_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getClientList"),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 50,
            orderBy: { field: "name", direction: "ASC" },
          }),
        })
      );
      expect(result.content[0].text).toContain("Test Client");
    });

    it("applies status filter", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_list", { status: "Active" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { status: "Active" },
          }),
        })
      );
    });

    it("applies stage filter", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_list", { stage: "Customer" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { stage: "Customer" },
          }),
        })
      );
    });

    it("respects max parameter with upper limit of 500", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_list", { max: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 500, // Should be capped at 500
          }),
        })
      );
    });

    it("passes cursor for pagination", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_list", { cursor: "abc123" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            after: "abc123",
          }),
        })
      );
    });
  });

  describe("superops_clients_get tool", () => {
    it("has correct definition", () => {
      const domain = getClientsTools();
      const tool = domain.tools.find((t) => t.name === "superops_clients_get");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Get detailed information");
      expect(tool?.inputSchema.properties).toHaveProperty("accountId");
      expect(tool?.inputSchema.required).toContain("accountId");
    });

    it("calls query with accountId", async () => {
      const mockResponse = {
        getClient: {
          accountId: "acc-123",
          name: "Test Company",
          status: "Active",
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      const result = await domain.handleCall("superops_clients_get", {
        accountId: "acc-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getClient"),
        expect.objectContaining({
          input: { accountId: "acc-123" },
        })
      );
      expect(result.content[0].text).toContain("Test Company");
    });
  });

  describe("superops_clients_search tool", () => {
    it("has correct definition", () => {
      const domain = getClientsTools();
      const tool = domain.tools.find((t) => t.name === "superops_clients_search");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Search for clients");
      expect(tool?.inputSchema.properties).toHaveProperty("query");
      expect(tool?.inputSchema.required).toContain("query");
    });

    it("constructs search filter with OR condition", async () => {
      const mockResponse = {
        getClientList: {
          clients: [{ accountId: "1", name: "Acme Corp" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_search", { query: "acme" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: {
              or: [
                { name: { contains: "acme" } },
                { emailDomains: { contains: "acme" } },
              ],
            },
          }),
        })
      );
    });

    it("respects max parameter with default of 20", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_search", { query: "test" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 20,
          }),
        })
      );
    });

    it("caps max at 100", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_search", { query: "test", max: 200 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 100,
          }),
        })
      );
    });
  });

  describe("Error handling", () => {
    it("returns error for unknown tool", async () => {
      const domain = getClientsTools();
      const result = await domain.handleCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown clients tool");
    });

    it("handles API errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("API connection failed"));

      const domain = getClientsTools();
      const result = await domain.handleCall("superops_clients_list", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: API connection failed");
    });

    it("handles non-Error exceptions", async () => {
      mockClient.query.mockRejectedValue("String error");

      const domain = getClientsTools();
      const result = await domain.handleCall("superops_clients_list", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: String error");
    });
  });

  describe("GraphQL query structure", () => {
    it("LIST_CLIENTS_QUERY includes required fields", async () => {
      const mockResponse = {
        getClientList: {
          clients: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_list", {});

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("accountId");
      expect(queryArg).toContain("name");
      expect(queryArg).toContain("status");
      expect(queryArg).toContain("stage");
      expect(queryArg).toContain("listInfo");
    });

    it("GET_CLIENT_QUERY includes detailed fields", async () => {
      const mockResponse = {
        getClient: { accountId: "1", name: "Test" },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getClientsTools();
      await domain.handleCall("superops_clients_get", { accountId: "1" });

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("address");
      expect(queryArg).toContain("customFields");
      expect(queryArg).toContain("sites");
    });
  });
});
