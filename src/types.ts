/**
 * SuperOps MCP Server Types
 *
 * Type definitions for the SuperOps.ai GraphQL API integration.
 */

export interface SuperOpsCredentials {
  apiToken: string;
  subdomain: string;
  region?: "us" | "eu";
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: {
    code?: string;
    retryAfter?: number;
    field?: string;
  };
}

export interface ListInfo {
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface ListInfoInput {
  first?: number;
  after?: string;
  before?: string;
  last?: number;
  filter?: Record<string, unknown>;
  orderBy?: {
    field: string;
    direction: "ASC" | "DESC";
  };
}

// Client types
export interface Client {
  accountId: string;
  name: string;
  stage?: "Lead" | "Prospect" | "Customer" | "Churned";
  status?: "Active" | "Inactive" | "Archived";
  emailDomains?: string[];
  website?: string;
  phone?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  address?: Address;
  accountManager?: Technician;
  primaryContact?: Contact;
  sites?: Site[];
  customFields?: CustomField[];
  createdTime?: string;
  lastUpdatedTime?: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface Site {
  id: string;
  name: string;
  address?: Address;
  phone?: string;
  timezone?: string;
  isDefault?: boolean;
  assetCount?: number;
  contactCount?: number;
}

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  isPrimaryContact?: boolean;
  isVIP?: boolean;
  site?: Site;
}

// Ticket types
export interface Ticket {
  ticketId: string;
  ticketNumber?: string;
  subject: string;
  description?: string;
  status?: "Open" | "In Progress" | "Pending" | "Resolved" | "Closed";
  priority?: "Low" | "Medium" | "High" | "Critical";
  impact?: string;
  urgency?: string;
  ticketType?: string;
  requestType?: string;
  source?: string;
  client?: Client;
  site?: Site;
  requester?: Contact;
  assignee?: Technician;
  techGroup?: TechGroup;
  category?: Category;
  customFields?: CustomField[];
  resolution?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
}

export interface TechGroup {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface TicketNote {
  noteId: string;
  content: string;
  isPublic: boolean;
  createdTime: string;
  createdBy?: Technician;
}

export interface TimeEntry {
  timeEntryId: string;
  ticketId: string;
  duration: number;
  description?: string;
  workType?: string;
  billable?: boolean;
  technician?: Technician;
  createdTime?: string;
}

// Asset types
export interface Asset {
  assetId: string;
  name: string;
  status?: "Online" | "Offline" | "Maintenance";
  platform?: "Windows" | "macOS" | "Linux";
  lastSeen?: string;
  agentVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  publicIp?: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  processorName?: string;
  processorCores?: number;
  totalMemory?: number;
  totalDiskSpace?: number;
  freeDiskSpace?: number;
  osName?: string;
  osVersion?: string;
  osBuild?: string;
  architecture?: string;
  client?: Client;
  site?: Site;
  tags?: string[];
  customFields?: CustomField[];
  patchStatus?: PatchStatus;
}

export interface PatchStatus {
  pendingCount: number;
  installedCount: number;
  failedCount: number;
  lastScanDate?: string;
}

// Technician types
export interface Technician {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface CustomField {
  name: string;
  value: string;
}

// Tool definition types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type Domain = "clients" | "tickets" | "assets" | "technicians" | "custom";

export interface DomainTools {
  tools: ToolDefinition[];
  handleCall: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
}
