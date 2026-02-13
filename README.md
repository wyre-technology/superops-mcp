# SuperOps.ai MCP Server

MCP server for Claude that provides tools to interact with the SuperOps.ai PSA/RMM platform using their GraphQL API.

## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/wyre-technology/superops-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyre-technology/superops-mcp)

## Features

- **Decision Tree Architecture**: Navigate to domains (clients, tickets, assets, technicians) to see relevant tools
- **Lazy Loading**: Domain modules load on-demand for faster startup
- **Full CRUD Operations**: List, get, create, and update entities
- **GraphQL Support**: Use custom queries for advanced operations

## Installation

```bash
npm install @wyre-technology/superops-mcp
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
      "args": ["@wyre-technology/superops-mcp"],
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
- `superops_clients_search` - Search clients by name/domain

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

## License

Apache-2.0

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/wyre-technology/superops-mcp/issues).
