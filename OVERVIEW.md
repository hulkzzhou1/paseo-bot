# Paseo Bot

Paseo Bot adds a global management conversation launcher for one connected daemon host. Start independent conversations, switch through persistent history, and ask your chosen Provider to inspect and manage Paseo work or perform an explicitly assigned ordinary task.

Each Bot conversation is a normal durable Paseo Agent in a dedicated background workspace. Selecting Paseo Bot opens that workspace directly. On its first visit, choose Agent in the native New tab page. Native chat owns initial configuration and first send; no Agent is created merely by opening the workspace. The host provides model controls, streamed Markdown, grouped tool calls, permission requests, questions, Stop and running feedback. Use the native new-tab controls for another conversation and the Bot history button in the workspace header for the existing Bot history list.

## Setup and compatibility

Requires Paseo **0.13.2 or later**, with the Paseo CLI available on the daemon's PATH. Newer releases, including beta versions, are allowed to load. Runtime acceptance was performed on 0.13.2; newer releases may introduce API changes and have not all been tested. Paseo selects and remembers creation configuration using its own native preferences and profiles; existing conversations retain their own configuration. Codex is the real Provider exercised by the acceptance record. Other Providers depend on their public Paseo adapters and have not been independently accepted.

Management capabilities depend on the selected Provider's available Paseo tools and the daemon's MCP injection/tool policy. In 0.13.2, `daemon.mcp.injectIntoAgents` defaults to false; a host administrator must explicitly configure supported MCP injection and permitted tools when management is desired. The plugin does not enable disabled tools, change daemon configuration or bypass normal permissions. If management tools are unavailable, the Bot should explain the missing capability. Review your existing Paseo MCP settings when you intend to allow management; injection is not enabled by this plugin.

Desktop and compact mobile browsers are the release target. Drafts and preferences now use native chat storage. Native iOS/Android apps and Electron are untested. See the repository's compatibility and verification records for the actual acceptance evidence.

## Conversations and delegated work

The plugin no longer provides an initial configuration form or first-message editor. All chat creation, drafts, model selection, sending, reconnect handling and message actions belong to Paseo. Old Bot-local drafts and preferences are not migrated or read.

Bot History retains previously registered conversations and includes non-internal root Agents in the dedicated workspace generations opened through the native Bot entrance. It excludes delegated children and business workspace sessions. It reads the daemon each time, including after a plugin restart, without copying transcripts or requiring an agent-created notification to arrive.

Rename conversations, archive them after execution is confirmed stopped, and open archived history using the host’s native behavior. Archiving the Bot workspace requires an explicit manual rebuild before further Bot work. Rebuild creates a new workspace identity while preserving old history and shared files.

Management stays on the current host and requires actual targets. The Bot is instructed to clarify ambiguous requests and create business work in a normal visible workspace, with ordinary parent/child completion notifications. Delegation and completion appear in the native conversation and its normal navigation. Delegated Agents do not appear in Bot History. These instructions do not replace Provider permissions or guarantee enforcement by every external tool transport.

## Data and permissions

The daemon's ordinary `PASEO_HOME/bot` directory, normally `~/.paseo/bot`, holds shared task files. It is separate from the installed plugin source. All Bot conversations on that host share files; the directory is not a filesystem sandbox and concurrent edits can conflict. Paseo stores durable transcripts. Plugin data stores workspace generations, owned conversation references and delivery fingerprints; it does not maintain a second transcript. Legacy delivery metadata is retained for compatibility; new native sessions use the host’s own storage and delivery behavior.

Conversation prompts, tool inputs/results and files accessed by authorized tools can be sent to the selected external Provider under its own data policy. Local history does not imply that conversation data stays on the daemon. This is a trusted plugin running with the daemon user's privileges. Stop and rename use the supported local CLI with the exact selected daemon home; archived-workspace inspection uses a read-only public SDK helper and local daemon authentication without exposing credentials. The plugin does not download software at runtime.

Native sessions in the dedicated Bot directory receive the management guidance alongside existing profile instructions. This directory-scoped context does not grant history ownership or change model, mode, tools or approval settings.
