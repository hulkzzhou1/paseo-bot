# Paseo Bot

A Paseo plugin for a persistent host-local management assistant. The Bot page offers independent conversations in a dedicated background workspace, with New conversation and History controls.

Status: implementation in progress against Paseo 0.13.2. The first slice provides the global Bot page, explicit configuration and durable daemon-owned conversations. The delivery target is a public Git release and submission to the Paseo community plugin registry; no registry listing exists yet.

- [Specification](docs/spec.md) / [GitHub specification #1](https://github.com/hulkzzhou1/paseo-bot/issues/1)
- [Architecture decision](docs/adr/0001-bot-workspace.md)
- [Glossary](docs/glossary.md)
- [GitHub issues](https://github.com/hulkzzhou1/paseo-bot/issues)

The source checkout is separate from the runtime working directory `~/.paseo/bot/` on the daemon host. The runtime directory contains shared task files; Paseo owns conversation history.

Development checks: `npm ci --include=dev`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`. The focused daemon tests start their own temporary loopback daemon and never use the production daemon. Override `PASEO_TEST_CLI` when the tested CLI is outside `PATH`.

The first release guarantees desktop and compact mobile browsers. Native device-local persistence is unavailable through the supported 0.13.2 plugin SDK and is not guaranteed. See [verification](docs/verification/issue-2.md) for actual evidence and remaining checks.
