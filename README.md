# Paseo Bot

A Paseo plugin for a persistent host-local management assistant. The Bot page offers independent conversations in a dedicated background workspace, with New conversation and History controls.

Status: specification and implementation tickets; no plugin implementation yet. The delivery target is a public Git release and submission to the Paseo community plugin registry; no registry listing exists yet.

- [Specification](docs/spec.md) / [GitHub specification #1](https://github.com/hulkzzhou1/paseo-bot/issues/1)
- [Architecture decision](docs/adr/0001-bot-workspace.md)
- [Glossary](docs/glossary.md)
- [GitHub issues](https://github.com/hulkzzhou1/paseo-bot/issues)

The source checkout is separate from the runtime working directory `~/.paseo/bot/` on the daemon host. The runtime directory contains shared task files; Paseo owns conversation history.
