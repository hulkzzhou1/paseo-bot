# Issue #7 verification

Implementation starts from `d6baf4655fd2301d7a162b9e02d5afaad38a721e`, Paseo app/daemon/CLI/public SDK 0.13.2. The management slice adds an owned-Bot-only system prompt and public same-host parent/child navigation. It preserves Provider mode, approvals and the daemon's MCP injection/tool policy; it does not enable management tools. Native MCP provisioning does not pass through the plugin's workspace creation hook, so business-workspace guidance is not described as universal enforcement.

## Test-first evidence

`node --import tsx --test tests/management.test.ts` first exited 1: the fixture's public timeline configuration reply had no Bot system prompt. It passed after adding owned-Bot guidance without changing normal Agent configuration. A second red exited 1 for the missing delegation boundary; the implemented boundary passed with actual same-host parent/child Agents, an unrelated Agent with the same title, a foreign-parent-host label and a nonexistent ID. Delegates remain outside Bot conversation history. Both tests run against fresh real loopback daemons and an explicitly selected deterministic Provider, not mocked daemon RPCs.

The client uses documented parent label fields directly because the plugin client bundler permits protocol types but not protocol runtime imports. Navigation revalidates the exact Agent and actual workspace before using public host navigation; subscriptions and in-flight reads are released on selection/host teardown. Disabled/unavailable navigation produces an explicit message.

| Command | Exit | Result |
| --- | --- | --- |
| `node --import tsx --test tests/management.test.ts` | 0 | 2/2 isolated-daemon management cases |
| `npm run typecheck` | 0 | Client/server/shared/test contracts |
| `npm run lint` | 0 | No findings |
| `npm run format:check` | 0 | Formatting matches |

Root owns actual Codex management/delegation/notification browser acceptance on a separate isolated daemon, desktop/compact screenshots, independent Standards/Spec reviews, exact-SHA Git installation and registry submission. These remain pending for this first implementation checkpoint. Native iOS/Android and Electron are untested. Release publication, registry submission, review and actual listing are separate states; this checkpoint is not publication.

## Git release preparation

The manifest targets exactly 0.13.2 and uses `npm ci --omit=dev --ignore-scripts`. Only the standalone Node recovery helper's client/server imports require direct production dependencies; host-supplied plugin/protocol/schema declarations are development dependencies. The lock was updated with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` (exit 0), without replacing the shared development environment.

English `OVERVIEW.md` discloses management setup (`daemon.mcp.injectIntoAgents` defaults false), normal tool permissions, shared files, Provider data flow, browser state, offline host-unmount behavior and native/Electron limits. Original source has an MIT license. Third-party notices reproduce upstream Paseo **v0.13.2** Apache-2.0 attribution and Zod's MIT text. Package media currently references already committed actual #3 desktop/mobile screenshots; root will add actual #7 images before freezing the release.

`npm test` passes **24/24** (exit 0), including all prior executable slices and the two new management cases. Typecheck, lint, format, `git diff --check` and `node --check server/recovery-probe.mjs` all exit 0. `npm pack --dry-run --json --ignore-scripts` exits 0 and includes both entries, every imported local module, the ordinary ESM helper, overview, license/notices and screenshots. This is an inventory check only: the release source is Git, whose committed `package-lock.json` is required; no npm publication or shrinkwrap workflow is introduced. A separate assert-based self-check confirms referenced media/entries exist, all lock package entries have exact versions/resolved URLs/integrity and the overview contains no forbidden installation commands (exit 0).

Production-only preparation was also executed against a fresh clean `git archive` of packaging checkpoint `5a8cbd1` (product checkpoint `03cacb2`): `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` exited 0, installing 486 packages. With the test driver kept outside that artifact, all three real isolated-daemon lifecycle tests ran with the installed plugin source pointing at this clean production-only archive (3/3, exit 0). This includes disabling the plugin, externally archiving its workspace, re-enabling it and using the ordinary ESM recovery helper to identify durable archive state. It verifies that production preparation supplies required helper imports without relying on development dependencies. The temporary artifact does not replace root's required remote exact-Git-SHA installation/browser acceptance.
