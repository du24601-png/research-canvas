# Agent 组件评测记录

- **性质：** 正式
- **时间：** 2026-09-14T02:56:13.403Z
- **模型：** deepseek-flash
- **Git：** `739c6db39705f33a16b7bef01df46590ad2a9fd2`（工作区有未提交改动）
- **数据集：** agent-component-tushare-v1
- **成绩：** **34 / 37 通过（91.9%）**，跳过 1，失败 3
- **范围：** 只评第一轮工具调用；不执行工具、不打 Tushare
- **备注：** 由首轮 scratch 报告回填。当时 runner 未保存 tool args，本档案补了问句与 gold。

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| tushare_query_canvas | 12 | 10 | 2 | 0 |
| tushare_query_quotes | 5 | 5 | 0 | 0 |
| tushare_query_profile | 3 | 3 | 0 | 0 |
| tushare_query_gate | 5 | 4 | 1 | 1 |
| no_tool | 12 | 12 | 0 | 0 |

## 失败

| 编号 | 问句 | 实际工具 | 原因 |
|---|---|---|---|
| qc-003 | 对比宁德时代和比亚迪近五年毛利率 | query_data | 工具 query_data 参数不匹配：start: 期望属于 [2021,2022]，实际 2020 |
| qc-009 | 宁德时代近三年毛利率 | query_data | 工具 query_data 参数不匹配：start: 期望属于 [2023,2024]，实际 2022 |
| qg-006 | 沪深300成分股有哪些 | resolve_industry_universe | max_calls 0，实际 1；禁止工具 resolve_industry_universe；must_not_call：出现工具调用 |

## 跳过

| 编号 | 问句 | 原因 |
|---|---|---|
| qg-005 | 确认，按这个名单查 | skipped |

## 复现

```bash
npm run eval:agent:component
```

判分器：`eval/agent/component/judge.mjs`。完整 JSON 与本简报同目录。
