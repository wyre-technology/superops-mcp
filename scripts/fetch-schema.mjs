#!/usr/bin/env node
/**
 * Regenerate schema/superops.graphql, which the test suite validates every
 * GraphQL document in src/ against.
 *
 * Two sources, in order of preference:
 *
 *  1. Live introspection, when SUPEROPS_API_TOKEN and SUPEROPS_SUBDOMAIN are
 *     set. Authoritative — it is the schema the server will actually answer.
 *  2. Scraping https://developer.superops.com/msp, a SpectaQL-style static site
 *     that embeds the whole schema in HTML tables. Needs no credentials, so CI
 *     and outside contributors can still regenerate — but the published docs
 *     lag the live API, so prefer introspection whenever credentials are
 *     available.
 *
 * How far the docs lag, measured against live introspection on 2026-09-05:
 *
 *   - 76 queries and 63 mutations documented; 116 and 83 exist.
 *   - 279 types documented; 404 exist.
 *   - Every root field the docs DO declare exists live, so the scrape is a
 *     strict subset of the real root — incomplete, but not dangerous. In
 *     particular `createTicketNote` is real: introspection reports it as
 *     `createTicketNote(input: CreateTicketNoteInput!): Note`, carrying
 *     `@deprecated(reason: "Use createNote")`. Deprecated is not absent, and
 *     the schema must keep declaring it.
 *   - Where the docs ARE wrong is field shapes and type names: see
 *     DOCS_CORRECTIONS and DOCS_PHANTOM_TYPES below.
 *
 * Run after a SuperOps API change:  node scripts/fetch-schema.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildSchema,
  buildClientSchema,
  getIntrospectionQuery,
  printSchema,
} from "graphql";

const API_ENDPOINTS = {
  us: "https://api.superops.ai/msp",
  eu: "https://euapi.superops.ai/msp",
};

/**
 * Ask the live API for its own schema. Returns SDL, or null when credentials
 * are absent so the caller falls back to the published docs.
 */
async function introspect() {
  const apiToken = process.env.SUPEROPS_API_TOKEN?.trim();
  const subdomain = process.env.SUPEROPS_SUBDOMAIN?.trim();
  if (!apiToken || !subdomain) return null;

  const region = process.env.SUPEROPS_REGION?.trim() === "eu" ? "eu" : "us";
  const res = await fetch(API_ENDPOINTS[region], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
      CustomerSubDomain: subdomain,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });
  if (!res.ok) throw new Error(`Introspection failed: ${res.status} ${res.statusText}`);

  const { data, errors } = await res.json();
  if (errors?.length) {
    throw new Error(
      `Introspection returned errors: ${errors.map((e) => e.message).join("; ")}`
    );
  }
  if (!data) throw new Error("Introspection returned no data");

  return printSchema(buildClientSchema(data));
}

const DOCS_URL = "https://developer.superops.com/msp";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "schema", "superops.graphql");

// GraphQL's built-in scalars must not be redeclared in SDL.
const BUILTIN = new Set(["ID", "String", "Int", "Float", "Boolean"]);

const PROP =
  /<span class="property-name"><code>([A-Za-z_]\w*)<\/code><\/span>\s*-\s*<span class="property-type">\s*<a href="#definition-\w+"><code>([^<]+)<\/code><\/a>/g;
const ENUM_VALUE = /<td>\s*<p><code>([A-Za-z_]\w*)<\/code><\/p>\s*<\/td>/g;

const unescape = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/** Field/argument rows, de-duplicated, in document order. */
function props(scope) {
  const out = new Map();
  for (const m of scope.matchAll(PROP)) {
    if (!out.has(m[1])) out.set(m[1], unescape(m[2]));
  }
  return out;
}

/** A definition section renders Fields after the `definition-properties` marker. */
function fieldsScope(body) {
  const i = body.indexOf("definition-properties");
  return i === -1 ? body : body.slice(i);
}

function block(keyword, name, fields) {
  if (fields.size === 0) {
    // Keep the type declared so references to it still resolve.
    return `${keyword} ${name} {\n  _empty: Boolean\n}`;
  }
  const body = [...fields].map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return `${keyword} ${name} {\n${body}\n}`;
}

