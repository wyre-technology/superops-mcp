/**
 * SuperOps.ai Tickets Domain
 *
 * Tools for managing service tickets in SuperOps.ai PSA.
 */

import { getClient } from "../client.js";
import type { DomainTools, Ticket, ListInfo } from "../types.js";

const LIST_TICKETS_QUERY = `
  query getTicketList($input: ListInfoInput!) {
    getTicketList(input: $input) {
      tickets {
        ticketId
        ticketNumber
        subject
        status
        priority
        createdTime
        lastUpdatedTime
        client {
          accountId
          name
        }
        assignee {
          id
          name
        }
        requester {
          id
          name
          email
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

const GET_TICKET_QUERY = `
  query getTicket($input: TicketIdentifierInput!) {
    getTicket(input: $input) {
      ticketId
      ticketNumber
      subject
      description
      status
      priority
      impact
      urgency
      createdTime
      lastUpdatedTime
      client {
        accountId
        name
      }
      site {
        id
        name
      }
      requester {
        id
        name
        email
        phone
      }
      assignee {
        id
        name
        email
      }
      techGroup {
        id
        name
      }
      category {
        id
        name
      }
      customFields {
        name
        value
      }
    }
  }
`;

const CREATE_TICKET_MUTATION = `
  mutation createTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      ticketId
      ticketNumber
      subject
      status
      priority
      createdTime
      client {
        accountId
        name
      }
      assignee {
        id
        name
      }
    }
  }
`;

const UPDATE_TICKET_MUTATION = `
  mutation updateTicket($input: UpdateTicketInput!) {
    updateTicket(input: $input) {
      ticketId
      ticketNumber
      status
      priority
      assignee {
        id
        name
      }
      lastUpdatedTime
    }
  }
`;

const ADD_TICKET_NOTE_MUTATION = `
  mutation addTicketNote($input: AddTicketNoteInput!) {
    addTicketNote(input: $input) {
      noteId
      content
      createdTime
      isPublic
      createdBy {
        id
        name
      }
    }
  }
`;

const ADD_TIME_ENTRY_MUTATION = `
  mutation addTicketTimeEntry($input: AddTimeEntryInput!) {
    addTicketTimeEntry(input: $input) {
      timeEntryId
      ticketId
      duration
      description
      technician {
        id
        name
      }
      createdTime
    }
  }
