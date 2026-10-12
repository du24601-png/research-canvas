# FinFrame 项目交接（2026-10-11）

> 接手者先读本文件，再读仓库根目录 `AGENTS.md`（工程硬规则，每轮生效）。旧的 `Research Canvas/HANDOFF.md` 记录到 2026-09-14 的双栏画布阶段，作为背景参考；**本文件之后的进度以本文件为准**。

## 1. 版本与代码位置

| 项 | 值 |
|---|---|
| 仓库 | `D:\canvas agent`，远端 `origin` = github.com/du24601-png/research-canvas |
| 工作分支 | `finframe/m0.5-m1`（**未推送**，没有上游分支） |
| 基线 | `main` @ `9e630ee`；本分支比 `main` 多 68 个提交 |
| 交接时 HEAD | `2c6dc24`（代码最后一次改动 `b46b077`，之后只有交接文档） |
| 应用版本号 | `0.4.0`（`/api/health` 返回值，未随本轮改动） |
| 文档库 Schema | v8（`packages/doc-library/src/schema.ts` 的 `DOC_LIBRARY_SCHEMA_VERSION`） |
| 当前对话模型 | `deepseek:deepseek-flash`（服务端配置，非代码常量） |
| 工作区 | 干净；只有未跟踪的 `.claude/`（本机工具配置，不要提交） |

推送前先确认：分支要不要整体合到 `main`，还是开 PR。用户至今没有要求推送。

## 2. 产品现状一句话

**FinFrame：对话式投研 Agent，回答是一份「活报告」，每个数字都能点开看来源。** 默认是对话优先布局（全宽对话 → 取数 → 回答里流式出图 → 用户「钉住」进看板抽屉）；上传的年报 / 文档可以问答，回答带页码引用，点一下翻到原文那一页。

## 3. 已完成（按时间）

| 阶段 | 内容 | 主要提交 / 文档 |
|---|---|---|
| M1 | 评测基线：`eval:agent` 在 deepseek-flash 上的基线、FinFrame 种子集与三个评分器 | `8497ed7`、`6297fbe`、`6a54bb2` |
| M2 | Agent 策略单因素实验，4 项全保留：美港股快速失败、代码给出走势标签、正文不写数字、改画布三件套改为可选包 `research_canvas_edit` | `docs/finframe/m2-report.md`、`m2-followups.md` |
| M3 / M3a | UI Spec 校验与生成式组件（ComparisonView / TrendView / EvidencePanel / MissingData）；`refine_dataset` 的 `yoy_delta`；对话优先布局、看板抽屉、「钉住」 | `m3-notes.md`、`m3a-notes.md` |
| M4 | Composer：每轮回答由经校验的 UI Spec 渲染成活报告，失败回退原预览卡；Action Bridge；取数前确认（开关默认关） | `m4-notes.md` |
| M4b | 追问报告生成 v2 / v3 版本并可对比（开关 `finframe.reportFollowup`，**默认关，未打磨**） | `m4b-notes.md` |
| M5 / M6 | 脚本化研究者任务测试（无真实用户）、seed-v2 30 题两轮几乎全过 | `m5-report.md`、`seed-v2-report.md` |
| UI 收敛 | 极简界面：不加新按钮，操作尽量交给对话框；KpiRow / NumberSentence / MetricTable / KeyPoints 组件（数字由代码算）；个股速览（一家公司一句话取 5 个指标）；进度卡；Vega-Lite 渲染器（开关，默认 ECharts） | `d9a83fd` … `4a6e596` |
| 实体澄清 | 简称命中多家 A 股时让用户选（如「平安」） | `dd87d10`（**演示前未复测**，见第 8 节） |
| 文档问答 | 页码引用 chip，点开跳到原文页；「+」菜单里的「我的资料」；只读资料库接口 | `0809f37`、`4b58853` |
| 检索质量 | FTS5 trigram 中文检索（Schema v7）；向量模型清单（e5 / bge-small-zh / Qwen3-0.6B）；PDF 乱码兜底（pdfium）；约 500 字切块；原话关键词检索；相关度下限与「没检到」信号；按模型记录向量（Schema v8）；默认模型自动选择 | `a110af3`、`59408ec`、`17c9428` |
| 检索评测 | 6 份 2024 年报、144 题、多种配置对比，前后对比报告 | `eval/rag/`、`rag-eval-report.md`、`rag-eval-report-v2.md` |
| 宽屏 | 对话栏随屏宽放宽（≤1280 不变，最多 1240px）；图表 3:1 等比，220–360px | `b46b077` |

## 4. 怎么跑

本机 C 盘几乎满，**临时文件、npm 缓存都要放到 D 盘**。现成脚本：

```powershell
& 'D:\canvas agent\node_modules\.cache\dev-on-d.ps1'   # 设 TEMP/TMP/npm 缓存到 D 盘，WEB_HTTPS=0，然后 npm run dev
```

