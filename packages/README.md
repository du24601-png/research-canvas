# Packages

Research Canvas monorepo 内部包说明。**产品形态 = 左侧 Chat Agent + 右侧研究画布**。根目录 `npm run build:packages` 按 workspace 依赖顺序编译。

> Agent 协作：[docs/AGENT-GUIDE.md](../docs/AGENT-GUIDE.md) · 架构：[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

## 分层总览

```
shared ──► market-data-core / provider-sdk
              │
              ▼
         a-stock-layer   （Engine + 内置 Provider 实现）
              │            market-data-providers-cn | us 仅为 re-export
    ┌─────────┼─────────┬──────────────┐
    ▼         ▼         ▼              ▼
user-store  institutions  news-feed   agent-skills
（含 Hub 磁盘缓存）
              │                         │
              ▼                         ▼
    research-hub · search-hub · local-inference
              │
              ▼
         agent · canvas · doc-library …
              │
              ▼
         server（自托管；注入 createHubDiskCache）
              │
              ▼
         research-canvas-client（client-ui/）
```

## 基础与数据

| Package | 职责 |
|---------|------|
| `@opptrix/shared` | InstrumentRef、Tool Pack 注册表、类型与工具函数 |
| `@opptrix/market-data-core` | 数据层核心类型与抽象 |
| `@opptrix/provider-sdk` | Provider 开发 SDK |
| `@opptrix/a-stock-layer` | **MarketDataEngine**、Provider Registry、内置驱动、`queryInstrumentData` / `queryMarketCapability` |
| `@opptrix/market-data-providers-cn` | **兼容层**：re-export `a-stock-layer`，无独立实现 |
| `@opptrix/market-data-providers-us` | **兼容层**：re-export Tickflow 相关符号 |
| `@opptrix/user-store` | 用户 SQLite；含 Hub 磁盘缓存（`createHubDiskCache`） |

> **已移除（2026-09）**：`@opptrix/stock-eval`、`@opptrix/t-strategy`、`@opptrix/market-data-providers-crypto`、本地行情灌库包 `market-data-store` / `market-data`（在线-only v3 起不再读写）。

## 投研能力

| Package | 职责 |
|---------|------|
| `@opptrix/institutions` | 机构评级 / 研报（config-driven evaluators） |
| `@opptrix/agent-skills` | 工作流技能（~70 个研究 builtin + 用户 SKILL.md） |
| `@opptrix/research-hub` | `dispatch(feature, params)` 统一 Hub 入口 |
| `@opptrix/search-hub` | 标的搜索 `searchInstruments` |
| `@opptrix/canvas` | 通用画布组件（与 `research_canvas` 工具配合） |

## 内容与推理

| Package | 职责 |
|---------|------|
| `@opptrix/news-feed` | RSS 订阅、文章列表与详情 API 支撑 |
| `@opptrix/article-enrichment` | 文章正文抓取、媒体处理 |
| `@opptrix/local-inference` | 本地翻译模型（llama.cpp 等，可选） |

## 应用与 Agent

| Package | 职责 |
|---------|------|
| `@opptrix/agent` | LLM Provider、MCP ToolRegistry、Tool Pack 路由、多会话 |
| `@opptrix/server` | Fastify HTTP、Chat SSE、静态 SPA |
| `@opptrix/extension-sdk` | 扩展开发者 SDK |
| `research-canvas-client` | React + Fluent UI（`client-ui/`） |

## Hub Features（Research Canvas 主路径）

仍可用（节选）：

```
instrument_* · institution_rating · institution_report
market_regime · market_dynamics · market_session
etf_* · fund_* · portfolio_* · watchlist_*
news_* · sector_constituents · provider_*
```

**已下线**（Hub 与 MCP 同删）：`scorecard`、`backtest`、`discover_*`、`strategy_signal`、`evaluation`、`cyq`、龙虎榜/涨跌停独立工具等。宏观/榜单类问题优先外部 MCP 问数（`iwencai__query2data`），本地 `get_market_dynamics` / `get_market_regime` 等为补充。

## 单包构建

```bash
npm run build -w @opptrix/a-stock-layer
npm run build -w @opptrix/agent
npm run build -w @opptrix/server
```

## 根脚本

```bash
npm run build:packages   # 所有 packages + server
npm run build            # + client-ui
npm run check:ui         # client-ui 门禁
npm run test:gate        # PR 门禁
npm run test:ci          # 离线测试套件
npm run eval:agent       # Agent 三层评测（不进 test:gate，见 docs/AGENT-EVAL.md）
```

## 扩展数据层

1. 读 [DATA-LAYER.md](../docs/DATA-LAYER.md)
2. 在 `a-stock-layer/src/providers/` 实现驱动 + `manifest.ts`，并登记 `register.ts`
3. **禁止** Hub/UI 直连 Provider HTTP；不要在 `market-data-providers-*` 加新驱动
