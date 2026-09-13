# C 端金融看板主路径 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Research Canvas 收成「个人投资者能给朋友用的低门槛金融 ChatGPT」：一个会话就是一块活看板；点数字能看到科目 / 报告期 / 来源；查数前有一句可改的计划；能全屏演示、整板发布快照、导出 16:9 与竖版图。

**Architecture:** 只学 Perspective 的 Table / View / Viewer / Workspace 切法，不嵌入其引擎。Dataset 仍由 `query_data` 从 Provider 写入；Widget 是对 Dataset 的一种 View；Board 绑定会话并持久化；分享是冻结 Snapshot，与活板分离。Agent 只决定查什么、提议哪张图；数字与图由代码执行。

**Tech Stack:** 现有 `client-ui` + `packages/agent` + `packages/shared` + `research-hub` / `a-stock-layer`；快照读页用现有 `apps/server` 路由。不引入 Perspective WASM。出图用浏览器 `html-to-image` 或 `dom-to-image` 一类已有/轻量方案（选型见 P3，禁止为出图引入 Electron）。

---

## 现状缺口（动手前必须承认）

| 北极星要求 | 现在 | 风险 |
|------------|------|------|
| 会话 = 一块活看板 | 画布存在 **全局** `localStorage` 键 `opptrix.research-canvas.v1`，换会话右侧板不变 | 不做 P0，后面全是错的 |
| 点数字看到科目/报告期/来源 | UI 已有 `sourceLookup` / `SourceCitationBar`；Engine merge 仍把多源压成 `'mixed'`；`ResearchSource.period` 可选，常缺 | 演示时仍会看到「多个来源」 |
| 查数前计划可改 | 仅行业名单走 `ask_user`；点名公司直接 `query_data` | 随手问若每次卡住会变重 |
| 演示 / 发布 / 导出 | 无 | 发布链接需要服务端存快照；演示+导出可先纯前端 |

Schema 只增不破：Dataset / persist 用新字段 + 幂等迁移；全局画布迁到按 `sessionId` 分桶。

---

## 阶段依赖（每阶段可单独给朋友用）

```text
P0 会话看板     ──┬── P1 单元格溯源 ── P3 演示 + 导出图 ── P4 整板发布快照
                  └── P2 查数计划（可与 P1 并行）
```

建议执行顺序：**P0 → P1 → P2 → P3 → P4**。P2 可在 P1 进行中并行，但不要插在 P0 之前。

预估（单人熟悉仓库）：P0 2–3 天 · P1 4–6 天 · P2 2–3 天 · P3 3–4 天 · P4 3–4 天。

---

## 文件地图

| 区域 | 主要文件 | 本计划职责 |
|------|----------|------------|
| 画布持久化 | `client-ui/src/chat/research-canvas/layoutStorage.ts` | 按 session 分桶；只读快照结构 |
| 画布壳 | `client-ui/src/chat/research-canvas/ResearchCanvas.tsx` `WidgetFrame.tsx` | 板名、演示模式、无聊天布局 |
| 溯源 UI | `sourceLookup.ts` `SourceCitationBar.tsx` `chartSourceClick.ts` `sourcePresentation.ts` | 科目 + 期 + 来源；禁止对用户说「多个来源」 |
| Dataset 协议 | `packages/shared/src/research-dataset.ts` | 补齐 `period` / `fieldLabel` / 禁止 `provider:'mixed'` 入库 |
| 取数 | `packages/a-stock-layer/src/core/query-plan.ts` `packages/a-stock-layer/src/engine.ts` `packages/agent/src/research-*.ts` | 行级来源不合并丢弃 |
| 计划确认 | `packages/agent/src/research-canvas-tools.ts` `packages/shared/src/agent-prompt-guide.ts` | `query_plan` 或复用 `ask_user` |
| 会话标题 | `ChatSessionTitleTools.tsx` `useSessionTitleActions.ts` | 板名 = 会话标题 |
| 快照 API | `apps/server/src/index.ts` 新路由 + `user-store` 新表 | 发布只读页 |
| 出图 | 新文件 `client-ui/src/chat/research-canvas/boardExport.ts` | 16:9 / 9:16 PNG |

