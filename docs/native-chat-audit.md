# 原生对话复用与体验差异审计

2026-10-27。对象为已安装的 Paseo Bot v0.1.0（`ffedf6a953ad25dae53f3f5903a2e5fcafb75b72`），对照真实 Paseo 0.13.2 浏览器和稳定版源码 `d2941157a8f91512daf54fc688241d416e8f5ebd`。这是单用户、多并发会话的插件界面审计，不是完整安全审计。源码参照是独立只读 checkout `/tmp/paseo-native-audit`，不是旁边有未提交改动的 Paseo checkout。

## 首要结论：完整原生页可以复用

公开 `PluginScreenProps.navigation.openAgent({agentId, serverId})` 能打开同一个 Bot Agent 的完整原生对话页。本轮已在隔离 daemon 的同一 Agent 上实际打开原生页，确认原生模型/思考/权限选择、六点运行反馈、耗时和消息操作可见。现有 `client/delegated-targets.tsx` 已使用此接口打开委派目标。

公开 `@getpaseo/plugin/client/ui` 只有 Markdown、StreamedText、Modal、Icon、输入及设置基础组件等，未导出完整 Agent 对话、模型选择器或时间线组件。因此：

- **直接打开原生页：支持。** Bot 插件保留专用工作区、会话身份、入口、新建与历史，聊天交给宿主。
- **把完整原生页嵌进 Bot 自定义页面：0.13.2 无公开组件接口。** 要做到这一点需宿主扩展；不能私用 app 内部模块。
- **继续仿制聊天页：可行，但需要持续跟进下面的功能和交互差异。** 之前以基础通路测试通过来表述“基本还原原生”不充分。

推荐优先评估直接打开原生页。不能默默切换，因为它会离开 Bot 全局页面，使用宿主的配置修改、运行中发送策略、草稿和归档交互；原规格的 Bot 专属工具栏、运行中禁发、归档只读等不能自动视为仍被插件强制保证。首条发送前的配置、新建页和历史入口也不会因 `openAgent` 自动变成原生，需要另行确定入口流程。

## 已核实差异

“遗漏”表示已有数据或基本交互没有呈现；“产品差异”需要结合原规格决定；“接口边界”不应冒充已支持。

