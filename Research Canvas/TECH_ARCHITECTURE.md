# Research Canvas 技术架构与执行方案

核心架构固定为：

> **Agent / App 骨架 + 统一数据 Engine；OpenBB 只借鉴 Provider 架构思想；Tushare 等 Provider 提供真实数据；react-grid-layout + ECharts 提供 Canvas；Excel Export 完成交付闭环。**

### 数据层锁定（Phase 4 起生效，Phase 1 不实现）

**不要新增一套独立 Mini OpenBB Provider Layer。**

本仓库已有完整取数管道：

```text
MarketDataEngine
  → Provider Registry
  → Provider Adapter / Normalize
  → Cache / Failover
```

后续接 AKShare 时，按现有 Provider 规范实现 `AkshareProvider`，挂入同一 Registry，复用熔断、限流、超时、校验与缓存。

OpenBB：只作 Provider 架构设计参考。不复制其代码，不引入其 Runtime。

### 当前交接（2026-09-10）

**Phase 4B 已完成。下一会话先读 [`HANDOFF.md`](./HANDOFF.md)。** Agent 评测轨道（与产品 CI 隔离）见 HANDOFF「Agent 评测轨道」与 [`docs/AGENT-EVAL.md`](../docs/AGENT-EVAL.md)。

已落地：Slim Shell → Static Canvas → Agent 控画布 → 真实 Dataset → Chat Preview + Adopt → Dataset Refinement & Lineage。

默认路径：`query_data` / `refine_dataset` → `propose_widget` → 左侧 Preview → 用户「添加到画布」。明确「放进画布」仍走 `create_widget`。

未开始：Excel、AKShare、全局 UI polish。

---

## 1. 技术目标

整个技术方案围绕一个原则：

> **最少自研，最大复用。**

技术组成：

```text
Research Canvas
→ Agent / App Shell

OpenBB
→ 只学习 Provider Architecture

AKShare
→ Financial Data

React Grid Layout
→ Research Canvas

ECharts
→ Visualization

Excel Export
→ Deliverable
```

---

## 2. 总体技术架构

```text
                        USER
                          │
                          ▼
                ┌───────────────────┐
                │   Chat Interface  │
                │     Opptrix       │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Intent Interpreter│
                └─────────┬─────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
      ┌───────────────┐       ┌───────────────┐
      │Entity Resolver│       │Metric Resolver│
      └───────┬───────┘       └───────┬───────┘
              └───────────┬────────────┘
                          ▼
                ┌───────────────────┐
                │   Query Planner   │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │    Data Service   │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ Provider Registry │
                └─────────┬─────────┘
                          │
                   ┌──────┴──────┐
                   ▼             ▼
               AKShare        BaoStock
                V1              V2
                   │
                   └──────┬──────┘
                          ▼
                    Normalizer
                          │
                          ▼
                       Dataset
                          │
                          ▼
                ┌──────────────────┐
                │Canvas Controller │
                └────────┬─────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
            Chart       Table     Sources
              │
              ▼
         React Grid Layout
              │
              ▼
           ECharts
              │
              ▼
         Excel Export
```

---

## 3. App Shell 使用策略

Agent / App 骨架保留，产品面向 Research Canvas 黄金路径裁剪。

保留：

```text
App Shell
Chat UI
LLM Provider
Conversation
Tool Calling
基础数据能力
基础用户设置
Theme
```

移除 / 隐藏：

```text
Quant
Backtest
Strategy
Portfolio
Trading
Screener
Extension Store
Community
Bot Channels
不相关 Skills
```

第一阶段不追求物理删除所有代码。

优先：

> **删除 UI Entry + Disable Route**

避免因为大面积删底层导致依赖崩溃。

---

## 4. 版本与变更策略

Research Canvas 为独立产品仓库。功能迭代以画布 + Agent 交付路径为准；不维护与外部上游的自动同步。

---

## 5. OpenBB 使用原则

不复制 OpenBB Provider 核心代码。

只学习其设计：

```text
统一 Query
统一 Data Model
Provider Adapter
Provider Registry
Normalizer
```

你的版本必须足够简单。

---

## 6. 复用现有 Provider Registry，不新建 Mini Layer

**已否决：** 独立 Mini OpenBB-style Provider Layer（自建 `provider.base.ts` / `provider.registry.ts` / 平行 query 管线）。

Phase 4 实现路径：

