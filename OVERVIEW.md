# Paseo Bot

Paseo Bot adds a global management conversation page for one connected daemon host. Start independent conversations, switch through persistent history, and ask your chosen Provider to inspect and manage Paseo work or perform an explicitly assigned ordinary task.

Each Bot conversation is a normal durable Paseo Agent in a dedicated background workspace. The page shows streamed Markdown, tool calls and results, permission requests, Provider questions and Stop. Running conversations continue when you switch or leave the page. New conversation and History controls remain available in desktop and compact layouts.

## Setup and compatibility

The supported version is exactly Paseo app, daemon and SDK **0.13.2**, with the Paseo CLI available on the daemon's PATH. Select an available Provider, model, thinking option and permission mode before the first message; existing conversations retain their own configuration. Codex is the real Provider exercised by the acceptance record. Other Providers depend on their public Paseo adapters and have not been independently accepted.

Management capabilities depend on the selected Provider's available Paseo tools and the daemon's MCP injection/tool policy. In 0.13.2, `daemon.mcp.injectIntoAgents` defaults to false; a host administrator must explicitly configure supported MCP injection and permitted tools when management is desired. The plugin does not enable disabled tools, change daemon configuration or bypass normal permissions. If management tools are unavailable, the Bot should explain the missing capability. Review your existing Paseo MCP settings when you intend to allow management; injection is not enabled by this plugin.

Desktop and compact mobile browsers are the release target. Native iOS/Android durable drafts and preferences are unsupported by the public 0.13.2 global-screen API; native apps and Electron are untested. See the repository's compatibility and verification records for the actual acceptance evidence.

## Conversations and delegated work

Device-local browser storage keeps each host's last selection, new-conversation configuration, per-conversation drafts and pending delivery identity. Send is disabled while the selected conversation runs or awaits a response; you may continue editing a draft. An unknown send is checked against durable history before an explicit retry. Reconnection restores history and state without automatically repeating a task. The host may temporarily remove the plugin page during disconnection, so continuous offline editing is not guaranteed; reopening or reconnecting restores saved browser state.

Rename conversations, archive them after execution is confirmed stopped, and read archived history. Archiving the Bot workspace requires an explicit manual rebuild before further Bot work. Rebuild creates a new workspace identity while preserving old history and shared files.

Management stays on the current host and requires actual targets. The Bot is instructed to clarify ambiguous requests and create business work in a normal visible workspace, with ordinary parent/child completion notifications. Related Agents appear under Delegated work with public Agent/workspace navigation, validated against their real parent relationship or a successful structured same-host Paseo send receipt. Existing recipients retain their original parent. Delegated Agents do not appear in Bot History. These instructions do not replace Provider permissions or guarantee enforcement by every external tool transport.

## Data and permissions

The daemon's ordinary `PASEO_HOME/bot` directory, normally `~/.paseo/bot`, holds shared task files. It is separate from the installed plugin source. All Bot conversations on that host share files; the directory is not a filesystem sandbox and concurrent edits can conflict. Paseo stores durable transcripts. Plugin data stores workspace generations, owned conversation references and delivery fingerprints; it does not maintain a second transcript. Browser drafts, selection, preferences and pending sends stay in that browser profile and are not synchronized across devices.

Conversation prompts, tool inputs/results and files accessed by authorized tools can be sent to the selected external Provider under its own data policy. Local history does not imply that conversation data stays on the daemon. This is a trusted plugin running with the daemon user's privileges. Stop and rename use the supported local CLI with the exact selected daemon home; archived-workspace inspection uses a read-only public SDK helper and local daemon authentication without exposing credentials. The plugin does not download software at runtime.

Paseo 0.13.2 has no atomic reject-if-busy send operation. The plugin serializes its own submissions and checks current state; another client starting the same Agent between that check and dispatch remains a public API race. Avoid competing senders for the same Bot conversation.
