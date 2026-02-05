/**
 * SuperOps Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCredentials, resetClient } from "./client.js";

describe("getCredentials", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetClient();
  });

  it("returns null when SUPEROPS_API_TOKEN is not set", () => {
    vi.stubEnv("SUPEROPS_API_TOKEN", "");
    vi.stubEnv("SUPEROPS_SUBDOMAIN", "testcompany");

    const creds = getCredentials();
    expect(creds).toBeNull();
  });

  it("returns null when SUPEROPS_SUBDOMAIN is not set", () => {
    vi.stubEnv("SUPEROPS_API_TOKEN", "test-token");
    vi.stubEnv("SUPEROPS_SUBDOMAIN", "");

    const creds = getCredentials();
    expect(creds).toBeNull();
  });

  it("returns credentials when both are set", () => {
    vi.stubEnv("SUPEROPS_API_TOKEN", "test-token");
    vi.stubEnv("SUPEROPS_SUBDOMAIN", "testcompany");

    const creds = getCredentials();
    expect(creds).toEqual({
      apiToken: "test-token",
      subdomain: "testcompany",
      region: undefined,
    });
  });

  it("includes region when SUPEROPS_REGION is set", () => {
    vi.stubEnv("SUPEROPS_API_TOKEN", "test-token");
    vi.stubEnv("SUPEROPS_SUBDOMAIN", "testcompany");
    vi.stubEnv("SUPEROPS_REGION", "eu");

    const creds = getCredentials();
    expect(creds).toEqual({
      apiToken: "test-token",
      subdomain: "testcompany",
      region: "eu",
    });
  });
});
