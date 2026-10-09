# FinFrame M3 笔记：UI Spec 与生成式组件（2026-10-09）

结论：Spec 校验、组件注册与 4 个组件已就位，用静态夹具验证。**还没接到 Agent**，模型目前不会产出 Spec，接入在 M4。另新增 `refine_dataset` 的 `yoy_delta` 变换，用于「变化最大的年份」：差值由代码计算，放在派生 Dataset 里。

## 改了什么

| 位置 | 内容 |
|---|---|
| `packages/shared/src/research-ui-spec.ts`（子路径 `@opptrix/shared/research-ui-spec`） | Spec 类型与 `parseResearchUiSpec`：只认已注册组件（ComparisonView / TrendView / EvidencePanel / MissingData）、已注册动作（pin / open_sources / highlight_largest_change）和已知 datasetId；未知字段拒绝；标题里不许出现年份以外的数字；任何一处不合规就整份拒绝，不修补、不补值 |
| `packages/shared/src/research-dataset-delta.ts` | `yoyDeltaDataset`（相邻两期相减，任一期缺值得 null，百分比指标单位为「个百分点」）和 `largestAbsDelta` |
| `research-dataset.ts` / `-derive.ts` | `DatasetTransform` 增加 `{ type: 'yoy_delta' }`。只加不改，旧数据不受影响 |
| `packages/agent/src/research-refine-dataset.ts`、`research-canvas-tools.ts` | `operation.type` 增加 `yoy_delta`（不接受其他参数），生成新的派生 Dataset，父集不变；模型看到的结果里没有差值 |
| `client-ui/src/chat/research-canvas/layoutStorage.ts`、`types.ts` | 客户端接受并克隆 `yoy_delta` 变换，刷新页面后派生集不会丢 |
| `client-ui/src/generative-ui/` | `registry`、`SpecRenderer`（不合规 → 原预览卡）、`BlockFrame`、4 个组件、静态夹具 |
| 测试 | `SpecRenderer.test.tsx`（11 个）、`tests/research-ui-spec.test.mjs`、`tests/research-yoy-delta.test.mjs`；后两个已加入 `test:gate` |

## 组件

- **ComparisonView**：多个 Dataset 并排，各画一张图，不合并、不改值（F3-A）。
- **TrendView**：单个 Dataset 的趋势。点「看变化最大的年份」时，文字取自同比变化 Dataset 里绝对值最大的一格，并注明「由代码计算」。
- **EvidencePanel**：每个 Dataset 列出指标、来源、报告期、获取时间和覆盖情况。来源为 mixed / unknown 时显示「来源未标注」。
- **MissingData**：逐家列出缺的期，说明缺失显示为 —，不补值。
- 动作：组件只回调 `onAction`，自己不发画布事件、不写看板。测试确认渲染和点击都不改看板。

## 与计划不一致的地方

- **没用 zod（F2-A）**：`npm install zod@4.4.3 -w @opptrix/shared` 被本机权限检查拒绝（「Modify Shared Resources」），我没有绕过。现在的 `parseResearchUiSpec` 是手写严格校验，语义与计划的 zod schema 相同，调用方只认 `{ ok, spec | errors }`，以后换成 zod 不影响调用方。依赖没装上，lockfile 也没改。
- `research-refine-dataset.ts` 原本已有 319 行，现在 329 行。计算逻辑都放进了 shared 新文件，这里只加了解析和分派。

## 已知问题与后续

- **既有缺陷**：客户端 `normalizeTransform` 不认 `aggregate_groups`，分组平均得到的派生集刷新页面后会被丢掉。这次没修。
- 评测用的工具清单（`eval/agent/component/tool-catalog.json`）是冻结的，里面还没有 `yoy_delta`。M2/M4 改提示词时再同步，同时跑 eval 对比。
- 这次改动了 refine_dataset 的工具描述，会影响模型选工具。M4 接入 Spec 时一起重跑种子集和 `eval:agent`。
- **M4 要做**：Agent 产出 Spec，经 SSE 下发；`SpecRenderer` 挂进 `ChatProcessTrace`，替代预览卡；`pin` 动作接到现有的 `widget_adopted`；`open_sources` 打开 EvidencePanel；计划卡按方案 B 做。
