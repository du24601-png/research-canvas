# FinFrame UI / 交互 / 图表调研（2026-10-10）

只调研，不改代码、不装包。版本、许可证、最近发布时间来自 2026-10-10 当天的 npm registry 与 GitHub API；「前沿理念」部分来自公开博客与规范页面，出处列在文末。

## 结论

1. **新 UI 的方向是对的，主要短板不在组件库，而在三处体验细节**：活报告要等 2.5–4 秒才替换预览卡；历史回答在数据集不在本浏览器时只剩一张「暂时无法读取」的空卡（`docs/finframe/screens/m3a-1-chat-first.png`）；图表样式仍是 ECharts 默认风格的轻改，读起来像后台仪表盘而不是研究报告。
2. **图表：建议保留 ECharts，重做一套「报告风格」主题和标注规则**，不换库。换成 Observable Plot / Vega-Lite 能更好看，但要重写 12 种图、K 线、点击溯源和样式编辑，收益主要是审美，可以靠主题拿到大部分。
3. **「像 Excel 一样编辑」不建议上完整电子表格**。Univer 的图表和透视表是付费 Pro（免费版有水印、限一张透视表）；FortuneSheet 一年没发版。更合适的是「表格视图用数据网格 + 点击格式化 + 派生列生成新数据集」，与「Dataset 不可变」规则一致。
4. **能直接拿来用、性价比最高的开源件**：
   - `streamdown`（Apache-2.0，Vercel）：替换 `react-markdown`，解决流式输出时半截 Markdown 闪烁 / 表格错位。
   - `@json-render/react`（Apache-2.0，Vercel Labs）：与我们手写的 UI Spec 思路完全一致，且支持**流式逐块渲染**，正好对症「Composer 晚 2.5–4 秒」。React 19.2.8 已满足其 `^19.2.3` 要求；代价是引入 zod 4。
   - 整套聊天框架（assistant-ui、CopilotKit、Vercel AI SDK）**不建议迁移**：我们已有自己的流协议、Fluent UI 体系和大量定制，迁移成本远大于收益；可以借鉴它们的交互模式。
5. **值得跟进但先不动的标准**：MCP Apps（2026-01 正式发布的 MCP 官方扩展，让工具返回可交互 UI）可以把 FinFrame 的活报告组件嵌进 Claude / ChatGPT 等宿主；A2UI（Google，v0.13）和 AG-UI（CopilotKit，v1.0）是 Agent→界面的声明式与传输协议，目前与我们的 Spec 是同类东西，等稳定后再考虑对齐。

## 1. 现状盘点

| 部分 | 现在怎么做 | 位置 |
|---|---|---|
| 布局 | 对话优先全宽 + 右侧看板抽屉，旧双栏在开关后 | `client-ui/src/chat/pin-board/` |
| 过程展示 | 「数据来源 · 1 次查询 · 1 张图表 · 展开过程」灰条 + 可折叠详细过程 | `chat/ChatProcessTrace.tsx`、`tracePresentation.ts` |
| 活报告 | Composer 产出 UI Spec → 手写校验 → 4 个组件（Comparison / Trend / Evidence / MissingData），不合规整份回退 | `client-ui/src/generative-ui/`、`packages/shared/src/research-ui-spec.ts` |
| 图表 | ECharts 6.1 手写 option（12 种图），K 线另有 lightweight-charts；颜色取 Fluent token | `chat/research-canvas/chartOptions*.ts`、`chartTheme.ts` |
| Markdown | react-markdown + remark-gfm/math + rehype-katex/sanitize | `chat/MarkdownMessage.tsx` |
| UI 基础 | Fluent UI v9 + 自有 Opptrix token | `theme/tokens` |

依赖现状：React 19.2.8、Vite 6、无 Tailwind、无 zod。

### 1.1 观察到的问题（按影响排序）

