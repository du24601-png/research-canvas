# FinFrame M3a 笔记：对话优先布局（2026-10-09）

## 状态

- 已提交 `d10fe22`（本地分支 `finframe/m0.5-m1`，未推送）：开关、看板抽屉、「钉住」、计划卡置顶、对外品牌、AGENTS.md 改写、6 个新 UI 测试。
- 工作区未提交：评审后的决定 (a)(b) 和本文件（见下）。
- 已通过（工作区）：`check:ui`、`test:ui`（37 文件 / 169 测试）。`d10fe22` 时 `build:packages`、`test:gate`（12 文件）、品牌测试 7/7 也已通过。
- 本机权限检查在做到一半时开始拒绝部分命令（标注过「Self-Modification」「Modify Shared Resources」）。我没有绕过。

## 改了什么

| 项 | 做法 |
|---|---|
| 开关 | 默认开。`VITE_FINFRAME_CHAT_FIRST=0`（构建期）或 localStorage `finframe.chatFirst=0`（运行期）恢复双栏画布，代码未删除 |
| 布局 | 对话全宽（沿用 820px 最大宽度）；右栏只在文件预览时出现 |
| 看板 | 顶栏「看板 n」打开右侧抽屉（宽 min(760px, 100vw)），复用 `ResearchCanvas`。关闭时只移出视口、保持挂载：画布状态和预览卡读的 localStorage 只在挂载时写入 |
| 钉住 | 预览卡显示「钉住 / 已钉住 / 在看板中查看」，仍走 `widget_adopted` → `adoptProposal`。钉住后不自动打开看板，只更新计数 |
| 计划卡 | 对话优先模式下 `ResearchFetchPlanCard` 放在本轮最上方，不随状态卡收起 |
| 品牌 | `shared/product-brand.ts` 新增 `OUTWARD_BRAND` = FinFrame，客户端统一用它。内部名 `PRODUCT_BRAND` 不变，因为它进系统提示词和 TOTP issuer |
| AGENTS.md | 产品定位改为 FinFrame / 活报告；原则 3 改为 Preview → Pin；代码地图加入 `pin-board/`；其余规则不变 |

## 评审决定（2026-10-09 17:02Z）

- **(a) AI 不写看板**：对话优先模式下，看板忽略 Agent 的 `widget_created`（`useResearchCanvas` 新增 `ignoreAgentCreates` 选项），已改，并加了测试。从默认工具里移除 `create_widget` 属于 Agent 改动，放到 M2。
- **(b) 移动端顶栏按钮**：原标签错写成「关注与持仓」。现在对话优先模式显示「打开/收起看板」，旧布局显示「打开/收起研究画布」。已改。
- **(c) 已知旧问题，未修**：旧布局里右栏收起时，流式数据集不落盘，之后点「添加到画布」会失败。原因同上：画布不挂载就不接收事件。
- **(d) 1–3 家公司的「先确认再取数」**：两个方案。
  - A：所有研究问题先返回 `plan_preview`，改 shared 的分档规则。每问多一次确认往返，复用现有确认 steer。
  - B：`query_data` 执行前发一个新的 SSE「plan」事件，短暂倒计时后自动继续，用户可经现有 steer 取消或修改。点击更少，但要新事件类型和 engine 钩子。
  - **选 B，排在 M4，不在 M3a 做。**

## 解除拦截后还要做

1. 提交工作区：`useResearchCanvas.ts`、`ResearchCanvas.tsx`、`MobileTopBar.tsx`、`PinBoard.test.tsx` 和本文件。
2. 重跑 6 个指定 node 测试：`node --test tests/research-canvas-tools.test.mjs tests/research-query-data.test.mjs tests/research-refine-dataset.test.mjs tests/mcp-tool-route-accuracy.test.mjs tests/session-artifacts-opt-in.test.mjs tests/session-tools-freeze.test.mjs`
3. 重跑 12 题种子集（`node eval/finframe/run.mjs`），确认 Agent 侧没有变化。
4. 截图：对开发服务器跑 Playwright，开关开、关各一组，外加看板打开时一张。
