/**
 * Pagination normalisation tests.
 *
 * Tool arguments are untrusted JSON numbers. SuperOps types `page`/`pageSize`
 * as `Int`, so a fractional value fails coercion at the API and a zero or
 * negative page returns an error or an empty page instead of the first one.
 * Four domains previously each rolled their own version of this and two of
 * them applied no floor and no truncation.
 */

import { describe, it, expect } from "vitest";
import {
  pageOf,
  pageSizeOf,
  paging,
  PAGE_PROPERTIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_PAGE,
} from "./paging.js";

describe("pageOf", () => {
  it("defaults to the first page", () => {
    expect(pageOf()).toBe(1);
    expect(pageOf(undefined)).toBe(1);
  });

  it("passes a valid page through", () => {
    expect(pageOf(1)).toBe(1);
    expect(pageOf(7)).toBe(7);
  });

  it("floors zero and negative pages at 1", () => {
    expect(pageOf(0)).toBe(1);
    expect(pageOf(-1)).toBe(1);
    expect(pageOf(-100)).toBe(1);
  });

  it("truncates fractional pages to an integer", () => {
    expect(pageOf(2.9)).toBe(2);
    expect(pageOf(1.0001)).toBe(1);
    expect(pageOf(0.5)).toBe(1);
  });

  it("falls back to 1 for non-finite input", () => {
    expect(pageOf(Number.NaN)).toBe(1);
    expect(pageOf(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("clamps to the signed 32-bit ceiling GraphQL Int allows", () => {
    // Past this, the request fails variable coercion before it is even sent.
    expect(pageOf(MAX_PAGE)).toBe(MAX_PAGE);
    expect(pageOf(MAX_PAGE + 1)).toBe(MAX_PAGE);
    expect(pageOf(Number.MAX_SAFE_INTEGER)).toBe(MAX_PAGE);
  });
});

describe("pageSizeOf", () => {
  it("defaults to DEFAULT_PAGE_SIZE", () => {
    expect(pageSizeOf()).toBe(DEFAULT_PAGE_SIZE);
  });

  it("passes a valid size through", () => {
    expect(pageSizeOf(25)).toBe(25);
    expect(pageSizeOf(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
  });

  it("clamps to MAX_PAGE_SIZE", () => {
    expect(pageSizeOf(500)).toBe(MAX_PAGE_SIZE);
  });

  it("floors zero and negative sizes at 1", () => {
    expect(pageSizeOf(0)).toBe(1);
    expect(pageSizeOf(-10)).toBe(1);
  });

  it("truncates fractional sizes to an integer", () => {
    expect(pageSizeOf(10.5)).toBe(10);
    expect(Number.isInteger(pageSizeOf(99.99))).toBe(true);
  });

  it("falls back to the default for non-finite input", () => {
    expect(pageSizeOf(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeOf(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("paging", () => {
  it("normalises both offsets together", () => {
    expect(paging({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(paging({ page: 0, pageSize: 1000 })).toEqual({
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    });
    expect(paging({ page: 3.7, pageSize: 10.9 })).toEqual({ page: 3, pageSize: 10 });
  });

  it("only ever emits in-range integers, so Int coercion cannot fail", () => {
    const inputs = [
      { page: 2.5 },
      { pageSize: 7.5 },
      { page: -3, pageSize: 0.2 },
      { page: Number.MAX_SAFE_INTEGER, pageSize: Number.MAX_SAFE_INTEGER },
      { page: Number.NaN, pageSize: Number.NaN },
    ];
    for (const input of inputs) {
      const result = paging(input);
      for (const value of [result.page, result.pageSize]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(MAX_PAGE);
      }
      expect(result.pageSize).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
  });
});

describe("PAGE_PROPERTIES", () => {
  it("advertises defaults matching the normalisation", () => {
    expect(PAGE_PROPERTIES.page.default).toBe(1);
    expect(PAGE_PROPERTIES.pageSize.default).toBe(DEFAULT_PAGE_SIZE);
    expect(PAGE_PROPERTIES.pageSize.description).toContain(String(MAX_PAGE_SIZE));
  });
});
