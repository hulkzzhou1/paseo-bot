# Project-grounded consultation

2026-10-28. Issue #12. Runtime implementation reviewed at `215eb4d017350bc70d31e860ae7c6d1a2977ad91`. Evidence/media additions do not change that runtime prompt.

New Bot conversations organize project Agents for understanding and judgment as well as execution. Project-specific discussion is grounded in current findings, with confirmed facts, assumptions and unresolved questions distinguished. Consultation is information gathering, not implementation authorization. Existing responsible Agents are preferred. No context mirror, new API, permissions or runtime storage is added; existing specialist workflows and saved-session limits remain.

## Checks

- Focused RED: `node --import tsx --test --test-name-pattern 'native creation retains' tests/native-workspace.test.ts`, exit 1 against the previous role.
- Same focused command GREEN, exit 0: fixture Provider sees the project-finding and information-only rules through the real daemon creation hook, with original profile/settings preserved.
- `npm test`: **34/34**, exit 0, 54.8 seconds. `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`: exit 0 after applying format output. No Paseo monorepo suite.
- Independent Standards: zero documented violations or material smells. Independent Spec: zero implementation findings, `1575037...215eb4d`. Provider evidence below is author acceptance.

## Actual Provider and browser

Paseo app/daemon/CLI/public SDK 0.13.2; real Codex / GPT-6.1-Sol / low / Auto-review. New isolated daemon only, with MCP injection enabled in its generated config for test purposes. Production configuration/lifecycle was not changed.

A synthetic report project contains README constraints (offline deployment, SQLite, tenant isolation, no selected PDF renderer) and a small existing `exportCsv` function. Its existing project Agent first reads the files. The user then asks Bot to discuss reusable pieces, constraints and open questions for PDF export, explicitly without implementation.

Bot checks the existing Agent's real identity and sends one information-only consultation with `notifyOnFinish:true`. After the response it explains the reusable tenant filter/name extraction, cites the actual source and README, distinguishes documented offline constraints from local-resource implications, and identifies missing export/authentication evidence and user decisions. Bot does not invent a complete PDF implementation from incomplete context.

Public SDK assertions verify the exact existing Agent was consulted, no new Agent was created, both project file hashes remained unchanged, only Bot is in Bot History, and the discussion includes actual project facts and source references. [Sanitized result](project-context-result.json). The first harness assertion required uppercase `CSV`, but the valid response cited `exportCsv`; a case-insensitive source-name check passed when re-reading the same completed conversation. No consultation or task was resent.

Server Browser displayed the same native discussion at 1120×900 and 390×844; compact document/viewport widths both 390 px. [Desktop](images/project-context/project-context-desktop.png), [compact](images/project-context/project-context-mobile.png). Only synthetic project data appears. The new-origin host discovery error/warnings precede the successful isolated connection; no plugin navigation failure occurred.

## Environment and limits

The root temporary filesystem was full before implementation. Four task-owned stopped Git-install fixtures were moved intact to `/data/home/hulkzzhou/.cache/paseo-bot/acceptance-archive`; their evidence was retained. New worktree and test temporary homes use the data volume. No unrelated user data was removed.

This acceptance uses a user-identified existing project Agent. It does not establish autonomous project discovery or every future model response. Missing/ambiguous targets retain the existing clarification rule. The role is guidance, not a permission sandbox. Native mobile/Electron, beta App runtime, other real Providers and TAPD dispatch integration remain untested. Existing conversations keep their saved role; start a new native Agent conversation in Bot for these instructions. Production daemon was not restarted.

## Matter continuity clarification

The user clarified Agent selection after the initial 0.4.1 candidate: a new independent matter should use a fresh project Agent; continue an existing Agent only when it already carries relevant groundwork for that same matter. Shared project membership alone is not enough. This supersedes the earlier general preference for an existing responsible Agent. Runtime follow-up `73ba2d23a723cf1028630154c002a8224edefe3d` was independently re-reviewed with zero Standards/Spec findings.

A second focused RED/GREEN cycle verified the new selection rule reaches the saved prompt. Final full suite: 34/34, exit 0, 48.9 seconds. Typecheck/lint/format/whitespace passed. Root package version is 0.4.2; dependency pins remain unchanged.

After reloading only the isolated plugin, a new Bot conversation received an independent export-encryption consultation. The user explicitly identified the old Agent's PDF discussion as unrelated groundwork. Bot created exactly one fresh project Agent in the existing visible project workspace, retained normal parent/completion semantics, and did not prompt the prior PDF Agent. The new Agent returned source-grounded findings; Bot used them to discuss reusable filtering, missing encryption/identity/delivery evidence and open questions. Both project file hashes remained unchanged. [Actual new-matter result](new-matter-result.json). The final Bot turn was awaited and re-read after an initial evidence read caught the response still streaming; no task was resent.

The original consultation evidence at `215eb4d` demonstrates reuse when the user supplies an already-informed responsible Agent. The separate `73ba2d2` run verifies the latest fresh-Agent selection rule. Neither evidence is a claim about every future model response.

## Final fixed artifact and local delivery

[v0.4.2](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.4.2) pins `7ad20572182331a17dd271b20529d77a5c9fd005`. A new empty isolated daemon installed that exact remote SHA with the locked production build. Public installed revision, checkout HEAD, bootstrap and running status matched. A real Codex new native conversation described evidence-grounded discussion, fresh Agents for new matters, continuing Agents with relevant prior groundwork, and consultation without project-change authorization. No tools/tasks were started for that role discussion. `probe-git-context-final.mjs` exited 0. [Fixed-artifact result](project-context-git-result.json).

The user-authorized local update exited 0; a separate public plugin listing confirmed enabled/running at the exact final pin. No production daemon restart, global config edit or production conversation mutation occurred. Existing Bot conversations retain saved instructions; new conversations adopt the updated role.

The interim v0.4.1 tag/release at `243b110` remains unchanged. Before independent community review of that proposal, the user clarified matter continuity; the author's still-unreviewed PR was advanced by a normal fast-forward to the final v0.4.2 pin. No reviewer edits were overwritten. Manual request [#1347](https://github.com/getpaseo/plugins/issues/1347) and earlier request #1342 are linked by [PR #1343](https://github.com/getpaseo/plugins/pull/1343), now proposing 0.4.0 → 0.4.2. Registry base `d369ad6` already includes approved v0.4.0 PR #1341. Trusted registry tests passed 172/172; final online validation reported 400 well-formed records and one matching changed artifact; whitespace passed. Proposal `917ab36` changes only the two record pin fields and leaves timestamps for independent review. No plugin code ran during registry preparation.

At this record the deployed directory still pins approved v0.3.1 (`73b81ff`); merged v0.4.0 approval and actual deployed listing are distinct. v0.4.2 independent directory review/listing remains pending.
