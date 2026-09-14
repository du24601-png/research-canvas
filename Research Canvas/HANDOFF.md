# Research Canvas 交接

> 下一会话先读本文件。Research Canvas 独立产品仓库。

**当前阶段（2026-09-13）：C 端金融看板 P0–P4 已落地。** 一个会话一块活看板；点数字看科目/报告期/来源；点名 ≤3 家直接取数，>3 家或行业对比先确认；可演示、导出 16:9 / 竖版；发布生成本机只读快照（不是公网分享）。不要进入 Inspector / Notes / Excel / Phase 5，除非用户明确要求。

日期：2026-09-13（会话看板 / 单元格溯源 / 分级取数 / 演示导出 / 本机快照）

---

## 产品形态

```text
左侧 Chat Agent          右侧 Research Canvas
Generate / Review / Adjust     Keep / Organize / Deliver
```

默认桌面：左对话 + 右画布。桌面无会话侧栏；会话切换走顶栏选择器 + 命令面板（Ctrl/Cmd+K）。手机仍用抽屉。资讯 / 市场 / 社区 / 专家等 Opptrix 遗留入口已从产品路径移除。

**Agent 默认交付（2026-09-11）**：日常「看一下/比较/走势」走 `query_data` → `propose_widget` + 2–5 句白话；禁止聊天区 L3 备忘录与工具名。L3 仅「全面/深度分析」等显式升级。新对话才会用新角色人设。

### 桌面会话导航（方案 3）

```text
顶栏：[会话] [新建对话] [搜索对话] + 标题
  会话 → SessionPickerMenu：最近 8 条（不含专家会话）+「搜索全部对话」+「系统设置」
  搜索按钮 / Ctrl/Cmd+K → WorkspaceSearchDialog（对话 + 个股 + 归档浏览）
手机：SessionSidebar drawer（不变）
设置页：SettingsSidebar panel/overlay（不变；仅设置页保留侧栏开关）
```

| 模块 | 职责 |
|------|------|
| `sessionSidebarPresentation.ts` | desktop `'none'` / mobile `'drawer'`；`recentSessionsForPicker`；`isCommandPaletteShortcut` |
| `SessionPickerMenu.tsx` | 顶栏会话下拉（Web `ChatView` + Electron `DesktopWindowChrome.toolbarLeading`） |
| `useChatAppChrome.tsx` | `Ctrl/Cmd+K` 捕获阶段 toggle 搜索；进设置关 drawer |

**未采用 overlay 侧栏**（曾实现于 `research-canvas-overlay-sidebar` @ `e8f9f7d6`，25% 视口宽）。方案 3 不占聊天列、不挡顶栏关闭按钮。

---

## 已完成阶段

