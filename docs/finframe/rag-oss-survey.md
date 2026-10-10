# 成熟开源 RAG 知识库：混合检索架构与边界条件（2026-10-10）

目的：看 GitHub 上成熟的知识库项目怎么做混合检索、怎么处理边界情况，挑出我们能复用或照着做的部分。star 数与许可证来自 GitHub API（2026-10-10）；参数默认值来自各项目官方文档或代码镜像，版本间可能不同，已标注出处可信度。

## 结论

- **最值得照着做的是 RAGFlow**（Apache-2.0，9.2 万 star，活跃）：解析质量是它的核心，检索参数（关键词与向量加权、相似度门槛、空结果回复）设计得清楚。
- **参数模型借 FastGPT 的思路**：多路召回 + RRF 融合 + 最低相关度 + 按 token 预算取引用 + 重排失败自动回退。但 FastGPT 的许可证带商用限制，**只学思路，不拷代码**。
- **能直接复用的模块很少**：主流项目大多是 Python 服务，我们是 Node/TypeScript。真正能直接用的是**重排模型**（bge-reranker 的 ONNX 版，可以用现有的 transformers.js 跑）。其余都是照着设计自己实现，我们已有的骨架（FTS + 向量 + RRF + 页码引用）方向是对的。
- **对照下来，我们最大的缺口**：解析质量检测只看字数，没看「读出来的是不是中文、是不是乱码」，所以招商银行年报漏过去了；没有相关度门槛和「没找到」的统一处理；没有重排；没有按文档类型切块。

## 项目一览

| 项目 | star | 许可证 | 语言 | 定位 | 能否借代码 |
|---|---|---|---|---|---|
| RAGFlow | 9.2 万 | Apache-2.0 | Go / Python | 深度文档解析 + 混合检索 | 可以（注明出处） |
| Dify | 15.8 万 | 改版 Apache（带多租户等限制） | TypeScript / Python | 应用平台，含知识库 | 只学思路 |
| FastGPT | 3.0 万 | 自定义许可证（商用有限制） | TypeScript | 知识库问答平台 | 只学思路 |
| MaxKB | 2.3 万 | GPL-3.0 | Python | 企业知识库 | 只学思路（传染性许可证） |
| QAnything（网易有道） | 1.4 万 | AGPL-3.0 | Python | 两阶段检索（BCE 向量 + BCE 重排），中文强 | 只学思路 |
| Langchain-Chatchat | 3.9 万 | Apache-2.0 | Python | 中文本地知识库 | 可以；2025-11 后更新少 |
| LlamaIndex | 5.2 万 | MIT | Python（另有 TS 版） | 检索框架，混合检索、多查询融合 | 可以 |
| Haystack | 2.7 万 | Apache-2.0 | Python | 检索流水线框架 | 可以 |
| LightRAG | 4.0 万 | MIT | Python | 图谱 + 向量的检索 | 可以；场景不同 |
| kotaemon | 2.6 万 | Apache-2.0 | Python | 文档问答 UI + 混合检索 | 可以 |

## 共同的架构（成熟项目几乎都是这几层）

1. **解析**：版面分析（标题、段落、表格、图片区域）→ 文本层检查 → 文本太少或乱码时走 OCR。RAGFlow 的 DeepDoc 是代表。
2. **切块**：按文档类型选模板（论文、法规、表格、问答、通用），表格整体保留并重复表头，块大小 + 重叠可配。
3. **索引**：全文（分词 / BM25）+ 向量两路，并行写入；记录每份文档的处理状态（排队 / 解析中 / 完成 / 失败）。
4. **召回**：问题先改写或扩展（补主语、拆子问题、生成多个查询）→ 两路各取一批候选。
5. **融合**：加权求和（RAGFlow、Dify）或 RRF 按排名合并（FastGPT）。
6. **重排**：重排模型对前几十条重新打分；失败时回退到融合结果。
7. **过滤与截断**：低于门槛的丢掉；按 token 预算或条数截断。
8. **生成**：只用检索到的片段回答，必须带引用；什么都没检到时给固定回复，不让模型自由发挥。

## 边界条件怎么设计

| 边界情况 | 成熟做法 | 出处 | 我们现在 |
|---|---|---|---|
| PDF 没有文本层 / 读出乱码 | 文本层检查，不合格就 OCR 或换解析器 | RAGFlow DeepDoc | 只看字数和空页占比（`parse-quality.ts`），**不看是不是中文、是不是乱码** → 招行年报漏检 |
| 表格 | 表格整体成块，重复表头；可转成 Markdown 或 HTML | RAGFlow 表格模板 | 一页一块，表格跟正文混在一起 |
| 块太长超过模型上限 | 按 token 切块 + 重叠 | 通用 | 一页一块，超过 bge 的 512 token |
| 重复上传 | 按文件哈希去重 | 通用 | 需确认 |
| 文档还没处理完就提问 | 显示状态，提示「索引未完成」 | FastGPT 排障文档 | 有状态，回答时没提示 |
| 问题太短、缺主语 | 问题改写 / 补全上下文 | FastGPT 问题优化 | 依赖 agent 自己改写 |
| 用户原话直接检索 | 全文检索也能分词匹配 | 各项目都有中文分词 | 刚加 trigram，原话仍然命中 0 |
| 两路分数不可比 | RRF 按排名融合，或加权（RAGFlow 默认关键词 0.7、向量 0.3） | FastGPT / RAGFlow | 已用 RRF |
| 不相关的结果混进来 | 最低相关度门槛（RAGFlow 默认 0.2） | RAGFlow、FastGPT、Dify | **没有门槛** |
| 什么都没检到 | 固定的空结果回复（RAGFlow `empty_response`），不让模型编 | RAGFlow | 交给模型自己说 |
| 检到太多、塞爆上下文 | 按 token 预算取引用，代替固定 top-k | FastGPT「引用上限」 | 固定条数（默认 8，最多 20） |
| 重排服务挂了 | 回退到原始排序 | FastGPT | 没有重排 |
| 跨文档 / 跨公司问题 | 拆子问题分别检索再合并 | 多查询融合（LlamaIndex） | 一次检索，前 10 条常被一家公司占满 |
| 换了向量模型 | 新建索引并回填，期间旧索引继续可用 | 通用 | 刚加按模型分表，回填还没做 |
| 调参没依据 | 「检索测试」页面：输入问题，看召回片段和分数 | RAGFlow、Dify | 有离线评测脚本，没有界面 |