`;

interface ListTicketsResponse {
  getTicketList: {
    tickets: Ticket[];
    listInfo: ListInfo;
  };
}

interface GetTicketResponse {
  getTicket: Ticket;
}

interface CreateTicketResponse {
  createTicket: Ticket;
}

interface UpdateTicketResponse {
  updateTicket: Ticket;
}

interface AddNoteResponse {
  addTicketNote: {
    noteId: string;
    content: string;
    createdTime: string;
    isPublic: boolean;
    createdBy?: { id: string; name: string };
  };
}

interface AddTimeEntryResponse {
  addTicketTimeEntry: {
    timeEntryId: string;
    ticketId: string;
    duration: number;
    description?: string;
    technician?: { id: string; name: string };
    createdTime: string;
  };
}

export function getTicketsTools(): DomainTools {
  return {
    tools: [
      {
        name: "superops_tickets_list",
        description:
          "List tickets in SuperOps.ai. Can filter by status, priority, client, or assignee.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "array",
              items: { type: "string" },
              description:
                "Filter by status(es): Open, In Progress, Pending, Resolved, Closed",
            },
            priority: {
              type: "array",
              items: { type: "string" },
              description: "Filter by priority(ies): Low, Medium, High, Critical",
            },
            clientId: {
              type: "string",
              description: "Filter by client account ID",
            },
            assigneeId: {
              type: "string",
              description: "Filter by assigned technician ID",
            },
            unassigned: {
              type: "boolean",
              description: "Show only unassigned tickets",
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
        name: "superops_tickets_get",
        description: "Get detailed information for a specific ticket by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            ticketId: {
              type: "string",
              description: "The unique ticket ID",
            },
          },
          required: ["ticketId"],
        },
      },
      {
        name: "superops_tickets_create",
        description: "Create a new ticket in SuperOps.ai.",
        inputSchema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description: "Ticket subject/title",
            },
            description: {
              type: "string",
              description: "Detailed description of the issue",
            },
            clientId: {
              type: "string",
              description: "Client account ID",
            },
            priority: {
              type: "string",
              description: "Ticket priority: Low, Medium, High, or Critical",
              enum: ["Low", "Medium", "High", "Critical"],
            },
            requesterEmail: {
              type: "string",
              description: "Email of the person reporting the issue",
            },
            techGroupName: {
              type: "string",
              description: "Name of the technician group to assign",
            },
            categoryName: {
              type: "string",
              description: "Service category name",
            },
          },
          required: ["subject", "clientId"],
        },
      },
      {
        name: "superops_tickets_update",
        description:
          "Update an existing ticket - change status, priority, assignment, or add resolution.",
        inputSchema: {
          type: "object",
          properties: {
            ticketId: {
              type: "string",
              description: "The ticket ID to update",
            },
            status: {
              type: "string",
              description: "New status: Open, In Progress, Pending, Resolved, Closed",
              enum: ["Open", "In Progress", "Pending", "Resolved", "Closed"],
            },
            priority: {
              type: "string",
              description: "New priority: Low, Medium, High, Critical",
              enum: ["Low", "Medium", "High", "Critical"],
            },
            assigneeId: {
              type: "string",
              description: "ID of technician to assign",
            },
            techGroupName: {
              type: "string",
              description: "Name of technician group to assign",
            },
            resolution: {
              type: "string",
              description: "Resolution notes (for resolving/closing tickets)",
            },
          },
          required: ["ticketId"],
        },
      },
      {
        name: "superops_tickets_add_note",
        description: "Add a note to a ticket. Can be internal or public (visible to client).",
        inputSchema: {
          type: "object",
          properties: {
            ticketId: {
              type: "string",
              description: "The ticket ID",
            },
            content: {
              type: "string",
              description: "Note content",
            },
            isPublic: {
              type: "boolean",
              description: "Whether the note is visible to the client (default: false)",
              default: false,
            },
          },
          required: ["ticketId", "content"],
        },
      },
      {
        name: "superops_tickets_log_time",
        description: "Log time spent on a ticket.",
        inputSchema: {
          type: "object",
          properties: {
            ticketId: {
              type: "string",
              description: "The ticket ID",
            },
            duration: {
              type: "number",
              description: "Time spent in minutes",
            },
            description: {
              type: "string",
              description: "Description of work performed",
            },
            workType: {
              type: "string",
              description: "Type of work (e.g., Remote Support, On-site, Phone)",
            },
            billable: {
              type: "boolean",
              description: "Whether the time is billable (default: true)",
              default: true,
            },
          },
          required: ["ticketId", "duration"],
        },
      },
    ],

    async handleCall(name, args) {
      const client = getClient();

      try {
        switch (name) {
          case "superops_tickets_list": {
            const params = args as {
              status?: string[];
              priority?: string[];
              clientId?: string;
              assigneeId?: string;
              unassigned?: boolean;
              max?: number;
              cursor?: string;
            };

            const filter: Record<string, unknown> = {};
            if (params.status) filter.status = params.status;
            if (params.priority) filter.priority = params.priority;
            if (params.clientId) filter.client = { accountId: params.clientId };
            if (params.assigneeId) filter.assignee = { id: params.assigneeId };
            if (params.unassigned) filter.assignee = null;

            const response = await client.query<ListTicketsResponse>(LIST_TICKETS_QUERY, {
              input: {
                first: Math.min(params.max ?? 50, 500),
                ...(params.cursor && { after: params.cursor }),
                ...(Object.keys(filter).length > 0 && { filter }),
                orderBy: { field: "createdTime", direction: "DESC" },
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTicketList, null, 2),
                },
              ],
            };
          }

          case "superops_tickets_get": {
            const { ticketId } = args as { ticketId: string };

            const response = await client.query<GetTicketResponse>(GET_TICKET_QUERY, {
              input: { ticketId },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.getTicket, null, 2),
                },
              ],
            };
          }

          case "superops_tickets_create": {
            const params = args as {
              subject: string;
              description?: string;
              clientId: string;
              priority?: string;
              requesterEmail?: string;
              techGroupName?: string;
              categoryName?: string;
            };

            const input: Record<string, unknown> = {
              subject: params.subject,
              client: { accountId: params.clientId },
            };
            if (params.description) input.description = params.description;
            if (params.priority) input.priority = params.priority.toUpperCase();
            if (params.requesterEmail) input.requester = { email: params.requesterEmail };
            if (params.techGroupName) input.techGroup = { name: params.techGroupName };
            if (params.categoryName) input.category = { name: params.categoryName };

            const response = await client.mutate<CreateTicketResponse>(
              CREATE_TICKET_MUTATION,
              { input }
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.createTicket, null, 2),
                },
              ],
            };
          }

          case "superops_tickets_update": {
            const params = args as {
              ticketId: string;
              status?: string;
              priority?: string;
              assigneeId?: string;
              techGroupName?: string;
              resolution?: string;
            };

            const input: Record<string, unknown> = { ticketId: params.ticketId };
            if (params.status) input.status = params.status;
            if (params.priority) input.priority = params.priority.toUpperCase();
            if (params.assigneeId) input.assignee = { id: params.assigneeId };
            if (params.techGroupName) input.techGroup = { name: params.techGroupName };
            if (params.resolution) input.resolution = params.resolution;

            const response = await client.mutate<UpdateTicketResponse>(
              UPDATE_TICKET_MUTATION,
              { input }
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.updateTicket, null, 2),
                },
              ],
            };
          }

          case "superops_tickets_add_note": {
            const params = args as {
              ticketId: string;
              content: string;
              isPublic?: boolean;
            };

            const response = await client.mutate<AddNoteResponse>(ADD_TICKET_NOTE_MUTATION, {
              input: {
                ticketId: params.ticketId,
                content: params.content,
                isPublic: params.isPublic ?? false,
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.addTicketNote, null, 2),
                },
              ],
            };
          }

          case "superops_tickets_log_time": {
            const params = args as {
              ticketId: string;
              duration: number;
              description?: string;
              workType?: string;
              billable?: boolean;
            };

            const response = await client.mutate<AddTimeEntryResponse>(
              ADD_TIME_ENTRY_MUTATION,
              {
                input: {
                  ticketId: params.ticketId,
                  duration: params.duration,
                  description: params.description,
                  workType: params.workType,
                  billable: params.billable ?? true,
                },
              }
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.addTicketTimeEntry, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [{ type: "text", text: `Unknown tickets tool: ${name}` }],
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