| 阶段 | 状态 | 要点 |
|------|------|------|
| Phase 1 Slim Shell | 完成 | 右栏空白占位 → 后被 Canvas 替换；隐藏无关入口 |
| Phase 2 Static Canvas | 完成 | react-grid-layout + ECharts；mock 仅作旧画布 fallback |
| Phase 3 Agent Controls Canvas | 完成 | `create_widget` / `update_widget` / `delete_widget` + `research_canvas` SSE |
| Phase 4A Real Data | 完成 | `query_data` → `queryInstrumentData(financials, annual)` → Dataset v2；不接 AKShare |
| **Phase 4A.1 Preview & Adopt** | **完成** | `propose_widget` → Chat Preview → 用户 Adopt；右侧不自动加图 |
| **Phase 4B Dataset Refinement** | **完成** | `refine_dataset` 派生新 Dataset；旧 Dataset 不可变；persist 仍 v2 |
| **Phase 4C.0 Canvas Interaction** | **完成** | 拖拽/缩放性能、响应式图表、first-fit 落位、整理布局；不改 Agent / Dataset 语义 |
| **Phase 4C.1 Active Widget** | **完成** | 单击选中 Widget；Chat chip + `research_canvas.activeWidget`；Adopt 后新图成为 active；selection 不 persist |
| **Phase 4C.1 Product Rebrand** | **完成** | 用户可见面统一 `Research Canvas`；品牌源 `packages/shared/src/product-brand.ts` |
| **Phase 4C.2 ECharts 图种** | **完成** | `stacked_bar` / `stacked_bar_percent` / `combo_bar_line` / `pie_chart` / `donut_chart` / `candlestick`；K 线经 `query_data(kline)` + `ohlc[]` |
| **Phase 4C.3 视图推荐与切换** | **完成** | intent × 形状 → 候选图种；`heatmap_table`；Preview/画布 ViewSwitcher；排名横柱；折线 Top-N |
| **Phase 4C.3.1 图表缩放自适应** | **完成** | 宽+高 compact；收起图例/色条；`containLabel`；提高 minH；窄 header 横滑 |
| **Phase 4C.4 artifacts 按需加载** | **完成** | `artifacts` pack 标记 `optIn`；默认不进会话 tools；+ 菜单「报告与脑图」→ `PATCH sessions artifactsEnabled` → 重建冻结 tools |
| **Phase 4C.4.1 Preview 样式** | **完成** | `update_proposal`（图例/颜色/轴标题/标题）；未 Adopt 走 proposal，已 Adopt 走 `update_widget` |
| **Phase 4C.5 Chat 流式 UX** | **完成** | 单行 status morph（投资者文案）；溯源 chip；思考摘要折叠；Receipt + 回复同气泡；工具步骤仅「展开详细过程」 |
| **Phase 4C.5.1 Composer 输入框** | **完成** | 空态单行 `+ | 输入 | 麦克风/发送`；聚焦 hint；Composer footer 与流式状态联动 |
| **C 端看板 P0** | **完成** | 画布按 `sessionId` 分桶；板名 = 会话标题 |
| **C 端看板 P1** | **完成** | 单元格溯源；入库禁止 `mixed`；折线/柱/堆积/饼/K 线/热力/表可点看来源 |
| **C 端看板 P2** | **完成** | ≤3 家直接取数；>3 家 `plan_preview` 须确认；禁止无数据集就 `propose_widget` |
| **C 端看板 P3** | **完成** | 演示模式、Esc 退出、导出 16:9 / 9:16 |
| **C 端看板 P4** | **完成** | 本机只读快照 `?board=`；链接只在当前部署有效 |

未开始：Inspector / Notes / Multi-select / Phase 5–8（Excel / UI polish 等）。

### 三套可视化路径（勿混）

| 路径 | 何时用 | 数字来源 | 默认 |
|------|--------|----------|------|
| **Research Canvas** | 比较/看看/走势、行业对比 | Provider → Dataset | 始终可用 |
| **artifacts** | 网页报告、TSX 画布、脑图 | 模型撰写 | **+ 菜单勾选** |
| **Markdown ` ```chart `** | 聊天正文插图 | 模型 JSON | 无需 pack |

技能 `required-packs: artifacts` 与消息里的「可视化报告/脑图」**不会**自动加载 pack；须用户先打开「报告与脑图」。`activate_tool_pack(['artifacts'])` 为 no-op 并提示用 + 菜单。

---

## Phase 4B 产品路由

```text
去掉公司 / 收窄年份 / 加上公司
  → refine_dataset（新 research-ds-*，parentDatasetId 指向旧集）
  → propose_widget
  → Chat Preview
  → 用户 Adopt 才上画布

改成柱状图 / 改标题
  → propose_widget（同一 datasetId）

改看 ROE / 新指标
  → query_data（新请求，不 derive）

明确把右侧已有图改数据范围
  → refine_dataset → update_widget(datasetId)
  layout 与 widget id 不变
```

Dataset 永不原地修改。localStorage `opptrix.research-canvas.v2.{sessionId}` 按会话分桶；发给 Agent 的 `datasetRecords` 只含本会话实际引用的 Dataset（active proposal / Canvas widgets / session toolSteps），不含无关 Store 条目。LLM 只看 metadata，没有 `data[]`。

remove / 子集年份：本地 derive，不访问 Tushare。年份超出父集：按 query 语义重新取数。add_entities 只查新增公司。中文名解析失败则报 unresolved，禁止 ticker 硬编码回退。

---

## Phase 4C.0 Canvas 交互引擎

**原则：Interaction state ≠ Persisted business state**

```text
drag / resize 进行中
  → RGL 维护瞬时 transform
  → 不写 localStorage
  → 不 rebuild 无关 chart option

onDragStop / onResizeStop / Adopt / Delete / 整理布局
  → commit layout 一次
  → persist 一次（相同 normalized layout 去重）
