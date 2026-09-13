# 自托管

数据留在本机。需要自备大模型 API Key（OpenAI 兼容）。

## 开发（推荐）

```bash
npm install
npm run build:packages
npm run dev
```

浏览器打开 `https://127.0.0.1:5173`（自签名；可设 `WEB_HTTPS=0` 用 HTTP）。API 默认 `127.0.0.1:8711`，由 Vite 代理。

环境变量见根目录 [`.env.example`](../.env.example) 与 [`example/startup/env.example`](../example/startup/env.example)。

用户数据目录默认 `~/.research-canvas`（若已有 `~/.opptrix` 则沿用）。可用 `RESEARCH_CANVAS_DATA_DIR` 覆盖。

## Docker Compose

```bash
cp compose.env.example compose.env   # 可选
docker compose up -d
```

默认入口：`https://<主机>:8712`（自签名 HTTPS）。明文 HTTP 默认关闭；反代需要明文时设 `OPPTRIX_ENABLE_HTTP=1`。

看板「发布」生成的只读链接只在**这台部署**上有效，仓库不提供公网托管。

数据卷：`opptrix-home` → 容器内 `/opptrix`。

CLI（可选）：`npm i -g @opptrix/selfhost`，命令 `research-canvas`（`opptrix` 仍可用）。说明见 [`packages/selfhost/README.md`](../packages/selfhost/README.md)。

## 裸 Node

```bash
npm install
npm run build
npm run start -w @opptrix/server
```

生产环境请在前面加反向代理终结 TLS。

## 检索服务

仓库**不内置**检索域名。若使用标的搜索付费源，须在设置或环境中同时配置 API Key 与 `STOCKINDEX_BASE_URL`（或 `OPPTRIX_STOCKINDEX_BASE_URL`）。
