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
docker compose up -d --build
```

默认入口：`https://<主机>:8712`（自签名 HTTPS）。明文 HTTP 默认关闭；反代需要明文时设 `OPPTRIX_ENABLE_HTTP=1`。

看板「发布」生成的只读链接只在**这台部署**上有效，仓库不提供公网托管。未登录访客可打开 `/?board=<id>`；对话、取数、再发布仍需登录。

数据卷：`opptrix-home` → 容器内 `/opptrix`。

CLI（可选）：`npm i -g @opptrix/selfhost`，命令 `research-canvas`（`opptrix` 仍可用）。说明见 [`packages/selfhost/README.md`](../packages/selfhost/README.md)。**演示当前仓库提交时不要只 pull GHCR 预构建镜像**，须用下文「云服务器演示」从本 git SHA 构建。

## 云服务器演示

面向「把当前提交推到 GitHub，再在一台云主机上给别人看」的最短路径。这是**单用户自托管实例**，不是多租户公网 SaaS。

### 机器

- 系统：Linux x86_64，Docker Compose V2
- 建议：2 vCPU / **8 GB 内存** / 40 GB 磁盘（首次 `docker compose build` 会编译 native 依赖，内存不足会失败）
- 安全组 / 防火墙：先只放行 **22**；认领账户后再放行 **8712/tcp**（或 443 若走反代）

### 1. 从 GitHub 检出并构建

不要用 `research-canvas up` / `opptrix up` 的默认 **GHCR 拉取**：公开标签里未必包含本次看板改动。在云主机：

```bash
git clone <你的仓库 URL>
cd Opptrix   # 或你的目录名
git checkout <推上去的 commit>

cp compose.env.example compose.env
# 编辑 compose.env：至少填 LLM_API_KEY（及 LLM_BASE_URL / LLM_MODEL）
# 演示站推荐同时填写双账户（预置路径允许 ≥6 位简单密码）：
#   OPPTRIX_ADMIN_USERNAME=admin
#   OPPTRIX_ADMIN_PASSWORD=123456
#   OPPTRIX_USER_USERNAME=user1
#   OPPTRIX_USER_PASSWORD=123456
# 可选 TUSHARE_TOKEN；也可启动后用管理员登录，在「设置 → 数据源」填写

docker compose up -d --build
```

首次构建可能 15–40 分钟。健康检查：`curl -fk https://127.0.0.1:8712/api/health`

### 2. 账户（对公网开放端口之前）

**推荐：预置双账户。** 在 `compose.env` 中同时设置 `OPPTRIX_ADMIN_PASSWORD` 与 `OPPTRIX_USER_PASSWORD`（用户名默认 `admin` / `user1`）。预置路径允许 ≥6 位简单密码（如 `123456`），与 UI 自助注册的强密码规则不同。容器**首次启动**会自动创建管理员与演示用户，并关闭自助注册。

| 角色 | 默认账户 | 权限 |
|------|----------|------|
| **管理员** | `admin` / `123456`（可在 compose.env 覆盖） | 模型、数据源、系统设置；可对话与看板 |
| **演示用户** | `user1` / `123456`（可在 compose.env 覆盖） | 对话、看板、发布；**不能**改模型/数据源/系统设置 |

若未配置双账户密码，仍走旧流程：先用 SSH 隧道打开 `https://127.0.0.1:8712` 完成**唯一所有者**注册，再放行公网端口（否则陌生人可抢先注册）。

### 3. 两种演示方式

| 方式 | 给观众什么 | 消耗 |
|------|------------|------|
| **只读看板** | `https://<公网主机>:8712/?board=<发布得到的 uuid>` | 不消耗模型/数据配额；无需登录 |
| **可对话（演示用户）** | 同一入口 + `user1` / `123456`（或你自定义） | 每次提问消耗 LLM 与财报源配额 |
| **可对话（管理员）** | 管理员账户 | 同上；还可改设置 |

操作：登录后新建对话 → 提问出图 → 添加到画布 → **发布** → 把链接发给观众。链接只在**这台机器、这份数据卷**上有效。

### 4. 证书与反代

- 直连 8712：浏览器会警告自签名证书，演示时让观众点继续即可。
- 前面用 Nginx / Caddy 终结正式 TLS：设 `OPPTRIX_ENABLE_HTTP=1`，映射 8711，填写 `OPPTRIX_TRUSTED_PROXIES`，并按实际协议调整 `OPPTRIX_AUTH_COOKIE_SECURE`。

### 不要做的事

- 未认领就对公网开放 8712
- 把 `compose.env` / `.env` / 密钥提交进 GitHub
- 把这台演示机当成开放注册的 SaaS（目前只有一个所有者账户）

## 裸 Node

```bash
npm install
npm run build
npm run start -w @opptrix/server
```

生产环境请在前面加反向代理终结 TLS。

## 检索服务

仓库**不内置**检索域名。若使用标的搜索付费源，须在设置或环境中同时配置 API Key 与 `STOCKINDEX_BASE_URL`（或 `OPPTRIX_STOCKINDEX_BASE_URL`）。