```

客户端新增（`client-ui/src/chat/research-canvas/`）：

| 模块 | 职责 |
|------|------|
| `layoutCommit.ts` | 交互中跳过 persist；normalized layout dedupe |
| `widgetSizePresets.ts` | line/bar/stacked/combo/pie/donut/candlestick/table/sources 的 preferred + minW/minH |
| `layoutPlacement.ts` | first-fit 落位、`autoArrangeLayout` |
| `chartResponsive.ts` | wide / medium / compact（宽 600 / 380px；高 <168px 也进 compact） |
| `chartLayout.ts` | 统一 `plotGrid` / `seriesLegend` / 轴标签截断 / compact 去 `%` 后缀 |
| `chartOptions.ts` / `chartOptionsHeatmap.ts` | 按 mode 生成 ECharts option；tooltip 保留全名 |
| `EchartsFill.tsx` | ResizeObserver（宽+高）→ RAF；mode 变化时重建 option |
| `ViewSwitcher.tsx` | Preview / Widget header 切换视图；排名可选年份 |
| `widgetSizePresets.ts` | 折线/K线/热力 minH=6，柱/饼 minH=5，避免缩成邮票 |

交互细节：

- **Drag handle**：仅左上六点（24×28 hitbox）；Header 标题单行 ellipsis，不可整行拖
- **Resize handle**：右下透明热区，hover 显示细角标
- **拖拽中**：`.research-canvas-widget-body { pointer-events: none }`；图表 tooltip 暂停
- **整理布局**：画布顶栏按钮；按 widget 顺序 + preferred size 确定性重排
- **缩放自适应（4C.3.1）**：窗口变窄/变矮时自动 compact——收起图例、饼图切片标签、热力 visualMap 与左侧公司名；轴刻度 `hideOverlap` + `containLabel`；完整名称与数值靠 tooltip。缺数说明仅在 wide 横柱显示。

Adopt / create 落位：first-fit（自上而下、从左到右填空洞），不再永远 `maxY` 堆底。

本地开发默认 HTTPS 自签；Cursor 内置浏览器可能 `-202`。用 `WEB_HTTPS=0 npm run dev` → `http://127.0.0.1:5173`。

**本阶段未做**：Inspector、Notes、Excel、Agent routing 改动。（Selection 已在 4C.1 完成。）

---

## Phase 4C.1 Active Widget & Chat Context Bridge

Selection 是 UI ephemeral state，不进 persist。

```text
点击 Widget body → activeWidgetId
点击画布空白 / 关闭 Widget → 清除 selection
Chat composer 上方 chip 显示标题；点 × 清除
发送时 research_canvas.activeWidget 带最小 metadata（id / type / title / datasetId）
Adopt / widget_created → 新 Widget 成为 active
刷新后 Widget 还在，selection 不恢复
```

Agent 侧：`research-canvas-turn-state` hydrate `activeWidget`；`research-canvas-context` 注入 turn 上下文；`agent-prompt-guide` 增加「这个 / 这里 / 当前图」指代说明。

Preview 卡：`ResearchWidgetPreviewCard` 增加「取消」；按钮顺序 Cancel / 调整 / 添加到画布。「和谷歌比」仍走 `propose_widget` Preview → 用户确认；不要 AI 偷偷改画布。

客户端新增（`client-ui/src/chat/research-canvas/`）：

| 模块 | 职责 |
|------|------|
| `activeWidgetSelection.ts` | 模块级 `activeWidgetId` + subscribe；不 persist |
| `activeWidgetContext.ts` | `getActiveWidgetContext()`；点击 / 空白区 / Adopt 后选中新 Widget |
| `ComposerActiveWidgetChip.tsx` | Composer 上方 chip；清除 selection |
| `sessionDatasetSnapshot.ts` | POST snapshot 注入 `activeWidget` |
| `WidgetFrame.tsx` / `ResearchCanvasWidget.tsx` | body 点击选中；drag handle / 关闭按钮不触发 |

Shared / Agent：`research-canvas-protocol.ts` — `ResearchCanvasActiveWidget` + sanitize；`research-canvas-turn-state.ts` / `research-canvas-context.ts` 消费 snapshot。

---

## Phase 4C.1 Product Rebrand（用户可见面）

