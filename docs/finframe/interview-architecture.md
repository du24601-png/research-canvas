# FinFrame 技术架构（面试用，2026-10-11 按代码核对）

## 一句话

自研的 TypeScript Agent 引擎，没有用 LangChain / LlamaIndex / Vercel AI SDK 这类框架；模型走 OpenAI 兼容接口（当前 DeepSeek），工具调用循环、流式输出、上下文压缩都是自己写的。核心原则是「模型只决定查什么，数字全部由代码取回」。

## 1. Agent 框架：自研，不依赖框架

| 方面 | 做法 | 代码 |
|---|---|---|
| 模型接入 | 一个 `OpenAiCompatibleProvider`，直接 `fetch` 调 `/chat/completions`，自己解析 SSE 流；换模型只改 baseUrl / key / model。当前配置是 `deepseek:deepseek-flash` | `packages/agent/src/llm/provider.ts` |
| 工具调用 | 标准 function calling（`tools` + `tool_choice`，上游不支持时降级）；引擎里是一个有轮数上限的循环：模型出工具调用 → 代码执行 → 结果回填 → 再问模型，直到给出最终回答 | `packages/agent/src/engine.ts`（`for (round < maxSafetyRounds)`） |
| 工具管理 | 每个会话开始时「冻结」一份工具清单；部分工具做成需要用户勾选的可选包（如报告与脑图、改画布三件套），模型不能自己打开 | `session-tools-freeze`、`tool-route-plan.ts` |
| 流式 | 服务端把模型的流和工具事件转成自己的 SSE 事件（工具开始 / 完成、研究画布事件、UI Spec、最终回答）推给前端 | `apps/server/src/index.ts` 的 `/chat/stream` |
| 上下文 | 自己做的 token 估算、超长时压缩（compact）、工具调用序列修复（避免 OpenAI 400）、会话记忆与投影 | `packages/agent/src/context/` |
| 其他 | 支持 MCP（用官方 `@modelcontextprotocol/sdk`）、技能包（Agent Skills）、子代理 | `mcp/`、`agent-skills`、`subagents/` |

为什么自研：要严格控制「哪些工具在什么时候可用」「数字从哪来」「事件怎么流到界面」，框架的抽象反而碍事；而且能接任何 OpenAI 兼容的国产模型。

## 2. 分层与数据流

```
浏览器 client-ui（React 19 + Vite + Fluent UI，ECharts / Vega-Lite 画图）
   │  POST /chat/stream（SSE）
API apps/server（Fastify 5）：路由、校验、会话、流式
   │
Agent 引擎 packages/agent：提示词、工具循环、Composer（把回答组装成 UI Spec）
   │ 工具：query_data / refine_dataset / propose_widget / search_library / read_document …
   ├─ 研究数据 research-hub → a-stock-layer（查询计划、Provider 路由、缓存、熔断）→ 行情 / 财报数据源
   ├─ 文档库 doc-library（SQLite FTS5 全文 + LanceDB 向量 + 本地 ONNX 向量模型，RRF 混合检索）
   │        └─ Python 侧车：pdfplumber 版面、RapidOCR 识别（按需拉起）
   └─ 存储 user-store（SQLite，迁移只增不破）
```

一次提问的路径（例如「对比宁德时代和比亚迪近五年毛利率」）：

1. 前端发问题，服务端开 SSE。
2. 模型决定调用 `query_data`（公司、指标、年份），**代码**去数据源取数，生成一个带来源的 Dataset（每个数字记着科目、报告期、来源）。
3. 模型调用 `propose_widget` 只「提议」用哪种图；前端在回答里流式出现预览。
4. Composer 把这一轮的数据集组装成一份经过校验的 UI Spec（KPI、对比图、要点），校验不过就回退到原预览卡。
5. 用户点「钉住」才写入看板。

## 3. 语言与主要库

| 语言 | 代码量（行，不含测试） | 用在哪 |
|---|---|---|
| TypeScript（.ts / .tsx） | 约 24 万 | 前端、服务端、Agent 引擎、数据层、文档库，主体 |
| JavaScript（.mjs） | 约 1.8 万 | 评测脚本、构建与工具脚本 |
| Python | 约 2 万，**其中大部分是内置技能包里的分析脚本**；核心链路只有几个侧车 worker | PDF 版面（pdfplumber）、OCR（RapidOCR）、AKShare 取数 worker |
| 测试 | 约 7.3 万行 | node:test + vitest |

主要库：React 19、Vite 6、Fluent UI 9、ECharts 6、Vega-Lite 6、react-grid-layout；Fastify 5；better-sqlite3、LanceDB、@huggingface/transformers（ONNX 跑向量模型）、@hyzyla/pdfium；@modelcontextprotocol/sdk。工程是 npm workspaces 的 monorepo（`packages/` 下约 25 个包）。

## 4. 值得讲的设计点

1. **模型不写数字**：所有财务数字由代码从数据源取回，模型正文只描述走势；评测里有专门的「编造数字」评分器。缺数显示「—」，`null ≠ 0`。
2. **Preview → Pin**：AI 只能提议图表，用户确认才进看板；AI 不能偷改看板。
3. **Dataset 不可变**：数据变了就派生新 Dataset，记录父数据集和变换（如同比差值由代码算），保证可追溯。
4. **活报告的 UI Spec**：模型输出受限的 JSON Spec，只能用注册过的组件和动作，标题里不许出现年份以外的数字；校验不过整份拒绝、回退。
5. **文档问答带页码引用**：混合检索（中文 trigram 全文 + 向量），回答里每句话都带「《文件》p.N」，点开跳到原文那一页；检不到就如实说。
6. **评测驱动**：Agent 评测（`eval:agent`，工具选择、拒答、数字来源）、种子集 30 题、知识库检索评测 144 题（Recall@10 从 0.83 提到 0.96）；改动按「单因素实验」验证，实现和验收由不同模型分开做。
7. **本地优先、轻部署**：Docker Compose 或裸 Node 自托管；向量模型、OCR 都在本机跑，资料不出机器。

## 未核对 / 注意

- 代码量是用 `git ls-files` 粗算的行数，包含注释和空行，只说「约」。
- 引擎轮数上限的具体值由配置决定（`resolveMaxSafetyRounds`），没有在这里写死。
- 仓库里还保留着早期 Opptrix 的一些包（资讯、社区、浏览器代理、沙箱等），不在 FinFrame 主路径上；面试时说「主路径用到的」即可。
