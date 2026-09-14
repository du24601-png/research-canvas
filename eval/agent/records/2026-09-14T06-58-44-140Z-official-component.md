# Agent 组件评测记录

- **性质：** 正式
- **时间：** 2026-09-14T06:58:44.140Z
- **模型：** deepseek-flash
- **Git：** `739c6db39705f33a16b7bef01df46590ad2a9fd2`（工作区有未提交改动）
- **数据集：** agent-component-tushare-v1
- **成绩：** **93 / 99 通过（93.9%）**，跳过 1，失败 6
- **范围：** 只评第一轮工具调用；不执行工具、不打 Tushare

## 监控指标

| 指标 | 本轮 |
|---|---|
| 有效占比 | 93 / 99（93.9%） |
| 失败频率 | 6.1%（6 题） |
| 平均决策次数（全量） | 0.73 |
| 平均决策次数（通过题） | 0.71 |
| 步骤有效率 | 93.9% |
| 约束击穿 | must_not_call×4 |
| 耗时 | 180s |

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| tushare_query_canvas | 32 | 31 | 1 | 0 |
| tushare_query_quotes | 13 | 13 | 0 | 0 |
| tushare_query_profile | 8 | 8 | 0 | 0 |
| tushare_query_gate | 15 | 10 | 5 | 1 |
| no_tool | 31 | 31 | 0 | 0 |

## 失败

| 编号 | 问句 | 实际工具 | 原因 |
|---|---|---|---|
| qc-017 | 看一下中芯国际的K线 | search_instruments | 缺少工具 query_data |
| qg-004 | 比较茅台、五粮液、洋河、泸州老窖、山西汾酒 2020 到 2024 年营收 | ask_user | 缺少工具 query_data |
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
