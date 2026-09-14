# 根目录地图

| 路径 | 用途 |
|------|------|
| `client-ui/` | React 界面（workspace：`research-canvas-client`） |
| `apps/server/` | Fastify API（唯一应用） |
| `packages/` | 领域包，见 [packages/README.md](../packages/README.md) |
| `tests/` | 根级 `node:test`（`.mjs`） |
| `eval/agent/` | Agent 评测题集、流水线与正式档（见 [AGENT-EVAL.md](./AGENT-EVAL.md)） |
| `docs/` | 随仓文档（本目录） |
| `example/` | 可提交的启动 / 配置样例（无密钥） |
| `examples/` | 扩展示例（如 hello-world `.opx`） |
| `Research Canvas/` | 产品 PRD / 交接（目录名含空格） |
| `archive/experts/` | 已下线专家市场静态 JSON，产品运行时不读 |
| `assets/brand/` | 字标等品牌源文件，不参与运行 |
| `scripts/` | 构建、测试、发布辅助脚本 |
| `Dockerfile` / `docker-compose.yml` | 自托管交付 |

不要把密钥写入仓库。`.env` 已被 gitignore；从 `.env.example` 复制。
