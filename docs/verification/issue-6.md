# Delivery recovery and complete observation (#6)

Base: integration `c6240c5`; implementation branch `implement/issue-6`. App, daemon and public SDK baseline: 0.13.2. Browser-first scope follows specification decision 15. No production daemon/configuration or sibling checkout changes.

## Durable delivery boundary

Every first/subsequent message has a browser-generated UUID persisted before dispatch in device-local storage, scoped to host, installation and exact conversation/new slot. Its original payload and submitted draft revision remain available after navigation/reload. The selected daemon records request identity, payload hash and outcome in `<daemon-home>/plugin-data/paseo-bot/deliveries.json` (private directory/file modes). This journal stores no duplicate transcript; Paseo owns session history. Browser storage holds the pending payload alongside its drafts until delivery is resolved.

`submit-delivery` and `reconcile-delivery` return accepted, definitely failed, unknown, or ready for an explicit original-message retry. The plugin serializes submissions and records unknown before dispatch. Reusing a UUID with different content is rejected. Reusing a dispatched UUID verifies the same operation rather than sending again. A fresh result or an exact `user_message.clientMessageId` proves acceptance; history is paged to its beginning when needed. An unknown marker without proof remains unknown and is never automatically replayed. A request with no server journal can be retried deliberately with its original identity, protecting a delayed original request from duplicate execution.

Subsequent sends validate exact installation/workspace ownership, mutable state, actual idle status, absence of pending requests and the existing Provider catalog before using the public `send(text, { messageId })` option. This does not introduce queue or steer semantics. Public SDK/CLI 0.13.2 has only interrupt/steer active-turn behavior, with no atomic reject-if-busy operation: an external actor starting the same Agent between the fresh check and dispatch is a documented public API race. Plugin submissions themselves are serialized.

The plugin preserves editable drafts while unresolved, blocks normal Send, and offers Check delivery. The plugin has an offline guard, but actual 0.13.2 host behavior can unmount the entire disconnected plugin surface: editing is unavailable until the host remounts it, while the last device-saved draft is retained. Only a verified absent server journal offers Retry original message. No reconnect handler resends tasks or answers/denies requests. Late host visits and unmounted pages cannot apply old callbacks. Draft cleanup compares submitted revisions and repeated creation reconciliation cannot overwrite an already promoted follow-up draft. Failed local cleanup blocks another send until storage is restored and checked.

## Observation boundary

Observation waits for the public subscription readiness signal, reads every older timeline page, deduplicates sequence identities, and refreshes the Agent snapshot. Subscription restoration refills missed history. Replacement invalidates the previous epoch immediately; pages or callbacks from that generation cannot publish. Repeated unstable history returns an actionable retry rather than mixing epochs. Teardown releases both subscriptions and ignores late history responses. Selected-host status uses the public `useHosts` hook. User-facing errors prefer the public `userMessage`, omitting request-type/code transport suffixes.

## Red/green and fault injection

- Initial delivery test failed because `submit-delivery` did not exist (exit 1), then passed against a real isolated daemon. First/subsequent results are discarded at the caller, reconciled and submitted again under the same identity. After a plugin reload, the daemon still has one Agent, exactly two user messages and the actual fixture Provider reports `Execution count: 2`.
- A fixture response emits 220 distinct tool rows. The latest 200-entry page reports older history. A fault arrangement in the isolated temporary journal simulates a crash after dispatch but before recording acknowledgement; reconciliation finds the first user message across older pages. Another durable unknown marker simulates the crash-before-dispatch interval: repeated submission stays unknown, creates no second Agent, and Provider count stays 1. Only test-owned temporary metadata is modified for this injection.
- Definite invalid-model creation fails without creating an Agent. Sending to a running owned Agent fails before dispatch and leaves its timeline with one user message.
- A public observation-contract regression first failed because older pages were never requested. It now delays an old page, delivers replacement, and confirms no obsolete epoch reaches the view; a subscription-restored event then refills the new snapshot. A released subscription still requires a fresh observation, and teardown suppresses late responses.
- Device tests first failed on the missing outbox operation, then passed persistence/recreation/revision checks. Repeated accepted-creation cleanup initially erased a newer follow-up draft (exit 1); it now preserves it (exit 0).

## Commands and remaining acceptance

From the issue-6 worktree:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Client/server/shared/test contracts |
| `npm run lint` | 0 | No warnings/errors |
| `npm run format:check` | 0 | Formatting matches |
| `git diff --check` | 0 | No whitespace errors |
| `npm test` | 0 | 19/19, including real isolated daemon cases |

Focused commands: `node --import tsx --test tests/delivery.test.ts`, `tests/observation.test.ts`, and `tests/device-state.test.ts`.

Root owns final browser fault injection, desktop/mobile screenshots, actual Provider recovery and independent Standards/Spec review. A fresh test-only daemon/source is available for that acceptance; its password is confined to a private temporary context file and is not published. Native iOS/Android and Electron remain untested. Community publication belongs to the final ticket.

## Independent review corrections

Standards review identified a first-send cleanup ordering error. Root reproduced it on `b83f265` by holding the real accepted response, typing `STORAGE_NEWER_EDIT`, failing only the browser selection write, then forwarding the response. The Agent executed once and newer text survived, but a retained original-slot outbox became unreachable after selection moved; Send remained enabled (browser assertion exit 1). Cleanup now commits draft promotion and original-slot outbox removal before changing selection. Selection/config preference errors after that commit remain visible without concealing an unresolved delivery. A real outbox cleanup failure leaves the original slot and Check delivery reachable; the existing repeated-promotion guard retains its follow-up draft for reload/reconciliation.