占位品牌：`Research Canvas` / `AI 投研 Agent · 交互式数据分析画布`。

换名只改：

- `packages/shared/src/product-brand.ts`（运行时 / Agent / TOTP issuer）
- `client-ui/index.html` 与 `client-ui/public/manifest.webmanifest`（静态元数据；`tests/branding-surface.test.mjs` 锁一致性）

**冻结**：`@opptrix/*`、`--opptrix-*`、`OpptrixButton`、`opptrix.research-canvas.v1`、`opptrix-ws://`、API path、DB。

设置「关于」去掉官网入口；法律条款与 Apache 版权保留。图标为临时中性 mark（`icons/product-mark.svg`），`npm run prepare:pwa-icons` 生成 PWA / favicon。

---

## Phase 4C.5 Chat 流式 UX & Composer（2026-09-12）

**原则：投资者可见面只呈现结论与进度，不默认暴露工具步骤 / token / 英文 CoT。** 后端 SSE 与 tool loop 不变；呈现层纯客户端。

```text
流式进行中
  → 单行 status morph（「正在查数据…」→「正在整理图表…」）
  → query_data 完成后显示溯源 chip（Provider / 覆盖度）
  → propose_widget Preview 独立强调；replyDraft 时正文与 Receipt 同气泡
  → 思考过程：默认折叠摘要；原始 reasoning / 逐步工具链在「展开详细过程」

Composer
  → 空态单行：+ | 编辑器 | 麦克风或发送
  → 有内容时扩为双行；聚焦且空时显示 @ / / / Enter hint
  → footer 同步 streamStatusLabel（与 Chat 区 status morph 一致）
```

| 模块 | 职责 |
|------|------|
| `tracePresentation.ts` | `resolveInvestorStatusLabel` / `extractSourceChips` / `buildTraceReceipt` / `buildThinkingSummary` |
| `ChatProcessTrace.tsx` | live + 历史 trace；`ChatStreamReplyShell`；`replyActive` 时隐藏 trace 壳 |
| `ChatStreamReceipt.tsx` | 回复气泡底部 Receipt（耗时 / 数据源摘要） |
| `ChatView.tsx` | 组装 liveTrace、reply shell、向 Composer 传 `streamStatusLabel` |
| `ChatComposer.tsx` | 4C.5.1 布局与 footer 状态行 |
| `sessionStreamRuntime.ts` | `formatLiveThinkingStatus()` 仅 morph phase，不拼 token/step |
| `toolLiveStatus.ts` | 工具 live 文案走 `resolveInvestorStatusLabel` |
| `ChatReplyDraftPreview.tsx` | reply 模式主文案字号；嵌入 reply shell |

**未改**：Agent prompt、SSE 事件 schema、`chat-progress` 服务端字段。协作子 trace 与主 trace 同一套呈现规则。

验收（2026-09-12）：`npm run test:ui -- src/chat/tracePresentation.test.ts src/chat/toolLiveStatus.test.ts`；`node --test tests/session-stream-runtime.test.mjs` 通过。

---

## 工作区分栏比例（2026-09-11 修复）

旧默认右栏固定 **360px**（市场面板遗留），Research Canvas 打开时常出现「左侧 Chat 过宽、右侧画布过窄」。

| 项 | 值 |
|----|-----|
| 默认 | 右栏 **75%**（左 Chat 25%） |
| 持久化 | `localStorage` `opptrix.workspace-split.right-ratio` |
| 实现 | `client-ui/src/hooks/workspaceSplitWidth.ts` + `useWorkspaceSplit.ts` |
| 拖拽 | 用户调整后保存比例；窗口 resize 按比例重算像素宽 |

`WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH`（360px）仍用于 preview / fallback，**不是** Canvas 分栏默认。

---

## Phase 4A.1 产品路由

```text
比较 / 看看 / 分析
  → query_data（若尚无真实 Dataset）
  → propose_widget
  → Chat Preview
  → 用户点「添加到画布」（纯客户端，不调 LLM）
  → 右侧 Canvas Widget

明确「直接加入右侧 / 放进画布」
  → create_widget（仍保留）
```

「再看看2025年毛利率排名」应复用已有 Dataset，只 `propose_widget`，不再 `query_data`。

---