1. **活报告「先出卡、再被换掉」**：M5 测得最终布局比首个反馈晚 2.5–4 秒（Demo B 第二轮约 7 秒）。用户先看到预览卡，然后整块被替换，视觉上是跳变。
2. **历史回答失效**：数据集只在 localStorage，换浏览器 / 清缓存后回答主体变成「此浏览器暂时无法读取这份研究数据」，只留「准备重新查询」。活报告最核心的「每个数字可溯源」在这里彻底丢失。（已知限制，但对「活报告」定位伤害最大。）
3. **回答正文和图是两张皮**：正文写「两条曲线可以直接读出……具体点位以图为准」，正文里不能引用具体数字（规则禁止模型写数字），于是正文显得空。缺一种「由代码填数的句子」组件（例如「茅台 2024 年 ROE 为 {value}」由代码代入并带来源角标）。
4. **过程条信息密度低**：灰条「1 次查询 · 1 张图表」对投资者意义不大；真正有价值的是「查了哪家、哪几年、哪个口径、缺了什么」。
5. **图表观感**：
   - 图例在顶部、颜色靠图例对应，读者要来回看；研究报告惯例是线尾直接标公司名和最新值。
   - 网格线、坐标轴字号偏弱但数量多（每张图都有 splitLine），数据墨水比不高。
   - 没有强调手段：最新一期、最大变化、行业均值线都没有默认标注（「变化最大年份」需要点按钮）。
   - 来源只在卡片外（EvidencePanel），图上没有「来源：XX 年报，取数时间」脚注；导出成图片后来源就丢了。
   - 看板空状态用一张示意折线图，图里是「赛轮轮胎」等示例名，和当前问题无关，容易让人以为是真数据。

## 2. 前沿交互理念（与我们相关的部分）

业界在 2026 年把「生成式 UI」大致分三类（CopilotKit 的划分，被多处引用）：

| 模式 | 含义 | 代表 | 我们 |
|---|---|---|---|
| 受控（Controlled） | 开发者预置组件，Agent 只挑组件、给参数 | AG-UI + 前端组件 | **我们现在就是这一类**，最安全，适合金融 |
| 声明式（Declarative） | Agent 输出 JSON UI 描述，客户端只从白名单目录渲染 | A2UI、json-render、Open-JSON-UI | Composer Spec 已接近这一类 |
| 开放式（Open-ended） | Agent 产出完整 HTML，沙箱 iframe 渲染 | MCP Apps、Claude Artifacts | 不适合研究画布（数字不可控） |

可以借鉴、且不违反「数字只来自代码」的做法：

1. **流式渐进 UI**：先渲染骨架和代码生成的默认 Spec，模型的细化以补丁形式逐块到达（json-render 的 SpecStream、A2UI 的增量消息、AG-UI 的 state delta 都是这个思路）。直接解决问题 1。
2. **数字即引用（inline citation chips）**：Perplexity / Copilot 的「角标 + 悬停卡片」做法。我们可以更进一步：句子模板由模型写，数值槽位由代码填，每个数值本身就是可点的来源角标。解决问题 3。
3. **计划可编辑、步骤可打断**：计划卡（我们已有 planConfirm，默认关）做成可勾选的清单，执行中每一步可「跳过 / 换口径」。Devin、Manus、ChatGPT Agent 都把计划做成可编辑对象。
4. **共享状态（Agent 看得见界面）**：AG-UI 的 shared state 思路：用户在组件里切换的图种、高亮、隐藏的系列，作为上下文回传给下一轮（我们已有 `activeWidgetContext`，可以扩到回答里的组件）。
5. **版本与对比**：M4b 已有「追问 → 新版本」。下一步是版本之间的差异高亮（哪些数字变了、哪些来源换了），类似文档的修订视图。
6. **反馈与追问挂在组件上**：已有「追问这部分」；可加「这数不对」反馈，直接记录到该数据点的来源。

## 3. 开源库评估

状态说明：「活跃」= 最近一个月内有发版或提交。

### 3.1 Agent / 聊天 UI

