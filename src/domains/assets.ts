/**
 * SuperOps.ai Assets Domain
 *
 * Tools for managing assets (endpoints) in SuperOps.ai RMM.
 *
 * Every document here is validated against schema/superops.graphql by
 * graphql-schema.test.ts. Two SuperOps traits shape the queries below:
 *
 *  - `client`, `site`, `requester`, `assetClass`, `deviceCategory`,
 *    `customFields` and `software` are the `JSON` scalar. They are selected
 *    bare; a subselection makes the API reject the whole request.
 *  - Pagination is page/pageSize offsets, not Relay cursors. There is no
 *    `first`/`after`/`hasNextPage`/`endCursor`.
 */

import { getClient } from "../client.js";
import type { DomainTools, Asset, AssetSoftware, ListInfo, PatchData } from "../types.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const LIST_ASSETS_QUERY = `
  query getAssetList($input: ListInfoInput!) {
    getAssetList(input: $input) {
      assets {
        assetId
        name
        hostName
        status
        platform
        platformFamily
        platformVersion
        publicIp
        primaryMac
        loggedInUser
        patchStatus
        lastCommunicatedTime
        client
        site
      }
      listInfo {
        page
        pageSize
        totalCount
        hasMore
      }
    }
  }
`;

const GET_ASSET_QUERY = `
  query getAsset($input: AssetIdentifierInput!) {
    getAsset(input: $input) {
      assetId
      name
      hostName
      status
      platform
      platformFamily
      platformCategory
      platformVersion
      manufacturer
      model
      serialNumber
      primaryMac
      publicIp
      gateway
      domain
      loggedInUser
      sysUptime
      agentVersion
      patchStatus
      warrantyExpiryDate
      purchasedDate
      lastCommunicatedTime
      lastReportedTime
      client
      site
      requester
      assetClass
      deviceCategory
      customFields
    }
  }
`;

const GET_ASSET_SOFTWARE_QUERY = `
  query getAssetSoftwareList($input: AssetDetailsListInput!) {
    getAssetSoftwareList(input: $input) {
      assetSoftwares {
        id
        software
        version
        installedDate
        bitVersion
        installedPath
      }
      listInfo {
        page
        pageSize
        totalCount
        hasMore
      }
    }
  }