## Persistence（方案 A，已锁定）

- Preview 历史：从对应 `propose_widget` tool step 的轻量 metadata 恢复
- 数值：Canvas Dataset Store persist v2
- 采纳：`acceptedProposalIds: string[]`
- **不改 message model，不新增独立 proposal 存储**

Proposal 身份 = 现有 `toolCallId` / `step.id`：

```text
tool_start → 该槽位 Skeleton
widget_proposed → 同一槽位 Ready
reload → 从该 toolStep hydrate
live SSE 不得与历史 Preview 重复
```

真实 Dataset 缺失时 Preview Error：「暂时无法加载这个研究视图」。**禁止**回退 `ds-tire-gross-margin-2021-2025`。该 mock 只给 Phase 2 旧画布。

「调整」预填 `调整「{title}」：`，界面不得出现 proposalId。廉价 metadata（proposalId / type / title / datasetId）可挂在现有 `research_canvas` POST snapshot 的 `activeProposal` 上。本阶段没有 proposal-update 状态机。

Adopt 后 Widget id 为 `rc-<uuid>`，不是 proposal id。

---

## 真实数据

不接 AKShare。走现有 Engine：

```text
query_data
  → Entity Resolver（OpptrixQuant search / 代码解析）
  → Metric Registry
  → queryInstrumentData(financials, annual)
  → dataset_created SSE
```

Dataset id：`research-ds-<uuid>`。Source.provider 来自 QueryResult.source（验收里见过 `tushare`）。无 per-query provider preference；字段全 null 则 fail closed。

Tushare 已在本机 `~/.opptrix/opptrix.db` 经官方 `saveTushareConfig` 配置。**禁止把 token 写入代码、日志或文档。**

---

## 代码地图

### Shared

- `packages/shared/src/research-view-recommendation.ts` — 数据形状、intent、candidates、Top-N 阈值
- `packages/shared/src/research-view-params.ts` — Widget `view` 参数 sanitize / compact
- `packages/shared/src/research-view-title.ts` — 按图种/年份/实体数生成标题
- `packages/shared/src/research-canvas-protocol.ts` — Widget snapshot、Proposal、SSE 事件、sanitize；`heatmap_table`；可选 `view.intent/period/topN`
- `packages/shared/src/research-dataset.ts` — Dataset id / mock 判定 / query / lineage
- `packages/shared/src/research-dataset-derive.ts` — 纯函数 derive / clone
- `packages/shared/src/research-dataset-scope.ts` — records vs LLM meta 选择
- `packages/shared/src/tool-packs.ts` — pack `research_canvas`（always-on）
- `packages/shared/src/agent-prompt-guide.ts` — query / refine / propose 分工

### Agent

- `packages/agent/src/research-canvas-tools.ts` — `query_data` / `refine_dataset` / `propose_widget` / `update_proposal` / `create_widget` / `update_widget` / `delete_widget`
- `packages/shared/src/tool-packs.ts` — `artifacts` 为 `optIn`；`defaultSessionPackIds()` 不含 artifacts
- `packages/agent/src/engine.ts` — `setSessionArtifactsEnabled`；切换时 bump `frozenToolsSchemaGeneration`
- `client-ui/src/chat/ComposerPlusMenu.tsx` — 「报告与脑图」开关
- `packages/agent/src/research-query-data.ts`
- `packages/agent/src/research-refine-dataset.ts` — 本地 filter / 增量 add / 超范围重查
- `packages/agent/src/research-propose-widget.ts` — `proposal.id = currentToolCallId()`；拒绝 mock Dataset；不创建 Canvas Widget
- `packages/agent/src/research-entity-resolver.ts`
- `packages/agent/src/research-canvas-turn-state.ts` — `records` 供 refine；LLM 只用 meta
- `packages/agent/src/research-canvas-context.ts` — 轻量 metadata，含 parentDatasetId
- `packages/agent/src/mcp/tool-session-context.ts` — ALS `{ sessionId, toolCallId }`
- `packages/agent/src/mcp/tool-route-plan.ts` — query / refine / propose / create / update / delete
- `packages/agent/src/engine.ts` — `runInToolSession(..., toolCallId)`；`research_canvas` snapshot
- `packages/agent/src/tool-meta.ts` / `chat-progress.ts` — `refine_dataset` 文案「调整研究范围」

