# Issues #15 + #16 — final Coordinator preset lifecycle

> Later user feedback removes both setup and intermediate entry pages. [Direct native entry acceptance](direct-native-entry.md) records that subsequent change; this document preserves evidence for the revisions named below.

Branch `feat/paseo-team-profiles` continues the approved native-workspace integration baseline `9df62016bc8de1978b1be4b6bed336ee3383ebca` and #15 delivery `3882a462d63a0cb6d787651899061b57695bc3dd`, using the same draft PR #17 targeting `integration/paseo-bot`. No production installation, reload, configuration change, deployment, merge, publication or real external platform write is authorized or performed here.

## Final behavior

First entry copies only standard runtime fields from the user's explicit source preset into one stable dedicated identity and seeds the public generic notes. Existing installation/package/workspace/session identities remain unchanged. Native and legacy creation share current preset resolution, runtime catalog validation and exactly-once rule injection. A present preset with empty notes adds no rules. Normal edits, new default seed code, reload, disable/enable, cold restart and same-ID reinstall preserve user choices and existing sessions.

Successful config read plus an absent associated ID activates the public generic rule fallback with valid native form settings or explicit legacy RPC inputs. Same-name presets are ignored. Deletion neither recreates the preset nor requires binding nor blocks creation. A stale picker instruction is hidden on this fallback entry.

Read denial, unavailable config, invalid model, missing/corrupt plugin state and an unknown association produce distinct, sanitized errors rather than deletion fallback. The native hook previously allowed a preset model outside the available catalog; moving existing validation into the shared resolver now rejects it on both paths without guessing a replacement. Native omitted-model and model-alias inputs retain host semantics: default/first selectable model selection is used only to validate thinking options, never to fill the returned configuration.

Before initialization writes, state records the stable ID and attempted-write status. Lost acknowledgement is checked by the same ID, retaining later edits. A still-unknown attempt is never resubmitted; a definite access denial permits explicit retry after permission is restored. Initialization markers expose partial association loss. Missing state files fail safely. After all plugin metadata is cleared, surviving reserved preset IDs or a dedicated-directory workspace are uncertainty signals, never ownership proof or adoption candidates. Complete removal of both metadata and observable traces cannot reliably be distinguished from genuine first use.

## Test seam and observed RED/GREEN cycles

`tests/coordinator-lifecycle.test.ts` uses the existing real isolated daemon, public plugin RPCs, native workspace Agent creation, durable Provider replies and public config/CLI operations. Config faults wrap only the public SDK boundary in a temporary copy of the actual contribution. Production code contains no fault switches. Other config requests, session persistence, compiler/import boundaries and Provider handling remain real. Fault errors contain a synthetic secret canary; assertions verify it is not returned to the caller.

Observed REDs included missing-state reinitialization, loss of the association field, full metadata cleanup followed by duplicate setup, permission errors shown as generic failures, retries of unconfirmed writes, native acceptance of an unavailable preset model, and rejection of a valid native thinking option when model was omitted. The latter regression test also covers a model alias through the public low-level DaemonClient. Each corresponding focused GREEN passed after its correction. Empty systemPrompt is normalized to an omitted Provider field by the host; the test checks absence of rules and verifies notes remain empty in the actual preset.

The lifecycle scenarios cover source preservation; current edits and optional empty notes; an upgraded seed in a test source copy; disable/enable; cold daemon restart; plugin removal/reinstall retaining profiles and history; deletion with same-name unrelated presets; explicit fallback configurations; denied/unavailable reads; missing and invalid models; corrupt/missing/cleared plugin metadata; lost write acknowledgement; persisted write with failed read-back; and a write that was not confirmed, plus explicit retry after a definite denial.

## Validation status

Final executable source/test revision: `152c0bdfae1cf7055ff77a0e2abcf0adf09da774`. Later delivery commits add documentation and screenshots only. App/daemon/public SDK remain 0.13.2; installed CLI version, installed app/server package manifests and public declarations were rechecked. No new public API version is claimed. Commands below ran in this plugin worktree, with no host monorepo suite.