Spec review identified that a failed initial bootstrap/catalog operation on a stable connection left the composer disabled with no retry. Retry Bot initialization now explicitly repeats read-only bootstrap/discovery and restores device selection, drafts and pending delivery. It does not resend tasks. A simple network interruption in root's browser recovered automatically through the host facade, so that network case is not recorded as a failing regression. Stable-connection operation-error injection and the final cleanup browser replay are root-owned acceptance evidence.

The integration tip advanced to `e4f4716` while these corrections were being committed (`8b59d1b`). The issue-6 branch then merged that reviewed lifecycle slice, preserving archive/workspace read-only guards alongside offline/delivery guards, both RPC groups, lifecycle hooks and the public recovery helper. Retry original message and permission/Stop controls retain the same workspace mutation restrictions. The combined fixture now replays its public persistence history. After resolving the integration conflicts, `npm test` passed **22/22** (exit 0), including the three lifecycle cases; typecheck, lint, format and whitespace checks and `node --check server/recovery-probe.mjs` also passed.

## Root fault acceptance and final reviews

Reviewed implementation `c644c30` (delivery fixes `8b59d1b`), integration merge `898b91431c170d7a4af174fe1e6e3a960b3e0d5b`. Independent Standards and Spec re-reviews: **0 findings each**, including prior P2 fixes and merged archive/workspace guards. Focused reviewer tests: 9/9 exit 0; combined implementation checks: 22/22 plus all checks above exit 0.

Primary visual acceptance uses the installed Server Browser. Its public MCP surface has no independent context or WebSocket interception. Deterministic fault injection therefore uses the already installed Playwright in separate, task-owned Chromium contexts, without CDP takeover or dependency installation. App/daemon/CLI/SDK 0.13.2, Chromium 154.0.8037.0; generated isolated home only (port 38969), desktop 1120×720 and compact 390×844. Scripts and secret fixture context remain outside the repository; screenshots contain no credentials.

- `node /tmp/paseo-bot-research/check-delivery-after.mjs`: exit 0. For first creation and subsequent send, forward the actual request, withhold its accepted response, type newer draft, close that browser WebSocket (1012), reload and Check delivery. Neither executes twice. For a third request, intercept before dispatch, close/reload, Check then explicitly Retry original message. The last two transport attempts retain the same request UUID. Exact resulting Agent `4ea8dbab-17d9-4f9d-beb1-94d7d9f1d651` has **3 user messages, 3 distinct client identities and 3 actual Provider executions**, from 4 submit transport attempts. All three newer draft revisions survive. Five owned Agents existed at that probe's snapshot because other storage regressions each create a separate fixture conversation; the proof checks this exact Agent, not a fabricated empty-daemon count.
- `node /tmp/paseo-bot-research/check-selection-failure-after.mjs`: exit 0. Hold first acceptance, edit newer text, throw only the browser selection-preference write, then release acceptance. The original outbox is durably cleared before selection changes; newer text remains. The old version's same probe exited 1 with an unreachable retained outbox.
- `node /tmp/paseo-bot-research/check-outbox-failure-after.mjs`: exit 0. Throw the actual pending-delivery clear write. UI retains original slot, newer draft, disabled Send and reachable Check delivery. Reload with storage restored and Check resolves the original acceptance, restores the promoted newer draft and shows execution count 1, without resending. The initial probe incorrectly waited for selected conversation history before cleanup; corrected assertion waits for the original-slot Check control, matching the required safe behavior.
- `node /tmp/paseo-bot-research/check-initialization-operation-error.mjs`: old `b83f265` exits 1 (stable connection, failed bootstrap operation, read-only/no retry). Replace only a held bootstrap response with the public `rpc_error` envelope, leaving connection online. Fixed version exits 0: Retry Bot initialization restores `INIT_SAVED_DRAFT`, editable composer and saved configuration with no dispatch. A separate raw network interruption automatically reinitialized even before the fix and is not claimed as red evidence.

Screenshots: [unknown first delivery](images/issue-6-1-unknown-desktop.png), [recovered compact history](images/issue-6-recovered-mobile.png), [outbox cleanup failure](images/issue-6-outbox-failure-after.png), [initialization retry](images/issue-6-initialization-operation-error.png). Provider is the explicitly selected deterministic fixture for repeatable execution-count and network proofs; the real Codex tool/permission/question chain remains recorded in #3. Native iOS/Android/Electron are untested. The public external-actor busy-check race described above remains a supported API limitation.

The primary Server Browser separately opened the recovered exact conversation and displayed execution counts 1, 2 and 3 from durable history; its independent new device had an empty draft, as expected. [Server Browser history](images/issue-6-server-browser-history.png).

`node /tmp/paseo-bot-research/check-dual-reconnect.mjs`: exit 0, two fresh independent browser contexts on that exact Agent, desktop and 390px. A moved to its New slot while B remained on the conversation. B's WebSocket closed with 1012; 0.13.2 host displayed **This plugin surface is unavailable** and removed the editor, so offline editing is not claimed. On automatic reconnect and reload B restored its pre-disconnect draft; A retained its separate New selection/draft and could reopen its own distinct conversation draft. Both views restored all 3 user turns and execution count 3; **0 submit RPCs** occurred. [Offline host compact](images/issue-6-dual-b-offline-mobile.png), [A recovered](images/issue-6-dual-a-recovered-desktop.png), [B recovered](images/issue-6-dual-b-recovered-mobile.png).