function operations(src, prefix) {
  const re = new RegExp(
    `<section id="${prefix}-(\\w+)" class="operation operation-\\w+"([\\s\\S]*?)</section>`,
    "g"
  );
  const ops = [];
  for (const m of src.matchAll(re)) {
    const [, name, body] = m;
    // "Returns [ Foo ]" (list) must be checked before the scalar "Returns a Foo".
    const list = body.match(
      /operation-response[\s\S]*?Returns\s+\[\s*<a href="#definition-\w+"><code>([^<]+)<\/code><\/a>\s*\]/
    );
    const single =
      body.match(
        /operation-response[\s\S]*?Returns\s+an?\s+<a href="#definition-\w+"><code>([^<]+)<\/code><\/a>/
      ) || body.match(/Returns[\s\S]*?<a href="#definition-\w+"><code>([^<]+)<\/code><\/a>/);
    const ret = list ? `[${unescape(list[1])}]` : single ? unescape(single[1]) : "JSON";

    const i = body.indexOf("operation-arguments");
    const args = i === -1 ? new Map() : props(body.slice(i));
    const sig = args.size
      ? `(${[...args].map(([k, v]) => `${k}: ${v}`).join(", ")})`
      : "";
    ops.push(`  ${name}${sig}: ${ret}`);
  }
  return ops;
}

// Prefer the live API's own account of itself; fall back to the docs.
const introspected = await introspect();
if (introspected) {
  const banner = `# SuperOps.ai GraphQL schema — GENERATED, do not edit by hand.
#
# Source: live introspection (authoritative)
# Regenerate with: node scripts/fetch-schema.mjs
#
# This is the schema the server actually answers with, not the published docs.
# The docs at ${DOCS_URL} lag it badly: they list 76
# queries and 63 mutations where live introspection reports 116 and 83, and
# they rename or re-type fields (their FieldType enum is CustomFieldType live;
# their TicketType enum is a plain String live). Everything the docs DO declare
# exists live, so the scrape fallback produces a strict subset — safe for
# validation, just incomplete.
#
# Deprecated fields are kept, with their @deprecated reasons: they are part of
# the live schema and the server still accepts them.
#
# Validated by src/domains/graphql-schema.test.ts against every GraphQL
# document in src/. Regenerate after a SuperOps API change.
`;
  writeFileSync(OUT, `${banner}\n${introspected}`);
  console.log(`Wrote ${OUT} from live introspection.`);
  process.exit(0);
}

console.log(
  "SUPEROPS_API_TOKEN/SUPEROPS_SUBDOMAIN not set — falling back to the published\n" +
    "docs, which lag the live API. Set them to generate an authoritative schema."
);

const res = await fetch(DOCS_URL);
if (!res.ok) throw new Error(`Failed to fetch ${DOCS_URL}: ${res.status} ${res.statusText}`);
const src = await res.text();

const parts = [];
const scalars = new Set();

const SECTION =
  /<section id="definition-(\w+)" class="definition definition-([a-z-]+)"([\s\S]*?)<\/section>/g;
for (const m of src.matchAll(SECTION)) {
  const [, name, kind, body] = m;
  if (kind === "scalar") {
    if (!BUILTIN.has(name)) scalars.add(name);
    continue;
  }
  if (kind === "enum") {
    const values = [...new Set([...fieldsScope(body).matchAll(ENUM_VALUE)].map((v) => v[1]))];
    if (values.length) parts.push(`enum ${name} {\n  ${values.join("\n  ")}\n}`);
    continue;
  }
  parts.push(
    block(kind === "input-object" ? "input" : "type", name, props(fieldsScope(body)))
  );
}

/**
 * Corrections applied to the SCRAPED schema only, for places where the
 * published docs are known to lag the live API. Each entry must have been
 * confirmed against a live tenant. The introspection path above needs none of
 * this — which is the reason to prefer it.
 */
const DOCS_CORRECTIONS = [
  {
    type: "RuleConditionInput",
    // The docs show only the flat attribute/operator/value form. Live
    // introspection also exposes joinOperator + operands, and a compound
    // {joinOperator:"or", operands:[...]} filter demonstrably works. Without
    // these, conformance testing would reject valid compound-filter queries.
    add: ["  joinOperator: String", "  operands: [RuleConditionInput!]"],
  },
];

