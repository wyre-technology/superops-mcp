/**
 * Technicians Domain Tests
 *
 * Tests for technician (agent) management tools.
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
import { getTechniciansTools } from "./technicians.js";

describe("Technicians Domain", () => {
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

  describe("getTechniciansTools", () => {
    it("returns tools array with expected tools", () => {
      const domain = getTechniciansTools();
      expect(domain.tools).toHaveLength(3);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_technicians_list",
        "superops_technicians_get",
        "superops_technicians_groups",
      ]);
    });

    it("returns handleCall function", () => {
      const domain = getTechniciansTools();
      expect(typeof domain.handleCall).toBe("function");
    });
  });

  describe("superops_technicians_list tool", () => {
    it("has correct definition", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_list");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("List technicians");
      expect(tool?.inputSchema.properties).toHaveProperty("activeOnly");
      expect(tool?.inputSchema.properties).toHaveProperty("teamId");
      expect(tool?.inputSchema.properties).toHaveProperty("max");
      expect(tool?.inputSchema.properties).toHaveProperty("cursor");
    });

    it("calls query with default parameters (activeOnly: true)", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [
            { id: "tech-1", name: "John Doe", email: "john@example.com", isActive: true },
          ],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTechnicianList"),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 50,
            filter: { isActive: true },
            orderBy: { field: "name", direction: "ASC" },
          }),
        })
      );
      expect(result.content[0].text).toContain("John Doe");
    });

    it("includes inactive technicians when activeOnly is false", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { activeOnly: false });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.not.objectContaining({
            filter: expect.objectContaining({ isActive: true }),
          }),
        })
      );
    });

    it("applies teamId filter", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { teamId: "team-123" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: expect.objectContaining({
              teams: { id: "team-123" },
            }),
          }),
        })
      );
    });

    it("combines activeOnly and teamId filters", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", {
        activeOnly: true,
        teamId: "team-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: {
              isActive: true,
              teams: { id: "team-123" },
            },
          }),
        })
      );
    });

    it("respects max parameter with upper limit of 500", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { max: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 500,
          }),
        })
      );
    });

    it("passes cursor for pagination", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { cursor: "cursor-abc" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            after: "cursor-abc",
          }),
        })
      );
    });
  });

  describe("superops_technicians_get tool", () => {
    it("has correct definition", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_get");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("detailed information");
      expect(tool?.inputSchema.properties).toHaveProperty("technicianId");
      expect(tool?.inputSchema.required).toContain("technicianId");
    });

    it("calls query with technicianId", async () => {
      const mockResponse = {
        getTechnician: {
          id: "tech-123",
          name: "Jane Smith",
          email: "jane@example.com",
          isActive: true,
          role: "Senior Technician",
          teams: [{ id: "team-1", name: "Support Team" }],
          skills: ["Networking", "Hardware"],
          ticketCount: 45,
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "tech-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTechnician"),
        expect.objectContaining({
          input: { id: "tech-123" },
        })
      );
      expect(result.content[0].text).toContain("Jane Smith");
      expect(result.content[0].text).toContain("Senior Technician");
    });
  });

  describe("superops_technicians_groups tool", () => {
    it("has correct definition", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_groups");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("technician groups");
      expect(tool?.inputSchema.properties).toHaveProperty("max");
    });

    it("calls query with default max", async () => {
      const mockResponse = {
        getTechGroupList: {
          techGroups: [
            {
              id: "group-1",
              name: "Support Team",
              memberCount: 5,
              members: [
                { id: "tech-1", name: "John" },
                { id: "tech-2", name: "Jane" },
              ],
            },
          ],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_groups", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTechGroupList"),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 50,
          }),
        })
      );
      expect(result.content[0].text).toContain("Support Team");
      expect(result.content[0].text).toContain("memberCount");
    });

    it("respects max parameter with upper limit of 500", async () => {
      const mockResponse = {
        getTechGroupList: {
          techGroups: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_groups", { max: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 500,
          }),
        })
      );
    });

    it("uses custom max when provided", async () => {
      const mockResponse = {
        getTechGroupList: {
          techGroups: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_groups", { max: 25 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 25,
          }),
        })
      );
    });
  });

  describe("Error handling", () => {
    it("returns error for unknown tool", async () => {
      const domain = getTechniciansTools();
      const result = await domain.handleCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown technicians tool");
    });

    it("handles API errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("Technician not found"));

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "nonexistent",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Technician not found");
    });

    it("handles non-Error exceptions", async () => {
      mockClient.query.mockRejectedValue("Network failure");

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_list", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Network failure");
    });
  });

  describe("GraphQL query structure", () => {
    it("LIST_TECHNICIANS_QUERY includes expected fields", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", {});

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("id");
      expect(queryArg).toContain("name");
      expect(queryArg).toContain("email");
      expect(queryArg).toContain("isActive");
      expect(queryArg).toContain("teams");
      expect(queryArg).toContain("ticketCount");
    });

    it("GET_TECHNICIAN_QUERY includes detailed fields", async () => {
      const mockResponse = {
        getTechnician: { id: "1", name: "Test" },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_get", { technicianId: "1" });

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("skills");
      expect(queryArg).toContain("manager");
      expect(queryArg).toContain("averageResponseTime");
    });

    it("LIST_TECH_GROUPS_QUERY includes members", async () => {
      const mockResponse = {
        getTechGroupList: {
          techGroups: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_groups", {});

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("members");
      expect(queryArg).toContain("memberCount");
      expect(queryArg).toContain("description");
    });
  });

  describe("Response format", () => {
    it("returns JSON stringified response for list", async () => {
      const mockResponse = {
        getTechnicianList: {
          technicians: [{ id: "1", name: "Test Tech" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_list", {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockResponse.getTechnicianList);
    });

    it("returns JSON stringified response for get", async () => {
      const mockResponse = {
        getTechnician: { id: "1", name: "Test Tech", email: "test@example.com" },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "1",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockResponse.getTechnician);
    });

    it("returns JSON stringified response for groups", async () => {
      const mockResponse = {
        getTechGroupList: {
          techGroups: [{ id: "1", name: "Support" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_groups", {});

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockResponse.getTechGroupList);
    });
  });
});
