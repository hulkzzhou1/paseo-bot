# Bot goal-coordination role

2026-10-28. Issue #11. Generic goal-coordination implementation and Provider execution acceptance were reviewed at `1f0947107c8378e4d6420f22b74848e0f567ef3e`. Specialist-workflow precedence was subsequently added and separately re-reviewed at `8fdf076c26b2b5122e8701efb946de1dcddac0e1`; this changes the final runtime prompt.

Bot owns continuing coordination toward user goals; project Agents own concrete execution. The first prompt paragraph defines the role without imposing a fixed conversation/dispatch checklist. Conflicting permission to carry out arbitrary assigned work was removed. Existing targeting, approval and normal parent/child completion guidance remains. No tool permissions or Provider defaults changed. A subsequent tool-choice clarification gives applicable specialist skills/workflow tools precedence over generic Paseo dispatch. The generic path is now explicitly conditional; required workflow associations are not bypassed.

## Checks and independent review

- RED: `node --import tsx --test --test-name-pattern 'native creation retains' tests/native-workspace.test.ts` failed against the previous injected role, exit 1.
- GREEN: the same focused command passed, exit 0. The real isolated daemon/fixture Provider observed the new role alongside the user's original profile instructions, unchanged mode, zero preapprovals and unchanged MCP servers.
- Existing-session characterization: `node --import tsx --test --test-name-pattern 'reloading an existing' tests/native-workspace.test.ts`, exit 0. A conversation created with historical instructions while Bot was disabled retained those instructions after plugin enable and public Agent refresh, and remained in history.
- The initial characterization used `paseo agent reload`, whose baseline CLI lookup omitted the background Agent and returned AGENT_NOT_FOUND. The corrected public Node driver `refreshAgent(exactId)` reached the same refresh RPC and passed. No production Agent was reloaded.
- `npm test`: exit 0, **34/34**, 53.9 seconds. Typecheck, lint, format:check and whitespace checks exit 0. No Paseo monorepo suite.
- Independent Standards review: zero documented violations or material smells. Independent Spec review: zero implementation findings. Both reviewed `2e83bbf...1f09471`; actual Provider acceptance below is author evidence.

## Actual Provider behavior

Isolated daemon home only; app/daemon/CLI/public SDK 0.13.2. Root Bot used actual Codex / GPT-6.1-Sol / low / Auto-review, receiving the role through the normal native workspace creation hook. Host MCP injection was enabled only in this generated test daemon; plugin code does not enable it.

1. **Explore:** a Chinese user request to discuss a still-unclear requirements tool produced a contextual discussion and a question about the team's real difficulty. No tool calls, task creation or child Agents.
2. **Execute:** a concrete request to write and verify `result.txt` in an existing visible synthetic project resulted in exactly one project Agent, normal parent relationship and completion notification. The child wrote/read `ROLE_DELEGATED_OK`; Bot reported its real identity, then summarized its completion. Bot's only shell call read the installed Paseo skill; it issued no project implementation tool calls.
3. **Change and follow through:** a later requirement changed the marker to `ROLE_CHANGED_OK`. Bot read the existing Agent status and used `send_agent_prompt` with the same exact Agent and `notifyOnFinish:true`, rather than creating another Agent. The same project Agent changed/read the file and Bot summarized the received result. Child remained outside Bot History.

`verify-role.mjs` and both `settle-role.mjs` marker assertions exited 0. [Sanitized SDK assertions](bot-role-result.json). These establish this actual run, not a deterministic guarantee for every future Provider response.

Server Browser opened Bot History and the same native conversation. Desktop 1120×900 and compact 390×844 displayed the follow-up and native child-completion row. Compact document width matched viewport width. [Desktop](images/bot-role/bot-role-desktop.png), [compact](images/bot-role/bot-role-mobile.png). Screenshots contain only isolated synthetic tasks. New-origin host discovery logged one localhost error before successful connection plus host warnings; no plugin error occurred during the accepted navigation.

## Existing conversations and limits

0.13.2 public `PaseoAgentConfig.systemPrompt` and `agent.create.config` support new saved instructions. `AgentConfigApply` accepts only model/mode/thinking/features; low-level `updateAgent` accepts name/labels; the installed `PluginSessionOpenRequest` exposes launch environment, not saved systemPrompt. Current public docs also distinguish saved creation config from launch-only contributions. No supported existing-systemPrompt update path was found.

Existing conversations retain their saved instructions, even after reload. Start a new native Agent conversation in Bot to adopt this role. Existing history remains intact. No private store edits, unsolicited migration prompts, task replay or production conversation changes were used.

Role guidance is a model instruction, not a new permission sandbox or autonomous background monitor. Normal parent/completion notifications provide continuation; the plugin adds no polling scheduler. Native iOS/Android and Electron, beta App runtime and other real Providers were not exercised. Provider permission/question/voice/attachment flows were not separately retested in this role change. Production daemon was not restarted.

The TAPD clarification was checked against installed `paseo-tapd` skill and the actual `tapd_agent_options`, `tapd_dispatch_agent` and `tapd_bind_agent` tool schemas, without executing or changing any real TAPD item. The actual Provider run above exercises generic project delegation; it does not establish TAPD dispatch acceptance. A second focused RED/GREEN cycle verifies specialist-workflow priority is injected through the same public creation boundary.

After reloading the directory plugin, a newly created real Codex conversation asked how Bot would handle a TAPD item, explicitly without reading an item or dispatching. It read the installed Paseo TAPD skill and selected `tapd_agent_options` / `tapd_dispatch_agent`, preserving item association and reporting missing tools as a blocker. It assigned implementation to project Agents. The only call read the skill; no real TAPD entity or write tool ran. [Actual discussion result](bot-role-tapd-discussion.json). This checks routing comprehension, not TAPD dispatch integration. Both re-review axes reported zero runtime findings; their revision-attribution correction is reflected above.
