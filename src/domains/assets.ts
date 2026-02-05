/**
 * SuperOps.ai Assets Domain
 *
 * Tools for managing assets (endpoints) in SuperOps.ai RMM.
 */

import { getClient } from "../client.js";
import type { DomainTools, Asset, ListInfo } from "../types.js";

const LIST_ASSETS_QUERY = `
  query getAssetList($input: ListInfoInput!) {
    getAssetList(input: $input) {
      assets {
        assetId
        name
        status
        platform
        lastSeen
        ipAddress
        osName
        osVersion
        client {
          accountId
          name
        }
        site {
          id
          name
        }
        patchStatus {
          pendingCount
          installedCount
          failedCount
        }
      }
      listInfo {
        totalCount
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_ASSET_QUERY = `
  query getAsset($input: AssetIdentifierInput!) {
    getAsset(input: $input) {
      assetId
      name
      status
      platform
      lastSeen
      ipAddress
      macAddress
      publicIp
      hostname
      manufacturer
      model
      serialNumber
      processorName
      processorCores
      totalMemory
      osName
      osVersion
      osBuild
      architecture
      totalDiskSpace
      freeDiskSpace
      client {
        accountId
        name
      }
      site {
        id
        name
      }
      tags
      customFields {
        name
        value
      }
      agentVersion
    }
  }
`;

const GET_ASSET_SOFTWARE_QUERY = `
  query getAssetSoftwareList($input: AssetSoftwareListInput!) {
    getAssetSoftwareList(input: $input) {
      software {
        name
        version
        publisher
        installDate
        size
      }
      listInfo {
        totalCount
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_ASSET_PATCHES_QUERY = `
  query getAssetPatchDetails($input: AssetPatchInput!) {
    getAssetPatchDetails(input: $input) {
      patches {
        patchId
        title
        severity
        status
        releaseDate
        kbNumber
        category
      }
      summary {
        pendingCount
        installedCount
        failedCount
        lastScanDate
      }
    }
  }
`;

interface ListAssetsResponse {
  getAssetList: {
    assets: Asset[];
    listInfo: ListInfo;
  };
}

interface GetAssetResponse {
  getAsset: Asset;
}

interface Software {
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
  size?: number;
}

interface GetSoftwareResponse {
  getAssetSoftwareList: {
    software: Software[];
    listInfo: ListInfo;
  };
}

interface Patch {
  patchId: string;
  title: string;
  severity?: string;
  status?: string;
  releaseDate?: string;
  kbNumber?: string;
  category?: string;
}

interface GetPatchesResponse {
  getAssetPatchDetails: {
    patches: Patch[];
    summary: {
      pendingCount: number;
      installedCount: number;
      failedCount: number;
      lastScanDate?: string;
    };
  };
}

export function getAssetsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_assets_list",
        description:
          "List assets (endpoints) in SuperOps.ai RMM. Can filter by status, platform, or client.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Filter by status: Online, Offline, or Maintenance",
              enum: ["Online", "Offline", "Maintenance"],
            },
            platform: {
              type: "string",
              description: "Filter by platform: Windows, macOS, or Linux",
              enum: ["Windows", "macOS", "Linux"],
            },
            clientId: {
              type: "string",
              description: "Filter by client account ID",
            },
            max: {
              type: "number",
              description: "Maximum number of results (default: 100, max: 500)",
              default: 100,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page",
            },
          },
        },
      },
      {
        name: "superops_assets_get",
        description:
          "Get detailed information for a specific asset including hardware, OS, and network details.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "The unique asset ID",
            },
          },
          required: ["assetId"],
        },
      },
      {
        name: "superops_assets_software",
        description: "Get the software inventory for a specific asset.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "The unique asset ID",
            },
            search: {
              type: "string",
              description: "Search term to filter software by name",
            },
            max: {
              type: "number",
              description: "Maximum number of results (default: 100)",
              default: 100,
            },
          },
          required: ["assetId"],
        },
      },
      {
        name: "superops_assets_patches",
        description: "Get patch status and pending patches for a specific asset.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "The unique asset ID",
            },
            status: {
              type: "string",
              description: "Filter patches by status: Pending, Installed, or Failed",
              enum: ["Pending", "Installed", "Failed"],
            },
            severity: {
              type: "array",
              items: { type: "string" },
              description: "Filter by severity levels: Critical, Important, Moderate, Low",
            },
          },
          required: ["assetId"],
        },
      },
    ],

    async handleCall(name, args) {
      const client = getClient();

      try {
        switch (name) {
          case "superops_assets_list": {
            const params = args as {
              status?: string;
              platform?: string;
              clientId?: string;
              max?: number;
              cursor?: string;
            };

            const filter: Record<string, unknown> = {};
            if (params.status) filter.status = params.status;
            if (params.platform) filter.platform = params.platform;
            if (params.clientId) filter.client = { accountId: params.clientId };

            const response = await client.query<ListAssetsResponse>(LIST_ASSETS_QUERY, {
              input: {
                first: Math.min(params.max ?? 100, 500),
                ...(params.cursor && { after: params.cursor }),
                ...(Object.keys(filter).length > 0 && { filter }),
                orderBy: { field: "name", direction: "ASC" },
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getAssetList, null, 2),
                },
              ],
            };
          }

          case "superops_assets_get": {
            const { assetId } = args as { assetId: string };

            const response = await client.query<GetAssetResponse>(GET_ASSET_QUERY, {
              input: { assetId },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getAsset, null, 2),
                },
              ],
            };
          }

          case "superops_assets_software": {
            const params = args as {
              assetId: string;
              search?: string;
              max?: number;
            };

            const filter: Record<string, unknown> = {};
            if (params.search) filter.name = { contains: params.search };

            const response = await client.query<GetSoftwareResponse>(GET_ASSET_SOFTWARE_QUERY, {
              input: {
                assetId: params.assetId,
                first: Math.min(params.max ?? 100, 500),
                ...(Object.keys(filter).length > 0 && { filter }),
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getAssetSoftwareList, null, 2),
                },
              ],
            };
          }

          case "superops_assets_patches": {
            const params = args as {
              assetId: string;
              status?: string;
              severity?: string[];
            };

            const filter: Record<string, unknown> = {};
            if (params.status) filter.status = params.status;
            if (params.severity) filter.severity = params.severity;

            const response = await client.query<GetPatchesResponse>(GET_ASSET_PATCHES_QUERY, {
              input: {
                assetId: params.assetId,
                ...(Object.keys(filter).length > 0 && { filter }),
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getAssetPatchDetails, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [{ type: "text", text: `Unknown assets tool: ${name}` }],
              isError: true,
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  };
}
