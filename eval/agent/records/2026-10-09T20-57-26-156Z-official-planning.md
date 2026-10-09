# Agent 规划评测记录

- **性质：** 正式
- **时间：** 2026-10-09T20:57:26.156Z
- **模型：** deepseek-flash
- **Git：** `e88fb8bd41f2e20cb4c16ce4914833820990ee71`（工作区有未提交改动）
- **数据集：** agent-planning-canvas-v1
- **有效占比：** **21 / 24（87.5%）**
- **失败频率：** 12.5%（3 题）
- **平均决策次数：** 全量 1.83；通过题 1.67
- **步骤有效率：** 87.8%
- **范围：** 夹具多轮决策链；执行工具但不打 Tushare

## 监控指标

| 指标 | 本轮 |
|---|---|
| 有效占比 | 21 / 24（87.5%） |
| 失败频率 | 12.5%（3 题） |
| 平均决策次数（全量） | 1.83 |
| 平均决策次数（通过题） | 1.67 |
| 步骤有效率 | 87.8% |
| 约束击穿 | 无 |
| 耗时 | 84s |

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| named_compare | 4 | 4 | 0 | 0 |
| many_preview | 3 | 1 | 2 | 0 |
| industry | 3 | 3 | 0 | 0 |
| refine_view | 5 | 5 | 0 | 0 |
| adopt_boundary | 3 | 3 | 0 | 0 |
| quotes_and_stop | 6 | 5 | 1 | 0 |

## 约束击穿

无。

## 失败

| 编号 | 任务 | 实际工具 | 原因 |
|---|---|---|---|
| pl-005 | 比较茅台、五粮液、洋河、泸州老窖、山西汾酒 2020 到 2024 年营收 | ask_user, query_data, propose_widget | 缺少步骤 query_data；缺少步骤 query_data；缺少步骤 propose_widget |
| pl-007 | 比较茅台、五粮液、洋河、泸州老窖、山西汾酒 2020 到 2024 年营收 | query_data, ask_user, ask_user | max_decisions 2，实际 3 |
| pl-023 | 看一下招商银行近五年净息差走势 | get_instrument_financials, get_instrument_snapshot, ask_user | max_decisions 1，实际 3 |

## 复现

```bash
npm run eval:agent:planning
```

判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。