```text
packages/market-data-providers-cn（或等价内置源目录）
  AkshareProvider
    provider.json v2
    Adapter + Normalize
    CAP_METHOD bindings

挂入现有：
  ManifestRegistry
  MarketDataEngine.queryInstrumentData / queryMarketCapability
  现有 Cache / Failover
```

Python sidecar（若 AKShare 必须跑 Python）只作为该 Provider 的上游进程，不对外暴露第二套 query API。Hub / client-ui / Agent 仍只走 `queryInstrumentData` / `queryMarketCapability`。

规范见仓库 `docs/PROVIDER-STANDARD-API.md`。OpenBB 仅对照其 Registry / Adapter / Normalize 分层，不引入 Runtime。

---

## 7. DataProvider Interface

统一接口：

```typescript
interface DataProvider {

  resolveEntity(query: string): Promise<Entity[]>

  getMetricSeries(
    entities: Entity[],
    metric: Metric,
    start: string,
    end: string
  ): Promise<DataPoint[]>

  getCrossSection(
    entities: Entity[],
    metric: Metric,
    period: string
  ): Promise<DataPoint[]>

}
```

---

## 8. Entity Schema

```typescript
interface Entity {
  id: string
  name: string
  ticker: string
  market: "CN" | "HK" | "US"
  type: "equity"
}
```

例如：

```json
{
  "id": "601058.SH",
  "name": "赛轮轮胎",
  "ticker": "601058",
  "market": "CN",
  "type": "equity"
}
```

---

## 9. Metric Schema

```typescript
interface Metric {
  id: string
  name: string
  aliases: string[]
  unit: string
  type: string
  preferredView: string
}
```

例如：

```json
{
  "id": "gross_margin",
  "name": "毛利率",
  "aliases": [
    "销售毛利率",
    "毛利水平"
  ],
  "unit": "%",
  "type": "ratio",
  "preferredView": "line_chart"
}
```

K 线指标（Phase 4C.2）：

```json
{
  "id": "kline",
  "name": "日K",
  "aliases": ["K线", "蜡烛图", "日K", "kline"],
  "unit": "元",
  "preferredView": "candlestick"
}
```

Dataset 可选 `ohlc[]`（与 `periods` / `data[]` 并存；K 线按起止年份约 250 根/年、最多 2500 根/实体，最多 2 实体）。

---

## 10. Dataset Schema

核心结构：

```typescript
interface Dataset {

  id: string

  title: string

  metric: string

  unit: string

  entities: Entity[]

  periods: string[]

  data: DataPoint[]

  ohlc?: OhlcBar[]

  sources: Source[]

}
```

DataPoint：

```typescript
interface DataPoint {
  entityId: string
  period: string
  value: number
}

interface OhlcBar {
  entityId: string
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}
```

---

## 11. Source Schema

```typescript
interface Source {
  provider: string
  metric: string
  entityId: string
  fetchedAt: string
  url?: string
}
```

---

## 12. Widget Schema

```typescript
interface Widget {

  id: string

  type:
    | "line_chart"
    | "bar_chart"
    | "stacked_bar"
    | "stacked_bar_percent"
    | "combo_bar_line"
    | "pie_chart"
    | "donut_chart"
    | "candlestick"
    | "table"
    | "sources"

  title: string

  datasetId: string

  config: Record<string, any>

  layout: {
    x: number
    y: number
    w: number
    h: number
  }

}
```

---

## 13. Canvas 技术方案

使用：

> **react-grid-layout**

负责：

```text
drag
resize
collision
layout（grid 单位 x/y/w/h）
```

客户端交互模型（Phase 4C.0）：

```text
RGL 拖拽/缩放 → 瞬时 transform
stop 事件 → layoutCommit → localStorage v2（dedupe）
ECharts → ResizeObserver + RAF resize；option 仅在 dataset/theme/mode 变化时重建
```

Canvas state：

```typescript
interface CanvasState {

  widgets: Widget[]

  datasets: Dataset[]

  layouts: Layout[]

}
```

推荐：

```text
Zustand
```

管理前端状态。

原因：

* 简单
* 比 Redux 轻
* 很适合 Canvas state

---

## 14. Chart 技术方案

使用：

> **Apache ECharts**

Widget：

```text
LineChartWidget
BarChartWidget
TableWidget
SourceWidget
```

结构：

```text
WidgetContainer
      │
      ├ Header
      │
      ├ Content
      │   └ ECharts
      │
      └ Actions
```

