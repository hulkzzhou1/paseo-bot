# Paseo Bot

Read [the specification](docs/spec.md) before implementation and the assigned GitHub ticket before each slice. [The glossary](docs/glossary.md) owns terminology; [the ADR](docs/adr/0001-bot-workspace.md) owns the architectural trade-off.

Track work in `hulkzzhou1/paseo-bot`; use explicit `--repo hulkzzhou1/paseo-bot`. See [tracker conventions](docs/agents/issue-tracker.md).

Build a standalone Paseo plugin using supported public SDK exports. Classify code as client, server, or shared; preserve the plugin runtime import boundaries. Verify public API availability and actual app/daemon versions before claiming compatibility. Missing APIs are engineering blockers, not permission to import private app modules or silently drop required behavior.

Use React Native primitives, host theme tokens, and compact-layout support. Keep backend operations on the selected daemon host. Release subscriptions on teardown and reconcile after reconnect. Reuse Paseo's durable sessions rather than maintain duplicate transcripts.

Use test-driven vertical slices and real isolated daemon/browser boundaries. Add package scripts for typecheck, lint, format, and focused tests when executable code is introduced; run the applicable checks for every implementation change. Do not run the entire Paseo monorepo test suite. Record commands, exit codes, revision, screenshots, and untested platforms.

The sibling Paseo source checkout at `../paseo` is a reference, not this project's write target. Preserve its existing uncommitted changes. Never restart the production daemon, change production config, install/reload the plugin into production, merge, or publish unrelated releases. The user authorized eventual Paseo Bot community publication after implementation and verification; follow the final ticket and report registry review separately from publication.
