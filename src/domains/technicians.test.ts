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

/** A technician exactly as SuperOps returns one. */
const TECHNICIAN = {
  userId: "tech-123",
  name: "Jane Smith",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  contactNumber: "+1-555-0100",
  emailSignature: "Jane Smith, Support",
  designation: { id: "d1", name: "Senior Technician" },
  businessFunction: null,
  team: { teamId: "team-1", name: "Support Team" },
  reportingManager: null,
  role: { roleId: "r1", name: "Administrator" },
  groups: [{ groupId: "group-1", name: "Support Team" }],
};

const LIST_INFO = { page: 1, pageSize: 50, totalCount: 1, hasMore: false };

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
      expect(tool?.inputSchema.properties).toHaveProperty("search");
      expect(tool?.inputSchema.properties).toHaveProperty("page");
      expect(tool?.inputSchema.properties).toHaveProperty("pageSize");
    });

    it("advertises no fields SuperOps does not have", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_list");

      // SuperOps has no active flag and no Relay cursors — these must not come back.
      expect(tool?.inputSchema.properties).not.toHaveProperty("activeOnly");
      expect(tool?.inputSchema.properties).not.toHaveProperty("teamId");
      expect(tool?.inputSchema.properties).not.toHaveProperty("max");
      expect(tool?.inputSchema.properties).not.toHaveProperty("cursor");
    });

    it("calls query with default page/pageSize and name sort", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [TECHNICIAN], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTechnicianList"),
        {
          input: {
            page: 1,
            pageSize: 50,
            sort: [{ attribute: "name", order: "ASC" }],
          },
        }
      );
      expect(result.content[0].text).toContain("Jane Smith");
    });

    it("sends no condition when no search term is given", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", {});

      const variables = mockClient.query.mock.calls[0][1] as {
        input: Record<string, unknown>;
      };
      expect(variables.input).not.toHaveProperty("condition");
    });

    it("builds a contains condition for a search term", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { search: "Jane" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            condition: { attribute: "name", operator: "contains", value: "Jane" },
          }),
        })
      );
    });

    it("passes page through and clamps pageSize to 100", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { page: 3, pageSize: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({ page: 3, pageSize: 100 }),
        })
      );
    });

    it("uses a custom pageSize within range", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { pageSize: 25 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({ pageSize: 25 }),
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

    it("filters the technician list by userId and returns the single match", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [TECHNICIAN], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "tech-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("getTechnicianList"), {
        input: {
          page: 1,
          pageSize: 1,
          condition: { attribute: "userId", operator: "includes", value: ["tech-123"] },
        },
      });
      // The list wrapper is unwrapped — callers get the technician itself.
      expect(JSON.parse(result.content[0].text)).toEqual(TECHNICIAN);
      expect(result.isError).toBeUndefined();
    });

    it("reports a clear not-found when the filtered list is empty", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: { ...LIST_INFO, totalCount: 0 } },
      });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "nope",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No technician found with ID: nope");
    });

    it("reports not-found when SuperOps returns a null list", async () => {
      mockClient.query.mockResolvedValue({ getTechnicianList: null });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_get", {
        technicianId: "nope",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No technician found");
    });
  });

  describe("superops_technicians_groups tool", () => {
    it("has correct definition", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_groups");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("technician groups");
      // The SuperOps query takes no arguments, so the tool takes none either.
      expect(tool?.inputSchema.properties).toEqual({});
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it("calls the argument-less group query and returns the plain list", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianGroupList: [{ groupId: "group-1", name: "Support Team" }],
      });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_groups", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTechnicianGroupList")
      );
      expect(mockClient.query.mock.calls[0]).toHaveLength(1);
      expect(JSON.parse(result.content[0].text)).toEqual([
        { groupId: "group-1", name: "Support Team" },
      ]);
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
    /** Fields SuperOps' Technician type does not define. */
    const INVENTED_TECHNICIAN_FIELDS = [
      "isActive",
      "department",
      "teams",
      "manager",
      "skills",
      "ticketCount",
      "averageResponseTime",
      "lastLoginTime",
      "phone",
    ];

    /** Relay-style pagination SuperOps does not implement. */
    const INVENTED_PAGINATION_FIELDS = ["hasNextPage", "endCursor"];

    it("LIST_TECHNICIANS_QUERY selects the real Technician fields", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", {});

      const queryArg = mockClient.query.mock.calls[0][0] as string;
      expect(queryArg).toContain("userList");
      expect(queryArg).toContain("userId");
      expect(queryArg).toContain("contactNumber");
      expect(queryArg).toContain("hasMore");
      expect(queryArg).not.toContain("technicians {");
      for (const field of [...INVENTED_TECHNICIAN_FIELDS, ...INVENTED_PAGINATION_FIELDS]) {
        expect(queryArg).not.toContain(field);
      }
    });

    it("selects JSON scalar fields bare, with no subselection", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", {});

      const queryArg = mockClient.query.mock.calls[0][0] as string;
      for (const scalar of [
        "designation",
        "businessFunction",
        "team",
        "reportingManager",
        "role",
        "groups",
      ]) {
        expect(queryArg).toContain(scalar);
        expect(queryArg).not.toMatch(new RegExp(`${scalar}\\s*\\{`));
      }
    });

    it("GET_TECHNICIAN_QUERY is a filtered getTechnicianList, not getTechnician", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [TECHNICIAN], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_get", { technicianId: "tech-123" });

      const queryArg = mockClient.query.mock.calls[0][0] as string;
      expect(queryArg).toContain("getTechnicianList(input: $input)");
      expect(queryArg).not.toMatch(/getTechnician\(/);
      expect(queryArg).not.toContain("TechnicianIdentifierInput");
      for (const field of [...INVENTED_TECHNICIAN_FIELDS, ...INVENTED_PAGINATION_FIELDS]) {
        expect(queryArg).not.toContain(field);
      }
    });

    it("LIST_TECH_GROUPS_QUERY selects only groupId and name", async () => {
      mockClient.query.mockResolvedValue({ getTechnicianGroupList: [] });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_groups", {});

      const queryArg = mockClient.query.mock.calls[0][0] as string;
      expect(queryArg).toContain("getTechnicianGroupList");
      expect(queryArg).toContain("groupId");
      expect(queryArg).toContain("name");
      expect(queryArg).not.toContain("getTechGroupList");
      expect(queryArg).not.toContain("listInfo");
      for (const field of ["description", "memberCount", "members", "$input"]) {
        expect(queryArg).not.toContain(field);
      }
    });
  });

  describe("Response format", () => {
    it("returns the JSON stringified list payload", async () => {
      const payload = { userList: [TECHNICIAN], listInfo: LIST_INFO };
      mockClient.query.mockResolvedValue({ getTechnicianList: payload });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_list", {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(JSON.parse(result.content[0].text)).toEqual(payload);
    });

    it("returns the JSON stringified group list", async () => {
      const groups = [
        { groupId: "1", name: "Support" },
        { groupId: "2", name: "Field" },
      ];
      mockClient.query.mockResolvedValue({ getTechnicianGroupList: groups });

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_groups", {});

      expect(JSON.parse(result.content[0].text)).toEqual(groups);
    });
  });
});
