# Direct native entry after local feedback

The user explicitly removed both the first source-selection page and the later Open Team workspace intermediate page. This supersedes the entry flow in #15/#16 without changing existing preset resolution, notes, deletion fallback, permission checks or history ownership.

Normal entry now calls only the existing `open-workspace` RPC and public native navigation. It never invokes source setup or writes presets. First use without a dedicated association uses valid native settings and one public default rule set; previously configured dedicated presets continue to work. `prepare-coordinator` remains a compatible explicit RPC, with its existing uncertainty safeguards. Errors retain recovery/history/retry controls. No new editor or alternative setup flow is introduced.

## Verification

Browser RED at `6fbf410`: after clicking Paseo Team, the native Agent action did not appear within 10 seconds because the intermediate page remained. GREEN after the client change: the same action opened the native New tab page directly, with neither the source chooser nor intermediate Open Team workspace button.

The public isolated-daemon native entry test additionally checks concurrent open, no Agent until sending, no profiles before/after, actual Provider runtime inputs and one public default rule set. Existing preset/lifecycle tests remain intact, including edited/empty notes, deletion, unknown association and lost acknowledgements.

Final executable revision: `7389f157dff723baa995c11aea525b8d2946d3e5`. Later delivery commits contain only documentation, sanitized results and screenshots.

An independent review caught one P2 in the initial direct-entry candidate: a legacy preset write that persisted but lost confirmation was no longer reconciled by the entry. A real isolated 0.13.2 daemon RED reproduced an incomplete-setup failure on the next send. Opening now checks only an already saved pending stable ID: if found, it confirms plugin metadata and preserves current preset content; if absent, it reports unknown without another patch or deletion fallback. The updated lost-ack/commit-unreadable tests recover through `open-workspace` and inspect the actual Provider result before invoking any legacy setup RPC.

| Check | Result / exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, no warnings |
| `npm run format:check` and `git diff --check` | 0 |
| `node --import tsx --test --test-name-pattern='native entry needs' tests/native-workspace.test.ts` on 0.13.2 | 1/1, 0 |
| `node --import tsx --test --test-name-pattern='lost acknowledgements\|unconfirmed initialization' tests/coordinator-lifecycle.test.ts` on 0.13.2 | RED then GREEN 4/4, 0 |
| `npm test` with the fixed 0.13.2 CLI on final executable revision | 47/47, 0; 121.9 seconds; no skipped/cancelled tests |
| Browser direct-entry check on 0.13.2 | RED 1, GREEN 0 |
| Fresh 0.14.0-beta.1 browser navigation/draft/read-failure retry | 0; desktop 1120×900, compact 390×844; document width 390 |
| Fresh-entry public SDK read-back on beta | 0; no Agent or Coordinator association created; unrelated source preset unchanged |
| Fixture Provider send on 0.14.0-beta.1 | 1: `Provider bot-test is not configured`; beta Provider/model behavior remains unverified |

The ambient CLI and running local daemon were externally upgraded to 0.14.0-beta.1 during this change. Baseline Provider/full tests were therefore explicitly pinned by prepending the retained 0.13.2 CLI bin directory to PATH (that executable reports 0.13.2). The newer app/daemon loaded the plugin and passed the stated limited UI checks, but rejected the existing fixture Provider. No host workaround, private module import or false model-success claim was added. SDK dependencies remain 0.13.2.

[Sanitized result](direct-native-entry-result.json), [desktop first open](images/direct-entry/desktop-first-open.png), [compact native New tab](images/direct-entry/mobile-native-open.png), [compact native draft](images/direct-entry/mobile-native-draft.png), [recoverable read error](images/direct-entry/mobile-retry-error.png). Existing server Chromium/Playwright performed the browser checks because no client browser automation host was connected.

Independent Standards and Spec reviews rechecked final executable SHA `7389f157dff723baa995c11aea525b8d2946d3e5`, with no remaining findings. Standards independently repeated the recovery tests on fixed 0.13.2 (4/4, exit 0). Spec's two P3 documentation references to an entry explanation were replaced by public documentation and existing creation error hints. This review covers the latest user decision; older two-ticket evidence stays historical.

The user separately authorized installing on this local daemon after the original isolated-only delivery. The fixed Git revision is applied through the public plugin updater using the same `paseo-bot` runtime ID; local installation status and before/after state checksum are checked without restarting the daemon or creating a live model task. Installation alone does not establish beta Provider compatibility.

## Scope limits

The initial native New tab screen and its Agent action belong to Paseo. The plugin uses supported workspace navigation and leaves native draft/tab restoration to the host. It does not create an empty Agent to force a chat route.

Native iOS/Android and Electron are not tested. The prior real-model coordination evidence remains applicable because the default rule text is unchanged. Preset array writes through the retained legacy setup RPC still lack cross-client CAS.
