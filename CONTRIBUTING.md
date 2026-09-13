# 贡献指南

欢迎提交 Issue 与 Pull Request。贡献代码即视为同意以本仓库 [Apache License 2.0](LICENSE) 授权。

## 开发

```bash
npm install
npm run build:packages
npm run dev
```

改 `packages/**` 后必须 `npm run build:packages`。改 `client-ui` 后跑 `npm run check:ui`。

## 测试

```bash
npm run test:gate    # 主路径 + 文档 + 缓存门禁（PR 必绿）
npm run test:ui      # client-ui vitest（PR 必绿）
npm run test:ci      # 全量 node 测试（较慢）
npm run test:e2e:smoke  # 浏览器主路径烟测；需本机 :8711 + :5173，并已安装 Playwright Chromium
```

Windows 上全量 `test:ci` 仍可能有环境相关失败；以 Linux CI 的 `test:gate` + `test:ui` 为准。已知能力矩阵用例见 `AGENTS.md`。

主路径烟测不进每次 PR（需本机模型与财报源）。本地验收：

```bash
npm run start -w @opptrix/server
WEB_HTTPS=0 npm run dev
npx playwright install chromium
npm run test:e2e:smoke
```

## 约定

- 先读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 与 [`AGENTS.md`](AGENTS.md)。
- 新增功能 / 改 API / Schema / Provider 前先说明方案再写码。
- 不要把密钥写入代码、日志或文档。
- UI 文案面向投资者，不要裸用内部术语。

## Pull Request

请用仓库模板：改了什么、如何验证。CI 跑构建、`check:ui`、`test:ui` 与 `test:gate`。
