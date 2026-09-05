# SuperOps.ai MCP Server

MCP server for Claude that provides tools to interact with the SuperOps.ai PSA/RMM platform using their GraphQL API.

## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/WYRE-AI/superops-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WYRE-AI/superops-mcp)

> **Operator note — GitHub Packages authentication.** This package is published
> to the `@wyre-ai` scope on **GitHub Packages**, which requires an
> authentication token on every install (GitHub Packages has no anonymous reads,
> even for public packages). Create a GitHub **Personal Access Token** with the
> `read:packages` scope and supply it to the cloud builder:
>
> - **Cloudflare Workers** — set a build variable named `NODE_AUTH_TOKEN` to your PAT.
> - **DigitalOcean App Platform** — set a **build-time** secret named `GITHUB_TOKEN` to your PAT.
>
> For local installs, run `export NODE_AUTH_TOKEN=$(gh auth token)` before `npm install`.

## Features

- **Decision Tree Architecture**: Navigate to domains (clients, tickets, assets, technicians) to see relevant tools
- **Lazy Loading**: Domain modules load on-demand for faster startup
- **Full CRUD Operations**: List, get, create, and update entities
- **GraphQL Support**: Use custom queries for advanced operations
- **Interactive Ticket Card (MCP Apps)**: ticket results render as an interactive card in MCP Apps hosts — neutral by default, brandable via `window.__BRAND__` injection or `MCP_BRAND_*` env vars

### Interactive Ticket Card (MCP Apps)

`superops_tickets_get` renders as an interactive card in MCP Apps hosts
(Claude Desktop/web) with an in-card "Add note" round-trip via
`superops_tickets_add_note` that always posts internal-only notes
(`isPublic: false`); plain-JSON behavior is unchanged in other hosts.
The card is neutral by default and brandable via `window.__BRAND__` injection
or `MCP_BRAND_*` env vars (`MCP_BRAND_NAME`, `MCP_BRAND_LOGO_URL`,
`MCP_BRAND_PRIMARY_COLOR`, `MCP_BRAND_ACCENT_COLOR`, `MCP_BRAND_BG`,
`MCP_BRAND_TEXT`) — no rebuild needed.

## Installation

```bash
# The @wyre-ai scope lives on GitHub Packages and needs a token to install:
export NODE_AUTH_TOKEN=$(gh auth token)
npm install @wyre-ai/superops-mcp
```

## Configuration

Set the following environment variables:

```bash
export SUPEROPS_API_TOKEN="your-api-token"
export SUPEROPS_SUBDOMAIN="yourcompany"
export SUPEROPS_REGION="us"  # or "eu" for EU region
```

### Getting Your API Token

1. Log in to SuperOps.ai
2. Click settings icon > "My Profile"
3. Navigate to "API token" tab
4. Click "Generate token"
5. Copy and securely store the token

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "superops": {
      "command": "npx",
      "args": ["@wyre-ai/superops-mcp"],
      "env": {
        "SUPEROPS_API_TOKEN": "your-api-token",
        "SUPEROPS_SUBDOMAIN": "yourcompany",
        "SUPEROPS_REGION": "us"
      }
    }
  }
}
```

## Available Domains & Tools

### Navigation

- `superops_navigate` - Navigate to a domain
- `superops_back` - Return to main menu
- `superops_test_connection` - Test API connectivity

### Clients Domain

- `superops_clients_list` - List clients with filters
- `superops_clients_get` - Get client details
- `superops_clients_search` - Search clients by name

### Tickets Domain

- `superops_tickets_list` - List tickets with filters
- `superops_tickets_get` - Get ticket details
- `superops_tickets_create` - Create a new ticket
- `superops_tickets_update` - Update ticket status/assignment
- `superops_tickets_add_note` - Add note to ticket
- `superops_tickets_log_time` - Log time on ticket

### Assets Domain

- `superops_assets_list` - List assets/endpoints
- `superops_assets_get` - Get asset details
- `superops_assets_software` - Get software inventory
- `superops_assets_patches` - Get patch status

### Technicians Domain

- `superops_technicians_list` - List technicians
- `superops_technicians_get` - Get technician details
- `superops_technicians_groups` - List technician groups

### Custom Domain

- `superops_custom_query` - Run custom GraphQL query
- `superops_custom_mutation` - Run custom GraphQL mutation

## Example Usage

```
User: What tools are available?
Claude: Use superops_navigate to select a domain...

User: Navigate to tickets
Claude: [calls superops_navigate with domain: "tickets"]
Now in tickets domain. Available tools: superops_tickets_list, superops_tickets_get...

User: Show open high priority tickets
Claude: [calls superops_tickets_list with status: ["Open"], priority: ["High"]]
Here are the open high priority tickets...
```

## Rate Limits

SuperOps.ai API has a rate limit of 800 requests per minute per API token.

## Pagination

SuperOps uses page-based pagination, not cursors. List tools take `page`
(1-indexed, default 1) and `pageSize` (default 50, max 100), and return a
`listInfo` block with `page`, `pageSize`, `totalCount` and `hasMore`.

**`hasMore` is tri-state:** `true` when another page exists, `null` — never
`false` — when it does not. Loop on `hasMore === true`, or page off
`totalCount`; looping until `hasMore === false` never terminates.

## Filtering

Filters are `condition` clauses of `{ attribute, operator, value }`, and they
compose — `{ joinOperator: "and" | "or", operands: [ … ] }` nests recursively.
Operators verified against a live tenant:

| Operator | Value |
|---|---|
| `is`, `isNot`, `contains`, `notContains`, `startsWith`, `endsWith` | string |
| `includes`, `notIncludes` | array |

`equals` and `in` are rejected by the API. `includes` matches a value *whole*
while `contains` matches a substring — filtering an OS platform with
`includes: ["Windows"]` matches nothing, because SuperOps stores
`"Microsoft Windows 10 Pro"`.

Two things to know, because neither reports an error:

- Filtering on a value outside a field's real set returns **zero rows, not an
  error**. An empty result may mean a bad value, not an empty tenant.
- Filtering on a JSON column (`software`) rather than a path into it
  (`software.name`) also returns **zero rows silently**.

Use `superops_custom_query` for filter semantics the standard tools don't
express.

## Schema conformance

`schema/superops.graphql` is a vendored copy of the SuperOps GraphQL schema:

```bash
# Authoritative — generated from live introspection
SUPEROPS_API_TOKEN=... SUPEROPS_SUBDOMAIN=... node scripts/fetch-schema.mjs

# No credentials? Falls back to scraping the published API reference
node scripts/fetch-schema.mjs
```

Prefer introspection, and note the committed schema is already the introspected
one. The published docs declare 276 types / 76 queries / 63 mutations where the
live API reports **404 / 116 / 83**, omit deprecations entirely, and declare two
types that do not exist live (`FieldType`, `TicketType`) — validating against
those would pass documents the API rejects.

`src/domains/graphql-schema.test.ts` validates every GraphQL document in `src/`
against it on each `npm test`, so a query referencing a field SuperOps does not
define fails in CI rather than at runtime. Regenerate the schema after a
SuperOps API change and re-run the tests.

## License

Apache-2.0

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/WYRE-AI/superops-mcp/issues).
