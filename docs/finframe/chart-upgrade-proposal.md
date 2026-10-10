# FinFrame 图表与通用组件升级：接入方案（待确认，2026-10-10）

背景：Quinn 认为 ECharts 不够好看，且「只有图表不够通用」（见 `docs/finframe/ui-research.md` 第 6 节、样张 https://claude.ai/artifact/EgsCi5sqMNCeUtNP8Xwvt6 ）。
Quinn 尚未在 Vega-Lite 与 AntV G2 之间选定，本方案**默认按 Vega-Lite 写**；改选 G2 时只替换「渲染器」一层，其余不变。
按 AGENTS.md「先确认再动手」：本文件只是方案，确认前不写代码、不装包。

## 1. 目标

1. 回答和看板里的图更好看：线尾直接标名与最新值、只留横向网格、突出关注对象、图下带来源脚注（导出也带上）。
2. 回答不只有图：新增指标卡、带数句子、热力表格、事件时间线等通用组件。
3. 不破坏现有规则：数字只来自 Dataset、Preview → Pin、Dataset 不可变、看板已存数据只增不破、能一键回退。

## 2. 现状调用链（已读代码确认）

```
Dataset ──views.ts（build*View，与渲染库无关）──> *View
   *View + ChartStyle ──chartOptions*.ts──> EChartsOption ──EchartsFill.tsx──> 画面
   点击 ──chartSourceClick.ts（按 seriesIndex / dataIndex 反查）──> ResearchCellRef ──> 来源面板
Spec（shared/research-ui-spec.ts，4 个组件，手写严格校验）──generative-ui/registry.tsx──> 组件
看板 Widget { type: WidgetType(12 种), datasetId, view, style: ChartStyle } ──persist──> localStorage
```

关键事实：

- `views.ts` 已把「数据 → 视图模型」与「视图模型 → ECharts option」分开，换渲染器只需替换后半段。
- ECharts 直接依赖集中在 `client-ui/src/chat/research-canvas/` 的约 10 个文件，另有 `packages/canvas-kit` 的 Chart 组件（报告 / 脑图路径，不在本次范围）。
- 看板持久化只存 `type / datasetId / view / style`，**不存 ECharts option**，换渲染器不需要迁移已存数据。
- 主应用没有对图表脚本设 CSP；附件预览路由的 CSP 已含 `'unsafe-eval'`。Vega 的表达式默认会动态编译，建议仍用 `vega-interpreter`（CSP 安全模式），避免以后收紧 CSP 时出问题。

## 3. 可选做法

### 做法 A：只换渲染器 + 扩组件目录（推荐先做）

- **图表**：保留 12 种 `WidgetType`、`views.ts`、`ChartStyle` 不变；新增 `vegaSpecs/*.ts`，把每种 `*View` 转成 Vega-Lite spec（数据行里带 `entityId / period`，点击直接拿到单元格，不再按下标反查）；新增 `VegaFill.tsx` 替代 `EchartsFill.tsx`。
  - K 线（`candlestick`）继续用 ECharts / lightweight-charts，第二步再评估。
  - 渲染器开关 `finframe.chartRenderer = echarts | vega`（与现有 `finframe.*` 开关同一机制），默认先 `echarts`，验收通过后改默认。
- **通用组件**：在 `research-ui-spec.ts` 的 `RESEARCH_UI_COMPONENTS` 里**追加** `KpiRow`、`NumberSentence`、`MetricTable`、`EventTimeline`（`version` 仍为 1，旧 Spec 照常通过）。
  - `NumberSentence.template` 只允许占位符 `{value:实体@期间}`、`{delta:…}`、`{rank:…}`、`{largestChange}`、`{entity:…}`；去掉占位符和年份后出现任何数字整份拒绝（沿用标题规则）。所有占位符由代码从 Dataset 计算并挂来源。
  - `EventTimeline` 需要事件数据源；没有现成 Provider 时先不开放，只做组件与校验。
