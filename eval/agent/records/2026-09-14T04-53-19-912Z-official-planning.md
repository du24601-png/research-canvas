# Agent 规划评测记录

- **性质：** 正式
- **时间：** 2026-09-14T04:53:19.912Z
- **模型：** deepseek-flash
- **Git：** `739c6db39705f33a16b7bef01df46590ad2a9fd2`（工作区有未提交改动）
- **数据集：** agent-planning-canvas-v1
- **有效占比：** **17 / 24（70.8%）**
- **失败频率：** 29.2%（7 题）
- **平均决策次数：** 全量 2.04；通过题 1.47
- **步骤有效率：** 83.7%
- **范围：** 夹具多轮决策链；执行工具但不打 Tushare

## 分题组

| 题组 | 判分 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| named_compare | 4 | 3 | 1 | 0 |
| many_preview | 3 | 0 | 3 | 0 |
| industry | 3 | 2 | 1 | 0 |
| refine_view | 5 | 5 | 0 | 0 |
| adopt_boundary | 3 | 2 | 1 | 0 |
| quotes_and_stop | 6 | 5 | 1 | 0 |

## 约束击穿

| 约束 | 击中次数 |
|---|---|
| no_early_confirm | 3 |
| no_fake_metric | 1 |

## 失败

| 编号 | 任务 | 实际工具 | 原因 |
|---|---|---|---|
| pl-004 | 看一下中芯国际的K线 | search_instruments, search_instruments, search_instruments, ask_user, query_data, propose_widget | max_decisions 4，实际 6 |
| pl-005 | 比较茅台、五粮液、洋河、泸州老窖、山西汾酒 2020 到 2024 年营收 | query_data, ask_user, query_data, propose_widget | no_early_confirm：禁止参数 query_data |
| pl-006 | 对比工商银行、建设银行、农业银行、中国银行、交通银行 2020 到 2024 年营收 | query_data, ask_user, query_data, propose_widget | no_early_confirm：禁止参数 query_data |
| pl-007 | 比较茅台、五粮液、洋河、泸州老窖、山西汾酒 2020 到 2024 年营收 | query_data, ask_user, query_data, propose_widget | max_decisions 2，实际 4；no_early_confirm：禁止参数 query_data |
| pl-008 | 白酒行业毛利率对比 | resolve_industry_universe, ask_user | 缺少步骤 query_data；缺少步骤 propose_widget |
| pl-018 | 把右侧这张改成柱状图 | propose_widget | 缺少步骤 update_widget |
| pl-023 | 看一下招商银行近五年净息差走势 | ask_user, query_data, propose_widget | max_decisions 1，实际 3；no_fake_metric：禁止工具 query_data |

## 复现

```bash
npm run eval:agent:planning
```

判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。
