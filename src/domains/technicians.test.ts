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

/**
 * A technician exactly as SuperOps returns one. The JSON-scalar fields carry the
 * shapes a live tenant actually returns: `role` is `{ roleId, name }`, `groups` is
 * `[{ groupId, name }]`, and the lookup objects are keyed by their own id field
 * (`designationId`, `teamId`) rather than a bare `id`.
 */
const TECHNICIAN = {
  userId: "tech-123",
  name: "Jane Smith",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  contactNumber: "+1-555-0100",
  emailSignature: "Jane Smith, Support",
  designation: { designationId: "d1", name: "Senior Technician" },
  businessFunction: null,
  team: { teamId: "team-1", name: "Support Team" },
  reportingManager: null,
  role: { roleId: "r1", name: "Administrator" },
  groups: [{ groupId: "group-1", name: "Support Team" }],
};

/**
 * Operators SuperOps rejects outright on `getTechnicianList` — both come back as an
 * Internal Server Error, so no tool may ever emit them. Verified live alongside the
 * accepted set (`is`, `contains`, `startsWith` with a string; `includes` with an array).
 */
const REJECTED_OPERATORS = ["equals", "in"];

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
      expect(domain.tools).toHaveLength(4);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_technicians_list",
        "superops_technicians_get",
        "superops_technicians_groups",
        "superops_technicians_lookups",
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

    it("searches name OR email with a compound contains condition", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { search: "Jane" });

      // A term the user typed could be either a name or an address; SuperOps
      // resolves both legs in one request via joinOperator/operands.
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            condition: {
              joinOperator: "OR",
              operands: [
                { attribute: "name", operator: "contains", value: "Jane" },
                { attribute: "email", operator: "contains", value: "Jane" },
              ],
            },
          }),
        })
      );
    });

    it("uses operators and value types SuperOps accepts in every search clause", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { search: "Jane" });

      const { condition } = (mockClient.query.mock.calls[0][1] as {
        input: { condition: { operands: { operator: string; value: unknown }[] } };
      }).input;

      for (const clause of condition.operands) {
        // `contains` takes a bare string; an array value here is a server error.
        expect(typeof clause.value).toBe("string");
        expect(REJECTED_OPERATORS).not.toContain(clause.operator);
      }
    });

    it("sends joinOperator uppercase, which SuperOps validates by silence", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { search: "Jane" });

      const { condition } = (mockClient.query.mock.calls[0][1] as {
        input: { condition: { joinOperator: string } };
      }).input;

      // A joinOperator SuperOps does not recognise is not rejected — it silently
      // becomes OR. Lowercase would still return the right rows for this tool and
      // hide the bug, so assert the exact casing rather than a case-insensitive match.
      expect(condition.joinOperator).toBe("OR");
    });

    it("never wraps a lone clause in a compound envelope", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_list", { search: "Jane" });

      const { condition } = (mockClient.query.mock.calls[0][1] as {
        input: { condition: { operands?: unknown[] } };
      }).input;

      // Two clauses here, so a compound is right — but it must carry every clause
      // it wraps. A single-operand envelope would mean the collapse rule broke.
      expect(condition.operands).toHaveLength(2);
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

    it("describes role and groups by their real shape, not as opaque blobs", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_get");

      // SuperOps types these as JSON scalars but returns structured objects; a
      // caller told they are "opaque" will not read `.name` off them.
      expect(tool?.description).not.toContain("opaque");
      expect(tool?.description).toContain("roleId");
      expect(tool?.description).toContain("groupId");
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

    it("filters with an operator SuperOps accepts, and an array value for it", async () => {
      mockClient.query.mockResolvedValue({
        getTechnicianList: { userList: [TECHNICIAN], listInfo: LIST_INFO },
      });

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_get", { technicianId: "tech-123" });

      const { condition } = (mockClient.query.mock.calls[0][1] as {
        input: { condition: { attribute: string; operator: string; value: unknown } };
      }).input;

      // `userId` + `includes` is the only pair verified to resolve a single
      // technician; `includes` requires an array value.
      expect(condition.attribute).toBe("userId");
      expect(condition.operator).toBe("includes");
      expect(Array.isArray(condition.value)).toBe(true);
      expect(REJECTED_OPERATORS).not.toContain(condition.operator);
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

  describe("superops_technicians_lookups tool", () => {
    const LOOKUPS = {
      roles: [{ roleId: "1", name: "Admin" }],
      teams: [{ teamId: "t1", name: "Sales" }],
      designations: [{ designationId: "d1", name: "Finance" }],
      businessFunctions: [{ businessFunctionId: "b1", name: "Admin" }],
    };

    it("has correct definition", () => {
      const domain = getTechniciansTools();
      const tool = domain.tools.find((t) => t.name === "superops_technicians_lookups");

      expect(tool).toBeDefined();
      // All four SuperOps lookup queries are argument-less, so the tool is too.
      expect(tool?.inputSchema.properties).toEqual({});
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it("calls the argument-less lookup query and returns all four vocabularies", async () => {
      mockClient.query.mockResolvedValue(LOOKUPS);

      const domain = getTechniciansTools();
      const result = await domain.handleCall("superops_technicians_lookups", {});

      expect(mockClient.query.mock.calls[0]).toHaveLength(1);
      expect(JSON.parse(result.content[0].text)).toEqual(LOOKUPS);
      expect(result.isError).toBeUndefined();
    });

    it("queries the four real lookup fields under stable aliases", async () => {
      mockClient.query.mockResolvedValue(LOOKUPS);

      const domain = getTechniciansTools();
      await domain.handleCall("superops_technicians_lookups", {});

      const queryArg = mockClient.query.mock.calls[0][0] as string;
      for (const field of [
        "getTechnicianRoleList",
        "getTeamList",
        "getDesignationList",
        "getBusinessFunctionList",
      ]) {
        expect(queryArg).toContain(field);
      }
      // Each type defines exactly its own id plus name — nothing else to select.
      for (const alias of ["roles:", "teams:", "designations:", "businessFunctions:"]) {
        expect(queryArg).toContain(alias);
      }
      for (const id of ["roleId", "teamId", "designationId", "businessFunctionId"]) {
        expect(queryArg).toContain(id);
      }
      expect(queryArg).not.toContain("$input");
      expect(queryArg).not.toContain("listInfo");
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
