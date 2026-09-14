# Agent 规划评测记录

- **性质：** 正式
- **时间：** 2026-09-14T05:15:57.092Z
- **模型：** deepseek-flash
- **Git：** `739c6db39705f33a16b7bef01df46590ad2a9fd2`（工作区有未提交改动）
- **数据集：** agent-planning-canvas-v1
- **有效占比：** **24 / 24（100.0%）**
- **失败频率：** 0.0%（0 题）
- **平均决策次数：** 全量 1.75；通过题 1.75
- **步骤有效率：** 95.8%
- **范围：** 夹具多轮决策链；执行工具但不打 Tushare

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| named_compare | 4 | 4 | 0 | 0 |
| many_preview | 3 | 3 | 0 | 0 |
| industry | 3 | 3 | 0 | 0 |
| refine_view | 5 | 5 | 0 | 0 |
| adopt_boundary | 3 | 3 | 0 | 0 |
| quotes_and_stop | 6 | 6 | 0 | 0 |

## 约束击穿

无。

## 失败

无。

## 复现

```bash
npm run eval:agent:planning
```

判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。
