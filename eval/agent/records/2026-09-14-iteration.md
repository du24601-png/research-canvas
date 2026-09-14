# Agent 评测迭代（2026-09-14）

同一天内把 Agent 评测从「第一轮工具对不对」做到「整段决策链对不对」，并对规划层做了一轮夹具 / gold / 评测 prompt 校准。**不进入 `test:gate`，不与产品 CI 加权。**

模型一律 `deepseek-flash`（temperature 0）。产品 `tool-catalog.json` 未改（P2 未做）。

## 怎么跑

改完 Agent（提示词 / 工具 / 夹具）后跑整体流水线，串行三层全量并对照上一份正式档：

```bash
npm run eval:agent             # 先 build dist，再 component → planning → prompt，写综合简报
npm run eval:agent:component   # 只跑第一轮工具调用；不执行工具、不打 Tushare
npm run eval:agent:planning    # 只跑夹具多轮决策链；评测短提示词
npm run eval:agent:prompt      # 只跑同一套规划题 + 生产 assembleSystemPrompt
```

冒烟：`EVAL_LIMIT=1 npm run eval:agent`。分数不当门（有失败题也 exit 0）；未配模型 exit 2。`EVAL_STRICT=1` 时单层命令在有失败题时 exit 1。

正式归档在本目录 `*-official-*.md/json`（含 `*-official-pipeline.md`）。scratch 在 `eval/agent/*/runs/`（git 忽略）。不进入 `test:gate`。

## 时间线

| 顺序 | 做什么 | 结果 | 归档 |
|---|---|---|---|
| 1 | 组件评测 38 题冒烟回填 | 34/37（91.9%），跳过 qg-005 | [2026-09-14T02-56-13-403Z-official-component.md](./2026-09-14T02-56-13-403Z-official-component.md) |
| 2 | 组件集扩到 100 题，正式跑 | **94/99（94.9%）**，跳过 1 | [2026-09-14T04-20-44-545Z-official-component.md](./2026-09-14T04-20-44-545Z-official-component.md) |
| 3 | 规划层：做法 A（夹具多轮、先 24 题） | 数据集 `agent-planning-canvas-v1` | `eval/agent/planning/` |
| 4 | 规划正式评测 v1 | **17/24（70.8%）** | [2026-09-14T04-53-19-912Z-official-planning.md](./2026-09-14T04-53-19-912Z-official-planning.md) |
| 5 | 技术 RCA；确认 `ask_user` 算有效确认路径 | 7 题失败里多数是夹具/判分噪声 | 见下节 |
| 6 | P0 夹具 + P1 gold/prompt，不改产品 catalog | 单元测试 22 条绿 | — |
| 7 | 规划正式评测 v2 | **24/24（100%）** | [2026-09-14T05-15-57-092Z-official-planning.md](./2026-09-14T05-15-57-092Z-official-planning.md) |
| 8 | 生产提示词评测（同一 24 题，换线上 system + 尾注） | **18/24（75.0%）** | [2026-09-14T05-43-31-216Z-official-prompt.md](./2026-09-14T05-43-31-216Z-official-prompt.md) |
| 9 | 四条提示词删改后再跑生产稿 | **23/24（95.8%）** | [2026-09-14T05-55-41-816Z-official-prompt.md](./2026-09-14T05-55-41-816Z-official-prompt.md) |
| 10 | A+B（夹具 idle 放宽 + 报完现价即停） | **22/24（91.7%）** | [2026-09-14T06-04-27-210Z-official-prompt.md](./2026-09-14T06-04-27-210Z-official-prompt.md) |
| 11 | 整体流水线 `npm run eval:agent` 全量正式 | 组件 **93/99**；规划 **24/24**；生产提示词 **22/24**（450s） | [2026-09-14T06-55-44-442Z-official-pipeline.md](./2026-09-14T06-55-44-442Z-official-pipeline.md) |

## 两层分别量什么

