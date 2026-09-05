/**
 * SuperOps.ai Technicians Domain
 *
 * Tools for reading technicians (agents) and technician groups from SuperOps.ai PSA.
 *
 * The SuperOps `Technician` type is deliberately narrow: there is no active/inactive
 * flag, no ticket counts, no skills, no last-login and no group membership roster.
 * `designation`, `businessFunction`, `team`, `reportingManager`, `role` and `groups`
 * are all `JSON` scalars, so they are selected bare — a subselection on them is
 * rejected by the API.
 */

import { getClient } from "../client.js";
import type { DomainTools, Technician, TechnicianGroup, ListInfo } from "../types.js";

/**
 * The selection below is every field the real `Technician` type defines. It is
 * repeated verbatim in GET_TECHNICIAN_QUERY rather than shared through a template
 * interpolation, because an interpolated document cannot be statically validated
 * against the schema (see graphql-schema.test.ts).
 */
const LIST_TECHNICIANS_QUERY = `
  query getTechnicianList($input: ListInfoInput!) {
    getTechnicianList(input: $input) {
      userList {
        userId
        name
        firstName
        lastName
        email
        contactNumber
        emailSignature
        designation
        businessFunction
        team
        reportingManager
        role
        groups
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

/**
 * SuperOps exposes no single-technician query, so a lookup by id is a
 * `getTechnicianList` call filtered down to one record.
 *
 * The `attribute`/`operator` strings in the condition are validated by SuperOps at
 * runtime, not by the schema — the schema types them as plain `String`. If a tenant
 * needs different filter semantics, `superops_custom_query` is the escape hatch.
 */
const GET_TECHNICIAN_QUERY = `
  query getTechnicianById($input: ListInfoInput!) {
    getTechnicianList(input: $input) {
      userList {
        userId
        name
        firstName
        lastName
        email
        contactNumber
        emailSignature
        designation
        businessFunction
        team
        reportingManager
        role
        groups
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

/** `getTechnicianGroupList` takes no arguments and returns a plain, unpaginated list. */
const LIST_TECH_GROUPS_QUERY = `
  query getTechnicianGroupList {
    getTechnicianGroupList {
      groupId
      name
    }
  }
`;

interface ListTechniciansResponse {
  getTechnicianList: {
    userList: Technician[] | null;
    listInfo: ListInfo | null;
  } | null;
}

interface ListTechGroupsResponse {
  getTechnicianGroupList: TechnicianGroup[] | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function clampPageSize(pageSize?: number): number {
  return Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
}

export function getTechniciansTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_technicians_list",
        description:
          "List technicians (agents) in SuperOps.ai, sorted by name. Optionally narrow the " +
          "list with a name substring search. SuperOps does not expose an active/inactive " +
          "flag, ticket counts or last-login times for technicians; team, role and group " +
          "assignments come back as opaque JSON values. Use superops_custom_query for filters " +
          "beyond a name search.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Substring match on the technician's name",
            },
            page: {
              type: "number",
              description: "Page number, 1-based (default: 1)",
              default: 1,
            },
            pageSize: {
              type: "number",
              description: "Results per page (default: 50, max: 100)",
              default: DEFAULT_PAGE_SIZE,
            },
          },
        },
      },
      {
        name: "superops_technicians_get",
        description:
          "Get detailed information for a specific technician by their user ID. SuperOps has " +
          "no single-technician endpoint, so this filters the technician list to that ID. " +
          "Returns the technician's contact details plus their designation, business " +
          "function, team, reporting manager, role and groups as opaque JSON values. " +
          "Skills, ticket counts and response-time metrics are not available from SuperOps.",
        inputSchema: {
          type: "object",
          properties: {
            technicianId: {
              type: "string",
              description: "The unique technician user ID",
            },
          },
          required: ["technicianId"],
        },
      },
      {
        name: "superops_technicians_groups",
        description:
          "List technician groups/teams in SuperOps.ai. Returns every group's ID and name — " +
          "SuperOps exposes no description, member count or member roster for a group, and " +
          "the endpoint is neither paginated nor filterable.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],

    async handleCall(name, args) {
      const client = getClient();

      try {
        switch (name) {
          case "superops_technicians_list": {
            const params = args as {
              search?: string;
              page?: number;
              pageSize?: number;
            };

            const response = await client.query<ListTechniciansResponse>(
              LIST_TECHNICIANS_QUERY,
              {
                input: {
                  page: params.page ?? 1,
                  pageSize: clampPageSize(params.pageSize),
                  ...(params.search && {
                    condition: {
                      attribute: "name",
                      operator: "contains",
                      value: params.search,
                    },
                  }),
                  sort: [{ attribute: "name", order: "ASC" }],
                },
              }
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTechnicianList, null, 2),
                },
              ],
            };
          }

          case "superops_technicians_get": {
            const { technicianId } = args as { technicianId: string };

            const response = await client.query<ListTechniciansResponse>(GET_TECHNICIAN_QUERY, {
              input: {
                page: 1,
                pageSize: 1,
                condition: {
                  attribute: "userId",
                  operator: "includes",
                  value: [technicianId],
                },
              },
            });

            const technician = response.getTechnicianList?.userList?.[0];
            if (!technician) {
              return {
                content: [
                  { type: "text", text: `No technician found with ID: ${technicianId}` },
                ],
                isError: true,
              };
            }

            return {
              content: [{ type: "text", text: JSON.stringify(technician, null, 2) }],
            };
          }

          case "superops_technicians_groups": {
            const response =
              await client.query<ListTechGroupsResponse>(LIST_TECH_GROUPS_QUERY);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTechnicianGroupList, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [{ type: "text", text: `Unknown technicians tool: ${name}` }],
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
