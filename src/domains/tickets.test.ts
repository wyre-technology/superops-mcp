/**
 * Tickets Domain Tests
 *
 * Tests for service ticket management tools.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock the client module
vi.mock("../client.js", () => ({
  getClient: vi.fn(() => ({
    query: vi.fn(),
    mutate: vi.fn(),
  })),
}));

import { getClient } from "../client.js";
import { getTicketsTools } from "./tickets.js";

describe("Tickets Domain", () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      mutate: vi.fn(),
    };
    vi.mocked(getClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getClient>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTicketsTools", () => {
    it("returns tools array with expected tools", () => {
      const domain = getTicketsTools();
      expect(domain.tools).toHaveLength(6);
      expect(domain.tools.map((t) => t.name)).toEqual([
        "superops_tickets_list",
        "superops_tickets_get",
        "superops_tickets_create",
        "superops_tickets_update",
        "superops_tickets_add_note",
        "superops_tickets_log_time",
      ]);
    });

    it("returns handleCall function", () => {
      const domain = getTicketsTools();
      expect(typeof domain.handleCall).toBe("function");
    });
  });

  describe("superops_tickets_list tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_list");

      expect(tool).toBeDefined();
      expect(tool?.description).toContain("List tickets");
      expect(tool?.inputSchema.properties).toHaveProperty("status");
      expect(tool?.inputSchema.properties).toHaveProperty("priority");
      expect(tool?.inputSchema.properties).toHaveProperty("clientId");
      expect(tool?.inputSchema.properties).toHaveProperty("assigneeId");
      expect(tool?.inputSchema.properties).toHaveProperty("unassigned");
    });

    it("calls query with default parameters", async () => {
      const mockResponse = {
        getTicketList: {
          tickets: [{ ticketId: "1", subject: "Test Ticket" }],
          listInfo: { totalCount: 1, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      const result = await domain.handleCall("superops_tickets_list", {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTicketList"),
        expect.objectContaining({
          input: expect.objectContaining({
            first: 50,
            orderBy: { field: "createdTime", direction: "DESC" },
          }),
        })
      );
      expect(result.content[0].text).toContain("Test Ticket");
    });

    it("applies status filter as array", async () => {
      const mockResponse = {
        getTicketList: {
          tickets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_list", {
        status: ["Open", "In Progress"],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: expect.objectContaining({
              status: ["Open", "In Progress"],
            }),
          }),
        })
      );
    });

    it("applies priority filter", async () => {
      const mockResponse = {
        getTicketList: {
          tickets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_list", {
        priority: ["High", "Critical"],
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: expect.objectContaining({
              priority: ["High", "Critical"],
            }),
          }),
        })
      );
    });

    it("applies clientId filter", async () => {
      const mockResponse = {
        getTicketList: {
          tickets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_list", { clientId: "client-123" });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: expect.objectContaining({
              client: { accountId: "client-123" },
            }),
          }),
        })
      );
    });

    it("filters for unassigned tickets", async () => {
      const mockResponse = {
        getTicketList: {
          tickets: [],
          listInfo: { totalCount: 0, hasNextPage: false },
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_list", { unassigned: true });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            filter: expect.objectContaining({
              assignee: null,
            }),
          }),
        })
      );
    });
  });

  describe("superops_tickets_get tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_get");

      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties).toHaveProperty("ticketId");
      expect(tool?.inputSchema.required).toContain("ticketId");
    });

    it("calls query with ticketId", async () => {
      const mockResponse = {
        getTicket: {
          ticketId: "ticket-123",
          subject: "Test Issue",
          status: "Open",
        },
      };
      mockClient.query.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      const result = await domain.handleCall("superops_tickets_get", {
        ticketId: "ticket-123",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("getTicket"),
        expect.objectContaining({
          input: { ticketId: "ticket-123" },
        })
      );
      expect(result.content[0].text).toContain("Test Issue");
    });
  });

  describe("superops_tickets_create tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_create");

      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties).toHaveProperty("subject");
      expect(tool?.inputSchema.properties).toHaveProperty("description");
      expect(tool?.inputSchema.properties).toHaveProperty("clientId");
      expect(tool?.inputSchema.properties).toHaveProperty("priority");
      expect(tool?.inputSchema.required).toContain("subject");
      expect(tool?.inputSchema.required).toContain("clientId");
    });

    it("calls mutate with required fields", async () => {
      const mockResponse = {
        createTicket: {
          ticketId: "new-ticket",
          ticketNumber: "TKT-001",
          subject: "New Issue",
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      const result = await domain.handleCall("superops_tickets_create", {
        subject: "New Issue",
        clientId: "client-123",
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.stringContaining("createTicket"),
        expect.objectContaining({
          input: expect.objectContaining({
            subject: "New Issue",
            client: { accountId: "client-123" },
          }),
        })
      );
      expect(result.content[0].text).toContain("new-ticket");
    });

    it("includes optional fields when provided", async () => {
      const mockResponse = {
        createTicket: { ticketId: "new-ticket", subject: "Issue" },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_create", {
        subject: "Issue",
        clientId: "client-123",
        description: "Detailed description",
        priority: "High",
        requesterEmail: "user@example.com",
        techGroupName: "Support Team",
        categoryName: "Hardware",
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            description: "Detailed description",
            priority: "HIGH",
            requester: { email: "user@example.com" },
            techGroup: { name: "Support Team" },
            category: { name: "Hardware" },
          }),
        })
      );
    });

    it("converts priority to uppercase", async () => {
      const mockResponse = {
        createTicket: { ticketId: "new-ticket" },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_create", {
        subject: "Issue",
        clientId: "client-123",
        priority: "critical",
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            priority: "CRITICAL",
          }),
        })
      );
    });
  });

  describe("superops_tickets_update tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_update");

      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties).toHaveProperty("ticketId");
      expect(tool?.inputSchema.properties).toHaveProperty("status");
      expect(tool?.inputSchema.properties).toHaveProperty("priority");
      expect(tool?.inputSchema.properties).toHaveProperty("assigneeId");
      expect(tool?.inputSchema.required).toContain("ticketId");
    });

    it("calls mutate with ticketId only", async () => {
      const mockResponse = {
        updateTicket: { ticketId: "ticket-123", status: "Open" },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_update", { ticketId: "ticket-123" });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.stringContaining("updateTicket"),
        expect.objectContaining({
          input: { ticketId: "ticket-123" },
        })
      );
    });

    it("includes update fields when provided", async () => {
      const mockResponse = {
        updateTicket: { ticketId: "ticket-123" },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_update", {
        ticketId: "ticket-123",
        status: "Resolved",
        priority: "Low",
        assigneeId: "tech-456",
        resolution: "Fixed the issue",
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            ticketId: "ticket-123",
            status: "Resolved",
            priority: "LOW",
            assignee: { id: "tech-456" },
            resolution: "Fixed the issue",
          }),
        })
      );
    });
  });

  describe("superops_tickets_add_note tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_add_note");

      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties).toHaveProperty("ticketId");
      expect(tool?.inputSchema.properties).toHaveProperty("content");
      expect(tool?.inputSchema.properties).toHaveProperty("isPublic");
      expect(tool?.inputSchema.required).toContain("ticketId");
      expect(tool?.inputSchema.required).toContain("content");
    });

    it("adds internal note by default", async () => {
      const mockResponse = {
        addTicketNote: {
          noteId: "note-123",
          content: "Test note",
          isPublic: false,
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_add_note", {
        ticketId: "ticket-123",
        content: "Test note",
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.stringContaining("addTicketNote"),
        expect.objectContaining({
          input: expect.objectContaining({
            ticketId: "ticket-123",
            content: "Test note",
            isPublic: false,
          }),
        })
      );
    });

    it("adds public note when specified", async () => {
      const mockResponse = {
        addTicketNote: {
          noteId: "note-123",
          content: "Public note",
          isPublic: true,
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_add_note", {
        ticketId: "ticket-123",
        content: "Public note",
        isPublic: true,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            isPublic: true,
          }),
        })
      );
    });
  });

  describe("superops_tickets_log_time tool", () => {
    it("has correct definition", () => {
      const domain = getTicketsTools();
      const tool = domain.tools.find((t) => t.name === "superops_tickets_log_time");

      expect(tool).toBeDefined();
      expect(tool?.inputSchema.properties).toHaveProperty("ticketId");
      expect(tool?.inputSchema.properties).toHaveProperty("duration");
      expect(tool?.inputSchema.properties).toHaveProperty("description");
      expect(tool?.inputSchema.properties).toHaveProperty("workType");
      expect(tool?.inputSchema.properties).toHaveProperty("billable");
      expect(tool?.inputSchema.required).toContain("ticketId");
      expect(tool?.inputSchema.required).toContain("duration");
    });

    it("logs time with required fields and default billable", async () => {
      const mockResponse = {
        addTicketTimeEntry: {
          timeEntryId: "time-123",
          ticketId: "ticket-123",
          duration: 30,
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_log_time", {
        ticketId: "ticket-123",
        duration: 30,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.stringContaining("addTicketTimeEntry"),
        expect.objectContaining({
          input: expect.objectContaining({
            ticketId: "ticket-123",
            duration: 30,
            billable: true,
          }),
        })
      );
    });

    it("includes optional fields when provided", async () => {
      const mockResponse = {
        addTicketTimeEntry: {
          timeEntryId: "time-123",
          duration: 60,
        },
      };
      mockClient.mutate.mockResolvedValue(mockResponse);

      const domain = getTicketsTools();
      await domain.handleCall("superops_tickets_log_time", {
        ticketId: "ticket-123",
        duration: 60,
        description: "Troubleshooting network issue",
        workType: "Remote Support",
        billable: false,
      });

      expect(mockClient.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            description: "Troubleshooting network issue",
            workType: "Remote Support",
            billable: false,
          }),
        })
      );
    });
  });

  describe("Error handling", () => {
    it("returns error for unknown tool", async () => {
      const domain = getTicketsTools();
      const result = await domain.handleCall("unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tickets tool");
    });

    it("handles API errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("API rate limit exceeded"));

      const domain = getTicketsTools();
      const result = await domain.handleCall("superops_tickets_list", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: API rate limit exceeded");
    });

    it("handles mutation errors gracefully", async () => {
      mockClient.mutate.mockRejectedValue(new Error("Validation failed"));

      const domain = getTicketsTools();
      const result = await domain.handleCall("superops_tickets_create", {
        subject: "Test",
        clientId: "123",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Validation failed");
    });
  });
});
