# [1.1.0](https://github.com/wyre-technology/superops-mcp/compare/v1.0.0...v1.1.0) (2026-02-18)


### Bug Fixes

* **ci:** fix release workflow failures ([c8fa4b8](https://github.com/wyre-technology/superops-mcp/commit/c8fa4b8f5a2166c819b490315c4d378ef81f74be))
* **docker:** drop arm64 platform to fix QEMU build failures ([5a2f713](https://github.com/wyre-technology/superops-mcp/commit/5a2f7137e74d8640124cd6c3104e8c61e60ed010))
* escape newlines in .releaserc.json message template ([cfeb0e8](https://github.com/wyre-technology/superops-mcp/commit/cfeb0e80070b17b39129d988accb2dd98baa8fa5))
* update Node.js to 22 for semantic-release compatibility ([654083a](https://github.com/wyre-technology/superops-mcp/commit/654083a7a57c243ad68928c27f8335c0d263781e))
* update Node.js to 22 in ci.yml release job ([2218c24](https://github.com/wyre-technology/superops-mcp/commit/2218c248ffde3a4cb513d38ffe727007985ad13f))


### Features

* add MCPB manifest for desktop installation ([ecbc3c2](https://github.com/wyre-technology/superops-mcp/commit/ecbc3c26f244cf51841f2e16e68512dfea1836db))
* add MCPB pack script ([209a183](https://github.com/wyre-technology/superops-mcp/commit/209a1832760edb1cc9c1099c16528221318fea3f))
* add mcpb packaging support ([4823ed4](https://github.com/wyre-technology/superops-mcp/commit/4823ed41f7bf774955069d09b5fbec5894b4fcaf))
* add mcpb packaging support ([830bb96](https://github.com/wyre-technology/superops-mcp/commit/830bb968bc6afa1a05ca056997cc66123541c854))
* add mcpb packaging support ([08ed8f2](https://github.com/wyre-technology/superops-mcp/commit/08ed8f2feda0de6f4debcab49ae85a95505df139))
* add mcpb packaging support ([5b74455](https://github.com/wyre-technology/superops-mcp/commit/5b74455e1196b5def987eae34561645bddf544a4))
* add mcpb packaging support ([15f7488](https://github.com/wyre-technology/superops-mcp/commit/15f7488437a3a7bc046c4c91d80e32fd6931608f))

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
