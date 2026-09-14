# Research Canvas — Agent 工程规则

> 本文件自动注入每轮 system 提示。只写必须每轮生效的约束，细节去代码里读。

## 产品定位

**交互画布投研 Agent：每个数字都能点开看来源的投研画布。**

主路径：左侧 Chat 提问 → `query_data` 取真实财务 / K 线数据 → `propose_widget` 在聊天区出预览 → 用户 Adopt → 右侧 ECharts 画布。

**报告与脑图（artifacts）默认关闭**：`create_canvas` / `create_mindmap` / `create_web` 不在默认 tools 里；用户须在输入框 **+ → 报告与脑图** 勾选后才会进入会话冻结列表。`activate_tool_pack` 与技能 `required-packs: artifacts` **不能**替用户打开；未开启时用研究预览或文字，勿与右侧 Research Canvas 混淆。

## 核心原则

1. **LLM decides, Code executes**：模型只决定查什么、选哪种图；所有数字由代码从 Provider 取回。**禁止模型生成或计算财务数字**，禁止模型直接产出 ECharts option / React。
2. **宁愿没有数据，也不要猜数据**：`null ≠ 0`，缺失显示 `—`；字段全空则 fail closed。口径冲突如实呈现，不由模型裁决。
3. **Preview → Adopt**：`propose_widget` 只提议，画布 no-op；只有用户点「添加到画布」才写入。AI 不得偷改右侧画布（除非用户明确要求改某张已有图）。
4. **Dataset 不可变**：数据语义变化 → 新 `research-ds-*` + `parentDatasetId` / `transform`；仅视图变化 → 同一 `datasetId` 再 `propose_widget`。
5. **增量改动**：按用户最新指示做最小 diff，不顺手重构。

## 架构分层

| 层 | 职责 | 禁止 |
|----|------|------|
| UI `client-ui` | 渲染、交互、状态展示 | 直连 Provider、硬编码 API URL |
| API `apps/server` | 路由、校验、响应格式化 | 复杂业务逻辑、Provider 直连 |
| Hub `research-hub` / `search-hub` | feature 调度、多源聚合 | Provider 实现、UI 逻辑、持久化 |
| Engine `a-stock-layer` | 查询计划、Provider 路由、缓存、熔断 | 业务语义、UI 状态 |
| Provider `market-data-providers-*` | 单源适配、标准化 | 跨 Provider 逻辑、缓存策略、业务判断 |
| Storage `user-store` | SQLite 持久化与迁移 | 业务逻辑、网络调用 |

调用规则：UI → Hub API；Hub → `engine.queryInstrumentData` / `queryMarketCapability`；Engine → Provider Registry / Cache；Provider → 上游 API。**禁止**跨层直连（UI 直连 Provider HTTP 或 SQLite；Provider 之间互调）。

**当前代码写实（与上表不完全一致）：** Provider 实现在 `a-stock-layer/src/providers/`，`market-data-providers-cn/us` 仅为 re-export。Hub 磁盘缓存在 `user-store`（`createHubDiskCache`），由 server / MCP 注入；Hub 包不依赖 `user-store`。详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 代码地图（一次提问穿过的文件）

```
client-ui/src/chat/session/useSubmitImpl.ts   # POST research_canvas snapshot
client-ui/src/chat/ComposerPlusMenu.tsx       # + 菜单「报告与脑图」开关
client-ui/src/chat/session/useSessionData.ts  # PATCH artifactsEnabled
client-ui/src/chat/tracePresentation.ts       # 流式 status morph、溯源 chip、Receipt
client-ui/src/chat/ChatProcessTrace.tsx       # live/history trace；Preview 槽位；折叠详细过程
client-ui/src/chat/ChatComposer.tsx           # 输入框布局 + streamStatusLabel footer
apps/server/src/index.ts                      # /chat、/chat/stream、PATCH sessions
packages/agent/src/engine.ts                  # tool loop、runInToolSession
packages/agent/src/research-canvas-tools.ts   # query_data / refine_dataset / propose_widget / create|update|delete_widget
packages/research-hub/                        # feature 调度
packages/a-stock-layer/src/engine.ts          # Provider 路由 + 缓存 + 熔断
packages/market-data-providers-*/             # 上游取数
```

画布相关：`client-ui/src/chat/research-canvas/`（布局、Preview、Adopt、persist、ViewSwitcher、chartLayout/chartResponsive）、`packages/shared/src/research-canvas-protocol.ts` + `research-view-*.ts`（协议 / 视图推荐 / 标题）、`packages/agent/src/research-*.ts`（取数、refine、实体解析）。

