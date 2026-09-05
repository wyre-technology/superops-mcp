/**
 * Assets Domain Tests
 *
 * Tests for asset (endpoint) management tools.
 *
 * These assert the *shape* of what we send SuperOps: page/pageSize offsets,
 * a single `RuleConditionInput` filter clause, and JSON-scalar fields selected
 * bare. graphql-schema.test.ts separately validates the documents against the
 * real schema.
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
import { getAssetsTools } from "./assets.js";

const LIST_INFO = { page: 1, pageSize: 50, totalCount: 1, hasMore: false };

describe("Assets Domain", () => {
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

  describe("getAssetsTools", () => {
    it("returns tools array with expected tools", () => {
      const domain = getAssetsTools();
      expect(domain.tools).toHaveLength(4);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_assets_list",
        "superops_assets_get",
        "superops_assets_software",
        "superops_assets_patches",
      ]);
    });

    it("returns handleCall function", () => {
      const domain = getAssetsTools();
      expect(typeof domain.handleCall).toBe("function");
    });

    it("paginates every list tool with page/pageSize, never Relay cursors", () => {
      const domain = getAssetsTools();
      for (const name of [
        "superops_assets_list",
        "superops_assets_software",
        "superops_assets_patches",
      ]) {
        const props = domain.tools.find((t) => t.name === name)?.inputSchema.properties;
        expect(props, name).toHaveProperty("page");
        expect(props, name).toHaveProperty("pageSize");
        expect(props, name).not.toHaveProperty("max");
        expect(props, name).not.toHaveProperty("cursor");
      }
    });
  });

  describe("superops_assets_list tool", () => {
    it("has correct definition", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_list");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("List assets");
      expect(tool?.inputSchema.properties).toHaveProperty("status");
      expect(tool?.inputSchema.properties).toHaveProperty("platform");
      expect(tool?.inputSchema.properties).toHaveProperty("clientId");
    });

    it("documents that only one filter condition applies per request", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_list");

      expect(tool?.description).toContain("single filter condition");
    });

    it("calls query with default pagination and sort", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [{ assetId: "1", name: "DESKTOP-001", status: "Online" }],
          listInfo: LIST_INFO,
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetList"),
        expect.objectContaining({
          input: {
            page: 1,
            pageSize: 50,
            sort: [{ attribute: "name", order: "ASC" }],
          },
        })
      );
      expect(result.content[0].text).toContain("DESKTOP-001");
    });

    it("applies status filter as a single includes condition", async () => {
      mockClient.query.mockResolvedValue({
        getAssetList: { assets: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { status: "Online" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            condition: { attribute: "status", operator: "includes", value: ["Online"] },
          }),
        })
      );
    });

    it("applies platform filter as a single includes condition", async () => {
      mockClient.query.mockResolvedValue({
        getAssetList: { assets: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { platform: "Windows" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            condition: { attribute: "platform", operator: "includes", value: ["Windows"] },
          }),
        })
      );
    });

    it("applies clientId filter as a single includes condition", async () => {
      mockClient.query.mockResolvedValue({
        getAssetList: { assets: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { clientId: "client-123" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            condition: { attribute: "client", operator: "includes", value: ["client-123"] },
          }),
        })
      );
    });

    it("passes through an explicit page and caps pageSize at 100", async () => {
      mockClient.query.mockResolvedValue({
        getAssetList: { assets: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { page: 3, pageSize: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({ page: 3, pageSize: 100 }),
        })
      );
    });

    it("rejects combined filters rather than silently dropping one", async () => {
      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_list", {
        status: "Online",
        platform: "Windows",
        clientId: "client-123",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("only one filter condition");
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe("superops_assets_get tool", () => {
    it("has correct definition", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_get");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("detailed information");
      expect(tool?.inputSchema.properties).toHaveProperty("assetId");
      expect(tool?.inputSchema.required).toContain("assetId");
    });

    it("is honest that CPU/memory/disk are not on the asset record", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_get");

      expect(tool?.description).toContain("does not expose CPU, memory or disk");
      expect(tool?.description).toContain("getAssetSummary");
    });

    it("calls query with assetId", async () => {
      const mockResponse = {
        getAsset: {
          assetId: "asset-123",
          name: "WORKSTATION-001",
          status: "Online",
          platform: "Windows",
          platformVersion: "23H2",
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_get", {
        assetId: "asset-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAsset"),
        expect.objectContaining({
          input: { assetId: "asset-123" },
        })
      );
      expect(result.content[0].text).toContain("WORKSTATION-001");
      expect(result.content[0].text).toContain("23H2");
    });
  });

  describe("superops_assets_software tool", () => {
    it("has correct definition", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_software");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("software inventory");
      expect(tool?.inputSchema.properties).toHaveProperty("assetId");
      expect(tool?.inputSchema.properties).toHaveProperty("search");
      expect(tool?.inputSchema.required).toContain("assetId");
    });

    it("nests pagination under input.listInfo alongside assetId", async () => {
      const mockResponse = {
        getAssetSoftwareList: {
          assetSoftwares: [
            { id: "sw-1", software: { name: "Microsoft Office" }, version: "365" },
          ],
          listInfo: LIST_INFO,
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_software", {
        assetId: "asset-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetSoftwareList"),
        {
          input: {
            assetId: "asset-123",
            listInfo: { page: 1, pageSize: 50 },
          },
        }
      );
      expect(result.content[0].text).toContain("Microsoft Office");
    });

    it("applies search as a contains condition", async () => {
      mockClient.query.mockResolvedValue({
        getAssetSoftwareList: { assetSoftwares: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_software", {
        assetId: "asset-123",
        search: "chrome",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            assetId: "asset-123",
            listInfo: expect.objectContaining({
              condition: { attribute: "software", operator: "contains", value: "chrome" },
            }),
          }),
        })
      );
    });

    it("caps pageSize at 100", async () => {
      mockClient.query.mockResolvedValue({
        getAssetSoftwareList: { assetSoftwares: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_software", {
        assetId: "asset-123",
        pageSize: 1000,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            listInfo: expect.objectContaining({ pageSize: 100 }),
          }),
        })
      );
    });
  });

  describe("superops_assets_patches tool", () => {
    it("has correct definition", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_patches");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("patch status");
      expect(tool?.inputSchema.properties).toHaveProperty("assetId");
      expect(tool?.inputSchema.properties).toHaveProperty("installationStatus");
      expect(tool?.inputSchema.properties).toHaveProperty("severity");
      expect(tool?.inputSchema.required).toContain("assetId");
    });

    it("nests pagination under input.listInfo alongside assetId", async () => {
      const mockResponse = {
        getAssetPatchDetails: {
          assetPatches: [
            {
              patchDetail: { patchId: "patch-1", title: "Security Update", severity: "Critical" },
              installationStatus: "Pending",
            },
          ],
          listInfo: LIST_INFO,
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetPatchDetails"),
        {
          input: {
            assetId: "asset-123",
            listInfo: { page: 1, pageSize: 50 },
          },
        }
      );
      expect(result.content[0].text).toContain("Security Update");
    });

    it("applies installationStatus as a single includes condition", async () => {
      mockClient.query.mockResolvedValue({
        getAssetPatchDetails: { assetPatches: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        installationStatus: "Pending",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            listInfo: expect.objectContaining({
              condition: {
                attribute: "installationStatus",
                operator: "includes",
                value: ["Pending"],
              },
            }),
          }),
        })
      );
    });

    it("applies severity as a single includes condition over the array", async () => {
      mockClient.query.mockResolvedValue({
        getAssetPatchDetails: { assetPatches: [], listInfo: LIST_INFO },
      });

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        severity: ["Critical", "Important"],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            listInfo: expect.objectContaining({
              condition: {
                attribute: "severity",
                operator: "includes",
                value: ["Critical", "Important"],
              },
            }),
          }),
        })
      );
    });

    it("rejects combined installationStatus and severity filters", async () => {
      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        installationStatus: "Pending",
        severity: ["Critical"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("only one filter condition");
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("returns error for unknown tool", async () => {
      const domain = getAssetsTools();
      const result = await domain.handleCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown assets tool");
    });

    it("handles API errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("Asset not found"));

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_get", {
        assetId: "nonexistent",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Asset not found");
    });

    it("handles non-Error exceptions", async () => {
      mockClient.query.mockRejectedValue({ message: "Unknown error" });

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_list", {});

      expect(result.isError).toBe(true);
    });
  });

  describe("GraphQL query structure", () => {
    async function queryFor(tool: string, args: Record<string, unknown>): Promise<string> {
      mockClient.query.mockResolvedValue({});
      await getAssetsTools().handleCall(tool, args);
      return mockClient.query.mock.calls[0][0] as string;
    }

    it("LIST_ASSETS_QUERY selects real Asset fields and offset listInfo", async () => {
      const query = await queryFor("superops_assets_list", {});

      expect(query).toContain("assetId");
      expect(query).toContain("hostName");
      expect(query).toContain("platform");
      expect(query).toContain("primaryMac");
      expect(query).toContain("publicIp");
      expect(query).toContain("lastCommunicatedTime");
      expect(query).toMatch(/listInfo\s*\{\s*page\s+pageSize\s+totalCount\s+hasMore\s*\}/);
    });

    it("LIST_ASSETS_QUERY selects patchStatus bare — it is a String, not an object", async () => {
      const query = await queryFor("superops_assets_list", {});

      expect(query).toContain("patchStatus");
      expect(query).not.toMatch(/patchStatus\s*\{/);
    });

    it("LIST_ASSETS_QUERY selects JSON scalars bare", async () => {
      const query = await queryFor("superops_assets_list", {});

      expect(query).toContain("client");
      expect(query).toContain("site");
      expect(query).not.toMatch(/client\s*\{/);
      expect(query).not.toMatch(/site\s*\{/);
    });

    it("GET_ASSET_QUERY selects hardware and platform fields SuperOps actually has", async () => {
      const query = await queryFor("superops_assets_get", { assetId: "1" });

      expect(query).toContain("manufacturer");
      expect(query).toContain("model");
      expect(query).toContain("serialNumber");
      expect(query).toContain("platformFamily");
      expect(query).toContain("platformVersion");
      expect(query).toContain("sysUptime");
      expect(query).toContain("agentVersion");
    });

    it("GET_ASSET_QUERY drops the fields SuperOps does not define", async () => {
      const query = await queryFor("superops_assets_get", { assetId: "1" });

      for (const invented of [
        "lastSeen",
        "ipAddress",
        "macAddress",
        "osName",
        "osVersion",
        "osBuild",
        "architecture",
        "processorName",
        "processorCores",
        "totalMemory",
        "totalDiskSpace",
        "freeDiskSpace",
        "tags",
        "hostname",
      ]) {
        expect(query, `${invented} is not a SuperOps Asset field`).not.toContain(invented);
      }
    });

    it("GET_ASSET_QUERY selects JSON scalars bare", async () => {
      const query = await queryFor("superops_assets_get", { assetId: "1" });

      for (const scalar of [
        "client",
        "site",
        "requester",
        "assetClass",
        "deviceCategory",
        "customFields",
      ]) {
        expect(query).toContain(scalar);
        expect(query).not.toMatch(new RegExp(`${scalar}\\s*\\{`));
      }
    });

    it("GET_ASSET_SOFTWARE_QUERY selects assetSoftwares with a bare software scalar", async () => {
      const query = await queryFor("superops_assets_software", { assetId: "1" });

      expect(query).toContain("assetSoftwares");
      expect(query).toContain("installedDate");
      expect(query).toContain("installedPath");
      expect(query).not.toMatch(/software\s*\{/);
      expect(query).toContain("$input: AssetDetailsListInput!");
    });

    it("GET_ASSET_PATCHES_QUERY selects assetPatches with a patchDetail subselection", async () => {
      const query = await queryFor("superops_assets_patches", { assetId: "1" });

      expect(query).toContain("assetPatches");
      expect(query).toMatch(/patchDetail\s*\{/);
      expect(query).toContain("kbNumbers");
      expect(query).toContain("approvalStatus");
      expect(query).toContain("installationStatus");
      expect(query).not.toContain("summary");
      expect(query).toContain("$input: AssetDetailsListInput!");
    });

    it("no query uses Relay-style cursor pagination", async () => {
      const cases: [string, Record<string, unknown>][] = [
        ["superops_assets_list", {}],
        ["superops_assets_get", { assetId: "1" }],
        ["superops_assets_software", { assetId: "1" }],
        ["superops_assets_patches", { assetId: "1" }],
      ];

      for (const [tool, args] of cases) {
        const query = await queryFor(tool, args);
        expect(query, tool).not.toContain("hasNextPage");
        expect(query, tool).not.toContain("endCursor");
        vi.clearAllMocks();
      }
    });
  });
});
