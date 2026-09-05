/**
 * SuperOps.ai Clients Domain
 *
 * Tools for managing clients (accounts) in SuperOps.ai PSA.
 *
 * The `Client` type exposes `accountManager`, `primaryContact`,
 * `secondaryContact`, `hqSite`, `technicianGroups` and `customFields` through
 * the `JSON` scalar. They must be selected bare — a subselection on a scalar is
 * rejected outright by the API.
 */

import { getClient } from "../client.js";
import type {
  DomainTools,
  Client,
  ListInfo,
  ListInfoInput,
  RuleConditionInput,
} from "../types.js";
import { elicitText } from "../utils/elicitation.js";
import { pageOf, pageSizeOf, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../utils/paging.js";

const LIST_CLIENTS_QUERY = `
  query getClientList($input: ListInfoInput!) {
    getClientList(input: $input) {
      clients {
        accountId
        name
        stage
        status
        emailDomains
        accountManager
        primaryContact
        hqSite
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

const GET_CLIENT_QUERY = `
  query getClient($input: ClientIdentifierInput!) {
    getClient(input: $input) {
      accountId
      name
      stage
      status
      emailDomains
      accountManager
      primaryContact
      secondaryContact
      hqSite
      technicianGroups
      customFields
    }
  }
`;

const SEARCH_CLIENTS_QUERY = `
  query searchClients($input: ListInfoInput!) {
    getClientList(input: $input) {
      clients {
        accountId
        name
        stage
        status
        emailDomains
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

interface ListClientsResponse {
  getClientList: {
    clients: Client[];
    listInfo: ListInfo;
  };
}

interface GetClientResponse {
  getClient: Client;
}

/**
 * SuperOps accepts exactly ONE condition clause per request, and validates the
 * `attribute`/`operator` strings at runtime — the schema types them as plain
 * `String`, so a bad pair fails at the API, not at query validation. Only
 * `includes` (array value), `contains` and `startsWith` (string value) are
 * documented. A tenant needing anything else should use `superops_custom_query`.
 */
function condition(attribute: string, operator: string, value: unknown): RuleConditionInput {
  return { attribute, operator, value };
}

export function getClientsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_clients_list",
        description:
          "List clients (accounts) in SuperOps.ai. Results are paginated with page/pageSize. " +
          "SuperOps accepts only one filter per request, so status takes precedence over stage " +
          "when both are supplied.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Filter by status: Active, Inactive, or Archived",
              enum: ["Active", "Inactive", "Archived"],
            },
            stage: {
              type: "string",
              description:
                "Filter by stage: Lead, Prospect, Customer, or Churned (ignored if status is also given)",
              enum: ["Lead", "Prospect", "Customer", "Churned"],
            },
            page: {
              type: "number",
              description: "1-indexed page number (default: 1)",
              default: 1,
            },
            pageSize: {
              type: "number",
              description: `Results per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
              default: DEFAULT_PAGE_SIZE,
            },
          },
        },
      },
      {
        name: "superops_clients_get",
        description: "Get detailed information for a specific client by their account ID.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "The unique account ID of the client",
            },
          },
          required: ["accountId"],
        },
      },
      {
        name: "superops_clients_search",
        description:
          "Search for clients by name. SuperOps accepts a single filter clause per request, " +
          "so this matches the client name only — it cannot also search email domains.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Substring to match against the client name",
            },
            page: {
              type: "number",
              description: "1-indexed page number (default: 1)",
              default: 1,
            },
            pageSize: {
              type: "number",
              description: `Results per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
              default: DEFAULT_PAGE_SIZE,
            },
          },
          required: ["query"],
        },
      },
    ],

    async handleCall(name, args) {
      const client = getClient();

      try {
        switch (name) {
          case "superops_clients_list": {
            const params = args as {
              status?: string;
              stage?: string;
              page?: number;
              pageSize?: number;
            };

            const page = pageOf(params.page);
            const pageSize = pageSizeOf(params.pageSize);

            // If no filters provided, elicit a search term from the user.
            const hasFilters = Boolean(params.status || params.stage);
            if (!hasFilters && params.page === undefined) {
              const searchTerm = await elicitText(
                "No filters specified. Would you like to search for a specific client?",
                "search",
                "Enter a client name to search for, or leave blank to list all"
              );
              if (searchTerm) {
                // Redirect to the search handler which supports name filtering
                const searchInput: ListInfoInput = {
                  page,
                  pageSize,
                  condition: condition("name", "contains", searchTerm),
                  sort: [{ attribute: "name", order: "ASC" }],
                };
                const searchResponse = await client.query<ListClientsResponse>(
                  SEARCH_CLIENTS_QUERY,
                  { input: searchInput }
                );
                return {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(searchResponse.getClientList, null, 2),
                    },
                  ],
                };
              }
            }

            const input: ListInfoInput = {
              page,
              pageSize,
              sort: [{ attribute: "name", order: "ASC" }],
            };
            if (params.status) {
              input.condition = condition("status", "includes", [params.status]);
            } else if (params.stage) {
              input.condition = condition("stage", "includes", [params.stage]);
            }

            const response = await client.query<ListClientsResponse>(LIST_CLIENTS_QUERY, {
              input,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getClientList, null, 2),
                },
              ],
            };
          }

          case "superops_clients_get": {
            const { accountId } = args as { accountId: string };

            const response = await client.query<GetClientResponse>(GET_CLIENT_QUERY, {
              input: { accountId },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getClient, null, 2),
                },
              ],
            };
          }

          case "superops_clients_search": {
            const params = args as { query: string; page?: number; pageSize?: number };

            const input: ListInfoInput = {
              page: pageOf(params.page),
              pageSize: pageSizeOf(params.pageSize),
              condition: condition("name", "contains", params.query),
              sort: [{ attribute: "name", order: "ASC" }],
            };

            const response = await client.query<ListClientsResponse>(SEARCH_CLIENTS_QUERY, {
              input,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getClientList, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [{ type: "text", text: `Unknown clients tool: ${name}` }],
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
