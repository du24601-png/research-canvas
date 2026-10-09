# Agent 规划评测记录

- **性质：** 正式
- **时间：** 2026-10-09T20:15:38.524Z
- **模型：** deepseek-flash
- **Git：** `5a4eeb0afaba149b1d213d9c1625e77ac31ccb32`（工作区有未提交改动）
- **数据集：** agent-planning-canvas-v1
- **有效占比：** **23 / 24（95.8%）**
- **失败频率：** 4.2%（1 题）
- **平均决策次数：** 全量 1.92；通过题 1.87
- **步骤有效率：** 90.3%
- **范围：** 夹具多轮决策链；执行工具但不打 Tushare

## 监控指标

| 指标 | 本轮 |
|---|---|
| 有效占比 | 23 / 24（95.8%） |
| 失败频率 | 4.2%（1 题） |
| 平均决策次数（全量） | 1.92 |
| 平均决策次数（通过题） | 1.87 |
| 步骤有效率 | 90.3% |
| 约束击穿 | no_fake_metric×1 |
| 耗时 | 84s |

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| named_compare | 4 | 4 | 0 | 0 |
| many_preview | 3 | 3 | 0 | 0 |
| industry | 3 | 3 | 0 | 0 |
| refine_view | 5 | 5 | 0 | 0 |
| adopt_boundary | 3 | 3 | 0 | 0 |
| quotes_and_stop | 6 | 5 | 1 | 0 |

## 约束击穿

| 约束 | 击中次数 |
|---|---|
| no_fake_metric | 1 |

## 失败

| 编号 | 任务 | 实际工具 | 原因 |
|---|---|---|---|
| pl-023 | 看一下招商银行近五年净息差走势 | query_data, query_data, propose_widget | max_decisions 1，实际 3；no_fake_metric：禁止工具 query_data, query_data |

## 复现

```bash
npm run eval:agent:planning
```

判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。
