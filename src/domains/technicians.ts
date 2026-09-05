/**
 * SuperOps.ai Technicians Domain
 *
 * Tools for reading technicians (agents) and technician groups from SuperOps.ai PSA.
 *
 * The SuperOps `Technician` type is deliberately narrow: there is no active/inactive
 * flag, no ticket counts, no skills and no last-login. `designation`,
 * `businessFunction`, `team`, `reportingManager`, `role` and `groups` are typed as
 * `JSON` scalars, so they are selected bare — a subselection on them is rejected by
 * the API — but the values are structured, not opaque. Verified against a live
 * tenant: `role` is `{ roleId, name }` and `groups` is `[{ groupId, name }]`, the
 * technician's actual group roster. `designation`, `businessFunction`, `team` and
 * `reportingManager` are null unless the tenant assigns them.
 *
 * `getTechnicianList` filter vocabulary, also verified live: the operators `is`,
 * `contains` and `startsWith` (string value) and `includes` (array value) are
 * accepted; `equals` and `in` are rejected with a server error. `userId`, `name`,
 * `email` and `groups` are all filterable attributes. `listInfo.hasMore` always
 * comes back `null`, so paginate against `totalCount`.
 *
 * `RuleConditionInput` is recursive — `joinOperator` + `operands` nest clauses —
 * so a filter is not limited to one clause. The list tool's `search` uses that to
 * match a term against name OR email in a single request. `joinOperator` must be
 * uppercase: an unrecognised value is silently treated as OR rather than erroring.
 */

import { getClient } from "../client.js";
import type {
  DomainTools,
  Technician,
  TechnicianGroup,
  ListInfo,
  RuleConditionInput,
} from "../types.js";
import { paging, PAGE_PROPERTIES } from "../utils/paging.js";

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
 * `getTechnicianList` call filtered down to one record. The `userId` + `includes`
 * pair is verified against a live tenant: it returns exactly the matching
 * technician, and an unknown or malformed id comes back as an empty list rather
 * than an error — which is what keeps the not-found branch below honest.
 *
 * The `attribute`/`operator` strings are validated by SuperOps at runtime, not by
 * the schema — the schema types them as plain `String`. If a tenant needs different
 * filter semantics, `superops_custom_query` is the escape hatch.
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

/**
 * The vocabularies behind a technician's `role`, `team`, `designation` and
 * `businessFunction`. Each of these four queries takes no arguments and returns a
 * plain list of `{ <name>Id, name }` — those two fields are all the types define.
 *
 * Without them a caller holds a role or team *name* and no way to reach the id
 * that `getTechnicianList` actually filters on.
 */
const LIST_TECHNICIAN_LOOKUPS_QUERY = `
  query getTechnicianLookups {
    roles: getTechnicianRoleList {
      roleId
      name
    }
    teams: getTeamList {
      teamId
      name
    }
    designations: getDesignationList {
      designationId
      name
    }
    businessFunctions: getBusinessFunctionList {
      businessFunctionId
      name
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

/** Each lookup list is a plain `{ <name>Id, name }` record. */
type Lookup = Record<string, string>;

interface TechnicianLookupsResponse {
  roles: Lookup[] | null;
  teams: Lookup[] | null;
  designations: Lookup[] | null;
  businessFunctions: Lookup[] | null;
}

/**
 * An OR across filter clauses. A lone clause is returned bare rather than wrapped:
 * SuperOps accepts `{ attribute, operator, value }` directly, and a one-operand
 * `joinOperator` envelope would only add noise to the request.
 *
 * `joinOperator` MUST be uppercase. A value SuperOps does not recognise is not an
 * error — it silently joins the operands with OR and returns a superset. Verified
 * live on two clauses that share no match: `"AND"` returned 0 rows, `"and"`
 * returned both. Lowercase would happen to look right here, because the fallback
 * *is* OR, and would quietly mean the wrong thing the moment anyone reused this.
 */
function anyOf(clauses: RuleConditionInput[]): RuleConditionInput {
  return clauses.length === 1 ? clauses[0] : { joinOperator: "OR", operands: clauses };
}

export function getTechniciansTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_technicians_list",
        description:
          "List technicians (agents) in SuperOps.ai, sorted by name. Optionally narrow the " +
          "list with a search term, matched as a substring against both name and email. " +
          "SuperOps does not expose an active/inactive " +
          "flag, ticket counts or last-login times for technicians. Each technician's role " +
          "comes back as {roleId, name} and their groups as an array of {groupId, name}; " +
          "designation, businessFunction, team and reportingManager are null unless the " +
          "tenant assigns them. listInfo.hasMore is always null — page against totalCount. " +
          "Use superops_custom_query for filters beyond a name search.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description:
                "Substring matched against the technician's name or email address",
            },
            ...PAGE_PROPERTIES,
          },
        },
      },
      {
        name: "superops_technicians_get",
        description:
          "Get detailed information for a specific technician by their user ID. SuperOps has " +
          "no single-technician endpoint, so this filters the technician list to that ID. " +
          "Returns the technician's contact details plus their role as {roleId, name} and " +
          "their group roster as an array of {groupId, name}; designation, businessFunction, " +
          "team and reportingManager are null unless the tenant assigns them. Skills, ticket " +
          "counts and response-time metrics are not available from SuperOps.",
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
          "the endpoint is neither paginated nor filterable. These are the same groups that " +
          "appear in a technician's groups field, so a group ID from here identifies the " +
          "group a technician belongs to.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "superops_technicians_lookups",
        description:
          "List the roles, teams, designations and business functions defined in this " +
          "SuperOps tenant, each as {id, name}. These are the values a technician's role, " +
          "team, designation and businessFunction fields refer to. Use this to turn a name " +
          "a user gave you (\"the Sales team\", \"Admin role\") into the ID SuperOps filters " +
          "on, then pass that ID to superops_custom_query — getTechnicianList accepts a " +
          "condition on the role attribute, and on groups using an ID from " +
          "superops_technicians_groups. Takes no arguments.",
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
                  ...paging(params),
                  ...(params.search && {
                    condition: anyOf([
                      { attribute: "name", operator: "contains", value: params.search },
                      { attribute: "email", operator: "contains", value: params.search },
                    ]),
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

          case "superops_technicians_lookups": {
            const response = await client.query<TechnicianLookupsResponse>(
              LIST_TECHNICIAN_LOOKUPS_QUERY
            );

            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
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
