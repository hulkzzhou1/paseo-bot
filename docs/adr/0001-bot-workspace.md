# Paseo Bot uses a dedicated workspace behind a plugin page

Accepted for the standalone Paseo Bot plugin. The workspace ownership decision remains current. The original interaction decisions below are historical: [specification decision 17](../spec.md) supersedes custom chat, remembered conversation selection, per-conversation drafts, busy-send restrictions, and archived read-only guarantees in v0.2.0. Decision 18 also supersedes the custom initial page: Bot opens its native workspace, with native creation/preferences and the retained Bot history list. The original decisions below remain historical.

Paseo Bot will use a global plugin page and a dedicated directory-backed background workspace at `~/.paseo/bot/` on its daemon host. Each conversation is an independent Agent session in that workspace. This accepts the existing project/workspace ownership model so the plugin can reuse session persistence, recovery, and management tools without adding a workspace-free agent type to core. The daemon may create the directory's project record automatically.

The page has New conversation and History controls in its own toolbar. It has no floating entry point. The initial version manages only its own host; each host has separate conversations and history. The Bot can coordinate work and execute explicitly requested ordinary tasks through authorized tools.

New conversations allow provider, model, thinking, and mode selection, remembering the previous selection. The first selection is explicit, existing conversations keep their own configuration, and approval bypass is not enabled by default. Initial chat scope includes text and Markdown, streaming, tool execution status, permission requests, provider questions, and Stop. Attachments, voice, and conversation search are deferred.

New conversation opens a blank draft; the Agent session is created only on first send. Repeated New conversation actions do not create empty sessions. History lists unarchived Bot conversations by recent activity, including running sessions, and supports rename, archive, and viewing archived records. There is no permanent deletion in the initial version; a running session must be stopped before archive.

Multiple conversations may run concurrently. Switching conversations or leaving the page does not stop them; history shows running and pending-confirmation states. Stop targets only the current conversation. Each device remembers its own last-selected conversation per host, while session history is shared. An invalid remembered selection opens a blank draft.

Conversations share the workspace's files; separate chat context does not provide filesystem isolation. Concurrent writes to the same file are not automatically isolated. During a running turn, the user can edit a draft but must wait for completion or stop the turn before sending. The initial version has no prompt queue or steering.

Failures preserve drafts and expose retry. After ambiguous delivery or disconnection, reconcile history and execution state before offering another submission; do not automatically repeat potentially executed work. Reconnection restores observation rather than redoing tasks. If the Bot workspace is archived elsewhere, explain its state and create a replacement only after the user explicitly requests it. Preserve old history for viewing; do not automatically restore archived resources or clean up history.

Keep unsent text on the current device, separately for each host and conversation, plus one new-conversation draft per host. Switching conversations, selecting New conversation, or closing the page preserves drafts; successful send clears the submitted draft. Drafts do not sync between devices.

Archived conversations are read-only. Continuing their work requires a new conversation with context explicitly supplied by the user; the initial version has no unarchive, automatic context copying, or permanent deletion.

Bot history contains only conversations created through the Bot page. Delegated agents stay in their target business workspaces, with navigation links from the Bot conversation. New business workspaces are ordinarily visible; only the Bot workspace is background. Clarify ambiguous targets rather than infer them from the page being viewed.

Implementation and validation evidence are tracked in the specification and verification records.
