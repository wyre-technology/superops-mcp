/**
 * Assets Domain Tests
 *
 * Tests for asset (endpoint) management tools.
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
      expect(tool?.inputSchema.properties).toHaveProperty("max");
      expect(tool?.inputSchema.properties).toHaveProperty("cursor");
    });

    it("supports status enum values", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_list");
      const statusProp = tool?.inputSchema.properties.status as { enum?: string[] };

      expect(statusProp?.enum).toEqual(["Online", "Offline", "Maintenance"]);
    });

    it("supports platform enum values", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_list");
      const platformProp = tool?.inputSchema.properties.platform as { enum?: string[] };

      expect(platformProp?.enum).toEqual(["Windows", "macOS", "Linux"]);
    });

    it("calls query with default parameters", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [{ assetId: "1", name: "DESKTOP-001", status: "Online" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetList"),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 100,
            orderBy: { field: "name", direction: "ASC" },
          }),
        })
      );
      expect(result.content[0].text).toContain("DESKTOP-001");
    });

    it("applies status filter", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { status: "Online" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { status: "Online" },
          }),
        })
      );
    });

    it("applies platform filter", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { platform: "Windows" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { platform: "Windows" },
          }),
        })
      );
    });

    it("applies clientId filter", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { clientId: "client-123" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { client: { accountId: "client-123" } },
          }),
        })
      );
    });

    it("respects max parameter with upper limit of 500", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", { max: 1000 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 500, // Capped at 500
          }),
        })
      );
    });

    it("combines multiple filters", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", {
        status: "Online",
        platform: "Windows",
        clientId: "client-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: {
              status: "Online",
              platform: "Windows",
              client: { accountId: "client-123" },
            },
          }),
        })
      );
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

    it("calls query with assetId", async () => {
      const mockResponse = {
        getAsset: {
          assetId: "asset-123",
          name: "WORKSTATION-001",
          status: "Online",
          platform: "Windows",
          osName: "Windows 11",
          osVersion: "23H2",
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
      expect(result.content[0].text).toContain("Windows 11");
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
      expect(tool?.inputSchema.properties).toHaveProperty("max");
      expect(tool?.inputSchema.required).toContain("assetId");
    });

    it("calls query with assetId only", async () => {
      const mockResponse = {
        getAssetSoftwareList: {
          software: [
            { name: "Microsoft Office", version: "365", publisher: "Microsoft" },
          ],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_software", {
        assetId: "asset-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetSoftwareList"),
        expect.objectContaining({
          input: expect.objectContaining({
            assetId: "asset-123",
            first: 100,
          }),
        })
      );
      expect(result.content[0].text).toContain("Microsoft Office");
    });

    it("applies search filter", async () => {
      const mockResponse = {
        getAssetSoftwareList: {
          software: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

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
            filter: { name: { contains: "chrome" } },
          }),
        })
      );
    });

    it("caps max at 500", async () => {
      const mockResponse = {
        getAssetSoftwareList: {
          software: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_software", {
        assetId: "asset-123",
        max: 1000,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 500,
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
      expect(tool?.inputSchema.properties).toHaveProperty("status");
      expect(tool?.inputSchema.properties).toHaveProperty("severity");
      expect(tool?.inputSchema.required).toContain("assetId");
    });

    it("supports patch status enum", () => {
      const domain = getAssetsTools();
      const tool = domain.tools.find((t) => t.name === "superops_assets_patches");
      const statusProp = tool?.inputSchema.properties.status as { enum?: string[] };

      expect(statusProp?.enum).toEqual(["Pending", "Installed", "Failed"]);
    });

    it("calls query with assetId only", async () => {
      const mockResponse = {
        getAssetPatchDetails: {
          patches: [
            { patchId: "patch-1", title: "Security Update", severity: "Critical" },
          ],
          summary: {
            pendingCount: 5,
            installedCount: 100,
            failedCount: 0,
          },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      const result = await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getAssetPatchDetails"),
        expect.objectContaining({
          input: expect.objectContaining({
            assetId: "asset-123",
          }),
        })
      );
      expect(result.content[0].text).toContain("Security Update");
      expect(result.content[0].text).toContain("pendingCount");
    });

    it("applies status filter", async () => {
      const mockResponse = {
        getAssetPatchDetails: {
          patches: [],
          summary: { pendingCount: 0, installedCount: 0, failedCount: 0 },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        status: "Pending",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { status: "Pending" },
          }),
        })
      );
    });

    it("applies severity filter", async () => {
      const mockResponse = {
        getAssetPatchDetails: {
          patches: [],
          summary: { pendingCount: 0, installedCount: 0, failedCount: 0 },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        severity: ["Critical", "Important"],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: { severity: ["Critical", "Important"] },
          }),
        })
      );
    });

    it("combines status and severity filters", async () => {
      const mockResponse = {
        getAssetPatchDetails: {
          patches: [],
          summary: { pendingCount: 0, installedCount: 0, failedCount: 0 },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_patches", {
        assetId: "asset-123",
        status: "Pending",
        severity: ["Critical"],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: {
              status: "Pending",
              severity: ["Critical"],
            },
          }),
        })
      );
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
    it("LIST_ASSETS_QUERY includes required fields", async () => {
      const mockResponse = {
        getAssetList: {
          assets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_list", {});

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("assetId");
      expect(queryArg).toContain("name");
      expect(queryArg).toContain("status");
      expect(queryArg).toContain("platform");
      expect(queryArg).toContain("patchStatus");
    });

    it("GET_ASSET_QUERY includes hardware details", async () => {
      const mockResponse = {
        getAsset: { assetId: "1", name: "Test" },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getAssetsTools();
      await domain.handleCall("superops_assets_get", { assetId: "1" });

      const queryArg = mockClient.query.mock.calls[0][0];
      expect(queryArg).toContain("manufacturer");
      expect(queryArg).toContain("model");
      expect(queryArg).toContain("serialNumber");
      expect(queryArg).toContain("processorName");
      expect(queryArg).toContain("totalMemory");
    });
  });
});
