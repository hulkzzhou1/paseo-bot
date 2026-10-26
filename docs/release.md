# Release status

Public Git **v0.1.0 is released**: [GitHub release](https://github.com/hulkzzhou1/paseo-bot/releases/tag/v0.1.0). Immutable reviewed and installed revision: `ffedf6a953ad25dae53f3f5903a2e5fcafb75b72`. The annotated remote tag peels to this exact commit. The integration branch may advance with acceptance and registry status records; that does not change the release pin.

| Milestone | Actual state |
| --- | --- |
| Implementation and actual Provider/browser acceptance | Complete; [slice evidence](verification/issue-7.md) |
| Final Standards / Spec | 0 findings each at the immutable revision |
| Public fixed Git tag/release | Published, v0.1.0 |
| Fresh remote exact-SHA installation | Passed; Git HEAD and public installation revision match |
| Official registry submission | Not submitted yet |
| Registry review / deployed listing | Not started / not listed |

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