所有 Widget 统一外壳。

---

## 15. Agent Architecture

不要做多个 Agent。

只有：

> **Research Agent**

它拥有工具：

```text
query_data
propose_widget
create_widget
update_widget
delete_widget
```

`propose_widget` 只提议视图，不写入右侧 Canvas。`create_widget` 留给用户明确要求直接加入画布的路径。

---

## 16. Agent Tool：query_data

Input：

```json
{
  "entities": [
    "赛轮轮胎",
    "玲珑轮胎"
  ],
  "metric": "gross_margin",
  "start": "2021",
  "end": "2025"
}
```

Output：

```json
{
  "datasetId": "dataset_001"
}
```

不要把几百行数据直接塞给 Agent。

Agent 只需要知道：

> Dataset 创建成功。

---

## 17. Agent Tool：create_widget

```json
{
  "datasetId": "dataset_001",
  "type": "line_chart",
  "title": "毛利率趋势"
}
```

后端发送：

```text
Canvas Event
```

前端：

```text
create widget
```

---

## 18. Agent Tool：update_widget

例如：

```json
{
  "widgetId": "widget_001",
  "changes": {
    "type": "bar_chart"
  }
}
```

---

## 19. Agent Tool：delete_widget

```json
{
  "widgetId": "widget_001"
}
```

---

## 20. Agent 与 Canvas 通信

推荐事件结构：

```typescript
type CanvasEvent =

  | {
      type: "widget.create"
      payload: Widget
    }

  | {
      type: "widget.update"
      payload: any
    }

  | {
      type: "widget.delete"
      payload: any
    }

  | {
      type: "dataset.update"
      payload: Dataset
    }
```

前端统一监听：

```text
CanvasEvent
↓
CanvasStore
↓
React
```

---

## 21. LLM 负责什么

LLM：

```text
理解用户语言
↓
确定 entity
↓
确定 metric
↓
确定 period
↓
选择 tool
↓
决定 Canvas 操作
```

---

## 22. LLM 不负责什么

禁止 LLM：

```text
生成财务数据
计算财务数字
生成 React
生成 ECharts option
生成 Excel
直接维护 Canvas state
```

这些全部由确定性代码完成。

核心原则：

> **LLM decides. Code executes.**

---

## 23. AKShare 接入

**入口是内置 Provider（如 Tushare），不是独立 Mini Provider Layer。**

AKShare 是 Python library，因此 Provider 内部可以起 Python sidecar，但对外仍是现有 Engine 能力：

```text
Hub / Agent / UI
       ↓
MarketDataEngine.queryInstrumentData / queryMarketCapability
       ↓
AkshareProvider（Adapter + Normalize）
       ↓
（可选）Python sidecar
       ↓
AKShare
```

例如：

```text
POST /data/query
```

Request：

```json
{
  "provider": "akshare",
  "entities": ["601058"],
  "metric": "gross_margin",
  "start": "2021",
  "end": "2025"
}
```

---

## 24. Cache

AKShare 不应该每次用户操作都重新请求。

建议：

```text
SQLite
```

缓存。

Cache key：

```text
provider
entity
metric
period
```

流程：

```text
query
↓
cache?
├ yes → return
└ no
   ↓
 AKShare
   ↓
 normalize
   ↓
 cache
```

---

## 25. Excel Export

第一版：

> Node 或 Python 都可以。

如果需要原生 Excel Chart：

推荐：

> **Python XlsxWriter**

流程：

```text
Canvas
↓
Export Schema
↓
Python Export Service
↓
XlsxWriter
↓
.xlsx
```

Export Schema：

```json
{
  "datasets": [],
  "widgets": [],
  "sources": []
}
```

---

## 26. Excel 结构

```text
Research.xlsx

Dashboard
Data
Sources
```

Dashboard：

* 标题
* 图表

Data：

* 原始 Dataset

Sources：

* Provider
* Metric
* Entity
* Period
* Fetch Time

---

## 27. 数据准确性原则

金融数据产品必须遵循：

> **宁愿没有数据，也不要猜数据。**

因此：

```text
null ≠ 0
```

如果取不到数据：

显示：

```text
—
```

而不是：

```text
0
```

如果不同数据源口径冲突：

第一版直接显示：

> Source mismatch

不要让 LLM 自己决定哪个数字是真的。

---

## 28. 开发阶段

### Phase 0 — Freeze

目标：

