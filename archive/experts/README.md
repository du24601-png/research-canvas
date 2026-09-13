# 远程专家市场静态目录（已归档）

> **2026-09 产品更新**：Experts 运行时（`/api/experts/*`、`ExpertCatalogService`、专家会话 UI）已从 Research Canvas **移除**。本目录保留历史静态 JSON，供 CDN/R2 归档；**新部署不再消费**。

## 历史用途

托管已下线的官方专家市场静态 JSON，曾发布到热更新 CDN 的 `/experts/` 路径。

## 文件结构

| 文件 | 说明 |
|------|------|
| `catalog.json` | 列表索引 |
| `{id}.json` | 单条专家定义 |

## 迁移说明

- 会话角色：使用默认 **Researcher Persona**（`DEFAULT_RESEARCHER_PERSONA`），可在会话设置中自定义 `rolePersona`
- 专题能力：改用 **Agent Skills**（`activate_agent_skill`）与工作流 pack

## 本地校验（归档维护）

```bash
node scripts/validate-experts.mjs
```

若仍有 CDN 同步脚本，请指向本目录 `archive/experts/**`。当前仓库无 `sync-experts` workflow；产品运行时不读取这些 JSON。
