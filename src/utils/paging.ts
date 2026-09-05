/**
 * Shared pagination normalisation for SuperOps list tools.
 *
 * SuperOps uses offset pagination: `ListInfoInput { page, pageSize }`, both
 * typed `Int`. Tool arguments arrive as untrusted JSON numbers, so a caller can
 * send `0`, `-1`, or `10.5` — a fractional value fails Int coercion at the API
 * and a zero/negative page yields an error or an empty page rather than the
 * first one. Normalise here, once, instead of per domain.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** 1-based page number, truncated to an integer and floored at 1. */
export function pageOf(page?: number): number {
  const value = Math.trunc(page ?? 1);
  return Number.isFinite(value) ? Math.max(value, 1) : 1;
}

/** Page size, truncated to an integer and clamped to [1, MAX_PAGE_SIZE]. */
export function pageSizeOf(pageSize?: number): number {
  const value = Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), MAX_PAGE_SIZE);
}

/** Both offsets normalised together, for the common list-tool case. */
export function paging(params: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  return { page: pageOf(params.page), pageSize: pageSizeOf(params.pageSize) };
}

/** The `page`/`pageSize` JSON Schema properties every list tool advertises. */
export const PAGE_PROPERTIES = {
  page: {
    type: "number",
    description: "Page number, 1-based (default: 1)",
    default: 1,
  },
  pageSize: {
    type: "number",
    description: `Results per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
    default: DEFAULT_PAGE_SIZE,
  },
} as const;
