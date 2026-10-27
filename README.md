# Paseo Bot

A standalone Paseo plugin that opens a dedicated host-local background workspace directly in Paseo's native interface. Native chat handles initial configuration, system preferences, first send and subsequent conversation interaction. The workspace header retains Bot history, rename/archive and existing conversations.

Version **0.3.1** allows Paseo **0.13.2 and later**, including newer betas. The native-workspace implementation was runtime-tested on 0.13.2; future API compatibility is not guaranteed. On the first workspace visit, choose **Agent** in the native New tab page. See [release status](docs/release.md), [OVERVIEW](OVERVIEW.md) and [compatibility](docs/compatibility.md) for verified and published revisions.

- [Specification](docs/spec.md) / [GitHub specification #1](https://github.com/hulkzzhou1/paseo-bot/issues/1)
- [Architecture decision](docs/adr/0001-bot-workspace.md) / [Glossary](docs/glossary.md)
- [GitHub issues](https://github.com/hulkzzhou1/paseo-bot/issues)
- Verification: [first conversation](docs/verification/issue-2.md), [execution](docs/verification/issue-3.md), [history/drafts](docs/verification/issue-4.md), [archive/rebuild](docs/verification/issue-5.md), [delivery/reconnect](docs/verification/issue-6.md), [management/release](docs/verification/issue-7.md)

The plugin source is separate from the ordinary daemon runtime directory `PASEO_HOME/bot`, normally `~/.paseo/bot`. Bot conversations share that directory's files and retain independent chat contexts; Paseo owns durable transcripts. Paseo owns new-conversation drafts, preferences and delivery. Old Bot-local drafts/preferences are not read or migrated. Native iOS/Android and Electron remain untested.

Management requires the selected Provider's existing host tools and daemon MCP injection policy. In 0.13.2, `daemon.mcp.injectIntoAgents` defaults to false; host setup must explicitly allow the intended supported management tools. The plugin never enables them or bypasses approvals. Available tools, models and modes depend on the configured Provider. Only Codex has actual Provider acceptance evidence; deterministic fixture tests supplement it. Do not treat shared Bot files as a security sandbox. Native chat uses the host’s normal sending policy.

The public Git manifest prepares exact locked production dependencies with `npm ci --omit=dev --ignore-scripts`; it does not require npm publication. The standalone read-only archived-workspace helper needs `@getpaseo/client` and `@getpaseo/server` installed at runtime. Other direct host libraries are development dependencies supplied by Paseo's plugin runtime. Select a reviewed fixed Git revision when installing; final release/tag and isolated exact-revision evidence will be linked from the management/release record. Production installation/configuration changes and production daemon restarts are outside this project's verification.

For development, run `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`. Tests start real temporary loopback daemons with test-owned resources and never operate the production daemon. Override `PASEO_TEST_CLI` when the tested CLI is outside PATH. Do not run the entire sibling Paseo monorepo test suite.

Original code: [MIT](LICENSE). Third-party attribution: [notices](THIRD_PARTY_NOTICES.md).
