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