### Client

- `client-ui/src/chat/research-canvas/` — Canvas、Widget、Preview、persist、Adopt、4C.0 布局/响应式、4C.1 selection
- `activeWidgetSelection.ts` / `activeWidgetContext.ts` / `ComposerActiveWidgetChip.tsx`
- `layoutCommit.ts` / `widgetSizePresets.ts` / `layoutPlacement.ts` / `chartResponsive.ts` / `chartOptions.ts`
- `client-ui/src/hooks/workspaceSplitWidth.ts` / `useWorkspaceSplit.ts` — 75/25 默认分栏 + 比例持久化
- `ResearchWidgetPreviewCard.tsx` — Skeleton / Ready / Accepted / Error；与 Canvas 共用 View Builder
- `proposalFromToolStep.ts` / `adoptProposal.ts` / `researchPreviewAdjust.ts`
- `layoutStorage.ts` — persist v2 + `acceptedProposalIds`；`resolveLiveResearchDataset()` 永不返回 mock
- `canvasController.ts` — `widget_proposed` 不改画布；客户端 `widget_adopted` 才 Adopt
- `tracePresentation.ts` / `ChatProcessTrace.tsx` / `ChatStreamReceipt.tsx` — 流式 status morph、溯源 chip、Receipt、Preview 槽位；步骤链默认折叠
- `ChatComposer.tsx` — 空态单行布局 + `streamStatusLabel` footer
- `ChatView.tsx` — `hiddenPreviewStepIds` 防 live + 历史双卡；`ChatStreamReplyShell` + receipt
- `sessionStreamRuntime.ts` / `toolLiveStatus.ts` — live 状态文案投资者化
- `useSubmitImpl.ts` — POST `research_canvas` snapshot：scoped `datasetRecords` + 轻量 `datasets` meta
- `sessionDatasetSnapshot.ts` — 按会话引用裁剪，禁止把全局 Store 全量发给 Agent
- `apps/server/src/index.ts` — chat/stream 与 chat 接受 `research_canvas`

