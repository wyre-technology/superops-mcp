/**
 * Filter conditions for SuperOps list queries.
 *
 * `ListInfoInput.condition` is a recursive `RuleConditionInput`: either a leaf
 * `{attribute, operator, value}` or a branch `{joinOperator, operands}`. The
 * published API docs describe only the leaf form — the branch form was found by
 * introspecting the live API, and is what lets a search match several fields.
 *
 * Everything below was verified against a live tenant.
 *
 * ## joinOperator must be UPPERCASE
 *
 * This is the sharp edge. SuperOps silently ignores a `joinOperator` it does
 * not recognise and joins the operands with `OR` instead — no error, just a
 * superset. Lowercase `"and"` and outright junk (`"banana"`) both behave that
 * way, and lowercase `"or"` only looks correct because OR is the fallback.
 *
 * Measured live on two different tenants' data, same operands each time:
 *
 *   clients, [stage is Active, status is Paid]:
 *     "AND"    -> 1 row    the intersection
 *     "and"    -> 2 rows   silently OR
 *     "xyzzy"  -> 2 rows   silently OR
 *
 *   assets, [status includes ONLINE, platform contains Windows]:
 *     "AND"    -> 1 row    the one online Windows box
 *     "OR"     -> 3 rows
 *     "and"    -> 3 rows   silently OR
 *     "banana" -> 3 rows   silently OR
 *
 * `combine()` is the only place in this server that builds a branch, so the
 * casing is decided once here rather than trusted to each call site.
 * `conditions.test.ts` sweeps `src/` to keep that true.
 *
 * ## Operators
 *
 * | Operator                                                  | Value  |
 * |-----------------------------------------------------------|--------|
 * | `is`, `isNot`, `contains`, `notContains`, `startsWith`, `endsWith` | string |
 * | `includes`, `notIncludes`                                 | array  |
 *
 * `equals` and `in` are rejected with a 500. Matching is case-insensitive.
 *
 * ## Two ways a filter silently returns nothing
 *
 * Neither of these errors — they return zero rows, which is indistinguishable
 * from an empty tenant:
 *
 *  - A value outside the field's real set. Filter values are plain strings in
 *    the schema, so nothing validates them.
 *  - Filtering a JSON column by its bare name rather than a path into it:
 *    `software` matches nothing, `software.name` works.
 *
 * `includes` also matches a value *whole*, so filtering an OS platform with
 * `includes: ["Windows"]` misses `"Microsoft Windows 10 Pro"` — use `contains`.
 */

import type { RuleConditionInput } from "../types.js";

/** A single `{attribute, operator, value}` filter clause. */
export function clause(
  attribute: string,
  operator: string,
  value: unknown
): RuleConditionInput {
  return { attribute, operator, value };
}

/**
 * Join clauses into one condition, dropping the absent ones.
 *
 * Returns `undefined` for nothing, the lone clause unwrapped for one (a
 * one-operand branch is pointless), and a `{joinOperator, operands}` branch for
 * several. Accepting `undefined` entries lets callers pass optional filters
 * inline without pre-filtering.
 *
 * Deliberately not exported, and deliberately not taking the operator as a
 * caller-supplied argument: `and()` and `or()` below are the only doors, so
 * `"AND"` and `"OR"` each appear exactly once in the codebase and no call site
 * is in a position to spell one wrong.
 */
function combine(
  joinOperator: "AND" | "OR",
  clauses: (RuleConditionInput | undefined)[]
): RuleConditionInput | undefined {
  const present = clauses.filter((c): c is RuleConditionInput => c !== undefined);
  if (present.length <= 1) return present[0];
  return { joinOperator, operands: present };
}

/** Every clause must match. */
export function and(
  clauses: (RuleConditionInput | undefined)[]
): RuleConditionInput | undefined {
  return combine("AND", clauses);
}

/** Any clause may match. */
export function or(
  clauses: (RuleConditionInput | undefined)[]
): RuleConditionInput | undefined {
  return combine("OR", clauses);
}
