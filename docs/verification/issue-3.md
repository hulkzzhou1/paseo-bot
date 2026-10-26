# Execution, permissions, questions and Stop (#3)

Implementation baseline: integration `069e9e4`; latest stable app/daemon/public SDK baseline remains 0.13.2. Browser-first guarantee and native conversation appearance follow specification decisions 15–16. The sibling Paseo checkout and production daemon/configuration were not changed.

## Public boundary

The selected host supplies `paseo` to server RPCs. Every Stop/response refreshes an exact owned UUID and checks its metadata record, workspace and installation label. Archived records reject mutations. Responses additionally match a currently pending request ID and provider action ID/behavior. Question input is validated, original metadata is preserved, and answers use provider-compatible header-keyed strings, including comma-separated multiselect labels. Unknown question shapes offer safe dismissal with an explicit unsupported message.

Stop uses the public `paseo agent stop <exact-id> --home <selected-daemon-home> --json` command without a shell. The daemon home must be absolute/nonempty. Inherited endpoint/password overrides are removed. Exit zero is insufficient: fresh session state must show no running/initializing status, active turn, or pending request. Refused/unknown outcomes remain errors and do not claim success. Stopping one turn does not affect other Bot sessions. An idle async Provider question blocks Send but is presented as waiting for an explicit answer/dismissal, rather than a running turn; the public CLI does not stop idle questions.

The native-style execution UI uses only public RN/theme/UI primitives: compact tool rows, bounded expandable output/error details and compact Modal, permission cards with provider-supplied actions, and radio/checkbox/text/secret question inputs. The stable composer remains editable while sending is blocked during execution or a pending request. Only actual running/initializing/active-turn state exposes Stop. Page teardown releases observation without interrupting execution.

## Deterministic isolated-daemon evidence

- `node --import tsx --test tests/execution.test.ts`: initial red exit 1 because the plugin contributed no `stop-conversation` RPC; first green exit 0 after implementation.
- `npm run typecheck`, `npm run lint`, `npm run format`: exit 0.
- `npm test`: exit 0, 8/8 tests. This includes the prior creation/observer checks and three execution tests against actual fresh isolated 0.13.2 daemons and a public registered fixture Provider.
- The execution tests cover idle Stop, unknown UUID rejection, exact-session cancellation with a second turn still running, refusal despite CLI exit zero, permission-pending cancellation, real tool success/failure timeline items, exact/cross-session/stale permission identity, allow/deny, required question answers, multiselect/header mapping and preserved original input.
- A first question test exposed asynchronous permission resolution (the old request can remain in a refreshed snapshot just after response acknowledgement). The test now waits for the next distinct request. The UI keeps successful response actions disabled until that request actually resolves, avoiding repeat submission during the acknowledgement/resolution gap.

The fixture produces deterministic states; it does not replace actual Provider/browser acceptance. Root acceptance owns the real Codex chain, desktop/mobile/dark screenshots and independent Standards/Spec review. Those evidence items must be appended before ticket closure. iOS, Android native and Electron remain untested.

## Spec review correction: combined multiselect/custom answers

Independent Spec review found that a multiselect custom answer replaced selected options and selecting another option erased the custom text. Root reproduced the UI failure on the old runtime: select One, type Three, select Two; the custom input became empty (assertion exit 1).

Multiselect now keeps the typed custom value when checkboxes change and serializes selected labels followed by that custom value. Single-choice custom text and selected options replace one another visibly. The same small serializer is used by the actual request card and the real-daemon question test; the Provider must receive exactly `Choice: "One, Two, Three"` while retaining the original question input and secret answer.

The new response-boundary regression initially failed with the missing serializer (exit 1). After implementation, `npm test` passed 8/8 (exit 0); typecheck, lint, format and whitespace checks also exited 0. Root's UI replay and final independent review are recorded separately before closure.

## Root browser and real Provider acceptance

Root tested implementation `0baae59`, then the correction `2ade873`, through the Server Browser plugin against isolated daemon home `/tmp/paseo-bot-test-A7anD5`, port 43583. Actual app/daemon/SDK: 0.13.2; real Provider: Codex 0.160.1, `gpt-6.1-sol`, high, Default Permissions. No production lifecycle/configuration/plugin changes were made.

- The actual Codex session executed a harmless `printf`, then requested user approval for a second harmless print command. Root left the page, returned through Bot History, edited `DRAFT_WHILE_WAITING` while only Stop was available, clicked **Accept**, and observed the actual completed reply `TOOL_PERMISSION_CHAIN_OK`. The draft remained unchanged and Send returned after completion. This is the required real text → tool → approval → continue → completion chain.
- Actual Codex `request_user_input_async` produced an idle session with a pending question. Bot correctly showed **Waiting for your response**, disabled Send, kept the draft editable and did not show a false running Stop. Root selected Hello and submitted; the actual answer was `Hello QUESTION_CHAIN_OK`, with `QUESTION_WAIT_DRAFT` preserved. Subsequent real questions were used to inspect the final single-question card against the native reference.
- The public fixture Provider in the same isolated daemon supplied successful and failed tools. Expanding the failed row showed `failed`, `fixture stderr`, exit code 1 and its error. Allow and Deny both reached the actual adapter; Deny returned `behavior: deny` with the chosen action ID. Its multiselect/secret form reproduced the old custom-answer loss (exit 1), then the same One → Three → Two browser assertion passed after correction (exit 0); the Provider received **One, Two, Three**, original sentinel metadata and the test-only secret value.
- Browser Stop of `hold-one` returned **Stopped. You can send your draft.**, preserving `AFTER_STOP_DRAFT`. Public CLI inspection confirmed that exact session idle while `hold-two` remained running after navigation and cancellation of the other session. Refused Stop showed **Stop was not confirmed**, retained Stop and blocked Send; the refused session remained running. An idle Stop and permission-pending cancellation are also covered by the retained real-daemon tests.

Screenshots were captured from the real runtime and visually inspected: [approval desktop](images/issue-3-permission-desktop.png), [question desktop](images/issue-3-question-desktop.png), [question compact](images/issue-3-question-mobile.png), [Stop refusal compact](images/issue-3-stop-failure-mobile.png). The approval screenshot precedes only the multiselect correction; that card's implementation did not change. Native reference captures remain outside the repository. Screenshots contain only isolated acceptance resources and test prompts.

Independent reviews: Standards **0 findings** at `0baae59`; Spec's one P2 was corrected in `2ade873` and independently re-reviewed with **0 findings** (focused real-daemon regression 1/1, exit 0). Integration merge `ef502ec2141c4724377705e854151460f8a7b01d` contains the corrected slice; combined #3/#4 merge `79993c786d5979b4ece85b5853e58e1cd756ea0c` retains it and the combined 13/13 checks recorded in #4. Full reconnect/delivery recovery remains #6; native and Electron remain untested.
