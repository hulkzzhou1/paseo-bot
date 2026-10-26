# Ticket #2 verification

Implementation and review-fix revision: `6739635980a250fea72af04eecc53996015caec6` on `implement/issue-2`. The native-style layout was introduced in `72caadd9e73bd28eaca0dd2ee49239486f25990c`; review fixes add explicit observation retry and native follow-scroll. The branch incorporates integration decisions 15 and 16 through `08dbd3a` (native devices not guaranteed; conversation UI follows native Paseo). This record covers the first slice, not tickets #3–#7 or community publication.

## Versions and isolated boundary

- Paseo CLI, daemon, app and plugin/client/protocol SDK: **0.13.2**. Manifest accepts exactly `0.13.2`; no earlier/future version compatibility is claimed.
- Actual configured Provider used by the root browser verification: **Codex**, model **gpt-6.1-sol**, thinking **high**, **Default permissions**. Installed binary reports `codex-cli 0.160.1`.
- Focused tests start packaged public `paseo daemon run --home <temporary-home>` with an OS-allocated loopback port, generated test password and their own plugin config. Test child processes inherit ordinary Provider authentication but remove all deployment `PASEO_*` overrides before setting the isolated home/listener. They never repurpose `HOME` or `CODEX_HOME`.
- Browser acceptance instance: `/tmp/paseo-bot-test-A7anD5`, loopback port `43583`. Its generated credential is kept outside the repository in a mode-600 file and is not included in logs or screenshots. Production port 6767 and production configuration/plugins were not changed.
- Durable Bot metadata stores installation identity, workspace/session references, configuration and a first-request fingerprint. Paseo owns all conversation transcripts. First-create retries verify the matching `clientMessageId` through paginated daemon history before acknowledging success; they do not resend a potentially executed prompt.

## Commands and results

