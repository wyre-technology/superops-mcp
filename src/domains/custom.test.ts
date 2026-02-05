/**
 * Custom Domain Tests
 *
 * Tests for custom GraphQL query and mutation tools.
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
import { getCustomTools } from "./custom.js";

describe("Custom Domain", () => {
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

  describe("getCustomTools", () => {
    it("returns tools array with expected tools", () => {
      const domain = getCustomTools();
      expect(domain.tools).toHaveLength(2);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_custom_query",
        "superops_custom_mutation",
      ]);
    });

    it("returns handleCall function", () => {
      const domain = getCustomTools();
      expect(typeof domain.handleCall).toBe("function");
    });
  });

  describe("superops_custom_query tool", () => {
    it("has correct definition", () => {
      const domain = getCustomTools();
      const tool = domain.tools.find((t) => t.name === "superops_custom_query");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("custom GraphQL query");
      expect(tool?.description).toContain("advanced use cases");
      expect(tool?.inputSchema.properties).toHaveProperty("query");
      expect(tool?.inputSchema.properties).toHaveProperty("variables");
      expect(tool?.inputSchema.required).toContain("query");
    });

    it("executes simple query without variables", async () => {
      const mockResponse = {
        getSystemStatus: {
          status: "healthy",
          version: "1.0.0",
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const customQuery = `
        query {
          getSystemStatus {
            status
            version
          }
        }
      `;

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: customQuery,
      });

      expect(mockClient.query).toHaveBeenCalledWith(customQuery, undefined);
      expect(result.content[0].text).toContain("healthy");
      expect(result.content[0].text).toContain("1.0.0");
    });

    it("executes query with variables", async () => {
      const mockResponse = {
        getUser: {
          id: "user-123",
          name: "Test User",
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const customQuery = `
        query getUser($id: ID!) {
          getUser(id: $id) {
            id
            name
          }
        }
      `;
      const variables = { id: "user-123" };

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: customQuery,
        variables,
      });

      expect(mockClient.query).toHaveBeenCalledWith(customQuery, variables);
      expect(result.content[0].text).toContain("user-123");
    });

    it("handles complex nested variables", async () => {
      const mockResponse = {
        searchEntities: {
          results: [
            { id: "1", type: "client" },
            { id: "2", type: "ticket" },
          ],
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const customQuery = `
        query searchEntities($input: SearchInput!) {
          searchEntities(input: $input) {
            results {
              id
              type
            }
          }
        }
      `;
      const variables = {
        input: {
          query: "test",
          filters: {
            types: ["client", "ticket"],
            dateRange: {
              start: "2024-01-01",
              end: "2024-12-31",
            },
          },
          pagination: {
            limit: 10,
            offset: 0,
          },
        },
      };

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: customQuery,
        variables,
      });

      expect(mockClient.query).toHaveBeenCalledWith(customQuery, variables);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.searchEntities.results).toHaveLength(2);
    });

    it("returns raw GraphQL response", async () => {
      const mockResponse = {
        getData: {
          items: [1, 2, 3],
          metadata: { count: 3 },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: "query { getData { items metadata } }",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockResponse);
    });
  });

  describe("superops_custom_mutation tool", () => {
    it("has correct definition", () => {
      const domain = getCustomTools();
      const tool = domain.tools.find((t) => t.name === "superops_custom_mutation");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("custom GraphQL mutation");
      expect(tool?.description).toContain("advanced write operations");
      expect(tool?.inputSchema.properties).toHaveProperty("mutation");
      expect(tool?.inputSchema.properties).toHaveProperty("variables");
      expect(tool?.inputSchema.required).toContain("mutation");
    });

    it("executes simple mutation without variables", async () => {
      const mockResponse = {
        resetCache: {
          success: true,
          message: "Cache cleared",
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const customMutation = `
        mutation {
          resetCache {
            success
            message
          }
        }
      `;

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: customMutation,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(customMutation, undefined);
      expect(result.content[0].text).toContain("success");
      expect(result.content[0].text).toContain("Cache cleared");
    });

    it("executes mutation with variables", async () => {
      const mockResponse = {
        updateSetting: {
          key: "theme",
          value: "dark",
          updatedAt: "2024-01-15T10:30:00Z",
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const customMutation = `
        mutation updateSetting($key: String!, $value: String!) {
          updateSetting(key: $key, value: $value) {
            key
            value
            updatedAt
          }
        }
      `;
      const variables = { key: "theme", value: "dark" };

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: customMutation,
        variables,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(customMutation, variables);
      expect(result.content[0].text).toContain("dark");
    });

    it("handles complex mutation input", async () => {
      const mockResponse = {
        bulkUpdateTickets: {
          updatedCount: 5,
          failedCount: 0,
          tickets: [
            { id: "1", status: "Closed" },
            { id: "2", status: "Closed" },
          ],
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const customMutation = `
        mutation bulkUpdateTickets($input: BulkUpdateInput!) {
          bulkUpdateTickets(input: $input) {
            updatedCount
            failedCount
            tickets {
              id
              status
            }
          }
        }
      `;
      const variables = {
        input: {
          ticketIds: ["1", "2", "3", "4", "5"],
          updates: {
            status: "Closed",
            resolution: "Bulk closed - issue resolved",
          },
        },
      };

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: customMutation,
        variables,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(customMutation, variables);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.bulkUpdateTickets.updatedCount).toBe(5);
    });

    it("returns raw GraphQL response for mutations", async () => {
      const mockResponse = {
        createEntity: {
          id: "new-123",
          createdAt: "2024-01-15T10:30:00Z",
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: "mutation { createEntity { id createdAt } }",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockResponse);
    });
  });

  describe("Error handling", () => {
    it("returns error for unknown tool", async () => {
      const domain = getCustomTools();
      const result = await domain.handleCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown custom tool");
    });

    it("handles query errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("GraphQL syntax error"));

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: "invalid query syntax",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: GraphQL syntax error");
    });

    it("handles mutation errors gracefully", async () => {
      mockClient.mutate.mockRejectedValue(new Error("Permission denied"));

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: "mutation { restrictedOperation { success } }",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Permission denied");
    });

    it("handles non-Error exceptions for queries", async () => {
      mockClient.query.mockRejectedValue("String error from API");

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: "query { test }",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: String error from API");
    });

    it("handles non-Error exceptions for mutations", async () => {
      mockClient.mutate.mockRejectedValue({ code: 500, message: "Server error" });

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: "mutation { test }",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("Query validation patterns", () => {
    it("accepts valid introspection query", async () => {
      const mockResponse = {
        __schema: {
          types: [{ name: "Query" }, { name: "Mutation" }],
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const introspectionQuery = `
        query {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: introspectionQuery,
      });

      expect(mockClient.query).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Query");
    });

    it("passes through fragment queries", async () => {
      const mockResponse = {
        getTickets: {
          tickets: [{ id: "1", subject: "Test" }],
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const queryWithFragment = `
        fragment TicketFields on Ticket {
          id
          subject
          status
        }

        query {
          getTickets {
            tickets {
              ...TicketFields
            }
          }
        }
      `;

      const domain = getCustomTools();
      await domain.handleCall("superops_custom_query", {
        query: queryWithFragment,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("fragment TicketFields"),
        undefined
      );
    });
  });

  describe("Response format", () => {
    it("returns formatted JSON for query results", async () => {
      const mockResponse = {
        data: {
          nested: {
            deeply: {
              value: "test",
            },
          },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: "query { data { nested { deeply { value } } } }",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      // Should be pretty-printed JSON
      expect(result.content[0].text).toContain("\n");
    });

    it("returns formatted JSON for mutation results", async () => {
      const mockResponse = {
        result: {
          success: true,
          data: { id: "123" },
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_mutation", {
        mutation: "mutation { result { success data } }",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("\n");
    });

    it("does not include isError for successful responses", async () => {
      mockClient.query.mockResolvedValue({ test: true });

      const domain = getCustomTools();
      const result = await domain.handleCall("superops_custom_query", {
        query: "query { test }",
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe("Variables handling", () => {
    it("handles empty variables object", async () => {
      mockClient.query.mockResolvedValue({ test: true });

      const domain = getCustomTools();
      await domain.handleCall("superops_custom_query", {
        query: "query { test }",
        variables: {},
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        {}
      );
    });

    it("handles null-valued variables", async () => {
      mockClient.query.mockResolvedValue({ test: true });

      const domain = getCustomTools();
      await domain.handleCall("superops_custom_query", {
        query: "query { test }",
        variables: { nullField: null, otherField: "value" },
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        { nullField: null, otherField: "value" }
      );
    });

    it("handles array variables", async () => {
      mockClient.query.mockResolvedValue({ test: true });

      const domain = getCustomTools();
      await domain.handleCall("superops_custom_query", {
        query: "query { test }",
        variables: { ids: ["1", "2", "3"] },
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        { ids: ["1", "2", "3"] }
      );
    });
  });
});
