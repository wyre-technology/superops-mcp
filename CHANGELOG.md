# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of SuperOps.ai MCP Server
- Decision tree architecture for tool navigation
- Lazy loading of domain modules
- Navigation tools: `superops_navigate`, `superops_back`, `superops_test_connection`
- Clients domain with list, get, and search tools
- Tickets domain with list, get, create, update, add_note, and log_time tools
- Assets domain with list, get, software, and patches tools
- Technicians domain with list, get, and groups tools
- Custom domain for advanced GraphQL queries and mutations
- Support for US and EU API regions
- Bearer token authentication
- Rate limit aware error handling