| # | 等级与性质 | 场景、当前行为及影响 | 原生依据 / 最小处理 |
| --- | --- | --- | --- |
| 1 | 必须修：交互 | 连续工具调用逐条占据消息流，仅单条详情能折叠；长任务滚屏严重。浏览器断言找不到工具组，实际失败。 | `tool-calls/detail-level/overview/view.tsx`、`grouping.ts`：连续调用摘要、桌面内联展开、紧凑模式弹层。直接原生页可全部复用。 |
| 2 | 必须修：状态样式 | Running 是输入区上方固定提示文字；工具内使用圆圈 ActivityIndicator，没有原生运行反馈。 | `components/synced-loader.tsx`、`synced-loader-state.ts`、`agent-stream/turn-footer.tsx`：14px 六点网格、950ms 周期、减少动态效果支持，位于 turn 尾部并伴随耗时。 |
| 3 | 必须修：选择交互 | 新会话先选 Provider 再选 Model，均为无搜索的独立 Modal，换模型清空 thinking。大量模型时难以找到目标。 | `components/combined-model-selector.tsx`、`model-browser.tsx`：统一 Provider/Model 浏览、搜索、当前项、设置和 profile 入口；桌面与紧凑布局分别处理。 |
| 4 | 产品差异兼真实性问题 | 已有会话配置变成不可点击文字；显示值来自创建时保存的 `conversation.config`。如果在原生页/CLI 改权限或思考选项，Bot 可继续显示旧值。 | `client/bot-screen.tsx` 的 `activeConfig` 与 selected 分支。显示应以实时 Agent 为准；允许显式改当前会话配置不等于“新会话偏好覆盖旧会话”。公开高层 handle 无 applyConfig，但公开 CLI 提供 mode / thinking；完整模型修改接入需进一步验证。 |
| 5 | 必须修：内容遗漏 | `ExecutionItem` 对 reasoning、todo、notification、compaction、plugin 全部返回 null。已有的思考、任务状态、警告和压缩提示会消失。 | 协议 `AgentTimelineItem` 含这些类型；原生 `agent-stream/view.tsx` 逐类渲染。前四类可用现有数据组合；第三方 plugin 自定义 renderer 没有可直接复用的公开宿主渲染组件，需如实说明。 |
| 6 | 必须修：键盘 | Bot 输入只有 multiline / onChangeText，没有 Enter 发送处理。桌面用户按 Enter 会换行，行为与原生不同。 | 原生 `composer/input/input.tsx`：桌面 Enter 提交，Shift+Enter 换行，IME composition 防误发；紧凑模式另有策略。实现时必须保留 Bot 当前禁发条件。 |
| 7 | 应修：工具内容呈现 | shell/read/edit/search 等全部通过 Object.entries + 文本/JSON 展示。文件修改没有原生 diff 展示与相关操作，计划也只有字段式内容。 | 原生 `tool-call-details.tsx` 与工具 detail 分层视图。基础结果可读不等于原生体验；自行组合成本明显高于原生页。 |
| 8 | 应修：消息与 turn 操作 | 没有消息复制按钮、用户消息时间、回答完成耗时/时间切换。只能手选文字。 | 原生 `components/message.tsx` 的 UserMessage、TurnCopyButton、CompletedTurnFooter；复制有公开 `copyText`，时间信息需保留原始 timeline entry 元数据。 |
| 9 | 应修：滚动导航 | 只有靠近底部时自动跟随；向上阅读后没有“回到底部”按钮。 | 原生 `agent-stream/view.tsx` 的 `scroll-to-bottom-button` 与阅读锚点逻辑。小按钮和明确跟随状态即可补基本行为。 |
| 10 | 应修：长历史成本 | 普通 ScrollView 挂载全部条目；observation 每次补读从末尾遍历全部历史。历史越长，更新的网络与渲染成本越大。 | 原生 history-window/strategy-web/virtualization 按窗口处理。当前是实现事实，未做长历史性能基准，不能给出虚构卡顿阈值。 |
| 11 | 应修：状态与布局密度 | 所有消息统一 gap 24，未按消息/工具/思考序列调整。运行、等待、停止提示独立堆在输入区；不含上下文用量。 | 原生 `agent-stream/spacing.ts` 对工具序列间距为 0、不同类型分配间距；turn footer 与 composer context usage 各有位置。两者默认内容最大宽度同为820，宽度本身不应误报成差异。 |
| 12 | 产品扩展：配置能力 | 未接入原生 profile、Provider 动态 feature/settings、模型诊断重试等入口。 | 原生 model-browser / composer/agent-controls。首期明确要求的 Provider/模型/思考/权限不等于所有扩展设置已要求；应记录未支持而非直接扩范围。 |
| 13 | 部分实现：权限与提问 | 已支持允许/拒绝、结构化问题、单多选和自定义回答；但卡片、布局和工具详情使用自定义组合，未复用宿主完整样式。 | `client/execution.tsx` RequestCard；前期真实 Provider 验证证明响应通路，不证明每种卡片与原生视觉一致。不能误报为“权限/提问功能缺失”。 |

## 明确不应计为首期遗漏的原生功能

原规格排除了附件、语音、全文搜索、运行中 queue/steer、取消归档、自动复制上下文、跨主机与悬浮窗。原生页可能提供其中部分功能；若迁移至原生页，要更新行为保证。消息 fork/rewind、outline、所有第三方 composer/timeline 扩展也不能在没有接入证据时宣称 Bot 已支持。

已有且本次未推翻的能力：会话创建与归属、独立历史、重命名、草稿、基础 Markdown/流式文字、单条工具详情、权限/提问响应、Stop、重连补读、发送不明恢复、归档/手动重建、委派导航。这些是功能通路，不能替代原生 UI 对照验收。

## 本轮证据与限制

- 实际运行隔离 Paseo 0.13.2，fixture Provider 创建工具成功/失败/待审批会话，以及持续 running 会话。
- Server Browser 实测 Bot 连续工具组不存在（red）；运行状态文字存在且原生 turn-working-indicator 不存在。
- 同一 running Agent 原生页实测可打开；模型按钮可操作，弹层存在 `Search models...`、Provider 设置、Create profile；原生六点状态与耗时可见。
- 截图在 `docs/verification/images/native-audit/`。公开截图只含隔离 fixture 数据。
- 源码审计覆盖入口、Bot 配置/输入/消息/滚动、ExecutionItem/RequestCard、observation、公开协议与插件 UI 导出，并对照稳定版原生组件。未重新审计完整后端安全或所有 Provider 行为。
- 本轮是差异审计，没有宣称修复通过。工具分组草稿保留在独立 `fix/native-chat-feedback` worktree（`/tmp/paseo-bot-chat-fix`）；尚未完成全部交互验证、未发布、未更新本机安装。Running 修复未实施。
- 浏览器实际画面验证为桌面；紧凑模式本轮仅源码核对。原生 iOS/Android/Electron、中文输入法、键盘组合与长历史性能未实际回归。

结论：先决定直接使用原生会话页还是继续独立聊天页。前者能复用更多已完成能力并减少维护，但必须明确调整前述产品约束；后者至少应按1–6、7–11的顺序补齐。当前不能称为“基本还原原生”。
