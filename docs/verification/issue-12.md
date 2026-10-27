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