建立稳定开发基础。

任务：

```text
Clone 仓库
本地跑通 dev
创建功能分支
移除无关导航
```

验收：

> 产品正常启动。

---

### Phase 1 — Slim Shell

目标：

获得：

```text
Chat + Empty Canvas
```

页面：

```text
Left
Agent

Right
Blank Canvas
```

验收：

> Chat 正常工作。

---

### Phase 2 — Static Canvas

加入：

```text
react-grid-layout
ECharts
```

Fake Data。

完成：

```text
Bar
Line
Table
Sources
```

并支持：

```text
drag
resize
delete
save layout
```

验收：

> 不依赖 AI，可以手动完成 Canvas 操作。

---

### Phase 3 — Agent Controls Canvas

已实现（方案 A + Pack P1）：

```text
User → Opptrix Agent → create_widget / update_widget / delete_widget
  → schema validation → research_canvas SSE
  → 客户端 Canvas Controller → Research Canvas state → UI
```

- 独立 pack `research_canvas`（always-on，仅三工具）
- 不复用 `create_canvas`
- Agent 不写 React state / 不生成 ECharts option / 不决定 x/y
- 本轮 TurnCanvasState：request snapshot → 每次成功 tool 后更新 → 结束销毁
- 客户端对 SSE 二次 fail-closed；localStorage 仍是 UI 权威
- 继续使用 Phase 2 固定 mock Dataset

验收句：加一个毛利率趋势图 / 再加一个2025年毛利率排名 / 把排名改成折线图 / 把毛利率趋势改名为五年毛利率趋势 / 删掉排名图 / 刷新保持。

### Phase 4A — Real Data → Research Canvas

已实现（A1 + B1 + C1，不接 AKShare）：

```text
User → query_data
  → Entity Resolver（OpptrixQuant search / 代码解析）
  → Metric Registry
  → queryInstrumentData(financials, annual)
  → Dataset Store（dataset_created SSE）
  → create_widget
```

- 无 per-query provider preference：不改 Engine failover；请求字段全 null 则 fail closed
- Source.provider 只来自 QueryResult.source；cache / 缺失记为 unknown，不编 URL
- 真实 Dataset id：`research-ds-<uuid>`；mock `ds-tire-gross-margin-2021-2025` 仅 v1 fallback
- 持久化 version 2：widgets + layout + datasets
- 不进入 Dataset mutation / Excel / UI polish

验收：比较三家轮胎 2021–2025 毛利率 → 真数据集 + 折线/表/来源；再加排名复用 datasetId；改成折线只 update_widget；刷新后 Dataset 仍在。

### Phase 4A.1 — Research Widget Preview & Adopt（已完成）

产品关系：

```text
Dataset → Widget Proposal → Chat Preview → 用户 Adopt → Canvas Widget
```

已实现（Persistence 方案 A）：

- 新工具 `propose_widget`；`proposal.id` = 现有 `toolCallId` / `step.id`
- SSE `widget_proposed`：画布 no-op；Chat 同槽位 Ready
- 历史 Preview 从 tool step 轻量 metadata hydrate；数值来自 persist v2 Dataset
- `acceptedProposalIds` 记录采纳；Adopt 纯客户端，不调 LLM
- 真实 Dataset 缺失 → Preview Error「暂时无法加载这个研究视图」；禁止 mock fallback
- 「调整」预填 `调整「{title}」：`，UI 不暴露 proposalId

路由：

```text
比较 / 对比 / 看看 / 看一下 / 梳理 财务指标或走势
  → query_data → propose_widget → Preview
再看看…排名           → 只 propose_widget（复用 Dataset）
直接加入右侧 / 放进画布 → create_widget
```

Golden Path（真实 Tushare Dataset，2026-09-10）已通过。细则见 [`HANDOFF.md`](./HANDOFF.md)。

### Phase 4B — Dataset Refinement & Lineage（完成）

核心原则：**Never silently mutate an existing ResearchDataset.** 数据语义变化 → 新 `research-ds-*` + 可选 `parentDatasetId` / `transform`；视图变化 → 同一 `datasetId` 的 `propose_widget`。

已实现：

