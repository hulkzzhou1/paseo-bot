# Issue #7 verification

Release-candidate implementation is complete, with actual isolated-daemon Codex management and desktop/compact browser acceptance. Accepted runtime revision: `22d704ab2b623f5a3be90e75d1984c9b23eb25f6`; functional review corrections: `d6c6347745964f86b5860b9fd6a90d30a87f7139`. The later documentation/media checkpoint changes no executable code. Remote exact-SHA Git installation, Git release/tag, registry submission, registry review and actual directory listing remain separate pending milestones. No community listing is claimed.

## Actual management and browser acceptance

Paseo app artifact, daemon, CLI and public SDK: **0.13.2**. Real Provider: **Codex 0.160.1 / gpt-6.1-sol / high / Default Permissions** (`modeId:auto`). Server Browser uses Chromium 154.0.8037.0. Acceptance used a new test-owned loopback daemon on port 43049, never the production daemon. MCP injection was explicitly configured through public settings in that new fixture before creating Agents; the plugin did not enable tools, change normal permissions or add blanket preapprovals. Each applicable real Provider permission card was explicitly accepted in the Bot UI.

The runtime adds system guidance only when creating an owned Bot. Other Agents retain their normal configuration. Native MCP workspace creation does not pass through the plugin's workspace creation hook; guidance is not a universal enforcement hook or ACL. The plugin client imports public protocol types only, with public label fields and supported navigation primitives for target identity.

Root performed these actual chains and independently verified their results:

| Scenario | Observed result |
| --- | --- |
| Current-host queries and progress | Actual `paseo.list_agents`, `list_workspaces`, `list_schedules` and activity/status reads returned exact isolated host identities. A tool argument validation error was corrected through the normal tool path. Final query reply: `MCP_READ_PREFLIGHT_OK`. No CLI management substitution or credential read. |
| Existing schedule management | Inspect → rename → resume → pause → inspect through MCP, with per-tool approvals. Existing schedule `4e9a61ec` ended paused as `Bot acceptance reviewed`; prompt, cadence and target unchanged; `runs:[]`, `lastRunAt:null`, `nextRunAt:null`. It was not run or replaced. Final reply: `SCHEDULE_MANAGEMENT_OK`. |
| Authorized ordinary task | Actual Codex wrote only the assigned test Bot file and verified its bytes; independent read confirmed exactly `ORDINARY_TASK_OK` plus newline. Normal permissions remained active. |
| Ambiguous request | Fresh guided Bot received “继续让他做下一步”. It made read-only resource/activity queries, then asked for the exact target and task. No dispatch, new resource or another Agent turn occurred. |
| Explicit existing recipient | Bot `524f093f-650f-4fce-802c-ba224ca2ed70` used `send_agent_prompt` with exact recipient `5f020939-c194-4752-abcf-84405dde7ae0` and `notifyOnFinish:true`. Structured success identified the same host. The recipient completed the authorized file check, returned `TARGET_AGENT_CONFIRMED`, and the Bot received the native completion message and summarized it. The recipient's parent stayed absent. |
| Visible business workspace and child | Actual `create_workspace(..., background:false)` returned `wks_24214293ca4bde98`. `create_agent` used that exact workspace, an available Codex configuration and `notifyOnFinish:true`. Child `416ff354-d1d3-43e3-a199-492eda52aff6` has the real Bot parent, its own business cwd and no Bot ownership label. Independent bytes equal `BUSINESS_DELEGATION_OK` plus newline. Native completion reached the Bot. No fabricated `detached` tool argument or parallel notification store. |
| Target navigation and history ownership | Actual Open Agent on both the existing recipient and new child reached their native histories; Open workspace reached the exact selected-host business workspace. Returning to Bot preserved its pending permission. Bot History contains exactly 2 owned Bot conversations and excludes the business child. |
| Nonexistent target | Actual `get_agent_status` for `00000000-0000-4000-8000-000000000000` reported not found; the Bot explained the same-host error. No fallback, creation, dispatch or fictitious navigation entry. Final Agent inventory remained 2 Bots plus 1 business child. |

The sanitized [machine-readable result](issue-7-result.json) records exact test identities and assertions. `node /tmp/paseo-bot-research/verify-management.mjs` exited **0**, independently checking workspace visibility, ownership/parent labels, history exclusion, both exact file contents and completed-response markers. Detailed tool/preflight records and scripts remain in the task-owned research directory; authentication context is excluded from this repository. All Agents were idle at the final snapshot.

Actual images show isolated sample resources only, with no credentials:

- [Delegation desktop, 1120×900](images/issue-7-delegation-desktop.png) and [compact, 390×844](images/issue-7-delegation-mobile.png).
- [Bot History excludes the child, 1120×720](images/issue-7-history-child-excluded.png).
- [Schedule management, dark desktop, 1120×800](images/issue-7-schedule-dark-desktop.png) and [compact, 390×844](images/issue-7-schedule-mobile.png). Actual dark background was RGB 24/27/26.

Console inspection was not error-free: the app's initial automatic localhost:6767 probe produced one HTTP 403 outside the target fixture, and 3 warnings were present. These were not target-fixture plugin crashes; no zero-console-error claim is made. Native iOS/Android and Electron are untested; compact browser evidence does not imply native acceptance. Native device-local durable drafts/preferences remain unsupported. The host may unmount the plugin while disconnected, as documented in [issue #6](issue-6.md).

## Test-first implementation and independent reviews