注意：这个脚本在 `node_modules/.cache/` 下，不进 git，换机器要重建（内容就是设置 `TEMP`、`TMP`、`npm_config_cache` 到 D 盘再 `npm run dev`）。

- API：http://127.0.0.1:8711（`/api/health`）；前端：http://127.0.0.1:5173 。首次打开要等十几秒（Vite 首次编译）。
- 改了 `packages/**` 要 `npm run build:packages`，改 shared / agent 还要重启 API。
- 模型文件在 `D:\finframe-data\models\`（bge-small-zh-v1.5 约 25 MB、Qwen3-Embedding-0.6B 约 630 MB）。要让应用用上，设 `DOC_LIBRARY_MODELS_DIR=D:\finframe-data\models`（必须是绝对路径）；可选 `DOC_LIBRARY_EMBEDDING_MODEL=bge-small-zh-v1.5 | Qwen3-Embedding-0.6B | multilingual-e5-small` 强制指定。都不设时按 bge → e5 → 只用关键词 自动选。`dev-on-d.ps1` 已设 `DOC_LIBRARY_MODELS_DIR`（2026-10-11），启动日志 `RAG runtime: embedding=bge-small-zh-v1.5` 即为生效；显示 `keyword-only` 说明没找到模型。模型在第一次检索或入库时才加载，随后后台给缺向量的文档补算。
- 下载模型：`node scripts/download-embedding-models.mjs bge-small-zh-v1.5 --dest <目录>`（或设 `DOC_LIBRARY_MODELS_DIR`）。

### 前端开关（localStorage / 环境变量）

| 开关 | 默认 | 作用 |
|---|---|---|
| `VITE_FINFRAME_CHAT_FIRST=0` 或 `finframe.chatFirst=0` | 开 | 关掉则回到旧双栏画布 |
| `finframe.composer=0` | 开 | 关掉则不用活报告，回到原预览卡 |
| `finframe.reportFollowup=1` | 关 | M4b 追问版本 |
| `finframe.chartRenderer=vega` | ECharts | Vega-Lite 渲染器 |

## 5. 门禁（交接时全部通过，2026-10-11）

```bash
npm run build:packages
npm run check:ui        # ALL PASSED
npm run test:ui         # 55 文件 / 271 测试
npm run test:gate       # 19 文件
node --test <AGENTS.md 列出的 6 个文件 + 文档库相关测试>   # 250 通过 / 0 失败
```

文档库相关测试：`document-library`、`doc-library-trigram-fts`、`doc-library-natural-search`、`embedding-model-tracking`、`doc-parse-quality-chunking`、`embedding-models-registry`、`embedding-batch`、`embedding-idle`、`lance-vector-store`、`doc-extract-engines`、`document-citation`、`library-document-file`、`library-list-documents`、`agent-research-prompt`。

已知在 Windows 上失败、**与本轮改动无关**的测试（导入时用了裸 `d:` 路径、或创建符号链接需要权限）：`semantic-model-install-job`、`ocr-deep-prepare-job`、`runtime-vendor-resolve`、`materialize-vendor`、`materialize-external-symlinks`、`vendor-fuse-lifecycle`。没在本轮之前跑过，不能确认它们原本就失败；`test:gate` 不包含它们。

## 6. 文档知识库架构（本轮重点）

代码在 `packages/doc-library/src/`，Agent 工具在 `packages/agent/src/document-tools.ts`。

1. **解析**：`parse-router.ts`。PDF 先走原解析；结果缺失、文字少、或乱码时试 `engines/pdfium-l0.ts`，用 `parse-quality.ts` 的 `pickFallbackResult` 保守择优；仍不行再走 OCR（Python 侧车：pdfplumber、RapidOCR）。
2. **切块**：`engines/chunk-text.ts`，约 500 字、约 15% 重叠、不跨页、按句断开、表格尽量整块（超长按行拆并重复表头）。**已有文档不会自动重切**；`rechunkMarkdown()` 是纯函数，还没接到服务上。
3. **关键词检索**：`fts.ts` → 含中文的查询走 `fts-cjk.ts`（trigram 表 `fts_chunks_tri`，后台分批回填，回填期间未覆盖的文档用有上限的扫描）；整句问题走 `fts-natural.ts`（3 字片段 OR，要求至少命中 max(2, 30%) 个片段）。旧 `fts_chunks`（unicode61）仍在写，保持兼容。
4. **向量**：`embedding-models.ts`（模型清单）、`embedding.ts`、`vector-store.ts`（LanceDB，每个模型一张表）。`chunk_embeddings` 表按 (chunk, model) 记录已算过的向量；换模型后台全量补算。
5. **融合**：`hybrid-search.ts`，RRF；纯向量命中低于 `relevance-floor.ts` 的下限就丢掉（bge / Qwen3 0.45，e5 0.80），关键词精确命中不受下限影响；`searchHybridDetailed` 返回 `found` / `reason`。
6. **Agent**：工具结果带 `cite` 链接（`opptrix-doc://`），提示词规则在 `system-prompt.ts` 的 `DOCUMENT_CITATION_RULE`：引用原样抄写；文档数字只作原文摘录、不进取数和画图工具；没检到就如实说；跨公司分开检索。
7. **前端**：`client-ui/src/chat/doc-citation/`（引用 chip、跳页）、`client-ui/src/chat/library/`（「我的资料」）。

