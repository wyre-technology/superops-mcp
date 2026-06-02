## [Unreleased]

### Fixed

- **deploy:** authenticate GitHub Packages in one-click cloud builds. Added the
  `_authToken` line to `.npmrc`, a build-time `GITHUB_TOKEN` secret to the
  DigitalOcean app template, and `ARG GITHUB_TOKEN` + temporary authenticated
  `.npmrc` to the Dockerfile so `npm ci` can resolve `@wyre-technology/*`
  packages during Cloudflare/DigitalOcean deploys.

### Changed

- **release:** publish the package to GitHub Packages (`npmPublish: true` plus a
  `publishConfig` registry) so the `@wyre-technology/superops-mcp` package is
  available to install.

## [1.2.5](https://github.com/wyre-technology/superops-mcp/compare/v1.2.4...v1.2.5) (2026-04-07)


### Bug Fixes

* **ci:** deploy :latest tag, force revision via env var bump ([77b2448](https://github.com/wyre-technology/superops-mcp/commit/77b24487047acba1bafa64f1e8763ae18f93569c))

## [1.2.4](https://github.com/wyre-technology/superops-mcp/compare/v1.2.3...v1.2.4) (2026-03-31)


### Bug Fixes

* **deploy:** replace node_compat with nodejs_compat for Wrangler v4 ([5151468](https://github.com/wyre-technology/superops-mcp/commit/515146842d1c8802de6e4f4ed0446371c100a71e))

## [1.2.3](https://github.com/wyre-technology/superops-mcp/compare/v1.2.2...v1.2.3) (2026-03-10)


### Bug Fixes

* **ci:** strip scope prefix from MCPB bundle filename ([a036691](https://github.com/wyre-technology/superops-mcp/commit/a0366916f6b5c1696b26d6f17f131c5e60f55298))

## [1.2.2](https://github.com/wyre-technology/superops-mcp/compare/v1.2.1...v1.2.2) (2026-03-10)


### Bug Fixes

* **ci:** add npm ci before MCPB pack and grant contents:write to Docker job ([f692c4e](https://github.com/wyre-technology/superops-mcp/commit/f692c4e543e87fd4fdd96a197be72136bf467eda))

## [1.2.1](https://github.com/wyre-technology/superops-mcp/compare/v1.2.0...v1.2.1) (2026-03-10)


### Bug Fixes

* **ci:** rename pack-mcpb.js to .cjs to fix require() in ESM scope ([f743d68](https://github.com/wyre-technology/superops-mcp/commit/f743d6862e04f54931838f9120ff806c781bb913))

# [1.2.0](https://github.com/wyre-technology/superops-mcp/compare/v1.1.3...v1.2.0) (2026-03-10)


### Features

* **elicitation:** add MCP elicitation support with graceful fallback ([#1](https://github.com/wyre-technology/superops-mcp/issues/1)) ([ceb51d9](https://github.com/wyre-technology/superops-mcp/commit/ceb51d91f1509e7022bfda1f119c60131d7baf0b))

## [1.1.3](https://github.com/wyre-technology/superops-mcp/compare/v1.1.2...v1.1.3) (2026-03-02)


### Bug Fixes

* **ci:** fix broken YAML in Discord notification step ([ccfb0f0](https://github.com/wyre-technology/superops-mcp/commit/ccfb0f0969266d8b64f2bc8598d725904408f5d9))

## [1.1.2](https://github.com/wyre-technology/superops-mcp/compare/v1.1.1...v1.1.2) (2026-02-26)


### Bug Fixes

* **ci:** move Discord notification into release workflow ([8193c5f](https://github.com/wyre-technology/superops-mcp/commit/8193c5f8e46ca27edde1fb3342ed18d23dd2f708))

## [1.1.1](https://github.com/wyre-technology/superops-mcp/compare/v1.1.0...v1.1.1) (2026-02-23)


### Bug Fixes

* quote MCPB bundle filename to prevent shell glob expansion failure ([7d0845c](https://github.com/wyre-technology/superops-mcp/commit/7d0845c4cad3a4d723ac72c49bf7e87b39b21ed6))
* rename duplicate step id 'version' to 'release-version' in docker job ([e8b035b](https://github.com/wyre-technology/superops-mcp/commit/e8b035b9d8f3a1a1b0dca1d096993563686b1d65))

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