---

## P0 — 会话 = 一块活看板

**产品：** 每个对话一块板；标题就是板名；离开再进还在；换对话换板。空板仍用现有空态。

**不做：** 独立看板库、跨会话拖图。

### Task P0.1 按 session 持久化（先测后改）

**Files:**
- Modify: `client-ui/src/chat/research-canvas/layoutStorage.ts`
- Modify: `client-ui/src/chat/research-canvas/layoutStorage.test.ts`
- Modify: 所有读写 `RESEARCH_CANVAS_STORAGE_KEY` 的测试（`ResearchWidgetPreviewCard.test.tsx` `canvasController.test.ts` `activeWidgetSelection.test.ts` 等）
- Modify: `ResearchCanvas.tsx` 及 Adopt 路径，把当前 `sessionId` 传入读写

- [x] 存储键改为 `opptrix.research-canvas.v2.{sessionId}`；无 session 时不写全局脏数据（欢迎页空板内存态即可）。
- [x] 启动时若存在旧键 `opptrix.research-canvas.v1`：若当前 session 的 v2 键为空，则 **搬迁一次** 到该 session，然后删除或改名为 `v1.bak`（幂等：已存在 v2 则不覆盖）。
- [x] `readPersistedCanvasState(sessionId)` / `writePersistedCanvasState(sessionId, state)` 签名带 session；禁止再写无 session 的全局活板。
- [x] 测试：session A 写入 widget，切到 B 读到空；回到 A 仍在。旧 v1 只迁一次。

门禁：`npm run test:ui`（至少上述测试文件）+ `npm run check:ui`。

### Task P0.2 板名 = 会话标题

**Files:**
- Modify: `client-ui/src/chat/research-canvas/ResearchCanvas.tsx`（画布顶栏展示标题，不要再像「附属插图」）
- Modify: `client-ui/src/chat/ChatSessionTitleTools.tsx`（aria：「打开看板菜单」类，勿写工具菜单）
- 不改默认标题文案逻辑以外的重命名 API；默认仍用 `DEFAULT_SESSION_DISPLAY_TITLE`（未命名对话）

- [x] 右侧画布 header 显示与顶栏同一标题。
- [x] 用户重命名会话，画布标题同步（已有 rename 通道，只接展示）。
- [x] 空会话：板空 + 标题「未命名对话」，不自动改名；Agent 或用户首次有实质内容后再允许建议标题（沿用现有自动标题，不新开一套）。

验收：换会话，右侧图与标题一起换；刷新同一会话板还在。

---

## P1 — 点数字 → 科目 / 报告期 / 来源

**产品：** 点折线点、柱、表格格，展开条上必须能读懂：公司、指标中文名、哪一年（或哪一天）、数据从哪来、缺则为「—」。用户可见文案禁止「多个来源」「mixed」「Provider 名裸奔」；可用「年报 / 公司公告」等投资者语言 + 可选链接。

**根因：** `ResearchSource` 已有 `provider, entityId, metric, period?, fetchedAt, sourceUrl?`，但 merge 写成 `'mixed'`，且 period 常缺失，UI 只能退化。

### Task P1.1 Dataset 来源字段补齐（协议只增不破）

**Files:**
- Modify: `packages/shared/src/research-dataset.ts`（`ResearchSource` 增加可选 `fieldLabel?: string`，`period` 财务点必填）
- Modify: `sanitizeResearchDataset`：`provider === 'mixed'` 的 source **丢弃该条并视为无效**，不得入库；多源改为 **多条 source**，每条绑定 `entityId + period`。
- Test: `packages/shared` 或现有 dataset sanitize 测试；`client-ui/src/chat/research-canvas/sourceLookup.test.ts`

- [x] `findSourceForCell`：精确匹配 `entityId + period`；没有精确行则返回 `undefined`（UI 显示「这条没有单独来源」），禁止拿该公司另一年的 source 顶上。
- [x] `sourceProviderLabel`：删除对用户展示 `'mixed' → 多个来源'`；未知 id 显示「来源未标注」而非技术名。

### Task P1.2 Engine / Hub 写 Dataset 时保留行级来源