`;

const GET_ASSET_PATCHES_QUERY = `
  query getAssetPatchDetails($input: AssetDetailsListInput!) {
    getAssetPatchDetails(input: $input) {
      assetPatches {
        patchDetail {
          patchId
          patchKey
          title
          publishedDate
          category
          severity
          kbNumbers {
            kbNumber
          }
          restartRequired
        }
        approvalStatus
        installationStatus
        installationTime
        failedMessage
      }
      listInfo {
        page
        pageSize
        totalCount
        hasMore
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

interface GetSoftwareResponse {
  getAssetSoftwareList: {
    assetSoftwares: AssetSoftware[];
    listInfo: ListInfo;
  };
}

interface GetPatchesResponse {
  getAssetPatchDetails: {
    assetPatches: PatchData[];
    listInfo: ListInfo;
  };
}

/** One `RuleConditionInput` clause — SuperOps accepts at most one per request. */
interface Condition {
  attribute: string;
  operator: string;
  value: unknown;
}

/**
 * Reduce the candidate filters to the single clause SuperOps allows.
 *
 * `RuleConditionInput` has no AND/OR composition, so two filters cannot be
 * combined — asking for both is an error rather than a silently dropped one.
 * Note that `attribute` and `operator` strings are validated by SuperOps at
 * runtime, not by the GraphQL schema: an unsupported attribute comes back as
 * an API error, not a schema error. `superops_custom_query` is the escape
 * hatch for anything this cannot express.
 */
function singleCondition(candidates: (Condition | undefined)[]): Condition | undefined {
  const clauses = candidates.filter((c): c is Condition => c !== undefined);
  if (clauses.length > 1) {
    throw new Error(
      `SuperOps accepts only one filter condition per request, but ${clauses.length} were given ` +
        `(${clauses.map((c) => c.attribute).join(", ")}). Apply one filter, or use ` +
        `superops_custom_query for a compound query.`
    );
  }
  return clauses[0];
}

/** page/pageSize offsets, clamped to the documented maximum. */
function paging(params: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  return {
    page: params.page ?? 1,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

const PAGE_PROPERTIES = {
  page: {
    type: "number",
    description: "Page number, 1-based (default: 1)",
    default: 1,
  },
  pageSize: {
    type: "number",
    description: `Results per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
    default: DEFAULT_PAGE_SIZE,
  },
} as const;

export function getAssetsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_assets_list",
        description:
          "List assets (endpoints) in SuperOps.ai RMM. SuperOps applies a single filter " +
          "condition per request, so supply at most one of status, platform or clientId.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description:
                'Filter by asset status exactly as SuperOps reports it, e.g. "Online" or ' +
                '"Offline". Values are validated by SuperOps, not by this server.',
            },
            platform: {
              type: "string",
              description:
                'Filter by platform exactly as SuperOps reports it, e.g. "Windows", "Linux" ' +
                'or "Mac".',
            },
            clientId: {
              type: "string",
              description: "Filter by client account ID",
            },
            ...PAGE_PROPERTIES,
          },
        },
      },
      {
        name: "superops_assets_get",
        description:
          "Get detailed information for a specific asset: hardware identity (manufacturer, " +
          "model, serial number), platform and OS version, network details (public IP, " +
          "primary MAC, gateway, domain), agent version and patch status. SuperOps does not " +
          "expose CPU, memory or disk figures on the asset record — use superops_custom_query " +
          "with getAssetSummary or getAssetDiskDetails for those.",
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
        description:
          "Get the software inventory for a specific asset: name, version, install date, " +
          "bit version and install path.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "The unique asset ID",
            },
            search: {
              type: "string",
              description: "Substring match on the software name",
            },
            ...PAGE_PROPERTIES,
          },
          required: ["assetId"],
        },
      },
      {
        name: "superops_assets_patches",
        description:
          "Get patch status and patch details for a specific asset. SuperOps applies a single " +
          "filter condition per request, so supply at most one of installationStatus or severity.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "The unique asset ID",
            },
            installationStatus: {
              type: "string",
              description:
                'Filter by installation status as SuperOps reports it, e.g. "Installed", ' +
                '"Pending" or "Failed".',
            },
            severity: {
              type: "array",
              items: { type: "string" },
              description:
                'Filter by one or more severity levels, e.g. "Critical", "Important", ' +
                '"Moderate", "Low".',
            },
            ...PAGE_PROPERTIES,
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
              page?: number;
              pageSize?: number;
            };

            const condition = singleCondition([
              params.status
                ? { attribute: "status", operator: "includes", value: [params.status] }
                : undefined,
              params.platform
                ? { attribute: "platform", operator: "includes", value: [params.platform] }
                : undefined,
              params.clientId
                ? { attribute: "client", operator: "includes", value: [params.clientId] }
                : undefined,
            ]);

            const response = await client.query<ListAssetsResponse>(LIST_ASSETS_QUERY, {
              input: {
                ...paging(params),
                ...(condition && { condition }),
                sort: [{ attribute: "name", order: "ASC" }],
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
              page?: number;
              pageSize?: number;
            };

            const condition = singleCondition([
              params.search
                ? { attribute: "software", operator: "contains", value: params.search }
                : undefined,
            ]);

            const response = await client.query<GetSoftwareResponse>(GET_ASSET_SOFTWARE_QUERY, {
              input: {
                assetId: params.assetId,
                listInfo: {
                  ...paging(params),
                  ...(condition && { condition }),
                },
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
              installationStatus?: string;
              severity?: string[];
              page?: number;
              pageSize?: number;
            };

            const condition = singleCondition([
              params.installationStatus
                ? {
                    attribute: "installationStatus",
                    operator: "includes",
                    value: [params.installationStatus],
                  }
                : undefined,
              params.severity?.length
                ? { attribute: "severity", operator: "includes", value: params.severity }
                : undefined,
            ]);

            const response = await client.query<GetPatchesResponse>(GET_ASSET_PATCHES_QUERY, {
              input: {
                assetId: params.assetId,
                listInfo: {
                  ...paging(params),
                  ...(condition && { condition }),
                },
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
