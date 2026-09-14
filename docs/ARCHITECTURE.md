# 架构

产品主路径：左侧 Chat 提问 → `query_data` 取真实数据 → `propose_widget` 预览 → 用户 Adopt → 右侧画布。

## 分层（约定）

```text
UI          client-ui
API         apps/server
Hub         research-hub / search-hub
Engine      a-stock-layer（MarketDataEngine）
Provider    上游适配（见下文「实际落点」）
Storage     user-store（SQLite）
```

调用：UI → Hub HTTP / Agent tools → Engine `queryInstrumentData` / `queryMarketCapability` → Provider Registry → 上游。

禁止：UI / Hub 直连 Provider HTTP；Provider 之间互调。

## 实际落点（与约定的差异）

这些是当前代码事实，不是待办口号：

1. **Provider 实现在 Engine 包内。** Tushare、Tickflow、同花顺、StockIndex、Akshare 驱动位于 `packages/a-stock-layer/src/providers/`，由 `registerAllDrivers` 注册。`@opptrix/market-data-providers-cn` / `-us` 只是 re-export 兼容层，**不要在这两个包里加新驱动**。
2. **Hub 不写 SQLite。** 市场动态 / 关注行情 / 组合汇总的磁盘缓存实现在 `user-store`（`createHubDiskCache`）。`apps/server` 与 MCP stdio 构造 `new ResearchHub({ diskCache })` 注入。Hub 进程内仍有短 TTL 内存缓存。
3. **包名仍是 `@opptrix/*`。** 产品名是 Research Canvas；npm scope 未改。
4. **`a-stock-layer` 名称偏 A 股**，实际也路由美股 / 港股等。

## 主链路文件

见 [`AGENTS.md`](../AGENTS.md)「代码地图」。画布协议在 `packages/shared` 的 `research-canvas-protocol` 与 `research-view-*`。

## 三套画图路径

| 路径 | 数字来源 | 用途 |
|------|----------|------|
| `research_canvas` | Provider，可溯源 | 默认，右侧画布唯一正路 |
| `artifacts` | 模型手打 | 须用户在 + 菜单勾选「报告与脑图」 |
| Markdown ` ```chart ` | 模型手打 | 不要当研究画布 |

## 相关

- 数据层细节：[DATA-LAYER.md](./DATA-LAYER.md)
- Agent 评测（与产品 CI 隔离）：[AGENT-EVAL.md](./AGENT-EVAL.md)
- 阶段验收：[Research Canvas/HANDOFF.md](../Research%20Canvas/HANDOFF.md)
