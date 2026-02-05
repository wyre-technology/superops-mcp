/**
 * SuperOps.ai GraphQL Client
 *
 * Lazy-loaded client for making GraphQL requests to the SuperOps.ai API.
 */

import type { SuperOpsCredentials, GraphQLResponse } from "./types.js";

const API_ENDPOINTS = {
  us: "https://api.superops.ai/msp",
  eu: "https://euapi.superops.ai/msp",
} as const;

export class SuperOpsClient {
  private readonly apiToken: string;
  private readonly subdomain: string;
  private readonly endpoint: string;

  constructor(credentials: SuperOpsCredentials) {
    this.apiToken = credentials.apiToken;
    this.subdomain = credentials.subdomain;
    this.endpoint = API_ENDPOINTS[credentials.region ?? "us"];
  }

  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        CustomerSubDomain: this.subdomain,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      throw new SuperOpsError(
        error.message,
        error.extensions?.code,
        error.extensions?.retryAfter
      );
    }

    if (!result.data) {
      throw new Error("No data returned from GraphQL query");
    }

    return result.data;
  }

  async mutate<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    return this.query<T>(mutation, variables);
  }
}

export class SuperOpsError extends Error {
  readonly code?: string;
  readonly retryAfter?: number;

  constructor(message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = "SuperOpsError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// Lazy-loaded singleton client
let _client: SuperOpsClient | null = null;

export function getCredentials(): SuperOpsCredentials | null {
  const apiToken = process.env.SUPEROPS_API_TOKEN;
  const subdomain = process.env.SUPEROPS_SUBDOMAIN;
  const region = process.env.SUPEROPS_REGION as "us" | "eu" | undefined;

  if (!apiToken || !subdomain) {
    return null;
  }

  return { apiToken, subdomain, region };
}

export function getClient(): SuperOpsClient {
  if (!_client) {
    const creds = getCredentials();
    if (!creds) {
      throw new Error(
        "SuperOps credentials not configured. Set SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN environment variables."
      );
    }
    _client = new SuperOpsClient(creds);
  }
  return _client;
}

export function resetClient(): void {
  _client = null;
}
