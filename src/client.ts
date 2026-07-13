/**
 * SuperOps.ai GraphQL Client
 *
 * Lazy-loaded client for making GraphQL requests to the SuperOps.ai API.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { SuperOpsCredentials, GraphQLResponse } from "./types.js";

const API_ENDPOINTS = {
  us: "https://api.superops.ai/msp",
  eu: "https://euapi.superops.ai/msp",
} as const;

// An unresolved MCPB/DXT manifest placeholder, e.g. "${user_config.superops_region}".
// Desktop hosts inject the config template verbatim when its optional user_config
// field is left blank, so the literal string arrives in the env var / header.
const CONFIG_PLACEHOLDER = /^\$\{.*\}$/;

/**
 * Normalise a single credential read from an env var.
 *
 * Returns `undefined` for values that are effectively absent, so callers treat
 * them as "no credential" rather than a real value:
 *   - undefined / empty / whitespace-only
 *   - an unresolved manifest placeholder like `${user_config.superops_region}`
 *
 * Root cause of issue #73: a blank optional SUPEROPS_REGION field left the
 * literal `${user_config.superops_region}` in the env var. That truthy string
 * defeated the `?? "us"` default, so `API_ENDPOINTS[region]` returned undefined
 * and every `fetch(this.endpoint, ...)` threw "Failed to parse URL". Stripping
 * the placeholder here lets the "us" default apply.
 */
export function cleanCredential(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || CONFIG_PLACEHOLDER.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * AsyncLocalStorage for per-request credential isolation in HTTP transport.
 * When running behind the MCP gateway, each request gets its own credentials
 * injected via headers — never stored in process.env or shared state.
 */
const credentialStore = new AsyncLocalStorage<SuperOpsCredentials>();

/**
 * Run a function with per-request credentials available via getCredentials()/getClient().
 */
export function runWithCredentials<T>(creds: SuperOpsCredentials, fn: () => T): T {
  return credentialStore.run(creds, fn);
}

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
  // Per-request credentials from AsyncLocalStorage take priority (HTTP/gateway mode)
  const requestCreds = credentialStore.getStore();
  if (requestCreds) {
    return requestCreds;
  }

  // Fall back to environment variables (stdio mode). Sanitise at ingress so an
  // unresolved MCPB placeholder or blank field is treated as absent (issue #73).
  const apiToken = cleanCredential(process.env.SUPEROPS_API_TOKEN);
  const subdomain = cleanCredential(process.env.SUPEROPS_SUBDOMAIN);
  // SUPEROPS_REGION only supports "us"/"eu"; anything else (including a stripped
  // placeholder) coerces to undefined so the constructor's `?? "us"` applies.
  const rawRegion = cleanCredential(process.env.SUPEROPS_REGION);
  const region = rawRegion === "eu" ? "eu" : rawRegion === "us" ? "us" : undefined;

  if (!apiToken || !subdomain) {
    return null;
  }

  return { apiToken, subdomain, region };
}

export function getClient(): SuperOpsClient {
  // Per-request credentials: always create a fresh client (no shared state)
  const requestCreds = credentialStore.getStore();
  if (requestCreds) {
    return new SuperOpsClient(requestCreds);
  }

  // Stdio mode: use cached singleton
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
