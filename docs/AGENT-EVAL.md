# Agent 评测

投研画布 Agent 的质量评测与产品 CI（`test:gate`）分开。三层测的不是同一件事，**禁止加权合成一个「Agent 分」**，分数不当 PR 门。

产品主路径：Chat → `query_data` → `propose_widget` 预览 → 用户 Adopt → 右侧画布。模型只决定查什么、出哪种图；数字由代码取。评测夹具**不打 Tushare**、不 Adopt 真画布。

## 怎么跑

```bash
npm run eval:agent                 # 全量流水线：build dist → component → planning → prompt
EVAL_LIMIT=1 npm run eval:agent    # 冒烟（综合档只进 scratch，不当基线）
npm run eval:agent:component       # 只跑第一轮工具
npm run eval:agent:planning        # 只跑夹具决策链（评测短提示词）
npm run eval:agent:prompt          # 只跑生产 assembleSystemPrompt
```

需已配置默认模型，或环境变量 `EVAL_LLM_API_KEY` / `EVAL_LLM_BASE_URL` / `EVAL_LLM_MODEL`。测完默认 exit 0（有失败题也是 0）；未配模型 exit 2。单层若要当本地门：`EVAL_STRICT=1`。

正式档：[`eval/agent/records/`](../eval/agent/records/)（`*-official-*.md/json`）。scratch：`eval/agent/*/runs/`（gitignore）。迭代叙事：[`eval/agent/records/2026-09-14-iteration.md`](../eval/agent/records/2026-09-14-iteration.md)。

## 三层

| 层 | 命令 | 数据集 | 量什么 | 不量什么 |
|---|---|---|---|---|
| component | `eval:agent:component` | 100 题，判 99（跳过 `qg-005`） | 第一轮工具名 + 参数 | 多轮、确认闸门、Adopt |
| planning | `eval:agent:planning` | 24 题 `pl-001`–`pl-024` | 夹具多轮决策链 + 硬约束 | 真行情数字、线上 system prompt |
| prompt | `eval:agent:prompt` | 同一 24 题 | **用户实际打到的** `assembleSystemPrompt` + 尾注 | 真 Tushare / 真画布 |

产品北星是 **prompt 层**。planning 是量具健康度。component 是第一轮工具的领先指标。

读分：planning 稳、prompt 掉 → 改生产提示词；planning 掉、prompt 稳 → 先查夹具/gold；只有 component 掉 → 第一轮工具幻觉，多轮夹具可能把错盖住。

## 监控指标

每层简报与流水线综合档必有：有效占比、失败频率、平均决策次数（全量 / 通过题）、步骤有效率、约束击穿、耗时。流水线再加相对上一份同层 official 的 Δ、业务场景并排、新失败/新通过。

## 正式基线（2026-09-14 全量流水线）

模型 `deepseek-flash`，temperature 0。综合档 [`2026-09-14T06-55-44-442Z-official-pipeline.md`](../eval/agent/records/2026-09-14T06-55-44-442Z-official-pipeline.md)。

| 层 | 有效占比 | 说明 |
|---|---|---|
| component | 93/99（93.9%） | 成分股问句仍会调 `resolve_industry_universe`；反例 `no_tool` 31/31 |
| planning | 24/24（100%） | 评测短提示词 + 校准夹具下主路径能走完 |
| prompt | 22/24（91.7%） | 北星；失败集中在行业确认后停手、改预览颜色 |

规划层曾从 17/24 升到 24/24，主要是**夹具与 gold 校准**（确认路径、空搜索、自动确认），不是产品突然变完美。生产提示词从 18/24 经定向修订稳定在 22/24。

未建第四层：真 Tushare 数值、真 Adopt UI。
