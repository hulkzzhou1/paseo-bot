# Native conversation migration acceptance

2026-10-27. Issue #8, specification decision 17. Implementation tree `18f993e`, reviewed integration `2296d348`; subsequent `ed46f10` only corrects archive/storage wording, integrated at `b0e147f`. No legacy conversation drafts/outboxes are read or migrated; durable sessions and history remain intact.

## Checks

- `npm test`: exit 0, 27/27. Real isolated daemon boundaries; no monorepo suite.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`: exit 0.
- Independent Standards review: no blocking findings. Historical ADR/glossary wording corrected at `d4cc649`.
- Independent Spec review: one P2 stale archive confirmation promise, corrected at `ed46f10`. No routing or history blocker found.

## Browser and Provider evidence

Stable app/daemon/public SDK/CLI 0.13.2; npm latest rechecked as 0.13.2. Isolated daemon only, with directory plugin source `/tmp/paseo-bot-native-navigation`. Server Browser desktop 1120×900 and compact 390×844. Compact native page measured viewport and document scroll width both 390 px.

Before migration, clicking existing running history remained on the Bot surface, failing the native-navigation assertion. After migration, both existing history and accepted first send open the same-host native workspace/Agent. Returning to Bot leaves the entrance accessible instead of immediately reopening the previous session. Compact History displays existing sessions, statuses, Rename, Archive and Show archived conversations; opening an existing fixture conversation displays its canonical reply and native composer.

An actual Codex / GPT-6.1-Sol / high / Default Permissions turn ran `printf NATIVE_CHAT_TOOL_OK` and replied `NATIVE_CHAT_OK`. Native UI displayed the grouped “Ran 1 command” disclosure, native model/thinking controls, native composer and elapsed turn time. This harmless command did not require approval; this run does not establish a new permission-request test. Screenshots contain only isolated test prompts and synthetic conversations.

- [Desktop native chat](images/native-migration/native-v020-real-desktop.png)
- [Compact native chat](images/native-migration/native-v020-real-mobile.png)
- [Compact Bot history](images/native-migration/native-v020-history-mobile.png)

`node /tmp/paseo-bot-research/check-native-delivery-browser.mjs` exited 0 against final implementation. Its separate Playwright browser intercepted only the isolated daemon socket: one accepted first-send acknowledgement was dropped; a second first-send request was withheld before dispatch and explicitly retried with the same identity. Exactly two Agents, two user turns and two Provider executions resulted from three transport submissions. Both recoveries navigated to native chat; newer entrance text survived reload and subsequent return from native chat. [Sanitized assertions](native-navigation-result.json). Browser version 154.0.8037.0.

## Limits

Native iOS/Android and Electron were not tested. The plugin does not guarantee durable native-device entrance preferences/drafts. Existing conversation behavior now follows the native app, including archive and sending semantics. Other real Providers, native voice/attachments and new native permission/question flows were not separately exercised in this migration; the earlier plugin-specific evidence is historical, not a claim of testing those native flows. One host browser warning was present; no page console errors were reported after navigation. Production daemon was not restarted.