All commands below ran in the issue-2 worktree; no full Paseo monorepo test suite ran.

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm install --include=dev --ignore-scripts --no-audit --no-fund` | 0 | Local development dependencies installed and lockfile committed. This shell otherwise omits development dependencies. |
| `npm run typecheck` | 0 | Strict TypeScript check with no DOM library; public runtime imports only. |
| `npm run lint` | 0 | Biome checked all 17 executable/config source files. |
| `npm run format:check` | 0 | Biome reported no formatting differences. |
| `npm test` | 0 | 3 focused tests passed through actual isolated daemons plus 2 focused public-SDK observation boundary tests, approximately 20 seconds. |
| `npm run test:daemon` | 0 | Focused daemon entry point also passed. |
| `git diff --check` | 0 | No whitespace errors. |
| `paseo --version` | 0 | `0.13.2`. |
| `codex --version` | 0 | `codex-cli 0.160.1`. |
| `paseo agent stop --help`, `paseo agent update --help` | 0 | Public Stop/rename CLI paths confirmed; this is not their behavioral acceptance test. |
| `env -u PASEO_PASSWORD paseo plugin reload paseo-bot --home /tmp/paseo-bot-test-A7anD5 --json` | 0 | Exact isolated plugin reports `status: running` after native-style update. |

The meaningful red/green regression was “a model with thinking choices requires an explicit choice before creating resources”: it initially failed with `Missing expected rejection` (exit 1); adding server-side explicit-choice validation made it pass (exit 0). Earlier harness setup failures exposed missing development tooling, the persisted daemon config schema, mandatory plugin cleanup, and inherited password overrides; they were fixed rather than reported as product-test success.

The retained daemon tests cover opening without creating empty resources; simultaneous duplicate and distinct first sends; one shared background directory workspace and independent session identities; one initial user message and the fixture Provider's completed streamed answer in real daemon history; request/payload mismatch rejection; and missing thinking choice rejection before resource creation. The fixture uses the supported public Provider registration boundary and does not replace the real configured Provider evidence.

## Browser and visual evidence

Root-agent server-browser verification against the isolated instance has completed the real Codex text chain: open Bot with no business workspace, explicitly choose the real configuration, send a no-tools prompt, observe pending and receive Markdown heading `Bot verification` plus `BOT_TEXT_CHECK_OK`. The accepted draft clears, the background Bot workspace stays hidden, reopening restores configuration preferences, and History restores the exact owned session and daemon transcript. The root repeated the final visual and history checks after the native-style layout and review fixes.

Native reference screenshots were inspected by the implementer at desktop 1120×720 and compact 390×844. They are stored outside the repository under `/data/home/hulkzzhou/.local/share/paseo-server-browser/visual/wks_dbcf6ede44f19eae/artifacts/` as `native-reference-desktop.png` and `native-reference-mobile.png`. The revised plugin uses the native content width/gutters, a right-aligned rounded user bubble, host Markdown without role labels, a bordered rounded composer, circular send button and compact configuration controls. It uses only public React Native primitives, public host Modal/Icon/Markdown and theme tokens; host private chat components are not imported.

The final runtime at `6739635` was visually inspected against the native references. Evidence committed with this record:

- [Desktop, 1120×720](images/issue-2-desktop.png).
- [Compact browser, 390×844](images/issue-2-mobile.png).
- [Dark compact browser, 390×844](images/issue-2-mobile-dark.png). Browser `prefers-color-scheme: dark` and surface `rgb(24, 27, 26)` were checked before capture.

The final Provider chip opens the public host Modal with Claude/Codex/Pi choices, and selecting Codex returns to the composer. Selecting a Provider resets dependent configuration and requires explicit choices again. New/History/Send compact targets measure 44×44 pixels. Reopening and selecting History restored the actual Codex answer. Final browser console: zero errors and one warning; initial app connection probes before selecting the isolated host are not plugin errors.

## Explicit limits

Browser device preferences use the skill-supported, platform-gated `client/web.ts` adapter, with storage errors shown. The 0.13.2 global-screen SDK has no supported native device persistence API; native devices are not guaranteed under the user's explicit decision. Electron, iOS and Android were not tested. Browser mobile width does not constitute native testing.

Stop, tool cards, permissions and Provider questions belong to #3; full paginated history, rename and drafts to #4; archive/rebuild to #5; delivery/reconnect recovery to #6; management, complete acceptance and publication to #7. [Compatibility evidence](../compatibility.md) distinguishes the available public paths from interactions still awaiting runtime validation. No tickets were closed and no release was published by this implementer. Independent Standards/Spec review is owned by the integration workflow; its first #2 pass raised two P2 findings, both addressed below.


## Independent review fixes

The Standards finding identified that SDK timeline errors release the subscription, while the old listener treated the error as another update and refetched once. The focused public-SDK boundary test reproduced the defect (exit 1, missing expected observation error). The extracted observation lifetime now makes failure visible, blocks sending while observation is unavailable, ignores queued/late work after failure or teardown, and exposes **Retry live updates** to establish a fresh observation. Focused tests for error/retry and late teardown responses pass (exit 0). The controllable event source is an external SDK boundary test, not a replacement for the real daemon/Provider acceptance chain.

The Spec finding identified missing native follow-scroll. Root reproduced it with a real isolated Codex 60-line answer: message viewport `clientHeight=498`, `scrollHeight=1754`, `scrollTop=0`, bottom gap `1256`; `SCROLL_CHECK_END` was below the viewport. Screenshot: external artifact `issue-2-scroll-before-fix.png`. The message ScrollView now has testID `bot-messages`, starts selected history at the bottom, follows content/layout growth while within 64 pixels of the bottom, and preserves manual scrolling away. Root repeated the exact desktop assertion after the fix: the same 498/1754 viewport/content measured `scrollTop=1256`, bottom gap `0` (exit 0; before-fix assertion exited 1). A second actual Codex turn added 40 lines. While the transcript grew from 1876 to 2917 pixels, manual scrolling to `scrollTop=0` remained at zero through completion (assertion exit 0). Compact history reopening also passed: width 390, viewport 594, content 4355, `scrollTop=3761`, bottom gap `0` (exit 0).

Both independent reviewers rechecked `6739635` and reported **Standards: 0 findings; Spec: 0 findings**. Merger integrated the reviewed source `af49a610b5ae20f4f649d576b735341e9fb2db5c` as `c04c3e07629ca5d0bc3a692fbc72b1d8ea9fb004` without conflicts. This root evidence update contains documentation and screenshots only; no implementation changed after the recorded checks.