| 库 | 许可证 | 最新版本 / 维护 | 与本仓库的契合度 | 建议 |
|---|---|---|---|---|
| **streamdown** | Apache-2.0 | 2.7.0，2026-09 发版，活跃，GitHub 5.7k★ | React 18/19 ✓。依赖 unified/remark/rehype，和现有链路同源。默认样式基于 Tailwind + shadcn CSS 变量，我们无 Tailwind，需要自己映射样式（可只用其解析与半截 Markdown 修复 `remend`，组件样式沿用现有 `markdownComponents.tsx`） | **推荐，小范围试点** |
| **@json-render/react** + core | Apache-2.0 | 0.21.0，2026-09-18；GitHub 18.6k★，活跃 | React `^19.2.3` ✓（我们 19.2.8）。core 依赖 **zod ^4**（新依赖）。有 catalog（白名单组件 + zod props）、SpecStream 流式补丁、actions。注意它支持 `$computed` / `$template` 表达式，必须在 catalog 层禁用，否则模型能绕过「数字只来自 Dataset」 | **推荐评估**，作为 Spec 流式渲染层；校验仍保留我们自己的规则 |
| @a2ui/react | Apache-2.0 | 0.13.0，2026-10-09，活跃；Google 主导，16.6k★ | React 18/19 ✓；依赖 **zod 3**（与 json-render 的 zod 4 冲突，二选一）。仍是 0.x，协议在变 | 观望，协议稳定后考虑对齐 |
| @assistant-ui/react | MIT | 0.15.26，2026-10-09，非常活跃，12.5k★ | React 18/19 ✓。依赖 radix-ui、zustand、zod 4、assistant-cloud；样式走 shadcn/Tailwind。要接入需把我们的 SSE 流适配成它的 runtime，且与 Fluent UI 视觉体系冲突 | 不迁移；参考其 thread / tool UI / branch 的交互设计 |
| @copilotkit/react-core + AG-UI | MIT | 1.78.0，活跃；@ag-ui/core 1.0.2 | 依赖面大（lit、rxjs、tailwind-merge、lucide、react-markdown 8、遥测包 @scarf/scarf） | 不引入；AG-UI 事件模型可作为我们流协议演进的参考 |
| ai / @ai-sdk/react（Vercel AI SDK） | Apache-2.0 | 7.0 / 4.0，极活跃 | 前端 hook 绑定其服务端流格式；我们服务端是自研 engine，改造面在 API 层 | 不引入 |
| @fluentui-copilot/react-copilot | MIT | 0.30.5（2026-03），之后只有 nightly；微软 fluentai 仓库，仍是 0.x | **唯一和 Fluent UI v9 同体系的**：prompt input、reference（引用角标）、output card、suggestions、feedback、latency 等组件，视觉无缝 | **值得挑个别子包试用**（如 react-reference 做引用角标、react-suggestions 做追问建议），不整包引入 |
| @mcp-ui/client / MCP Apps | Apache-2.0 | 7.1.1；MCP Apps 规范 2026-01-26 稳定版 | 用于把我们的组件作为 MCP 工具 UI 嵌入外部宿主，不影响本应用 | 中期选项：做「在 Claude / ChatGPT 里用 FinFrame」时再用 |
| @llm-ui/react、@tremor/react | MIT / Apache-2.0 | 分别停在 2025-02 / 2025-01，peer 只到 React 18 | ✗ | 不用 |

### 3.2 图表

| 库 | 许可证 | 最新版本 / 维护 | 契合度 | 建议 |
|---|---|---|---|---|
| **ECharts（现用）** | Apache-2.0 | 6.1.0（2026-05） | 已覆盖 12 种图、点击溯源、样式编辑；金融图（K 线、dataZoom、markLine）完整 | **保留，重做主题与标注** |
| lightweight-charts（现用） | Apache-2.0 | 5.2 | K 线专用，TradingView 观感 | 保留 |
| @observablehq/plot | ISC | 0.6.17（**2025-02 后无新版**），仓库仍有提交 | 静态 SVG，报告感最好，但交互（悬停溯源、点击）要自己补，无 K 线 | 只适合做导出 / 静态报告图，不做主图 |
| vega-lite + vega-embed | BSD-3-Clause | 6.5 / 7.3，活跃 | 声明式 JSON，天然适合「模型选图、代码填数」；但包体大，交互定制难，我们已有自己的视图推荐 | 不换 |
| @kanaries/graphic-walker | Apache-2.0 | 0.5.2（2026-07） | React ≥19 ✓，但依赖 styled-components、headlessui、一整套 radix；是「拖字段自助分析」，与对话主路径重叠 | 不引入 |
| @antv/g2 / @antv/gpt-vis | MIT | 5.4.8 / 1.0.2，活跃 | 中文生态好，GPT-Vis 专为「LLM 输出图表」设计，但数值由模型写进 Markdown 围栏，违背核心原则 | 不用于研究画布 |
| recharts / @mui/x-charts / visx | MIT | 均活跃 | React 组件式，好看但金融图种不全，等于重写 | 不换 |

### 3.3 表格 / 「像 Excel 一样」

| 库 | 许可证 | 最新版本 / 维护 | 契合度 | 建议 |
|---|---|---|---|---|
| Univer | 核心 Apache-2.0；**图表 / 透视表 / 导入导出为商业 Pro** | 1.0.3（2026-09），活跃 | 免费版图表有水印、仅几种图，透视表每文档一张；体量大（公式引擎、渲染引擎） | 不推荐（关键能力收费） |
| @fortune-sheet/react | MIT | 1.0.4（2025-11），仓库 2025-12 后无提交 | React ≥18.2 ✓，完整电子表格，但维护放缓 | 不推荐做主路径 |
| ag-grid-community | MIT | 36.2（2026-09），活跃 | React 19 ✓；社区版有编辑、格式化、排序筛选；透视、Excel 导出、图表是付费 Enterprise | 可选：表格视图升级 |
| @revolist/revogrid | MIT | 4.28.3（2026-10-09），活跃 | Web Component + React 包装，虚拟滚动、编辑、格式化免费 | 可选：轻量替代 |
| @tanstack/react-table | MIT | 9.2.8，活跃 | 无头，样式全自定，最贴 Fluent 体系，但编辑交互要自己写 | 可选：最小改动 |
| @glideapps/glide-data-grid、@silevis/reactgrid | MIT | peer 只到 React 18 | ✗ | 不用 |