## 可以复用或照着做的

| 做什么 | 来源 | 方式 | 优先级 |
|---|---|---|---|
| **解析质量检测加「中文占比 / 乱码率」**，不合格换 pdfium 或走 OCR | RAGFlow 的思路 | 自己实现，改 `parse-quality.ts` 的升级判定 | P0 |
| **最低相关度门槛 + 统一的「没找到」结果**：工具结果明确返回「未检到相关内容」，提示词规定此时如实说没有 | RAGFlow `similarity_threshold`、`empty_response` | 自己实现 | P0 |
| **重排**：bge-reranker-base 的 ONNX 版（MIT），用现有 transformers.js 对前 30 条重排，失败回退 | QAnything 两阶段思路、FastGPT 回退策略 | **直接复用模型** | P1（评测证明有提升再默认开） |
| **按 token 预算取引用**，代替固定条数 | FastGPT 引用上限 | 自己实现 | P1 |
| **切块模板**：通用文本按 400–600 字 + 重叠；表格整块 + 表头；块前加「文件名 · 第 N 页 · 小标题」 | RAGFlow 模板；Anthropic「Contextual Retrieval」的块上下文思路 | 自己实现 | P1 |
| **跨公司问题拆成子查询**分别检索再合并 | LlamaIndex 多查询融合 | 自己实现（工具层） | P2 |
| **检索测试**：开发用的命令行或调试面板，看每条召回的来源、分数和门槛 | RAGFlow、Dify | 自己实现（先做命令行，不加界面按钮） | P2 |

## 不建议

- **整套换成 RAGFlow / Dify 做后端**：多一套 Python 服务、Elasticsearch / Infinity 等依赖，和「本机、轻量、Node」的部署方式冲突；我们的数字溯源和页码引用要重新对接。
- **从 FastGPT、MaxKB、QAnything、Dify 拷代码**：许可证带商用限制或传染性，只能学思路。
- **图谱检索（LightRAG）**：适合关系推理，不是我们当前的瓶颈。

## 和上一份评测报告的关系

`rag-eval-report.md` 的 4 条建议在这里都能找到成熟做法：PDF 兜底（RAGFlow DeepDoc）、混合检索默认开（各项目通用）、原话也能走关键词（中文分词）、切小块（切块模板）。本文补上 3 条：**相关度门槛 + 空结果**、**重排**、**token 预算**。

## 出处

- GitHub API：[infiniflow/ragflow](https://github.com/infiniflow/ragflow)、[langgenius/dify](https://github.com/langgenius/dify)、[labring/FastGPT](https://github.com/labring/FastGPT)、[1Panel-dev/MaxKB](https://github.com/1Panel-dev/MaxKB)、[netease-youdao/QAnything](https://github.com/netease-youdao/QAnything)、[chatchat-space/Langchain-Chatchat](https://github.com/chatchat-space/Langchain-Chatchat)、[run-llama/llama_index](https://github.com/run-llama/llama_index)、[deepset-ai/haystack](https://github.com/deepset-ai/haystack)、[HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)、[Cinnamon/kotaemon](https://github.com/Cinnamon/kotaemon)
- RAGFlow 检索组件文档（相似度门槛 0.2、关键词权重 0.7、Top N 8、重排会明显增加耗时）：[ragflow.io/docs/dev/retrieval_component](https://ragflow.io/docs/dev/retrieval_component)；空结果处理见其 `agent/component/retrieval.py`（代码镜像，版本可能不同）
- FastGPT 知识库检索（四种模式、RRF 融合、重排失败回退、引用上限、最低相关度、排障）：[fastgpt.io 检索模式](https://fastgpt.io/tutorial/fastgpt-dataset-search-modes)、[检索参数](https://fastgpt.io/tutorial/fastgpt-dataset-search-params)、[排障](https://fastgpt.io/tutorial/fastgpt-dataset-search-troubleshooting)、[数据集引擎](https://doc.fastgpt.io/en/guide/dataset/dataset_engine)
- Dify 混合检索（加权分数或重排、TopK、分数门槛）：[docs.dify.ai 重排](https://docs.dify.ai/learn-more/extended-reading/retrieval-augment/rerank)、[检索测试](https://docs.dify.ai/guides/knowledge-base/retrieval-test-and-citation)
