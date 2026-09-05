/**
 * SuperOps.ai Clients Domain
 *
 * Tools for managing clients (accounts) in SuperOps.ai PSA.
 *
 * The `Client` type exposes `accountManager`, `primaryContact`,
 * `secondaryContact`, `hqSite`, `technicianGroups` and `customFields` through
 * the `JSON` scalar. They must be selected bare — a subselection on a scalar is
 * rejected outright by the API.
 *
 * `stage` and `status` are plain `String` in the schema, not enums. Their
 * allowed values are tenant configuration, published by
 * `getAllFields(input: "CLIENT")`. `status` is a *child* of `stage`, so each
 * status value belongs to one stage:
 *
 *   Active   → Paid, Unpaid
 *   Prospect → New, Negotiation, Won, Lost
 *   Inactive → (no status options)
 *
 * Those values are named in the tool descriptions rather than pinned as a JSON
 * Schema `enum`: the lists are tenant configuration, so an `enum` would reject
 * at the MCP boundary a value the API would have accepted. Getting a value
 * wrong is recoverable — filtering on an unrecognised one is not an error, it
 * silently matches nothing.
 *
 * Filter conditions come from `../utils/conditions.js`, which documents the
 * operator vocabulary and the uppercase-`joinOperator` trap.
 *
 * `listInfo.hasMore` is `true` when further pages exist and `null` on the last
 * page. SuperOps never returns `false`, so treat any falsy value as "no more".
 */

import { getClient } from "../client.js";
import type { DomainTools, Client, ListInfo, ListInfoInput } from "../types.js";
import { clause, and, or } from "../utils/conditions.js";
import { elicitText } from "../utils/elicitation.js";
import { paging, PAGE_PROPERTIES } from "../utils/paging.js";

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

/** Appended to the stage/status descriptions, to flag the lists as per-tenant. */
const TENANT_CAVEAT = "Your tenant may rename or extend this list.";

/**
 * Match a search term against the client name or any of its email domains.
 *
 * Both operands are always present, so `or()` never returns `undefined` here.
 */
function nameOrEmailDomain(query: string) {
  return or([
    clause("name", "contains", query),
    clause("emailDomains", "contains", query),
  ]);
}

export function getClientsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_clients_list",
        description:
          "List clients (accounts) in SuperOps.ai. Results are paginated with page/pageSize. " +
          "Supplying both stage and status narrows to clients matching both.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description:
                "Filter by status. Status is a sub-state of stage: Paid and Unpaid belong to " +
                "stage Active; New, Negotiation, Won and Lost belong to stage Prospect. " +
                "Stage Inactive has no statuses. Pairing a status with a stage it does not " +
                `belong to matches nothing. ${TENANT_CAVEAT}`,
            },
            stage: {
              type: "string",
              description:
                "Filter by stage: Active, Inactive, or Prospect. Combined with status if both " +
                `are given. ${TENANT_CAVEAT}`,
            },
            ...PAGE_PROPERTIES,
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
          "Search for clients by name or email domain. A client matches if the term appears " +
          "in either, so searching a domain fragment finds the account that owns it.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Substring to match against the client name or any of its email domains",
            },
            ...PAGE_PROPERTIES,
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

            const { page, pageSize } = paging(params);

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
                  condition: nameOrEmailDomain(searchTerm),
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
            const filter = and([
              params.stage ? clause("stage", "includes", [params.stage]) : undefined,
              params.status ? clause("status", "includes", [params.status]) : undefined,
            ]);
            if (filter) {
              input.condition = filter;
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
              ...paging(params),
              condition: nameOrEmailDomain(params.query),
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
