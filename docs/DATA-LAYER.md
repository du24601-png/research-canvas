# 数据层

Engine（`@opptrix/a-stock-layer`）负责查询计划、Provider 路由、缓存与熔断。数字由代码从 Provider 取回，模型不得编造财务数字。

## 内置驱动（注册名单）

`registerAllDrivers` 当前注册：

- Tushare
- Tickflow
- 同花顺
- StockIndex（须自配 `baseUrl` + API Key）
- Akshare

`packages/a-stock-layer/src/providers/` 里若还有未注册目录（例如历史 crypto 适配），**不等于已接入产品**。

## 兼容包

`@opptrix/market-data-providers-cn` 与 `@opptrix/market-data-providers-us` **没有独立实现**，只从 `a-stock-layer` re-export。新 Provider 请按现有 `providers/<name>/` 结构加在 Engine 包内并登记 `register.ts`。

## 缓存

| 层 | 位置 | 说明 |
|----|------|------|
| Engine | `Cache` → 数据根 `cache.json` | 行情/财务等；未设 data-dir 时只读回退 `~/.aaashare/cache.json` |
| Hub 磁盘 | `user-store` 文档表 | 市场动态、组合汇总、标的报价；经 `createHubDiskCache` 注入 |
| Hub 内存 | `ResearchHub` 进程内 Map | 短 TTL，去重轮询 |

Engine 有两条取数路径（`queryScoped` 与 `QueryPlanExecutor`），横切缓存时要改两处。详见 [`AGENTS.md`](../AGENTS.md) 技术债。

## 扩展

1. 在 `a-stock-layer` 实现 Driver + `manifest.ts`
2. `registerAllDrivers` 登记
3. 禁止 Hub / UI 直连上游 HTTP
