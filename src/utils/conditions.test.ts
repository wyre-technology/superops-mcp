/**
 * Filter condition builder tests.
 *
 * SuperOps silently ignores a `joinOperator` it does not recognise and joins
 * the operands with OR instead — no error, just a superset. Rather than trust
 * every call site to spell `"AND"` correctly and test each one, `and()`/`or()`
 * are the only functions in the repo that write those tokens. The sweep at the
 * bottom is what keeps that true.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { clause, and, or } from "./conditions.js";

describe("clause", () => {
  it("builds a leaf", () => {
    expect(clause("name", "contains", "acme")).toEqual({
      attribute: "name",
      operator: "contains",
      value: "acme",
    });
  });

  it("passes array values through for includes-style operators", () => {
    expect(clause("stage", "includes", ["Active"]).value).toEqual(["Active"]);
  });
});

describe("and / or", () => {
  const a = clause("stage", "is", "Active");
  const b = clause("status", "is", "Paid");

  it("returns undefined when there is nothing to filter on", () => {
    expect(and([])).toBeUndefined();
    expect(or([])).toBeUndefined();
    expect(and([undefined, undefined])).toBeUndefined();
  });

  it("returns a lone clause unwrapped rather than a one-operand branch", () => {
    expect(and([a])).toEqual(a);
    expect(or([undefined, a, undefined])).toEqual(a);
  });

  it("drops absent clauses before counting", () => {
    expect(and([a, undefined, b])).toEqual({
      joinOperator: "AND",
      operands: [a, b],
    });
  });

  it("emits UPPERCASE join operators", () => {
    // Lowercase is silently treated as OR by SuperOps, so a compound built
    // with "and" returns the union and nothing reports a problem.
    expect(and([a, b])).toMatchObject({ joinOperator: "AND" });
    expect(or([a, b])).toMatchObject({ joinOperator: "OR" });
  });

  it("nests, so compounds can be operands of compounds", () => {
    const nested = and([a, or([b, clause("name", "contains", "x")])]);
    expect(nested).toEqual({
      joinOperator: "AND",
      operands: [a, { joinOperator: "OR", operands: [b, clause("name", "contains", "x")] }],
    });
  });
});

describe("joinOperator is written in exactly one place", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const srcRoot = join(here, "..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
      return [full];
    });
  }

  // conditions.ts constructs it; types.ts declares the field on
  // RuleConditionInput. Nothing else has any business naming it.
  const ALLOWED = new Set([join("utils", "conditions.ts"), "types.ts"]);

  it("is constructed only by src/utils/conditions.ts", () => {
    // A domain that hand-builds `{ joinOperator: ... }` is one typo away from
    // silently returning a superset. Route it through and()/or() instead.
    const offenders = sourceFiles(srcRoot)
      .filter((path) => !ALLOWED.has(relative(srcRoot, path)))
      .filter((path) => /joinOperator\s*:/.test(readFileSync(path, "utf8")))
      .map((path) => relative(srcRoot, path));

    expect(offenders).toEqual([]);
  });

  it("never appears in lowercase anywhere in src/", () => {
    const offenders = sourceFiles(srcRoot)
      .filter((path) => /joinOperator\s*:\s*["'](?:and|or)["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(srcRoot, path));

    expect(offenders).toEqual([]);
  });
});