/**
 * Types the docs declare that the live API does not have, mapped to the live
 * type that replaced each one. References are repointed and the docs-only
 * declaration is dropped, so an operation naming the stale type fails
 * conformance here exactly as the server would reject it.
 *
 * Both confirmed absent from live introspection on 2026-09-05. Note this is
 * the only shape of "phantom" the docs actually exhibit — every query and
 * mutation they declare does exist live, `createTicketNote` included.
 */
const DOCS_PHANTOM_TYPES = {
  // Renamed. The docs carry both, and their stale copy is also missing TOTP.
  FieldType: "CustomFieldType",
  // Never an enum live: Ticket.ticketType is a plain String.
  TicketType: "String",
};

function applyCorrections(blocks) {
  return blocks.map((block) => {
    const fix = DOCS_CORRECTIONS.find((c) =>
      block.startsWith(`input ${c.type} {`) || block.startsWith(`type ${c.type} {`)
    );
    if (!fix) return block;
    const lines = block.split("\n");
    const missing = fix.add.filter((line) => !block.includes(line.trim()));
    if (missing.length === 0) return block;
    lines.splice(lines.length - 1, 0, ...missing);
    return lines.join("\n");
  });
}

/** Drop docs-only type declarations and repoint every reference to them. */
function dropPhantomTypes(blocks) {
  const names = Object.keys(DOCS_PHANTOM_TYPES);
  const declares = (block, name) =>
    new RegExp(`^(?:type|input|enum) ${name} \\{`).test(block);

  return blocks
    .filter((block) => !names.some((name) => declares(block, name)))
    .map((block) =>
      names.reduce(
        // \b keeps CustomFieldType and the lowercase fieldType field intact.
        (acc, name) =>
          acc.replace(new RegExp(`\\b${name}\\b`, "g"), DOCS_PHANTOM_TYPES[name]),
        block
      )
    );
}

const queries = operations(src, "query");
const mutations = operations(src, "mutation");
parts.push(`type Query {\n${queries.join("\n")}\n}`);
if (mutations.length) parts.push(`type Mutation {\n${mutations.join("\n")}\n}`);

const header = `# SuperOps.ai GraphQL schema — GENERATED, do not edit by hand.
#
# Source: ${DOCS_URL}
# Regenerate with: node scripts/fetch-schema.mjs
#
# Scraped from the published API reference because no API credentials were
# available. The docs lag the live API — set SUPEROPS_API_TOKEN and
# SUPEROPS_SUBDOMAIN and re-run to generate from live introspection instead.
#
# This schema is a strict SUBSET of the live one: roughly a third of the real
# queries and mutations are missing, so an operation can validate here and
# still be one the docs simply never mentioned. Known docs bugs are patched on
# the way out (see DOCS_CORRECTIONS and DOCS_PHANTOM_TYPES in the script).
`;

const definitions = [
  ...[...scalars].sort().map((s) => `scalar ${s}`),
  ...dropPhantomTypes(applyCorrections(parts)),
];

const sdl = `${header}\n${definitions.join("\n\n")}\n`;

// Refuse to overwrite a working schema with a broken scrape. If SuperOps
// changes the docs markup, the selectors above can silently yield an empty or
// unparseable SDL — writing that would take every conformance test with it.
let parsed;
try {
  parsed = buildSchema(sdl);
} catch (cause) {
  throw new Error(
    `Generated SDL does not parse — the docs markup likely changed, so the ` +
      `selectors in this script need updating. ${OUT} was left untouched.`,
    { cause }
  );
}
if (!parsed.getQueryType()) {
  throw new Error(`Generated SDL has no Query type. ${OUT} was left untouched.`);
}
if (queries.length === 0 || definitions.length < 50) {
  throw new Error(
    `Generated SDL looks truncated (${definitions.length} definitions, ` +
      `${queries.length} queries). ${OUT} was left untouched.`
  );
}

writeFileSync(OUT, sdl);
console.log(
  `Wrote ${OUT}\n  scalars=${scalars.size} definitions=${definitions.length} ` +
    `queries=${queries.length} mutations=${mutations.length}`
);
