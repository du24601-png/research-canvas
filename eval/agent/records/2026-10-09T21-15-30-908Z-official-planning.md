# Agent 规划评测记录

- **性质：** 正式
- **时间：** 2026-10-09T21:15:30.908Z
- **模型：** deepseek-flash
- **Git：** `b1125b82d14c14844e4bcde4c570d4ace0a4ce92`（工作区有未提交改动）
- **数据集：** agent-planning-canvas-v1
- **有效占比：** **23 / 24（95.8%）**
- **失败频率：** 4.2%（1 题）
- **平均决策次数：** 全量 1.83；通过题 1.78
- **步骤有效率：** 91.7%
- **范围：** 夹具多轮决策链；执行工具但不打 Tushare

## 监控指标

| 指标 | 本轮 |
|---|---|
| 有效占比 | 23 / 24（95.8%） |
| 失败频率 | 4.2%（1 题） |
| 平均决策次数（全量） | 1.83 |
| 平均决策次数（通过题） | 1.78 |
| 步骤有效率 | 91.7% |
| 约束击穿 | 无 |
| 耗时 | 86s |

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

无。

## 失败

| 编号 | 任务 | 实际工具 | 原因 |
|---|---|---|---|
| pl-023 | 看一下招商银行近五年净息差走势 | search_instruments, get_instrument_financials, ask_user | max_decisions 1，实际 3 |

## 复现

```bash
npm run eval:agent:planning
```

判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。