- **影响范围**：client-ui 图表层（约 10 个文件替换 / 新增）、shared spec 追加组件、agent 侧 Composer 提示词与组件说明、新依赖 `vega` `vega-lite` `vega-interpreter`（BSD-3）。不改 API、不改 Schema、不改 Provider。
- **代价**：图种仍是 12 种上限，「通用」主要靠组件目录解决。

### 做法 B：开放图表语法（第二步）

- 新增 Spec 组件 `ChartView { datasetId, chart: { mark, encoding } }`：模型写受限的 Vega-Lite 编码（mark 白名单、通道只能引用 `entity / period / value / metric` 字段），**禁止** `data`、`values`、`transform`、`expr`、`signal`、`params`、任何数字常量（坐标轴范围除外，由代码给）。数据由代码按 `datasetId` 注入。
- 钉住时需要新的 Widget 形态（`type: 'vega'` + 受限 spec），属于看板持久化**追加字段**，需幂等迁移与回退。
- **好处**：图种基本不设上限（面积、散点、分面小多图、瀑布……）。
- **代价**：校验器复杂、要新增评测（合规率、数字泄漏率）、看板数据结构扩展。

### 做法 C：整体迁移到 json-render

- 用 json-render 的 catalog 取代手写 Spec 校验，并获得流式逐块渲染。
- **代价**：引入 zod 4；必须关闭 `$computed` / `$template` / `$state` 等表达式；与现有 M3/M4 校验规则重复，迁移面大。暂不推荐，等做法 A 稳定后再评估「流式」单独收益。

**建议：先 A，再按评测结果决定 B；C 暂缓。**

## 4. 做法 A 的分步计划

| 步 | 内容 | 门禁 |
|---|---|---|
| A1 | 报告风格主题 token（颜色、字号、网格、数字格式）+ `VegaFill` + 折线 / 柱状 / 分组柱三种图；开关默认关 | `check:ui`、`test:ui` |
| A2 | 其余图种（堆叠、组合、饼 / 环、热力、表格）；点击溯源改为按数据行取 `entityId/period`；图下来源脚注；导出 PNG 含脚注 | 同上 + 现有 `chartSourceClick` 测试改写 |
| A3 | shared 追加 4 个组件与校验；client 组件；Composer 组件说明 | `build:packages`、`test:gate`、指定 node 测试 |
| A4 | 评测：Composer 合规率、Spec 内数字为 0；`eval:agent` | `eval:agent` |
| A5 | 验收通过后把 `finframe.chartRenderer` 默认改为 `vega` | 全部门禁 |

验收标准（由另一轮单独核对，不自评）：

1. 开关关闭时界面与现在一致；打开后除 K 线外的全部图种都能渲染，缺失值显示为断点 / `—`，不画成 0。
2. 每个图元可点开来源，结果与 ECharts 版一致。
3. 已钉住的旧看板在两种渲染器下都能打开，无需迁移。
4. 新组件里的所有数字都能追溯到 Dataset，Spec 中年份以外的数字一律被拒。
5. 新增函数 < 50 行、新增文件 < 300 行；无 `any` / `@ts-ignore` / 非空断言。
6. Vega 相关代码按需加载，首屏不变重（以 `vite build` 产物对比为准）。

## 5. 若改选 AntV G2

- 只替换 A1/A2 的渲染层：`vegaSpecs/*` → `g2Options/*`，`VegaFill` → `G2Fill`；依赖为 `@antv/g2`（MIT）。
- 做法 B 的「开放语法」改为受限的 G2 options，校验思路相同；但模型对 G2 的熟悉度低于 Vega-Lite，B 的合规率风险更高。

## 6. 需要 Quinn 确认

1. 图表库：Vega-Lite（本文默认）还是 G2？
2. 是否按「先做法 A、后评估 B」推进？
3. 实现交给哪个线程：现在负责代码改动的是「FinFrame 继续推进」线程，建议由它按本方案实现，本线程只负责方案与验收。
