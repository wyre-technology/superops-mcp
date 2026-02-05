/**
 * SuperOps.ai Clients Domain
 *
 * Tools for managing clients (accounts) in SuperOps.ai PSA.
 */

import { getClient } from "../client.js";
import type { DomainTools, Client, ListInfo } from "../types.js";

const LIST_CLIENTS_QUERY = `
  query getClientList($input: ListInfoInput!) {
    getClientList(input: $input) {
      clients {
        accountId
        name
        stage
        status
        emailDomains
        phone
        website
        industry
        employeeCount
        accountManager {
          id
          name
          email
        }
        primaryContact {
          id
          name
          email
        }
        createdTime
        lastUpdatedTime
      }
      listInfo {
        totalCount
        hasNextPage
        endCursor
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
      website
      phone
      industry
      employeeCount
      annualRevenue
      address {
        street
        city
        state
        country
        postalCode
      }
      accountManager {
        id
        name
        email
        phone
      }
      primaryContact {
        id
        name
        email
        phone
      }
      sites {
        id
        name
        isDefault
      }
      customFields {
        name
        value
      }
      createdTime
      lastUpdatedTime
    }
  }
`;

const SEARCH_CLIENTS_QUERY = `
  query searchClients($input: ListInfoInput!) {
    getClientList(input: $input) {
      clients {
        accountId
        name
        emailDomains
        status
        stage
        phone
      }
      listInfo {
        totalCount
        hasNextPage
        endCursor
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

export function getClientsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_clients_list",
        description:
          "List clients (accounts) in SuperOps.ai. Can filter by status, stage, or paginate through results.",
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
              description: "Filter by stage: Lead, Prospect, Customer, or Churned",
              enum: ["Lead", "Prospect", "Customer", "Churned"],
            },
            max: {
              type: "number",
              description: "Maximum number of results (default: 50, max: 500)",
              default: 50,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for fetching next page",
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
          "Search for clients by name or email domain. Returns matching clients with basic information.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term to find clients by name or email domain",
            },
            max: {
              type: "number",
              description: "Maximum number of results (default: 20)",
              default: 20,
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
              max?: number;
              cursor?: string;
            };

            const filter: Record<string, unknown> = {};
            if (params.status) filter.status = params.status;
            if (params.stage) filter.stage = params.stage;

            const response = await client.query<ListClientsResponse>(LIST_CLIENTS_QUERY, {
              input: {
                first: Math.min(params.max ?? 50, 500),
                ...(params.cursor && { after: params.cursor }),
                ...(Object.keys(filter).length > 0 && { filter }),
                orderBy: { field: "name", direction: "ASC" },
              },
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
            const params = args as { query: string; max?: number };

            const response = await client.query<ListClientsResponse>(SEARCH_CLIENTS_QUERY, {
              input: {
                first: Math.min(params.max ?? 20, 100),
                filter: {
                  or: [
                    { name: { contains: params.query } },
                    { emailDomains: { contains: params.query } },
                  ],
                },
              },
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