- 新工具 `refine_dataset`（`remove_entities` / `add_entities` / `change_period`）
- Dataset v2 可选字段：`query`、`parentDatasetId`、`transform`、`createdAt`（不升 v3）
- Agent TurnState `records[]`：完整 Dataset 供 derive；LLM 仍只看 metadata（cap 20）
- 客户端 POST `research_canvas`：`datasetRecords` 按会话引用裁剪（cap 32），禁止全局 Store 全量
- 本地 derive：remove / 子集年份；超范围年份或 add_entities 才重查 Provider
- SSE 仍复用 `dataset_created`；`update_widget(datasetId)` 仅当用户**明确**改右侧已有图

路由：

```text
去掉/加上公司、收窄年份  → refine_dataset → propose_widget → Preview → Adopt
改成柱状图/改标题       → propose_widget（同一 datasetId；勿 update_widget）
改看 ROE / 新指标       → query_data（无 parentDatasetId）
明确改右侧已有图范围     → refine_dataset → update_widget(datasetId)
```

Golden Path（浏览器，2026-09-10）已通过；路由已收紧 refine/propose 对 `update_widget` 的误触发。细则与验收表见 [`HANDOFF.md`](./HANDOFF.md)。

### Phase 4C.0 — Canvas Performance & Adaptive Layout（完成）

**范围**：仅客户端 Canvas Interaction Engine；不改 Agent 工具、Dataset 语义、Provider、Excel。

已实现：

```text
Interaction state ≠ Persisted business state

drag/resize active → RGL transient only（不写 localStorage）
onDragStop / onResizeStop / Adopt / Delete / Auto Arrange → commit once + dedupe
```

| 能力 | 实现 |
|------|------|
| Persist 时机 | `layoutCommit.ts`；交互中 `interactionRef` 阻断 |
| ECharts resize | `EchartsFill` ResizeObserver → RAF，每帧每实例 ≤1 次 |
| 图表响应式 | `chartResponsive.ts` wide/medium/compact（600/380px 内容宽阈值） |
| Widget 尺寸语义 | `widgetSizePresets.ts` preferred + minW/minH 按 type |
| 新 Widget 落位 | `layoutPlacement.ts` first-fit，非 maxY 堆底 |
| 整理布局 | 画布顶栏「整理布局」→ `autoArrangeLayout` 确定性重排 |
| React 优化 | Widget 组件 `memo`；view/option `useMemo` |
| 交互 UX | 仅六点 handle 可拖；resize 透明热区；拖拽时 body `pointer-events: none` |

持久化仍只存 grid 单位 `x/y/w/h`；splitter 变宽只触发 RGL 像素映射 + chart surface resize，不改 layout 坐标。

未做：Inspector、Notes、Excel、Agent routing。

验收与门禁见 [`HANDOFF.md`](./HANDOFF.md) § Phase 4C.0。

---

### Phase 4C.1 — Active Widget & Chat Context Bridge（完成）

**范围**：Widget 单击选中、Chat 上下文 chip、`research_canvas.activeWidget` 注入 Agent turn；不改 4C.0 persist / layout 架构、不改 Dataset 语义。

```text
UI selection (ephemeral)
  activeWidgetSelection.ts → activeWidgetId
  WidgetFrame body click → setActiveWidget
  blank canvas / delete / chip × → clear

Chat bridge
  ComposerActiveWidgetChip → composer 上方标题 chip
  sessionDatasetSnapshot → POST research_canvas.activeWidget
  useSubmitImpl → 随 datasetRecords 一并发送

Agent
  research-canvas-protocol → ResearchCanvasActiveWidget + sanitize
  research-canvas-turn-state → hydrate activeWidget from snapshot
  research-canvas-context → turn 上下文含当前选中 Widget
  agent-prompt-guide → 「这个 / 这里 / 当前图」指代 playbook
```

| 约束 | 说明 |
|------|------|
| 不 persist selection | 刷新后 Widget 在、选中态不恢复 |
| Adopt 后 auto-select | `findAddedWidgetId` 选中新 Widget |
| create_widget | 仍走 Preview → 用户 Adopt；禁止静默改画布 |
| Preview 卡 | 新增 Cancel；顺序 Cancel / Adjust / Add to Canvas |

工作区分栏（同批交付）：默认右栏 75% 画布 / 左 25% Chat；比例存 `opptrix.workspace-split.right-ratio`（`workspaceSplitWidth.ts`）。旧 360px 默认仅 preview fallback。

验收与门禁见 [`HANDOFF.md`](./HANDOFF.md) § Phase 4C.1。

---

### Phase 4C.5 — Chat Streaming Presentation & Composer（完成）