**Files:**
- Modify: `packages/a-stock-layer/src/core/query-plan.ts`（batch 成功不要 `source: 'mixed'` 作为唯一出处；按行记录实际 driver）
- Modify: `packages/a-stock-layer/src/engine.ts` 若同样压 mixed
- Modify: `packages/agent` 里组装 `ResearchDataset.sources` 的路径（先 Grep `sources:` / `provider:` 定位，不要凭记忆改）
- Test: `tests/research-query-data.test.mjs` 增补：两家公司若来自同一 Provider，每期仍有独立 source 行；禁止 dataset.sources 出现 `provider:'mixed'`

- [x] 财务点：每个 `(entityId, period)` 至多一条 source，period 为报告期字符串（与 `data[].period` 相同）。
- [x] K 线：至少按 entity 一条 source + 时间范围；点一根 K 显示该日与数据源。
- [x] 缺数：`value: null` 显示「—」，不补 0，不编造 source。

门禁：`node --test tests/research-query-data.test.mjs tests/research-refine-dataset.test.mjs` + `npm run check:ui` + `sourceLookup.test.ts`。

### Task P1.3 来源条文案（投资者语言）

**Files:**
- Modify: `SourceCitationBar.tsx` `sourcePresentation.ts`
- 覆盖图种：已有折线/柱/分组柱/热力/表；补 `combo_bar_line` / `candlestick` 若点击未接线则补 `chartSourceClick.ts`

验收 Demo：茅台 ROE 走势点 2024 → 「贵州茅台 · 净资产收益率 · 2024 年报 · {来源}」。两家对比点不同柱子，来源可以不同，但各自明确。

---

## P2 — 查数前一句计划，用户能改

**产品：** 取数前用户看见白话计划，例如「查贵州茅台、五粮液，净资产收益率，2019–2024 年报」。可改公司/年份后再查。

**门槛：** 每次都卡住会伤害「随手问」。采用 **分级确认**。

| 情况 | 交互 |
|------|------|
| 用户已点名 ≤3 家 + 标准指标 + 年份 | **直接取数**（轻问直查） |
| 行业/主题、未点名公司、>3 家 | 返回 `plan_preview`，必须点「确认取数」才打 Provider |
| 用户改指标/加公司 | 再出一条新计划或新查询，不静默改已有 Dataset |

实现备注：auto 档不再做 3 秒自动确认；未确认的 >3 家查询不得 `propose_widget`。

### Task P2.1 结构化计划对象

**Files:**
- Create: `packages/shared/src/research-query-plan.ts`（<300 行）类型 `ResearchFetchPlan { entities, metricLabel, start, end, statement }`
- Modify: `packages/agent/src/research-canvas-tools.ts`：`query_data` 调用前必须先产出 plan（工具内校验或新 tool `preview_query_plan`）
- Modify: `packages/shared/src/agent-prompt-guide.ts`：日常比较先展示计划再取数

推荐实现（少新工具）：`query_data` 增加可选 `confirmed: boolean`；未确认时 **不打 Provider**，只返回 plan 摘要给模型/UI；UI 用现有 UserPrompt / ask_user 卡片展示。行业路径保持 `resolve_industry_universe` → `ask_user`。

- [x] 测试：`tests/research-query-data.test.mjs` — `confirmed` 缺省且实体>3 时不发起网络；点名 ≤3 家直接取数。
- [x] UI：>3 家展示取数计划卡（确认 / 改一下）；≤3 家不拦截。

禁止：计划卡片里出现 tool 名、Provider、ticker 硬编码说明。

---

## P3 — 演示模式 + 导出 16:9 / 竖版图

**产品：** 一块干净板，适合录屏；能导出两张图（横版封面、竖版社媒）。页脚固定：「数据截至 {报告期} · 数字来自公开财报，未编造」。

**不做本阶段：** 公开 URL（P4）。

### Task P3.1 演示模式

**Files:**
- Modify: `ResearchCanvas.tsx` + `researchCanvas.css`
- 入口：画布工具条按钮「演示」；Esc 退出
- `?present=1` 或 hash 便于博主收藏（仅本机当前 session）

