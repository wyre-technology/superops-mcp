/**
 * SuperOps.ai Technicians Domain
 *
 * Tools for managing technicians (agents) in SuperOps.ai PSA.
 */

import { getClient } from "../client.js";
import type { DomainTools, Technician, ListInfo } from "../types.js";

const LIST_TECHNICIANS_QUERY = `
  query getTechnicianList($input: ListInfoInput!) {
    getTechnicianList(input: $input) {
      technicians {
        id
        name
        email
        phone
        isActive
        role
        department
        teams {
          id
          name
        }
        ticketCount
        lastLoginTime
      }
      listInfo {
        totalCount
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_TECHNICIAN_QUERY = `
  query getTechnician($input: TechnicianIdentifierInput!) {
    getTechnician(input: $input) {
      id
      name
      email
      phone
      isActive
      role
      department
      teams {
        id
        name
      }
      manager {
        id
        name
        email
      }
      skills
      ticketCount
      averageResponseTime
      lastLoginTime
      createdTime
    }
  }
`;

const LIST_TECH_GROUPS_QUERY = `
  query getTechGroupList($input: ListInfoInput!) {
    getTechGroupList(input: $input) {
      techGroups {
        id
        name
        description
        memberCount
        members {
          id
          name
        }
      }
      listInfo {
        totalCount
        hasNextPage
      }
    }
  }
`;

interface ExtendedTechnician extends Technician {
  isActive?: boolean;
  role?: string;
  department?: string;
  teams?: { id: string; name: string }[];
  manager?: { id: string; name: string; email: string };
  skills?: string[];
  ticketCount?: number;
  averageResponseTime?: number;
  lastLoginTime?: string;
  createdTime?: string;
}

interface ListTechniciansResponse {
  getTechnicianList: {
    technicians: ExtendedTechnician[];
    listInfo: ListInfo;
  };
}

interface GetTechnicianResponse {
  getTechnician: ExtendedTechnician;
}

interface TechGroup {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  members?: { id: string; name: string }[];
}

interface ListTechGroupsResponse {
  getTechGroupList: {
    techGroups: TechGroup[];
    listInfo: ListInfo;
  };
}

export function getTechniciansTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_technicians_list",
        description:
          "List technicians (agents) in SuperOps.ai. Can filter by active status or team.",
        inputSchema: {
          type: "object",
          properties: {
            activeOnly: {
              type: "boolean",
              description: "Show only active technicians (default: true)",
              default: true,
            },
            teamId: {
              type: "string",
              description: "Filter by team/group ID",
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
        name: "superops_technicians_get",
        description: "Get detailed information for a specific technician by their ID.",
        inputSchema: {
          type: "object",
          properties: {
            technicianId: {
              type: "string",
              description: "The unique technician ID",
            },
          },
          required: ["technicianId"],
        },
      },
      {
        name: "superops_technicians_groups",
        description: "List technician groups/teams in SuperOps.ai.",
        inputSchema: {
          type: "object",
          properties: {
            max: {
              type: "number",
              description: "Maximum number of results (default: 50)",
              default: 50,
            },
          },
        },
      },
    ],

    async handleCall(name, args) {
      const client = getClient();

      try {
        switch (name) {
          case "superops_technicians_list": {
            const params = args as {
              activeOnly?: boolean;
              teamId?: string;
              max?: number;
              cursor?: string;
            };

            const filter: Record<string, unknown> = {};
            if (params.activeOnly !== false) filter.isActive = true;
            if (params.teamId) filter.teams = { id: params.teamId };

            const response = await client.query<ListTechniciansResponse>(
              LIST_TECHNICIANS_QUERY,
              {
                input: {
                  first: Math.min(params.max ?? 50, 500),
                  ...(params.cursor && { after: params.cursor }),
                  ...(Object.keys(filter).length > 0 && { filter }),
                  orderBy: { field: "name", direction: "ASC" },
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

            const response = await client.query<GetTechnicianResponse>(GET_TECHNICIAN_QUERY, {
              input: { id: technicianId },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTechnician, null, 2),
                },
              ],
            };
          }

          case "superops_technicians_groups": {
            const params = args as { max?: number };

            const response = await client.query<ListTechGroupsResponse>(LIST_TECH_GROUPS_QUERY, {
              input: {
                first: Math.min(params.max ?? 50, 500),
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTechGroupList, null, 2),
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
