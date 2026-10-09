# Agent 组件评测记录

- **性质：** 正式
- **时间：** 2026-10-09T16:21:59.798Z
- **模型：** deepseek-flash
- **Git：** `9e630ee385e0d1b41cc596f25af719d5cf5a6da4`
- **数据集：** agent-component-tushare-v1
- **成绩：** **94 / 99 通过（94.9%）**，跳过 1，失败 5
- **范围：** 只评第一轮工具调用；不执行工具、不打 Tushare

## 监控指标

| 指标 | 本轮 |
|---|---|
| 有效占比 | 94 / 99（94.9%） |
| 失败频率 | 5.1%（5 题） |
| 平均决策次数（全量） | 0.71 |
| 平均决策次数（通过题） | 0.69 |
| 步骤有效率 | 94.9% |
| 约束击穿 | must_not_call×4 |
| 耗时 | 137s |

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| tushare_query_canvas | 32 | 31 | 1 | 0 |
| tushare_query_quotes | 13 | 13 | 0 | 0 |
| tushare_query_profile | 8 | 8 | 0 | 0 |
| tushare_query_gate | 15 | 11 | 4 | 1 |
| no_tool | 31 | 31 | 0 | 0 |

## 失败

| 编号 | 问句 | 实际工具 | 原因 |
|---|---|---|---|
| qc-017 | 看一下中芯国际的K线 | search_instruments | 缺少工具 query_data |
| qg-006 | 沪深300成分股有哪些 | resolve_industry_universe | max_calls 0，实际 1；禁止工具 resolve_industry_universe；must_not_call：出现工具调用 |
| qg-013 | 中证500成分股有哪些 | resolve_industry_universe | max_calls 0，实际 1；禁止工具 resolve_industry_universe；must_not_call：出现工具调用 |
| qg-014 | 上证50成分股列表 | resolve_industry_universe | max_calls 0，实际 1；禁止工具 resolve_industry_universe；must_not_call：出现工具调用 |
| qg-015 | 创业板指都有哪些股票 | resolve_industry_universe | max_calls 0，实际 1；禁止工具 resolve_industry_universe；must_not_call：出现工具调用 |

## 跳过

| 编号 | 问句 | 原因 |
|---|---|---|
| qg-005 | 确认，按这个名单查 | skipped |

## 复现

```bash
npm run eval:agent:component
```

判分器：`eval/agent/component/judge.mjs`。完整 JSON 与本简报同目录。