- [x] 隐藏：聊天列、顶栏会话菜单、Composer、空态网格装饰可保留极淡
- [x] 保留：图、标题（板名）、来源条若已打开
- [x] `prefers-reduced-motion`：无进场动画
- [x] 验收：录屏时不要出现「输入问题…」

### Task P3.2 导出图

**Files:**
- Create: `client-ui/src/chat/research-canvas/boardExport.ts`（导出逻辑 <50 行函数拆分）
- Create: `boardExport.test.ts`：无 DOM 环境下对尺寸与文件名纯函数测试（`exportSizeForRatio('16:9')` 等）
- 画布 DOM 导出在浏览器手工验；测试环境 mock `html-to-image`

规格：
- 16:9 → 1920×1080
- 竖版 9:16 → 1080×1920
- 文件名：`{板名}-看板.png`，非法字符去掉
- 页脚必须有；图内不要聊天气泡

若 DOM 导出在网格上不稳定：退化为 **逐 widget 截图拼接**（仍纯前端），不要先上服务端渲染。

---

## P4 — 整板发布快照

**产品：** 生成只读链接，打开无登录、无聊天、不能改图。活板以后再改不影响已发布版。

**数据：** 快照含 widgets + layout + datasets（含 sources）+ 板名 + 创建时间。不含聊天、不含 API key。

### Task P4.1 存储与路由

**Files:**
- `packages/user-store`：新表 `research_board_snapshots`（id, session_id, title, payload_json, created_at）；启动幂等迁移
- `apps/server/src/index.ts`：`POST /research/snapshots`（需当前用户/本机会话鉴权，沿用现有 session 鉴权）返回 `{ id }`；`GET /research/snapshots/:id` 公开只读
- 校验：payload 走 `sanitizeResearchDataset` + widget 上限 `RESEARCH_CANVAS_WIDGET_LIMIT`

- [x] 测试：`tests/` 新文件 `research-board-snapshot.test.mjs` — 创建、读取、篡改 id 404、payload 超限拒绝
- [x] 前端：`ResearchCanvas` 「发布」→ POST → 复制链接；只读页 `?board=`

只读页复用 Widget 渲染，禁用拖拽 / Adopt / 查询。点数字仍可看来源（依赖 P1）。

**对外话术：** 发布 = 当前这台自托管实例上的只读快照，不是公网 SaaS 分享。链接离开本机部署打不开。

---

## 明确不做（本计划内）

- 嵌入 Perspective / DuckDB / 实时盘口
- 独立看板库、聊天与板分家
- artifacts / Markdown chart 当主路径
- 社区、跟单、投教课程、Excel 工厂
- 单图单独分享（P4 后再加，复用同一 snapshot 结构只带一个 widget）
- 点图联动筛选（Perspective cross-filter）

---

## 门禁（每阶段结束）

```bash
npm run check:ui          # 改 client-ui
npm run test:ui
npm run build:packages    # 改 packages/**
node --test tests/research-canvas-tools.test.mjs tests/research-query-data.test.mjs tests/research-refine-dataset.test.mjs
npm run test:gate
```

手工主路径（P0 起每阶段都要走）：空会话 → 「看一下贵州茅台的净资产收益率走势」→ Preview → 放到看板 → 刷新仍在 → 换新对话板为空。

P1 追加：点 2024 年点，来源条含期与科目。  
P3 追加：演示全屏、导出两张图。  
P4 追加：无痕窗口打开发布链接。

---

## 验收对照北极星

- [x] 会话 = 活看板（P0）
- [x] 点数字 → 科目 / 报告期 / 来源，无「多个来源」（P1）
- [x] 查数：轻问直查（≤3 家），重问确认（>3 家 / 行业）（P2）
- [x] 演示模式 + 导出 16:9 / 竖版（P3）
- [x] 整板发布快照只读链接（P4，仅当前部署）

---

## 给执行者的约束

- LLM 不得生成财务数字；`null ≠ 0`。
- UI 文案面向投资者，禁止 Provider / MCP / hydrate / SQLite。
- 新增函数 <50 行、新增文件 <300 行。
- 先定位再改；Schema 只增不破。
- 不要在本计划里顺手做 Inspector / Notes / 全局 UI 重构。