The initial real-daemon configuration test exited 1 because the public fixture reply lacked Bot guidance. After implementation it confirmed owned-Bot-only guidance, unchanged approval mode, no tool preapprovals and no forced MCP servers. Actual parent/child navigation tests use a same-title unrelated Agent, a foreign-parent-host label and a nonexistent ID to reject guessed relationships.

Independent Standards and Spec reviews found two P2 issues, both corrected at `d6c6347`:

- A terminal owned-subscription error could be erased by an older read. The public observation contract reproduced error callbacks `['terminal', null, null]` (exit 1). The observer now aborts reads, releases its lifetime, ignores late events/results and retains error until a fresh subscription succeeds. Navigation errors have separate state. Retry and watch-resolving-after-teardown tests pass.
- Parent labels alone omitted explicitly messaged existing Agents. Root's actual successful MCP send showed no target button on `03cacb2`, and the real-daemon regression returned an empty recipient set (exit 1). The fix accepts completed known `send_agent_prompt` records only with structured success, no tool error, a valid input UUID, exact output host identity and no foreign explicit destination. It never parses prose, JSON text or titles, and never changes parent labels. Selected-host resources are freshly read before showing/opening. Root's actual corrected runtime opened the existing recipient successfully. Regression tests reject failed/running/unrelated tools, invalid IDs, missing host identity and foreign destinations.

Standards and Spec re-reviews of `d6c6347`: **0 findings each**. A later real 390px check found button right edges at 422/525/578px despite a clipped 390px document (red). The compact style correction `22d704a` wraps labels within the card while preserving complete accessibility labels and 44px touch height. Actual browser replay is green: all 4 target buttons have **left 29px, right 351px, height 52px**. Independent Spec review of the style correction and the final Standards delta through `fbddec8` both returned **0 findings**. Final artifact Spec review through `fbddec8` also returned **0 findings**; its eight new screenshots and sanitized result were checked against the actual isolated artifacts.

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` after both functional fixes | 0 | **27/27**, covering all executable slices |
| `node --import tsx --test tests/delegation-targets.test.ts tests/delegation-observation.test.ts tests/management.test.ts` | 0 | **5/5** focused management/observation cases |
| `npm run typecheck` | 0 | Public client/server/shared/test contracts |
| `npm run lint` | 0 | No findings |
| `npm run format:check` | 0 | Formatting matches |
| `git diff --check` | 0 | No whitespace errors |
| `node --check server/recovery-probe.mjs` | 0 | Ordinary ESM helper syntax |

The style-only correction also passed typecheck/lint/format/whitespace checks; its regression is the actual browser rectangle assertion, not a mirrored style unit test. Earlier slice evidence remains in [#2](issue-2.md), [#3](issue-3.md), [#4](issue-4.md), [#5](issue-5.md) and [#6](issue-6.md), including actual Codex tool/permission/question interactions, lost acknowledgements, dual-browser state and durable archived history. The final Provider-unavailability browser regression is appended to #6.

## Git artifact preparation and remaining publication

The manifest targets exactly 0.13.2 and prepares locked production dependencies using `npm ci --omit=dev --ignore-scripts`. The standalone read-only ESM recovery helper imports installed public client/server packages; other direct host library declarations are development dependencies supplied by Paseo. `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` exited 0 without replacing the shared development environment.

A fresh clean `git archive` of packaging checkpoint `5a8cbd1` successfully ran the production-only preparation command (exit 0, 486 packages). An external test driver then pointed isolated daemons at that artifact: all 3 lifecycle tests passed, including disable-plugin → external workspace archive → enable-plugin → durable public ESM inspection. This does not replace the pending remote exact-Git-SHA installation/browser check.

`npm pack --dry-run --json --ignore-scripts` exited 0 and inventories both entries, imported modules, ESM helper, overview, notices and media. Git is the release source and contains the required `package-lock.json`; no npm publication or shrinkwrap process is introduced. An assert-based artifact check confirms exact dependency versions/resolved URLs/integrity, required local entries/media, valid PNG files and no forbidden overview installation commands.

English `OVERVIEW.md` explains setup (including `daemon.mcp.injectIntoAgents` default false), normal permissions, shared files, Provider data flow, browser storage, offline behavior and platform limits. Original Bot source is MIT licensed. Notices reproduce actual upstream Paseo v0.13.2 Apache-2.0 attribution and Zod MIT text. Manifest media begins with the actual #7 desktop/mobile delegation images, followed by actual permission/question images from #3.

Independent artifact reviews are complete. Pending external milestones: public push/tag and Git release, isolated installation of that exact remote revision, correctly labeled official registry submission, linked review PR, and actual directory publication or an explicit external review blocker. Submission and review are not listing. Production plugin/configuration and daemon lifecycle remain untouched.

Final documentation/media checks: `npm run format:check` and `git diff --check` exited 0. The artifact self-check passed required entries, exact lock/integrity fields, overview policy, every changed document's local links, sanitized result fields and byte-for-byte source equality plus valid PNG headers/dimensions for all 8 newly committed screenshots (exit 0). The final dry-run package inventory contains 61 files and all declared media (exit 0). This checkpoint changes only documentation, a sanitized evidence result, screenshots and manifest media metadata; the accepted runtime remains `22d704a`.

The reviewed artifact `fbddec8` merged into integration as `7de9ff7f473d6546d63d1b41ccc12068b8190ba7`, with byte-identical trees and a clean root worktree. This final review-status correction changes documentation only; executable files remain the accepted `22d704a` tree. Subsequent remote installation and registry milestones will be recorded separately against the immutable release pin.
