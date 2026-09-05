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
 * Filtering on an unrecognised value is not an error — it silently matches
 * nothing — so the enums advertised below must stay in step with that list.
 *
 * `listInfo.hasMore` is `true` when further pages exist and `null` on the last
 * page. SuperOps never returns `false`, so treat any falsy value as "no more".
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
 * `RuleConditionInput` is recursive: a clause is either a leaf
 * (`attribute`/`operator`/`value`) or a branch (`joinOperator` + `operands`).
 * Branches nest, so filters are not limited to one clause.
 *
 * Operators verified against the live `getClientList`:
 *   array value  — `includes`, `notIncludes`
 *   string value — `is`, `isNot`, `contains`, `notContains`, `startsWith`,
 *                  `endsWith`
 * `equals` and `in` are rejected with a 500. The set is attribute-agnostic:
 * every accepted operator works on both `name` and `stage`.
 *
 * `joinOperator` is CASE-SENSITIVE and must be `"AND"` / `"OR"`. Anything the
 * API does not recognise — lowercase `"and"` included — silently falls back to
 * OR rather than erroring, so a lowercase `"and"` returns a *union* and looks
 * like a working filter that quietly over-matches. Verified live: uppercase
 * `"AND"` on stage=Active + status=New returns 0 rows (correct — no Active
 * client can hold a Prospect status), while lowercase `"and"` returns all 3.
 *
 * A tenant needing anything else should use `superops_custom_query`.
 */
function condition(attribute: string, operator: string, value: unknown): RuleConditionInput {
  return { attribute, operator, value };
}

/**
 * Combine leaf clauses under one join. A single clause is returned bare — the
 * API treats a lone operand the same either way, and an unwrapped clause keeps
 * the request readable.
 */
function join(
  joinOperator: "AND" | "OR",
  clauses: RuleConditionInput[]
): RuleConditionInput | undefined {
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { joinOperator, operands: clauses };
}

/** Match a search term against the client name or any of its email domains. */
function nameOrEmailDomain(query: string): RuleConditionInput {
  return {
    joinOperator: "OR",
    operands: [
      condition("name", "contains", query),
      condition("emailDomains", "contains", query),
    ],
  };
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
                "belong to matches nothing.",
              enum: ["Paid", "Unpaid", "New", "Negotiation", "Won", "Lost"],
            },
            stage: {
              type: "string",
              description:
                "Filter by stage: Active, Inactive, or Prospect. Combined with status if both " +
                "are given.",
              enum: ["Active", "Inactive", "Prospect"],
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
          "Search for clients by name or email domain. A client matches if the term appears " +
          "in either, so searching a domain fragment finds the account that owns it.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Substring to match against the client name or any of its email domains",
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
            const clauses: RuleConditionInput[] = [];
            if (params.stage) {
              clauses.push(condition("stage", "includes", [params.stage]));
            }
            if (params.status) {
              clauses.push(condition("status", "includes", [params.status]));
            }
            const filter = join("AND", clauses);
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
              page: pageOf(params.page),
              pageSize: pageSizeOf(params.pageSize),
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