**client-ui 禁止** `from '@opptrix/shared'`（会经 barrel 拉 Node 依赖导致空白页）。只用 `package.json` exports 子路径，例如 `@opptrix/shared/research-view-recommendation`。

## 硬性规则

- **先确认再动手**：新增功能 / 改架构 / 改 API / 改 Schema / 改 Provider 前，先说明目标、影响范围与**至少两个可选做法**，等用户选定再写码。纯问答、单行 typo 免。
- **先定位再改**：改代码前先用搜索 / 读文件确认真实调用链，不要凭记忆改。
- **禁止断代**：Schema 与用户数据只增不破，优先 `ALTER` / 新表 + 回填；启动自动检测 + **幂等**迁移；失败可诊断且保留原数据。
- **安全**：密钥 / token 禁止写入代码、日志、文档；所有外部输入必须校验；网络请求必须有超时（`AbortController`）。
- **代码质量**：禁止 `any`、`@ts-ignore`、非空断言 `!`；Provider 返回 null 触发 failover；独立操作并行（`Promise.all`）；**新增**函数 <50 行、**新增**文件 <300 行（既有超长文件不强制拆分，但不要继续加长）。
- **UI 文案面向投资者**：日常中文，禁止裸用 Provider / MCP / hydrate / SQLite 等术语与组件名、路径、错误码；空状态说清「为什么没有、下一步做什么」，错误说清「发生了什么、可以怎么办」。禁止 `window.confirm` / `alert` / `prompt`。
- **较大改动实现与验收分开**：不要自己写完自己判合格；验收按验收标准逐条核对，不合格返工。

## 门禁（改完必须跑，全部真实存在）

```bash
npm run build:packages   # 改 packages/** 后必跑；改 shared/agent 还要重启 API
npm run check:ui         # typecheck + lint + audit（改 client-ui 后）
npm run test:ui          # client-ui vitest
npm run test:gate        # 主路径 + 文档 + 缓存门禁
node --test tests/research-canvas-tools.test.mjs tests/research-query-data.test.mjs tests/research-refine-dataset.test.mjs tests/mcp-tool-route-accuracy.test.mjs tests/session-artifacts-opt-in.test.mjs tests/session-tools-freeze.test.mjs
npm run test:ci          # 全量 node 测试（较慢）
```

Agent 评测（**不进** `test:gate`；改提示词/工具/夹具后跑）：

```bash
npm run eval:agent       # 见 docs/AGENT-EVAL.md
```

本地运行：`npm run start -w @opptrix/server`（:8711）+ `WEB_HTTPS=0 npm run dev`（:5173）。交付形态为 Docker Compose 自托管 / 裸 Node + 反向代理（见 `Dockerfile`、`docker-compose.yml`）；不做 Electron 打包。

## 已知技术债（改到相关区域时注意）

- `a-stock-layer` 有两条取数路径：`engine.queryScoped` 与 `core/query-plan.ts` 的 `QueryPlanExecutor.execute`，各自维护缓存，加横切能力要改两处。
- 缓存读取被 `isWatchlistTarget()` 门控，非自选标的的 financials 完全不走缓存 —— 对研究画布是定位错配。
- merge 策略把逐行来源压成 `'mixed'`，妨碍「每个数字可溯源」。
- `tests/instrument-router.test.mjs`、`tests/instrument-capabilities-matrix.test.mjs` 共 5 条 **skip**（能力矩阵在途收窄，见测试 `skip` 原因）。CI 门禁为 `npm run test:gate`，不跑全量 `test:ci`。
- 三套画图路径并存：`research_canvas`（唯一有溯源的正路，always-on）、`artifacts`（报告/脑图/网页，**用户勾选**）、Markdown ` ```chart ` 围栏；后两者数字由模型手打、无溯源，**不要用于研究画布**。

- **改名遗留（易踩）**：数据根默认 `~/.research-canvas`；若 `~/.opptrix` 已存在则继续沿用（升级安全）。`RESEARCH_CANVAS_DATA_DIR` 优先于 `OPPTRIX_DATA_DIR`。`Cache` 默认落盘 `$DATA_ROOT/cache.json`；未设 data-dir env 且新 cache 不存在时，只读回退 `~/.aaashare/cache.json`。
- `dispose()` 名不副实：不阻断后续 `setWithTtl` 重建定时器，也不阻断 `clearMatching` / `clearType` / `delete` / `clearAll` 的同步 `flushNow()` 落盘，只能当辅助手段。

产品与阶段细节见 `Research Canvas/HANDOFF.md`。公开文档在 `docs/`（随仓提交）。
