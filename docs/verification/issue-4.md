# Issue #4 implementation evidence

Base: `069e9e4` on `integration/paseo-bot`; implementation branch `implement/issue-4`. App/daemon/public SDK target remains the actually installed stable 0.13.2. Browser acceptance and independent review are pending root integration; no native/Electron acceptance is claimed.

## Boundaries and behavior

- Plugin RPC → real isolated daemon → existing public Provider registration/adapter. History tests create three independent Bot Agents, a same-workspace non-Bot Agent, rename through the selected daemon's public CLI, then archive one Bot Agent. Only the exact owned, unarchived Agents enter ordered cursor pages; initial titles and final idle status are read from actual daemon snapshots. Rename response is confirmed against a fresh durable Agent snapshot.
- Device draft/selection boundary: a browser storage adapter is passed into the state module; host + installation + exact conversation/new-slot keys isolate data. Revision tokens protect edits even if text changes away from and back to the submitted string. A successful first-send acknowledgement promotes newer edits into the created conversation; failed writes report an error while retaining in-memory edits. New and history selection load each slot without creating an Agent or stopping another turn.
- Desktop history is a compact dropdown; compact layout uses the public Modal. Accessible 44px controls, loading/empty/error/retry and rename pending/error states are present. History refreshes while open and loads additional cursor pages explicitly. All runtime UI continues to use public SDK and React Native primitives.

## Red → green

1. Device persistence/revision test first failed with missing `client/device-state.ts`; implementation then passed. Initial test invocation lacked development tools because the environment omitted dev dependencies; reran installation explicitly with `npm ci --include=dev --ignore-scripts --no-audit --no-fund` before recording the actual missing-module red.
2. Real history boundary test failed with `Plugin paseo-bot does not contribute RPC list-conversations` (exit 1). Added exact-owned history/rename RPCs and public CLI binding; same scenario passed (exit 0, ~9s).
3. Blocked-storage test failed because edits re-read unavailable storage rather than remaining usable in memory (exit 1). Cache the empty in-memory slot before reading; failure stays visible and subsequent edits remain accessible (exit 0).
4. First-send edit-promotion test failed with missing `device.created` behavior (exit 1); implement promotion and preserve the newer revision (exit 0).

## Commands

All commands run from the issue-4 worktree, without production configuration or port 6767 lifecycle actions.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Client/server/shared/tests checked |
| `npm run lint` | 0 | 22 project files checked |
| `npm run format` | 0 | Project formatting applied |
| `npm test` | 0 | 9/9 tests, including real isolated daemon tests |
| `git diff --check` | 0 | No whitespace errors |

Focused red/green commands: `node --import tsx --test tests/device-state.test.ts` and `node --import tsx --test tests/history.test.ts`.

Untested here: actual dual-browser storage separation, visual desktop/mobile/touch/keyboard acceptance and actual Provider history navigation; root acceptance records will supply these. Native device persistence is explicitly unsupported by stable 0.13.2's public global-screen API under accepted specification decision 15. No screenshot is fabricated from fixture assertions.