不要用 `@opptrix/canvas`、`create_canvas`、Markdown ` ```chart ` 做 Research Preview。不要引入 CopilotKit / assistant-ui / shadcn / Tailwind。

**client-ui 禁止** `from '@opptrix/shared'`（会拉 `outbound-fetch` → 空白页）。只用子路径导出：`@opptrix/shared/research-view-recommendation` 等（见 `packages/shared/package.json` `exports`）。

---

## 本地运行

```text
API   npm run start -w @opptrix/server     → http://127.0.0.1:8711
Web   WEB_HTTPS=0 npm run dev               → http://127.0.0.1:5173
```

改 `packages/shared` 或 `packages/agent` 后必须 `npm run build:packages`（或分别 build）并**重启 API**。Vite 可 HMR 客户端。

Golden Path 模型：`deepseek-flash`（本机已配）。勿把密钥写入仓库。

---

## 验收（4B，浏览器 Golden Path，2026-09-10）

模型：`deepseek-flash`。API 已用含 `refine_dataset` 的 agent dist 重启。

| 步骤 | 工具 | 取数 | 结果 |
|------|------|------|------|
| 比较赛轮、玲珑、森麒麟 2021–2025 年毛利率 | `query_data` → `propose_widget` | Tushare 15/15 | Preview 后 Adopt；原集 `research-ds-454eade6-a0e5-4d2c-973f-8752b1417597` |
| 去掉玲珑 | `refine_dataset`（local） | 未再查 Tushare；`fetchedAt` 仍为 `2026-09-10T16:09:59.004Z` | 派生 `research-ds-03093517-6582-48d1-ac40-00a03f841a4d`（10 点，两家）；父集 15 点未改 |
| 只看2023–2025 | `refine_dataset`（local） | 未再查 Tushare | 派生 `research-ds-89dfbeb0-ee5c-46a4-a4d4-2a7bcbf622e8`，`parentDatasetId` → `03093517…`，`transform=filter_period` |
| 改成柱状图 | `propose_widget`（同一 datasetId） | 无 | 预览改为柱状；验收时模型曾误调 `update_widget`（已修路由） |
| 改看ROE | `query_data`（新请求，无 parent） | Tushare 6/6，新 `fetchedAt` `16:19:57` | `research-ds-7ad779c1-8e41-492d-9671-e3ef9032001f`，metric=roe；右侧仍是毛利率图 |

Snapshot：发给 Agent 的 `datasetRecords` 只有本会话引用（widget + 本轮 toolSteps），不含全局 Store 里更早的 `911056a3` / `a69b6c26`。LLM 工具结果与 metadata 均无 `data[]`。

**路由修补（已合入）**：refine/propose 的 preferred 已移除 `update_widget`；`改成柱状图` 列入 avoid。除非用户明确改右侧已有图，否则 Preview → Adopt 才上画布。

---

## 验收（4A.1，真实 Dataset）

已于 2026-09-10 浏览器跑通：

1. 「比较赛轮、玲珑、森麒麟 2021–2025 年毛利率」→ Chat Line Preview（`tushare · 15/15`），右侧不自动加图
2. 「添加到画布」→ 立即出现同标题 Widget，无新的 chat/stream；Preview 变为「已添加到画布」
3. 「再看看2025年毛利率排名」→ Chat Bar Preview，复用 Dataset，无 `query_data`；右侧不自动加图
4. 「调整」预填 `调整「2025 年毛利率排名（赛轮/玲珑/森麒麟）」：`，无 proposalId

---

## 验收（4C.0，2026-09-11）

| 项 | 结果 |
|----|------|
| drag/resize 中写 localStorage | 否（仅 stop / Adopt / Delete / 整理） |
| A2–A4 误触 `update_widget` | 否（4B 路由回归已通过） |
| ECharts resize | RAF 合并，每帧每实例 ≤1 次 |
| first-fit Adopt | line+bar 交替 Adopt 填空洞 |
| Auto Arrange | 确定性重排 + persist |
| 响应式图表 | compact 用 ticker 短标签，tooltip 全名；矮窗收起图例 |
| 门禁 | research-canvas 66/66；check:ui PASS |

---

## 门禁

```text
node --test tests/research-canvas-tools.test.mjs tests/mcp-tool-route-accuracy.test.mjs tests/mcp-tool-pack-router.test.mjs tests/research-query-data.test.mjs tests/research-refine-dataset.test.mjs tests/session-artifacts-opt-in.test.mjs tests/session-tools-freeze.test.mjs tests/skill-pack-auto-activate.test.mjs tests/agent-research-prompt.test.mjs
node --test --experimental-strip-types tests/branding-surface.test.mjs tests/pwa-icons.test.mjs
npm run test:ui -- src/chat/research-canvas
npm run test:ui -- src/chat/tracePresentation.test.ts src/chat/toolLiveStatus.test.ts
npm run test:ui -- src/chat/ComposerPlusMenu.test.tsx
npm run test:ui -- src/hooks/workspaceSplitWidth.test.ts
node --test tests/session-stream-runtime.test.mjs
npm run check:ui
npm run build:packages   # 改 shared/agent 后必跑
npm run build -w opptrix-client
```

4C.1 验收（2026-09-11）：`test:ui` 104/104；research-canvas 目录 54/54；`research-canvas-tools.test.mjs` 含 activeWidget sanitize + turn context。

4C.2 图种验收（2026-09-11）：`npm run test:ui -- src/chat/research-canvas` 56/56；`node --test tests/research-query-data.test.mjs tests/research-canvas-tools.test.mjs tests/mcp-tool-route-accuracy.test.mjs tests/agent-research-prompt.test.mjs` 通过；`npm run check:ui` PASS。改 shared/agent 后须 `npm run build -w @opptrix/shared -w @opptrix/agent` 再重启 API；**新对话**才加载 kline / 新图种 playbook。

4C.3 视图推荐 + 缩放自适应（2026-09-12）：`npm run test:ui -- src/chat/research-canvas` 66/66；`node --test tests/research-view-recommendation.test.mjs tests/research-canvas-tools.test.mjs` 通过；`npm run check:ui` PASS。浏览器：拖窄/拖矮 19 家折线 → 图例收起、轴不裁切；切排名/热力 compact 可用；拉宽后图例恢复。

---

## 已知问题

- Dataset entity `name` 有时是 ticker（例如 `601058`）。量化名录解析曾被凭证挡住时留下的数据，**不要在 resolver 里写死 ticker 回退名**。
- 中文公司名 add_entities 在 OpptrixQuant 凭证缺失时会 unresolved；Golden Path 用明确 ticker 验证增量查询。
- 4C.5 已把 reasoning 默认收进折叠摘要；若模型在**正文 reply** 里输出英文 CoT，仍可能可见——需 prompt / 模型侧约束，非呈现层能完全屏蔽。
- `refine_dataset` / `propose_widget` 后模型可能擅自 `update_widget`；2026-09-10 已收紧路由与 playbook，需重启 API。
- Vite 默认 HTTPS 自签；部分浏览器 / Cursor 内置页报 `-202`，本地用 `WEB_HTTPS=0`。

---

## 图表类型（ECharts）

研究画布图种全部走 ECharts。Opptrix 行情终端右栏已移除；K 线只在研究画布 `candlestick` 路径。

| 用户说法 | Widget `type` | 数据 |
|----------|---------------|------|
| 折线 / 走势 | `line_chart` | 现有财务 Dataset；实体多时可 Top-N 高亮 |
| 柱状 / 排名 | `bar_chart` | 指定年份截面；≥5 家自动横柱 |
| 热力 / 对照 | `heatmap_table` | 实体×年份矩阵；wide 显示格内数值 |
| 堆积柱 | `stacked_bar` | 各公司按期堆积 |
| 百分比堆积 | `stacked_bar_percent` | 同上，每期归一到 100% |
| 柱线混合 | `combo_bar_line` | 各公司柱 + 均值折线 |
| 扇形 / 饼图 | `pie_chart` | 最新一期、仅正值 |
| 圆环 | `donut_chart` | 同饼图，`radius ['42%','68%']` |
| K 线 / 蜡烛图 | `candlestick` | `query_data({ metric: 'kline' })` → `ohlc[]`；最多两只；图上画第一只 |
| 表格 / 来源 | `table` / `sources` | 不变 |

K 线路径：`query_data(metric=kline)` → `queryInstrumentData(ref, 'kline', { period: 'daily', startDate, endDate, count: klineBarBudget(start,end) })`（约 250 根/年，上限 2500）→ ECharts candlestick（A 股涨红跌绿）。persist v2 的 `ohlc` 可选，旧财务 Dataset 仍合法。

改图种：未 Adopt 的预览走 `propose_widget` / `update_proposal`；右侧已有组件走 `update_widget`。

---

## 视图推荐（Phase 4C.3）

代码推荐，模型可 override，用户可在 Preview / 画布 header 切换：

```text
query_data / refine_dataset
  → coverage + intent + view.candidates + suggestedTitle