| 层 | 数据集 | 题量 | 量什么 | 不量什么 |
|---|---|---|---|---|
| 组件 | `agent-component-tushare-v1` | 100（判 99，跳过 qg-005） | 第一轮工具名 + 参数 | 多轮、确认闸门、画布 Adopt |
| 规划 | `agent-planning-canvas-v1` | 24 | 有序决策链 + 硬约束 | 真 Tushare 数字、产品 UI |

主路径约定：Chat → `query_data` → `propose_widget` Preview → 用户 Adopt → 右侧画布。LLM 只决定查什么、出哪种图；数字由代码取。

## 组件层（背景，本轮未再改）

正式跑 **94/99（94.9%）**，约 158s。

仍失败 5 题：

- `qc-009`：近三年 `start` 写成 2022（期望 2023/2024）
- `qg-006/013/014/015`：指数成分股问句调了 `resolve_industry_universe`（本层 gold：没有成分股工具，应停）

反例题组 `no_tool` 31/31。组件层后续未做 P0/P1，分数仍以 `04-20-44` 为准。

## 规划层：改进前 → 改进后

同一模型、同一 24 题、同一 Git commit `739c6db`（工作区均有未提交改动）。变的是夹具、判分、gold、评测 system prompt。

| 指标 | v1 `04-53-19` | v2 `05-15-57` |
|---|---|---|
| 有效占比 | 17/24（70.8%） | **24/24（100%）** |
| 失败频率 | 29.2%（7 题） | **0%** |
| 平均决策次数 | 全量 2.04；通过题 1.47 | 全量 1.75；通过题 1.75 |
| 步骤有效率 | 83.7% | 95.8% |
| 约束击穿 | `no_early_confirm`×3、`no_fake_metric`×1 | 无 |
| 耗时 | 103s | 96s |

分题组：

| 题组 | v1 | v2 |
|---|---|---|
| named_compare | 3/4 | 4/4 |
| many_preview | 0/3 | 3/3 |
| industry | 2/3 | 3/3 |
| refine_view | 5/5 | 5/5 |
| adopt_boundary | 2/3 | 3/3 |
| quotes_and_stop | 5/6 | 6/6 |

v1 另有一题 **假通过**：`pl-009` 用实体 `["半导体"]` 取数，当时 gold 不要求公司名。v2 收紧 gold 后仍通过，实体已是 8 家公司。

## v1 失败根因与 v2 实际轨迹

判定约定：用户确认 **`ask_user` 与对话注入同等有效**。

| 题 | v1 表面失败 | 根因（评测侧 vs 模型侧） | P0/P1 改什么 | v2 实际链 |
|---|---|---|---|---|
| pl-004 | `max_decisions` 6>4 | 夹具：`search_instruments` 恒 `matches: []`，模型空转三轮再问 A/H | search 返回真实命中（中芯国际等） | `query_data(kline)` → `propose_widget`（2 步） |
| pl-005/006 | `no_early_confirm` | 判分：只认 chat 注入为 `user_confirm`；链本身是 preview → `ask_user` → `confirmed:true` → propose | `ask_user` 确认写入 `user_confirm`；`unless_after=user_confirm` 且 `i>0` 放行 | `query_data` → `ask_user` → `query_data` → `propose_widget` |
| pl-007 | 拒绝后仍取数 | 夹具：无匹配脚本时 `ask_user` 自动回「确认默认名单」，拒绝话术到不了模型 | 无脚本或拒绝话术一律 reject；不再默认确认 | `query_data` → `ask_user` 后停下（2 步） |
| pl-008 | universe + ask_user 后停 | 夹具：`default_entities: 8` 是数字，没有公司名 | 返回 8 个具名公司 + options | universe → ask_user → query_data → propose |
| pl-009 | （v1 假通过） | gold：entities 未要求公司名 | `covers` 必须命中半导体 8 家之一 | universe → ask_user → 8 家 `query_data` → propose |
| pl-018 | 调了 `propose_widget` | 评测 prompt / catalog 写「改图种用 propose_widget」；gold 要已 Adopt 走 `update_widget` | prompt：预览改图种 `propose_widget`；右侧已有组件 `update_widget` | `update_widget(w-1, bar_chart)` |
| pl-023 | 改查 ROE | 空 `user_script` + 自动确认，模型用 ROE 顶净息差 | 脚本：「不要改查别的指标，做不到就停」；禁止自动确认 | **零工具**（直接停） |