「像 Excel」在我们这里应拆成三件事，避免和数据规则冲突：

1. **改样子**（数字格式、颜色、隐藏系列、改标题）：只是视图变化，同一 `datasetId`，已有 `chartStyleApply` 基础，补「点击图上元素直接改」即可。
2. **算新列**（同比、占比、两列相减）：由代码按白名单变换生成新 `research-ds-*` + `transform`，不是任意公式。
3. **改原始数字**：不支持（违背「数字只来自代码」）；可支持「标注疑点」。

## 4. 建议的改进清单

按「收益 / 成本」排序，括号内为大致范围。

| # | 改进 | 解决的问题 | 依赖 |
|---|---|---|---|
| 1 | **报告风格图表主题**：线尾直接标名 + 最新值、去掉大部分网格线、默认标出最新一期与最大变化、图下脚注写来源与取数时间（导出也带上）、统一数字格式（万 / 亿、百分比位数） | 1.1-5 | 无新依赖，改 `chartOptions*.ts`、`chartLayout.ts`、`chartTheme.ts` |
| 2 | **代码先出默认 Spec，模型细化走补丁**：首个反馈即显示活报告骨架，不再整卡替换 | 1.1-1 | 可自研；或引入 json-render（+zod 4） |
| 3 | **「代码填数」句子组件**：模型写句式、代码填数并挂来源角标 | 1.1-3 | 新增 Spec 组件 + shared 校验；引用角标可试 `@fluentui-copilot/react-reference` |
| 4 | **流式 Markdown 用 streamdown** | 流式时半截表格 / 公式闪烁 | streamdown（Apache-2.0） |
| 5 | **过程条改成「取了什么」摘要**：公司、年份、口径、缺失项，而非查询次数 | 1.1-4 | 改 `tracePresentation.ts` |
| 6 | **数据集服务端持久化**（历史回答可跨浏览器重现） | 1.1-2 | 改 Schema / API，按规则需先定方案 |
| 7 | **表格视图换成可编辑数据网格 + 派生列** | 「像 Excel」诉求 | AG Grid Community / RevoGrid / TanStack Table 三选一 |
| 8 | 版本差异高亮、组件级「这数不对」反馈 | 信任感 | 无新依赖 |
| 9 | MCP Apps 输出（把活报告组件给外部宿主用） | 分发 | 中期 |

## 5. 需要决定的事

1. 图表是「保留 ECharts 重做主题」（推荐）还是「换 Observable Plot / Vega-Lite」？
2. 活报告流式化：自研补丁（零依赖），还是引入 json-render（需加 zod 4，Spec 校验要迁一部分）？
3. 「像 Excel」先做到哪一步：只做点击改样式 + 派生列（推荐），还是要可编辑表格网格（再选 AG Grid / RevoGrid / TanStack）？
4. 数据集服务端持久化（第 6 项）要不要排进下一个里程碑？它涉及 Schema 与 API，按项目规则需要先给方案。

## 出处

- npm registry（`npm view <pkg> version license time peerDependencies dependencies`），GitHub API（star 数、最近提交），2026-10-10 查询。
- 生成式 UI 三种模式：[CopilotKit: The developer's guide to generative UI in 2026](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026)、[AG-UI / MCP-UI / A2UI 对比](https://copilotkit.ai/blog/the-state-of-agentic-ui-comparing-ag-ui-mcp-ui-and-a2ui-protocols)（厂商观点）。
- MCP Apps：[MCP 官方博客 2026-01-26](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)、[WorkOS 解读](https://workos.com/blog/2026-01-27-mcp-apps)。
- Univer Pro 限制：[Univer: Upgrade to Pro](https://docs.univer.ai/guides/sheets/getting-started/pro)。
- streamdown：[vercel/streamdown](https://github.com/vercel/streamdown)；json-render：[vercel-labs/json-render](https://github.com/vercel-labs/json-render)；A2UI：[a2ui.org](https://a2ui.org/)。
- 早前项目资料：Sheet 主界面 mock（Observable Plot + 点击格式化）、竞品调研、FinFrame LUI demo v2（项目内 Artifact，2026-10-06）。