propose_widget
  → 可选 intent / type / title / view.period|topN
  → fail-soft warning（不阻断 Preview）

默认：≤6 实体×多期 → 折线；>6 → 热力；显式排名 → 横柱 @ latestCompletePeriod
```

Widget 持久化 `view?: { intent, period?, topN? }`；切换视图 = 同 datasetId 更新 type + view（客户端 `handleChangeWidgetView`）。

---

## 下一阶段（Phase 5+）

**行业指标横向对比（2026-09-12）**：`resolve_industry_universe` → 用户确认样本 → `query_data` → Preview。标题禁止在样本未覆盖全行业时写「行业排名」。

仍未做：Inspector / Notes / Multi-select / Excel Export。不要顺手做 AKShare、全局视觉重构。

---

## Agent 评测轨道（2026-09-14）

与 `test:gate` / 浏览器 Golden Path **分开**。不进产品 CI，不加权进产品验收。

- 文档：[docs/AGENT-EVAL.md](../docs/AGENT-EVAL.md)；PRD §18。
- 命令：`npm run eval:agent`（component → planning → 生产 prompt；约 7–8 分钟）。
- 正式档：`eval/agent/records/`。最新全量流水线：组件 93/99、规划 24/24、生产提示词 22/24（`deepseek-flash`）。
- 北星是生产提示词层。规划 24/24 是夹具校准后的量具健康度，不是产品突然满分。
- 未 Adopt 改图种/样式走 `propose_widget` / `update_proposal`；右侧已有组件走 `update_widget`。

下一刀优先：成分股问句的工具幻觉、生产稿上行业确认后停手、改预览颜色的方差。真 Tushare 数值层尚未建。
