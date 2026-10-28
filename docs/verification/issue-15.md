# Issue #15 — dedicated Coordinator preset

Historical first-ticket acceptance at `3882a462`. The [#16 record](issue-16.md) contains the subsequent combined lifecycle implementation and final review; the deferred matrix described below is no longer the current branch status.

Work branch: `feat/paseo-team-profiles`, based on `integration/paseo-bot` at `9df62016bc8de1978b1be4b6bed336ee3383ebca`. This record covers #15; #16 remains a separate follow-up. No production plugin installation, configuration change, daemon restart, merge or release was performed.

## Implemented behavior

First entry asks for an existing source preset. It copies only standard runtime fields into a dedicated stable ID, seeds the public generic notes, preserves other presets and stores only the association/initialization outcome. Source edits do not sync. The entry explains the notes convention and native picker selection before entering the existing workspace. It creates no empty Agent.

Native and legacy creation share the same resolver. Explicit preset fields take precedence, Provider/mode conflicts fail before creation, and the legacy path resolves an actual model before the SDK call. The creation hook loads notes once, preserving other system instructions. There is no second fixed role prompt. Ordinary project directories and existing sessions retain their behavior. The dedicated directory must remain a coordination directory: the public creation hook supplies cwd/config but no workspace/parent identity.

## Automated validation

Verified runtime revision: `b24bb5f4704b73d7d629bb82281d754d400856c0`. App, daemon and public SDK are **0.13.2**: the CLI and the matching bundled app/server package manifests were checked, alongside installed client/plugin/protocol declarations. The running CLI resolves to the packaged `main-6b7d49f0` build. Compatibility claims are limited to this exercised version; the existing `>=0.13.2` eligibility range is unchanged.

Current deployed documentation consulted: [plugin reference](https://paseo.sh/docs/plugins/reference.md), [SDK reference](https://paseo.sh/docs/sdk/reference.md), [Agent profiles](https://paseo.sh/docs/agent-profiles.md), and the quickstart from the official llms index. Installed declarations and real isolated-daemon calls confirmed public `config.get/patch` in handlers/hooks and the creation hook. No private host imports or host configuration-file reads were added.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci --include=dev` | 0 | Locked dependencies installed; no dependency changes |
| `npm run typecheck` | 0 | Both runtime entrypoints and focused tests typecheck |
| `npm run lint` | 0 | No lint findings |
| `npm run format:check` | 0 | Formatting passes |
| `git diff --check` | 0 | No whitespace errors |
| `TMPDIR=<data-volume-cache> npm test` | 0 | **36/36**, 61.8 s; this plugin only, no Paseo monorepo suite |

The focused tests were run regularly during implementation, with three observed RED/GREEN boundaries:

- First setup failed with missing `prepare-coordinator` RPC (exit 1), then passed (exit 0).
- Real Provider arguments initially contained zero custom notes, then both native and legacy creation received the dedicated settings and one copy (exit 0).
- Passing an existing copy of the notes initially produced two copies; the corrected hook retains exactly one (exit 0).

A focused regression initially passed 8/9: the mode-conflict fixture used a mode rejected by the SDK before reaching the hook. The fixture now supplies another valid mode/provider, and the hook conflict test passes. The final full suite includes no-resource-on-conflict, source preservation and source independence, non-copying of extension fields, explicit missing source-model errors, ordinary-project isolation, native history/rename/archive/rebuild, legacy delivery and delegation/reconnect behavior. One interim formatting failure came from a local CLI text capture named `.json`; it was renamed `.txt` before the final passing checks.

## Browser acceptance

The existing browser plugin could read public docs but could not reach this isolated loopback daemon. Local Chromium was launched with the installed server-browser package's existing libraries and CJK font, with a worktree-local font cache, using only a test browser context; no production browser/daemon settings changed. The test profile source was explicitly selected in the plugin UI. Before entering the workspace the public SDK confirmed two presets and **zero Agents**. First send created one Agent; new native tab remained a draft until send, then created a second independent Agent. Re-entering reused the same preset ID and workspace.

`node --import tsx artifacts/issue-15/browser-final.ts` exited 0. It checks the two actual saved Provider replies, their model/mode/thinking, exact equality with the dedicated notes (one copy), one shared workspace and the two matching history identities. [Sanitized result](issue-15-browser-result.json). At compact width, document and viewport both measure 390 px. A fresh test browser context also opened a saved session through Bot history. Screenshots use an isolated-host display alias to avoid publishing the machine hostname.

- First selection: [1120×900](images/team-profiles/setup-desktop.png), [390×844](images/team-profiles/setup-mobile.png).
- Notes convention and subsequent entry: [ready on mobile](images/team-profiles/ready-mobile.png), [reopened on desktop](images/team-profiles/reopen-desktop.png).
- Native selection and creation: [native picker](images/team-profiles/picker-mobile.png), [mobile conversation](images/team-profiles/native-mobile.png), [second native conversation](images/team-profiles/second-native-desktop.png).

## Independent review

Two independent review Agents compared `9df62016…966b6d7`, then verified their fixes. They made no implementation edits.

### Standards

One P2 was fixed: the shared read-error text said “no preset was changed” even when called after a possibly committed write. It now correctly reports unknown state. No remaining documented-standard breaches or actionable smells were reported. Review included public import boundaries, safe config projection, stable identity and serialized setup, both creation paths and late-response/teardown handling. Review Agents did not run duplicate tests or access production.

### Spec

One P3 wording inconsistency was fixed: the imported specification still said no display-name adjustment had occurred, while the branch changes the entry/page to Paseo Team. The document now describes the actual display change and keeps package/install/resource IDs unchanged. No remaining #15 functional gaps or scope creep were reported. The initial review correctly noted that final browser/model evidence was still pending; completed evidence is recorded separately here. The complete #16 lifecycle matrix was not claimed as #15 acceptance.

Standards: 1 fixed, 0 remaining. Spec: 1 fixed, 0 remaining.

## Real-model coordination

`TMPDIR=<data-volume-cache> node --import tsx artifacts/issue-15/real-coordination.ts` exited **0** with real Codex `gpt-6.1-terra`, low thinking. The explicitly selected isolated source preset used `full-access`, matching the existing acceptance method. Production configuration was untouched; the plugin did not change the requested mode.

A simple consultation about discussion versus implementation authorization returned a short answer with **zero tools and zero delegation**. A separate PDF-export goal identified an existing synthetic project workspace. Coordinator read its AGENTS.md, preserved the existing local TASKS.md, registered a parent goal and research subtask, and created exactly one Project Agent in that workspace with a normal parent relationship. The child investigated README/source facts, then wrote concrete research findings and a parent design draft to the local tracker. Offline deployment, SQLite, tenant filtering and the missing renderer/test/configuration were distinguished from inference and open choices.

The initial Coordinator evidence read was still a progress response waiting for the child. The later user-feedback turn retained offline availability and tenant filtering, cited the returned README/source evidence, and explained that implementation, deployment, publication, acceptance and external-platform actions were not authorized. Final source content/hash stayed unchanged; existing tracker content was retained. Child Agents were excluded from Bot history. [Sanitized actual result, final tracker and source hash](issue-15-model-result.json).

Preliminary `gpt-6.1-sol` research failed before tools with “Selected model is at capacity”. Subsequent `auto` runs reached ordinary MCP approval instead of bypassing it; incomplete harness approval allowlists ended those attempts. These are not recorded as successful coordination acceptance. No product code was changed to bypass approvals. Real-model validation demonstrates this bounded synthetic scenario, not every future response or actual external tracker/forge writes.

## Accepted limits and remaining scope

Public Agent profile updates replace the whole array without cross-client CAS. Serial plugin operations, a fresh read before writing and stable-ID read-back reduce the window; simultaneous cross-client edits can still be lost. This accepted limitation is shown in the setup UI and overview. Initialization is first-open behavior, not an installation hook. No native preset auto-selection API is claimed.

#16 owns the full editing/empty/upgrade/delete/failure recovery acceptance matrix; this branch supplies the shared resolver without adding deletion restrictions. Native iOS/Android and Electron, other real Providers, and real external tracker/forge writes are untested.