评测：`npm run eval:rag`（语料与工作目录在 `D:\finframe-data\`，不进仓库），对比 `node eval/rag/compare.mjs <前.json> <后.json>`。当前默认（trigram + bge）Recall@10：关键词问法 0.955、原话问法 0.670。

## 7. 演示

脚本：`docs/finframe/demo-script.md`（2026-10-11 实测，8 步约 8 分钟）。`docs/finframe/deliverables/demo-script.md` 是更早的版本。应用里有「【演示验收】」「【界面验收】」开头的测试对话，可删。

## 8. 已知问题与风险

| 问题 | 说明 | 建议 |
|---|---|---|
| 「没检到」不可靠 | 无答案题在检索层几乎总能检到东西（原话问法 0/12 判为没检到）；目前靠模型读片段后判断，实测「火星分行」能如实说没有 | 加重排模型或「答案是否被片段支持」校验；不要只调下限（调高会误伤有答案的题，见 `rag-eval-report-v2.md`） |
| 演示脚本里写了「平安」要避开 | `dd87d10` 已加简称多义澄清，但 M5 报告的结论早于它，本轮没复测 | 复测「看一下平安近五年的 ROE」，通过就从演示避坑里删掉 |
| 已有文档不会用新切块 / 新解析 | 只有新上传的文档受益 | 在 `service.ts` 加「按文档重建」方法（读存档 markdown → `rechunkMarkdown` → 写回块 → 重建关键词和向量索引），并决定是否后台批量执行（属于数据回填，按 AGENTS.md 先确认） |
| 向量表每次重开被误判损坏（已修，2026-10-11） | LanceDB 0.38 的 manifest 用 V2 命名（`u64::MAX - 版本号`），旧检测把它当成版本溢出，每个新进程打开都删表重建、清空嵌入标记、全库重嵌 | `vector-store.ts` 的 `manifestVersionFromName` 按 V1/V2 解码；`lance-vector-store` 测试含真表重开回归 |
| 应用内模型安装界面 | 已有 e5 时界面显示「已安装」，不会提示下载 bge | 设置页给 bge 一个明确的安装入口 |
| 手机宽度图表 | 宽屏改动后在 375px 宽度量到图表 660px 宽，未截图确认是否真的溢出 | 手机上看一次 |
| Qwen3 评测 | 新切块后没重跑；入库很慢（旧切块 6 份年报约 28 分钟） | 有需要再跑 `node eval/rag/run.mjs qwen3` |
| `search_library` 跨公司 | 一次检索前 10 条常被一家公司占满；目前只靠提示词要求分开检索 | 工具层按文档分组取前 N |
| M4b 追问版本 | 开关默认关，未打磨 | 演示不要开 |
| 架构技术债 | 见 `AGENTS.md`「已知技术债」（两条取数路径、缓存门控、`mixed` 来源等） | 改到相关区域时处理 |

## 9. 工作约定（用户明确要求过的）

- 新功能 / 改架构 / 改 API / 改 Schema 前，先给目标、影响范围和至少两个做法，等用户选。
- 极简界面：不随手加按钮，操作尽量交给对话框；界面文案面向投资者，不出现技术名词。
- 实现与验收分开：较大改动由另一个模型或另一个人按验收标准逐条核对，不合格返工。
- Schema 与用户数据只增不破，迁移幂等、可诊断。
- 不推送、不删数据，除非用户明确要求。
- C 盘空间不足：所有临时文件、缓存、模型、评测数据放 D 盘。

## 10. 关键文档索引（`docs/finframe/`）

- 评测与报告：`m2-report.md`、`m5-report.md`、`seed-v2-report.md`、`rag-eval-report.md`、`rag-eval-report-v2.md`
- 设计与调研：`ui-research.md`、`design-review.md`、`ui-references.md`、`user-scenarios.md`、`user-value.md`、`competitor-audience.md`、`pro-individual-needs.md`、`rag-oss-survey.md`、`rag-embedding-eval.md`、`chart-upgrade-proposal.md`
- 阶段笔记：`m3-notes.md`、`m3a-notes.md`、`m4-notes.md`、`m4b-notes.md`、`m2-followups.md`
- 演示：`demo-script.md`
