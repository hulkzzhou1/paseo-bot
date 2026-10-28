# Issues #15 + #16 — final Coordinator preset lifecycle

Branch `feat/paseo-team-profiles` continues the approved native-workspace integration baseline `9df62016bc8de1978b1be4b6bed336ee3383ebca` and #15 delivery `3882a462d63a0cb6d787651899061b57695bc3dd`, using the same draft PR #17 targeting `integration/paseo-bot`. No production installation, reload, configuration change, deployment, merge, publication or real external platform write is authorized or performed here.

## Final behavior

First entry copies only standard runtime fields from the user's explicit source preset into one stable dedicated identity and seeds the public generic notes. Existing installation/package/workspace/session identities remain unchanged. Native and legacy creation share current preset resolution, runtime catalog validation and exactly-once rule injection. A present preset with empty notes adds no rules. Normal edits, new default seed code, reload, disable/enable, cold restart and same-ID reinstall preserve user choices and existing sessions.

Successful config read plus an absent associated ID activates the public generic rule fallback with valid native form settings or explicit legacy RPC inputs. Same-name presets are ignored. Deletion neither recreates the preset nor requires binding nor blocks creation. A stale picker instruction is hidden on this fallback entry.

Read denial, unavailable config, invalid model, missing/corrupt plugin state and an unknown association produce distinct, sanitized errors rather than deletion fallback. The native hook previously allowed a preset model outside the available catalog; moving existing validation into the shared resolver now rejects it on both paths without guessing a replacement.

Before initialization writes, state records the stable ID and attempted-write status. Lost acknowledgement is checked by the same ID, retaining later edits. A still-unknown attempt is never resubmitted; a definite access denial permits explicit retry after permission is restored. Initialization markers expose partial association loss. Missing state files fail safely. After all plugin metadata is cleared, surviving reserved preset IDs or a dedicated-directory workspace are uncertainty signals, never ownership proof or adoption candidates. Complete removal of both metadata and observable traces cannot reliably be distinguished from genuine first use.

## Test seam and observed RED/GREEN cycles

`tests/coordinator-lifecycle.test.ts` uses the existing real isolated daemon, public plugin RPCs, native workspace Agent creation, durable Provider replies and public config/CLI operations. Config faults wrap only the public SDK boundary in a temporary copy of the actual contribution. Production code contains no fault switches. Other config requests, session persistence, compiler/import boundaries and Provider handling remain real. Fault errors contain a synthetic secret canary; assertions verify it is not returned to the caller.

Observed REDs included missing-state reinitialization, loss of the association field, full metadata cleanup followed by duplicate setup, permission errors shown as generic failures, retries of unconfirmed writes, and native acceptance of an unavailable preset model. Each corresponding focused GREEN passed after its correction. Empty systemPrompt is normalized to an omitted Provider field by the host; the test checks absence of rules and verifies notes remain empty in the actual preset.

The lifecycle scenarios cover source preservation; current edits and optional empty notes; an upgraded seed in a test source copy; disable/enable; cold daemon restart; plugin removal/reinstall retaining profiles and history; deletion with same-name unrelated presets; explicit fallback configurations; denied/unavailable reads; missing and invalid models; corrupt/missing/cleared plugin metadata; lost write acknowledgement; persisted write with failed read-back; and a write that was not confirmed, plus explicit retry after a definite denial.

## Validation status

App/daemon/public SDK remain 0.13.2; installed CLI version and declarations were rechecked. No new public API version is claimed. The final focused/full command results, runtime SHA, screenshots and independent two-axis review are recorded here before delivery.

Real-model rule text is unchanged from #15. Its actual simple-consultation and project-investigation/feedback evidence is reused: [sanitized model result](issue-15-model-result.json), [scope and preliminary failed attempts](issue-15.md#real-model-coordination). Those results demonstrate a bounded synthetic project/local tracker workflow, not production TAPD/forge writes or every possible model response. No unnecessary repeat model task is run.

## Accepted limits

Public patches replace the entire profiles array with no cross-client CAS. Plugin serialization, durable intent, fresh reads and ID-based confirmation reduce the race but cannot prevent another client edit being lost between read and patch. This is an accepted limit, not an atomicity claim.

Restoring verified plugin data is necessary after proven state loss; the plugin does not infer ownership from names or silently reconstruct historical associations. An unconfirmed initialization may remain unresolved if neither its result nor original metadata can be established. Confirmed deletion with a retained association remains unrestricted.

Native iOS/Android, Electron, other real Providers, production deployment, real external tracker/forge writes and all future Paseo versions remain untested. The existing `>=0.13.2` range is eligibility, not acceptance of every newer runtime.
