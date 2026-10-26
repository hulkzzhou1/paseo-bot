# Delivery recovery and complete observation (#6)

Base: integration `c6240c5`; implementation branch `implement/issue-6`. App, daemon and public SDK baseline: 0.13.2. Browser-first scope follows specification decision 15. No production daemon/configuration or sibling checkout changes.

## Durable delivery boundary

Every first/subsequent message has a browser-generated UUID persisted before dispatch in device-local storage, scoped to host, installation and exact conversation/new slot. Its original payload and submitted draft revision remain available after navigation/reload. The selected daemon records request identity, payload hash and outcome in `<daemon-home>/plugin-data/paseo-bot/deliveries.json` (private directory/file modes). This journal stores no duplicate transcript; Paseo owns session history. Browser storage holds the pending payload alongside its drafts until delivery is resolved.

`submit-delivery` and `reconcile-delivery` return accepted, definitely failed, unknown, or ready for an explicit original-message retry. The plugin serializes submissions and records unknown before dispatch. Reusing a UUID with different content is rejected. Reusing a dispatched UUID verifies the same operation rather than sending again. A fresh result or an exact `user_message.clientMessageId` proves acceptance; history is paged to its beginning when needed. An unknown marker without proof remains unknown and is never automatically replayed. A request with no server journal can be retried deliberately with its original identity, protecting a delayed original request from duplicate execution.

Subsequent sends validate exact installation/workspace ownership, mutable state, actual idle status, absence of pending requests and the existing Provider catalog before using the public `send(text, { messageId })` option. This does not introduce queue or steer semantics. Public SDK/CLI 0.13.2 has only interrupt/steer active-turn behavior, with no atomic reject-if-busy operation: an external actor starting the same Agent between the fresh check and dispatch is a documented public API race. Plugin submissions themselves are serialized.

The UI preserves editable drafts while offline or unresolved, blocks normal Send, and offers Check delivery. Only a verified absent server journal offers Retry original message. No reconnect handler resends tasks or answers/denies requests. Late host visits and unmounted pages cannot apply old callbacks. Draft cleanup compares submitted revisions and repeated creation reconciliation cannot overwrite an already promoted follow-up draft. Failed local cleanup blocks another send until storage is restored and checked.

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
