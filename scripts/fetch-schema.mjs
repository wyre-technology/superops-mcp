#!/usr/bin/env node
/**
 * Regenerate schema/superops.graphql from SuperOps' published API reference.
 *
 * SuperOps does not expose GraphQL introspection on the public endpoint, but
 * https://developer.superops.com/msp is a SpectaQL-style static site that
 * embeds the entire schema as HTML tables. We scrape it back into SDL so that
 * `npm test` can validate every query this server sends without needing live
 * API credentials.
 *
 * Run after a SuperOps API change:  node scripts/fetch-schema.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildSchema } from "graphql";

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

const queries = operations(src, "query");
const mutations = operations(src, "mutation");
parts.push(`type Query {\n${queries.join("\n")}\n}`);
if (mutations.length) parts.push(`type Mutation {\n${mutations.join("\n")}\n}`);

const header = `# SuperOps.ai GraphQL schema — GENERATED, do not edit by hand.
#
# Source: ${DOCS_URL}
# Regenerate with: node scripts/fetch-schema.mjs
#
# SuperOps does not expose introspection publicly, so this is scraped from the
# published API reference. It exists so the test suite can validate every query
# this server sends offline, without live credentials.
`;

const sdl =
  header +
  "\n" +
  [...[...scalars].sort().map((s) => `scalar ${s}`), ...parts].join("\n\n") +
  "\n";

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
if (queries.length === 0 || parts.length < 50) {
  throw new Error(
    `Generated SDL looks truncated (${parts.length} definitions, ` +
      `${queries.length} queries). ${OUT} was left untouched.`
  );
}

writeFileSync(OUT, sdl);
console.log(
  `Wrote ${OUT}\n  scalars=${scalars.size} definitions=${parts.length} queries=${queries.length} mutations=${mutations.length}`
);
