# Paseo Bot

A standalone Paseo plugin for a persistent host-local management assistant. Its global page provides independent conversations, native-style tool/permission/question interactions, Stop, history, local drafts, archive/rebuild, cautious delivery recovery and real delegated-target navigation.

[Public Git v0.1.0](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.1.0) targets exactly Paseo **0.13.2** and passed fresh remote exact-revision installation. [Official registry application #1246](https://github.com/getpaseo/plugins/issues/1246) is open, but intake is blocked because the current account cannot add its required label; the plugin is **not listed yet**. See [release status](docs/release.md), [OVERVIEW](OVERVIEW.md) and [compatibility](docs/compatibility.md).

- [Specification](docs/spec.md) / [GitHub specification #1](https://github.com/hulkzzhou1/paseo-bot/issues/1)
- [Architecture decision](docs/adr/0001-bot-workspace.md) / [Glossary](docs/glossary.md)
- [GitHub issues](https://github.com/hulkzzhou1/paseo-bot/issues)
- Verification: [first conversation](docs/verification/issue-2.md), [execution](docs/verification/issue-3.md), [history/drafts](docs/verification/issue-4.md), [archive/rebuild](docs/verification/issue-5.md), [delivery/reconnect](docs/verification/issue-6.md), [management/release](docs/verification/issue-7.md)

The plugin source is separate from the ordinary daemon runtime directory `PASEO_HOME/bot`, normally `~/.paseo/bot`. Bot conversations share that directory's files and retain independent chat contexts; Paseo owns durable transcripts. Browser-local state is per device, host and conversation. The host may unmount the plugin surface while offline; reconnect/reopen restores saved state, without promising continuous offline editing. Native iOS/Android durable preferences/drafts are unsupported, and Electron is untested.

Management requires the selected Provider's existing host tools and daemon MCP injection policy. In 0.13.2, `daemon.mcp.injectIntoAgents` defaults to false; host setup must explicitly allow the intended supported management tools. The plugin never enables them or bypasses approvals. Available tools, models and modes depend on the configured Provider. Only Codex has actual Provider acceptance evidence; deterministic fixture tests supplement it. Do not treat shared Bot files as a security sandbox. Public SDK 0.13.2 cannot atomically reject a send if an outside client starts the same Agent between validation and dispatch.

The public Git manifest prepares exact locked production dependencies with `npm ci --omit=dev --ignore-scripts`; it does not require npm publication. The standalone read-only archived-workspace helper needs `@getpaseo/client` and `@getpaseo/server` installed at runtime. Other direct host libraries are development dependencies supplied by Paseo's plugin runtime. Select a reviewed fixed Git revision when installing; final release/tag and isolated exact-revision evidence will be linked from the management/release record. Production installation/configuration changes and production daemon restarts are outside this project's verification.

For development, run `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`. Tests start real temporary loopback daemons with test-owned resources and never operate the production daemon. Override `PASEO_TEST_CLI` when the tested CLI is outside PATH. Do not run the entire sibling Paseo monorepo test suite.

Original code: [MIT](LICENSE). Third-party attribution: [notices](THIRD_PARTY_NOTICES.md).
