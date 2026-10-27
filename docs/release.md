# Release status

Version 0.3.0 is [released](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.3.0) and locally installed/running at `0966b7686859a4c6af0b8cd47332d49c12dd48b5`. Native workspace entry now owns creation/defaults/first send; Bot history remains. Fresh exact-Git installation and actual Provider/browser acceptance passed. [Evidence](verification/issue-9.md). Community [PR #1328](https://github.com/getpaseo/plugins/pull/1328) awaits independent review; this revision is not yet listed.

Version 0.2.0 [PR #1319](https://github.com/getpaseo/plugins/pull/1319) was approved and merged, and the actual deployed directory was verified at its `d1f312260230fe42cd086ae570a006c3085e9e81` pin on 2026-10-27.

## Historical v0.2.0 release record

The following pending-review statements describe the original submission; the current status above supersedes them.

Version 0.2.0 replaces custom conversation UI with native Agent navigation while retaining Bot history and new-conversation setup. [v0.2.0 is released](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.2.0) at `d1f312260230fe42cd086ae570a006c3085e9e81`. A fresh remote exact-SHA installation passed and the user-authorized local installation is running at that same revision, without daemon restart. [Registry update PR #1319](https://github.com/getpaseo/plugins/pull/1319), linked to manual update request #1318, awaits independent review. The deployed directory still pins v0.1.0; publication of the v0.2.0 Git release is distinct from its directory listing. See [migration evidence](verification/issue-8.md).

Version 0.1.0 is already listed: [registry PR #1250](https://github.com/getpaseo/plugins/pull/1250) was approved and merged, and the deployed record was verified at `https://plugins.paseo.sh/plugins/hulkzzhou1/paseo-bot.json`. Its pin is `ffedf6a953ad25dae53f3f5903a2e5fcafb75b72`.

## Historical v0.1.0 release record

The following records describe the original release at the time of submission. Its pending-review and production-untouched statements were superseded by registry approval and the user's later local-install authorization.

Public Git **v0.1.0 is released**: [GitHub release](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.1.0). Immutable reviewed and installed revision: `ffedf6a953ad25dae53f3f5903a2e5fcafb75b72`. The annotated remote tag peels to this exact commit. The integration branch may advance with acceptance and registry status records; that does not change the release pin.

| Milestone | Actual state |
| --- | --- |
| Implementation and actual Provider/browser acceptance | Complete; [slice evidence](verification/issue-7.md) |
| Final Standards / Spec | 0 findings each at the immutable revision |
| Public fixed Git tag/release | Published, v0.1.0 |
| Fresh remote exact-SHA installation | Passed; Git HEAD and public installation revision match |
| Official registry submission | [Application #1246](https://github.com/getpaseo/plugins/issues/1246), linked by [manual PR #1250](https://github.com/getpaseo/plugins/pull/1250) |
| Registry review / deployed listing | PR open for independent review; not listed |

## Exact remote artifact acceptance

A newly generated isolated daemon began with an empty plugin configuration, rather than a directory-installed Bot. It used Paseo app/daemon/CLI/public SDK 0.13.2 and real Codex 0.160.1, GPT-6.1-Sol/high/Default Permissions. Production config, plugin installation and daemon lifecycle were not changed.

The successful public CLI operation (exit 0) was:

```sh
paseo plugin add https://github.com/hulkzzhou1/paseo-bot.git --ref ffedf6a953ad25dae53f3f5903a2e5fcafb75b72 --home <isolated-home> --json
```

The immutable source ran its committed `npm ci --omit=dev --ignore-scripts` build. Plugin status was `running`; `installation.currentRevision`, the public installed `commit` and the actual checkout's `git rev-parse HEAD` all equal the full revision above. Both entries, overview, license/notices, lock and unbundled ESM helper exist in that checkout.

`node /tmp/paseo-bot-research/verify-release.mjs` exited 0. Actual Server Browser first send created exactly one Bot Agent and one background workspace, with one canonical user turn, exact assistant reply `GIT_INSTALL_OK` and zero tool calls. Typing `GIT_INSTALL_DRAFT` and reloading restored the same selection, draft and reply; the browser assertion verified editable input and both expected prompt/reply markers. [Compact restored page](verification/images/release-exact-git-mobile.png).

The plugin was then disabled only in this isolated daemon; its exact workspace was archived through the public CLI, then the Git-installed plugin re-enabled. This deliberately misses the archive hook. `node /tmp/paseo-bot-research/verify-release-archive.mjs` exited 0: public workspace inspection reported `archived`, the active workspace lookup was absent, and the ordinary ESM helper loaded with production-only dependencies from the Git artifact. Browser assertions retained the draft and durable real Provider reply, with read-only input and disabled Send. Public workspace listing returned no active background replacement. [Durable archived page](verification/images/release-exact-git-archived.png), [sanitized result](verification/release-result.json).

An initial author command using `URL#SHA` directly as the stable CLI remote failed Git cloning (exit 1); its disposable daemon was closed. The corrected supported CLI uses `--ref`, as above. No product code or immutable candidate changed. The official registry intake separately supports `repository URL#full SHA`; its current parser was re-read before submission.

## Compatibility and registry policy

Latest stable remained 0.13.2 at publication. Full tests passed 27/27, with typecheck/lint/format checks; final independent reviews returned 0 findings on both axes. Desktop and compact browser behavior is accepted. Native iOS/Android durable drafts/preferences are unsupported, and native/Electron runtime acceptance is untested. Other Providers are untested. The public external-actor send race and offline host-unmount limit remain disclosed in [OVERVIEW](../OVERVIEW.md).

The official submission template, REVIEW, BOTS, PROTOCOL and Source parser were re-read at registry revision `4fd2379bab088979a65de1a566a2c1c8138a560a`, 2026-10-26 22:13 UTC, and were unchanged from the prior verified policy. Submission, review, merge and actual deployed listing remain separate states. Only the deployed registry detail/index and visible directory establish listing.

## Community review PR

[PR #1250](https://github.com/getpaseo/plugins/pull/1250) proposes the single record `plugins/hulkzzhou1/paseo-bot.json`, generated with the official `scripts/add.ts` at upstream revision `4fd2379bab088979a65de1a566a2c1c8138a560a`. It pins the same reviewed and installed release commit and links application #1246. No registry machinery or policy is changed. `submittedAt` preserves the issue creation time; generated review/publication timestamps are proposal values for the reviewer to finalize, not a claim of approval.

The initial issue intake was skipped because the external account could not add `submission`. Treating that as the final blocker was incomplete: current BOTS.md explicitly accepts hand-edited PRs. Following the user's direction, the author submitted the complete proposed record through this supported path without requiring browser authentication or another application.

Local trusted registry validation passed: `npm test` **172/172**, `node scripts/validate.ts --online --changed` **391 records well-formed, 1 changed record matches its pin**, and `git diff --check origin/main...HEAD`, all exit 0. Registry proposal commit: `457059d`. No plugin code ran during registry proposal preparation/validation. Earlier isolated author runtime acceptance is distinct from the community's pending independent artifact review. GitHub's Validate workflow started on the PR; approval, merge and deployed listing remain pending.

## Acceptance environment cleanup

After acceptance, all six task-owned fixture launchers were gracefully stopped; no fixture launcher remained. Their isolated daemon homes and private evidence were retained. The six implementer worktrees were removed only after checking their exact owned paths, tracked changes and integration ancestry; their branches remain available. The integration worktree remains, and `main` still points to the original initialization commit. The sibling reference checkout's pre-existing changes were preserved. Production daemon/config/plugin lifecycle was untouched. The server browser remains available for the user's optional GitHub sign-in; the stopped fixture pages will appear disconnected.