**范围**：仅 `client-ui` 流式/trace/Composer 呈现；不改 Agent SSE schema、tool loop 或 `chat-progress` 服务端字段。

```text
SSE / sessionStreamRuntime（既有）
  → tracePresentation.resolveInvestorStatusLabel / extractSourceChips
  → ChatProcessTrace（status morph + 折叠摘要 + Preview 槽位）
  → replyDraft → ChatStreamReplyShell + ChatStreamReceipt
  → ChatComposer.streamStatusLabel footer

Composer 4C.5.1
  → 空态单行 + | editor | mic/send；有内容双行；focus hint
```

| 约束 | 说明 |
|------|------|
| 投资者文案 | 禁止默认展示 tool 名、step 序号、token 计数 |
| Preview | `propose_widget` 仍独立槽位，不塞进折叠「执行过程」 |
| 详细过程 | tool steps / raw reasoning 仅在用户展开后可见 |
| 后端 | 无新 API；status 文案由客户端 morph |

验收与门禁见 [`HANDOFF.md`](./HANDOFF.md) § Phase 4C.5。

---

### Phase 5 — Full Loop

接起来：

```text
Prompt
↓
Intent
↓
Data
↓
Dataset
↓
Canvas
```

验收：

> 一句话自动生成真实图表。

---

### Phase 6 — Editing

支持：

```text
加公司
删公司
改指标
改时间
改图表
```

---

### Phase 7 — Export

实现：

```text
Export Excel
```

---

### Phase 8 — UI Polish

最后才处理：

```text
Dark glass
Loading
Animations
Hover
Empty State
Error State
```

---

## 29. 第一条开发 Demo

建议不要一开始做海外营收。

先做：

> **轮胎公司标准财务指标比较。**

Demo：

```text
比较赛轮轮胎、玲珑轮胎、森麒麟
2021–2025 年：

毛利率
营收增速
```

输出：

```text
Widget 1
Gross Margin Trend

Widget 2
Revenue Growth Trend

Widget 3
2025 Gross Margin Ranking

Widget 4
Data Table

Widget 5
Sources
```

这是 V1 的 Golden Path。

---

## 30. 第二阶段再做真正行业研究指标

例如：

```text
海外收入
海外收入占比
分产品收入
产能
销量
ASP
市场份额
```

这类指标不能单纯依赖标准财务 API。

第二阶段架构：

```text
Annual Report
↓
Extraction
↓
Research Metric DB
↓
Provider Layer
```

但不要进入第一版。

---

## 31. 推荐最终目录结构

```text
research-canvas/

apps/
  web/
    components/
      canvas/
      widgets/
      chat/

    stores/
      canvas-store.ts

  server/
    agent/
    tools/
      query-data.ts
      canvas-tools.ts

    data/
      metric-registry.ts
      entity-resolver.ts
      provider-registry.ts

services/
  data/
    providers/
      akshare_provider.py

    normalizer/
    cache/

  export/
    excel_export.py

shared/
  schemas/
    dataset.ts
    widget.ts
    entity.ts
    metric.ts
    canvas-event.ts
```

---

## 32. 技术决策总结

最终第一版技术栈：

| 层                 | 方案                               |
| ----------------- | -------------------------------- |
| App Shell         | React + Fastify 自托管           |
| Agent             | 内置 Agent Runtime               |
| LLM               | OpenAI-compatible API            |
| Data Architecture | 现有 MarketDataEngine + Provider Registry（不新建 Mini Layer） |
| Real Data         | AKShare，经 `AkshareProvider` 接入                             |
| Cache             | 复用 Engine Cache；不另起一套 SQLite 行情缓存                   |
| Canvas            | react-grid-layout                |
| Chart             | Apache ECharts                   |
| State             | Zustand                          |
| Excel             | XlsxWriter                       |
| Frontend          | React / TypeScript               |
| Backend           | Node.js + Fastify                  |
| Data Service      | Python                           |

整个系统最终可以压缩成一句技术定义：

> **Research Canvas 是一个由 LLM 驱动操作、由结构化金融 Dataset 支撑、以动态 Canvas 作为主要输出界面，并以 Excel 作为最终交付格式的 AI-native research workspace。**

而产品定义则更简单：

> **用户不需要先找数据、导 Excel、画图，直接告诉 AI 想比较什么，Canvas 就把数据摆到眼前。**

这两句话基本就是之后写 README、作品集、面试介绍时最核心的两层叙事。
