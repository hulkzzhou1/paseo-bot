# Native workspace entry acceptance

2026-10-27. Issue #9, specification decision 18. Implementation `afefa3b`, with follow-up review fixes in the commit containing this record. Native workspace navigation replaces the custom initial form. Bot history stays separate and opens durable native Agents.

## Checks and review

- RED: missing open-workspace RPC, native conversations absent from Bot history, and missing management guidance failed before implementation.
- `npm test`: exit 0, 31/31 in 53.4 seconds. Four new real isolated daemon tests cover concurrent entry without empty Agents, native root ownership/exclusions, preserved native configuration/instructions, and legacy/archived workspace generations.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`: exit 0.
- Independent Standards review found missing header recovery after bootstrap failure. Successful Bot entry now re-reads every workspace generation and registers missing history buttons. Re-review: zero findings. This is entry-based recovery, not an automatic connection subscription.
- Independent Spec review found that rebuilding could bypass a missing navigation guard. The lifecycle controls are now gated by available native workspace navigation; history remains accessible. Re-review: zero findings.

## Actual browser and Provider

Stable app/daemon/CLI/public SDK 0.13.2, isolated directory installation. Server Browser desktop 1120×900 and compact 390×844. A fresh workspace opens the native New tab page; clicking Agent opens the native composer, with no Agent created until sending. Public 0.13.2 navigation does not expose an automatic new-Agent draft action.

A real Codex / GPT-6.1-Sol / Low / Auto-review turn ran `printf NATIVE_WORKSPACE_OK` and replied `NATIVE_WORKSPACE_DONE`. Native chat displayed its collapsed “Ran 1 command” disclosure. Creating another native draft restored the system's model, thinking and permission choices; browser assertions checked all three native control labels. No custom selection state is read.

Bot history included the native-created conversation. Desktop rename to “Native Bot acceptance”, compact opening back to its canonical native reply, and compact archive / archived listing succeeded. A compact geometry assertion placed the history row inside the 390×844 viewport after the host's sheet animation settled. Initial automation used the wrong Agent button role (the tab menu uses menuitem), and one title wait matched a hidden native tab; corrected selectors passed. A screenshot captured during sheet animation was replaced after a settled-layout assertion.

`node /tmp/paseo-bot-research/verify-native-workspace.mjs`: exit 0. Public SDK verified exactly one history entry, one canonical user turn, one tool call, the exact assistant reply, the background workspace and its isolated Bot directory. [Sanitized assertions](native-workspace-result.json).

- [Desktop native chat](images/native-workspace/native-v030-chat-desktop.png)
- [Compact native chat](images/native-workspace/native-v030-chat-mobile.png)
- [Compact Bot history](images/native-workspace/native-v030-history-mobile.png)

## Limits

Native iOS/Android and Electron were not exercised. Other real Providers and native permission/question/voice/attachment flows were not re-tested in this migration; the harmless command did not request approval. Native preferences/drafts follow host behavior; old custom drafts are not migrated. The browser reported no page errors after navigation and one host warning. No production test conversation was created and the production daemon was not restarted. Exact remote installation and registry status are recorded separately after the release candidate is fixed.

## Fixed Git release, local installation and community update

[v0.3.0](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.3.0) pins `0966b7686859a4c6af0b8cd47332d49c12dd48b5`. A fresh empty isolated daemon installed that exact remote revision with its locked production build; installed revision, checkout HEAD and plugin running status matched. Server Browser created a native Codex conversation through the Git artifact. `verify-native-workspace-release.mjs` exited 0: one history entry, one canonical user turn, exact reply `NATIVE_WORKSPACE_GIT_OK`, zero tools, expected background workspace. Browser asserted native workspace/composer and a 390 px viewport without horizontal overflow. [Sanitized result](native-workspace-release-result.json), [compact screenshot](images/native-workspace/native-v030-exact-git-mobile.png). The new-origin welcome page logged one localhost auto-discovery error and three host warnings; these preceded the successful isolated connection.

The user-authorized local `paseo plugin update paseo-bot --ref 0966b7686859a4c6af0b8cd47332d49c12dd48b5 --home <local-home> --json` exited 0. A separate public plugin listing confirmed enabled/running at that exact commit. Production daemon was not restarted and production conversations were not used for testing.

Manual update request [#1327](https://github.com/getpaseo/plugins/issues/1327) is linked by community PR [#1328](https://github.com/getpaseo/plugins/pull/1328), following current BOTS/REVIEW and official submission template at registry `7e11dd9`. Proposal `85a00f3` changes only two commit fields; existing timestamps are retained for the independent reviewer. Trusted registry checks: 172/172 tests; online changed-record validation 400 well-formed records and one matching artifact; whitespace check exit 0. No plugin code was executed as part of registry review preparation. GitHub Validate and independent review are tracked on the PR.

At this record, v0.2.0 PR #1319 has merged and the actual deployed directory pins `d1f312260230fe42cd086ae570a006c3085e9e81`. v0.3.0 Git release and local installation are complete; v0.3.0 directory approval/listing remains pending. Issue #9 remains open for that external milestone.