| Command / boundary | Result / exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, no warnings |
| `npm run format:check` | 0 |
| `git diff --check` | 0 |
| `node --import tsx --test tests/coordinator-lifecycle.test.ts tests/native-workspace.test.ts` (pre-final edge correction) | 17/17, 0 |
| `node --import tsx --test --test-name-pattern='native fallback retains' tests/coordinator-lifecycle.test.ts` | RED: thinking unavailable, 1; GREEN: 1/1, 0 |
| `npm test` at final source SHA | 47/47, 0; 117.4 seconds; no skipped/cancelled tests |
| Isolated browser lifecycle and durable Provider input checks | 0; 1120×900 and 390×844 |

The browser used the installed 0.13.2 web app, a generated isolated home/password, the fixture Provider and a temporary copy of the actual plugin at the final source revision. The available client browser could not reach server loopback; existing server Chromium/Playwright installation was used. No dependency or production browser connection was added. Three native conversations in one workspace preserved edited notes, empty notes and one public default rule set after deletion; public SDK reads verified persisted Provider replies and history, with only the unrelated source preset remaining. A simulated read failure displayed unknown state, then an actual successful retry restored deletion fallback with no binding or recreation. Mobile viewport and document widths both measured 390 pixels. The local browser host label was renamed to a generic test label before compact screenshots. [Sanitized browser result](issue-16-browser-result.json).

| Desktop evidence | Compact evidence |
| --- | --- |
| [Current preset entry](images/team-lifecycle/desktop-current-preset.png) | [Read result unknown](images/team-lifecycle/mobile-read-unknown.png) |
| [Edited notes at Provider](images/team-lifecycle/desktop-edited-notes.png) | [Recovered deletion fallback](images/team-lifecycle/mobile-deleted-recovered.png) |
| [Empty notes at Provider](images/team-lifecycle/desktop-empty-notes.png) | [Default rules at Provider](images/team-lifecycle/mobile-default-provider-input.png) |
| [Deleted preset entry](images/team-lifecycle/desktop-deleted-fallback.png) | |
| [Default rules at Provider](images/team-lifecycle/desktop-default-provider-input.png) | |

Independent Standards and Spec agents reviewed the combined diff from `9df62016bc8de1978b1be4b6bed336ee3383ebca` and re-reviewed final executable SHA `152c0bdfae1cf7055ff77a0e2abcf0adf09da774`. Standards identified one P2 at candidate `7b7c0b2`: valid omitted native model plus thinking was rejected. After the focused RED/GREEN correction, both axes report no remaining findings. The Standards reviewer independently repeated the final default/alias test (1/1, exit 0). #15's previously fixed findings and historical evidence remain in its record.

Real-model rule text is unchanged from #15. Its actual simple-consultation and project-investigation/feedback evidence is reused: [sanitized model result](issue-15-model-result.json), [scope and preliminary failed attempts](issue-15.md#real-model-coordination). Those results demonstrate a bounded synthetic project/local tracker workflow, not production TAPD/forge writes or every possible model response. No unnecessary repeat model task is run.

## Accepted limits

Public patches replace the entire profiles array with no cross-client CAS. Plugin serialization, durable intent, fresh reads and ID-based confirmation reduce the race but cannot prevent another client edit being lost between read and patch. This is an accepted limit, not an atomicity claim.

Restoring verified plugin data is necessary after proven state loss; the plugin does not infer ownership from names or silently reconstruct historical associations. An unconfirmed initialization may remain unresolved if neither its result nor original metadata can be established. Confirmed deletion with a retained association remains unrestricted.

Native iOS/Android, Electron, other real Providers, production deployment, real external tracker/forge writes and all future Paseo versions remain untested. The existing `>=0.13.2` range is eligibility, not acceptance of every newer runtime.
