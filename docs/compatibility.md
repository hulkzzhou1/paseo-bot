# Compatibility evidence

Paseo Bot currently targets exactly Paseo **0.13.2**. The installed CLI, daemon, app, client SDK, protocol and plugin SDK were inspected at that version; this is not a claim about earlier versions or future releases. The first release guarantees desktop and compact mobile browsers. Native devices are not guaranteed, as explicitly accepted in specification decision 15.

| Capability | Supported public path in 0.13.2 | Evidence and limit |
| --- | --- | --- |
| Global page, sidebar, themes and compact layout | `@getpaseo/plugin/client`, React Native primitives | Plugin loads on an isolated daemon; browser evidence belongs in the ticket verification record. |
| Background directory workspace | `paseo.workspaces.create({ source: { kind: "directory", path }, background: true, idempotencyKey })` | Real isolated-daemon test creates one owned workspace without Git. |
| Conversation creation and durable identity | Workspace `agents.create`, explicit `agentId`, `idempotencyKey`, labels | Concurrent duplicate request returns one identity; actual timeline read through SDK succeeds. Plugin metadata stores references and request fingerprints, not transcripts. |
| Provider, model, modes and thinking choices | `paseo.providers.waitForReady`, provider/model catalog | Server validates actual available choices before creating resources. A thinking choice is required when the model offers choices. |
| Streaming and saved history | Agent `timeline.subscribe`, `timeline.refetch` | Fixture provider emits a streaming answer through a real daemon. The SDK explicitly requires history refetch after `subscription_restored` and replacement events; the page subscribes before its initial fetch and refetches on events. |
| Tool state/results | Public `AgentTimelineItem` tool-call union | Available transport; complete tool UI belongs to ticket #3. |
| Permission and provider questions | `pendingPermissions`, `respondToPermission({ requestId, response })` | The public request kind includes `question`; `updatedInput` supports provider-defined answers. Installed Codex maps known questions to header-keyed `updatedInput.answers`. Complete interaction requires ticket #3 runtime evidence. |
| Stop | Public CLI `paseo agent stop <exact-id> --home <selected-daemon-home> --json` | High-level Agent handle has no stop method. CLI help confirms this supported command; exit 0 is insufficient proof of stopped state. Ticket #3 must refresh status and activeTurn after the command. |
| Rename | Public CLI `paseo agent update <exact-id> --name <title> --home <selected-daemon-home> --json` | High-level Agent handle has no rename method. CLI help confirms this path; ticket #4 must verify the resulting title. |
| Schedules and delegation | Public CLI `schedule`, workspace/Agent creation and messaging SDK | Commands/interfaces exist; management behavior remains ticket #7 acceptance work. |
| Browser device preferences | Platform-gated `client/web.ts`, standard browser storage | No DOM globals in components, no DOM TypeScript lib, no private host imports. Storage denial is shown to the user. |
| Native durable device state | No public storage path found | Allowed modules omit AsyncStorage; global screens have no persisted tab state. Host settings are shared across devices and do not meet this boundary. Native persistence remains unsupported. |

The plugin's backend resolves files against the selected daemon's inherited `PASEO_HOME`, normally `~/.paseo`. Tests supply an isolated temporary daemon home, generated test password and loopback listener. Deployment `PASEO_*` environment overrides are removed from test child processes; existing Provider authentication and the user's home environment are preserved. Production lifecycle and configuration are untouched.

Public documentation consulted: [plugin reference](https://paseo.sh/docs/plugins/reference), [SDK events](https://paseo.sh/docs/sdk/events). Installed public declaration exports and CLI help were checked rather than assuming the sibling source checkout matches the installed release. Stop, rename and question interaction are available engineering paths, not runtime acceptance claims for this slice.