## P0 / P1 改了什么、没改什么

**P0 夹具 / 判分**

- 成功 `ask_user`（`selected_ids[0]==='confirm'`）→ `state.userConfirm = true`
- `no_early_confirm`：若已有 `events.user_confirm` 且该次 `query_data` 不是第一步，不记击中
- `ask_user` 不再默认「确认默认名单」；无脚本或话术含 `先别|不要|不对|算了|拒绝|停` → reject
- `resolve_industry_universe` 返回具名 `default_entities`
- `search_instruments` 返回非空 matches

**P1 gold / 评测 prompt**

- 行业 `query_data.entities.covers` 必须是公司名，不能是「白酒」「半导体」
- 评测 system prompt：未 Adopt 改图种 → `propose_widget`；已 Adopt 改图种 → `update_widget`
- `pl-023` 增加拒绝脚本

**未改（有意）**

- 产品工具描述 / `packages/agent` 行为（P2）
- 组件评测 100 题与 94.9% 分数
- 真 Tushare 数值层（尚未建）

## 怎么读 24/24

v1→v2 的跳升，主要是 **评测量具校准**，不是产品 Agent 突然变完美：

1. 单次正式跑，没有重复抽样；LLM 仍有方差。
2. 夹具不打 Tushare，不 Adopt 真画布，失败分不清「推理错」还是「数据源抖」——这是设计，不是漏测。
3. 100% 说明：在当前 gold 与夹具下，这 24 条主路径链模型能走完。组件层仍有 5 题失败（年份口径、指数成分股幻觉）。
4. 若要钉死分数，用同一 commit 再跑一轮对照；若要量产品，下一步才是改 catalog（P2）或真数集成层。

## 生产提示词评测（同一 24 题）

题目、夹具、判分器与规划 v2 相同，只把短评测稿换成线上 `assembleSystemPrompt` + 本轮尾注（冻结时钟、选型卡、L2、画布元数据）。工具清单仍是评测冻结 catalog。约 191s。

| 指标 | 规划短稿 v2 | 生产提示词 |
|---|---|---|
| 有效占比 | 24/24（100%） | **18/24（75.0%）** |
| 失败频率 | 0% | 25.0%（6 题） |
| 平均决策次数 | 1.75 | 2.25 |
| 步骤有效率 | 95.8% | 75.0% |

失败 6 题：`pl-007` 拒绝后多问一次名单（3>2）；`pl-010` 成分股仍调 universe + `web_search`；`pl-018` 右侧改柱状图走了 `propose_widget`（生产 playbook 写「改图种用 propose、不要 update_widget」）；`pl-019` 现价多搜/快照；`pl-020` 追问毛利率却查了 K 线；`pl-023` 用 `net_margin` 顶净息差。

这 6 题里，主路径点名比较 / 行业确认 / refine 大多仍过。掉分集中在 **停手、现价、已 Adopt 改图、做不到的指标**。

随后按四条删改生产 playbook（改图种双规、metric 白名单、现价收短、成分股停手），评测冻结 catalog 的 propose/update 说明一并对齐，再跑：

| 指标 | 生产稿改前 | 生产稿改后 |
|---|---|---|
| 有效占比 | 18/24（75.0%） | **23/24（95.8%）** |
| 失败 | 6 题 | **pl-020 1 题** |

`pl-018/023/010/019/007` 已过。剩余 `pl-020`：首问现价后应停下来吃「再看近五年毛利率」，模型继续 quotes/snapshot，夹具没能注入第二句。

## 复现这两次规划跑

源文件 hash 已写在对应 JSON 的 `sources.hashes`。v1→v2 有变化的文件包括：`prompt.mjs`、`constraints.mjs`、`fixtures.mjs`、新增 `fixture-data.mjs`、`loop.mjs`、`cases-many.json`、`cases-industry.json`、`cases-quotes-stop.json`。
