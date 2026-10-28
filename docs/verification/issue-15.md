# Issue #15 — dedicated Coordinator preset

Work branch: `feat/paseo-team-profiles`, based on `integration/paseo-bot` at `9df62016bc8de1978b1be4b6bed336ee3383ebca`. This record covers #15; #16 remains a separate follow-up. No production plugin installation, configuration change, daemon restart, merge or release was performed.

## Implemented behavior

First entry asks for an existing source preset. It copies only standard runtime fields into a dedicated stable ID, seeds the public generic notes, preserves other presets and stores only the association/initialization outcome. Source edits do not sync. The entry explains the notes convention and native picker selection before entering the existing workspace. It creates no empty Agent.

Native and legacy creation share the same resolver. Explicit preset fields take precedence, Provider/mode conflicts fail before creation, and the legacy path resolves an actual model before the SDK call. The creation hook loads notes once, preserving other system instructions. There is no second fixed role prompt. Ordinary project directories and existing sessions retain their behavior. The dedicated directory must remain a coordination directory: the public creation hook supplies cwd/config but no workspace/parent identity.

## Verification in progress

Public SDK packages and the CLI report 0.13.2. Current deployed documentation was consulted through the browser: plugin quickstart/reference, SDK config reference and Agent profiles. Public `config.get/patch` and `agent.create` availability was checked against installed declarations and exercised through real isolated daemons. No private host imports or configuration-file reads were added.

RED: `node --import tsx --test --test-name-pattern='first entry copies' tests/native-workspace.test.ts` failed with missing RPC (exit 1). GREEN passed (1/1, exit 0). A separate runtime-rule RED failed with zero custom rule occurrences, then GREEN passed. A duplicated incoming-notes RED failed with two occurrences; GREEN passed with exactly one.

`npm run typecheck`, `npm run lint`, formatting and whitespace checks have passed during implementation. Focused native/management regression initially passed 8/9: the conflict fixture used a mode rejected by the SDK before the plugin hook. The fixture now exposes a second real mode/provider; the focused conflict test passes and exercises the hook.

Final suite, independent review, browser evidence, real-model evidence and final revision will be recorded before delivery.

## Accepted limits and remaining scope

Public Agent profile updates replace the whole array without cross-client CAS. Serial plugin operations, a fresh read before writing and stable-ID read-back reduce the window; simultaneous cross-client edits can still be lost. This accepted limitation is shown in the setup UI and overview. Initialization is first-open behavior, not an installation hook. No native preset auto-selection API is claimed.

#16 owns the full editing/empty/upgrade/delete/failure recovery acceptance matrix; this branch supplies the shared resolver without adding deletion restrictions. Native iOS/Android and Electron, other real Providers, and real external tracker/forge writes are untested.
