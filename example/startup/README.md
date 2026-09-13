# 启动示例

## Web（浏览器）

```bash
cd <仓库目录>
cp example/startup/env.example .env
# 编辑 .env，填入 LLM_API_KEY

npm install
npm run build
npm run dev
```

打开 **http://127.0.0.1:5173**。API 在 `127.0.0.1:8711`，由 Vite 代理，无需直接访问。

## 生产预览

```bash
npm run build
npm run serve
```

## 常用环境变量

| 变量 | 说明 |
|------|------|
| `LLM_API_KEY` | 大模型 API 密钥（对话必需） |
| `STOCK_RESEARCH_PORT` | API 端口，默认 `8711` |
| `RESEARCH_CANVAS_DATA_DIR` | 用户数据目录，默认 `~/.research-canvas`（已有 `~/.opptrix` 时沿用） |
| `OPPTRIX_DATA_DIR` | 同上，旧环境变量名，仍兼容 |
| `TUSHARE_TOKEN` | 可选，增强部分行情/基本面能力 |
| `TUSHARE_HTTP_URL` | 可选，非官方 Tushare 服务地址 |

未配置 LLM 时，除 Agent 对话外的投研工具、右侧面板等仍可使用（依赖免费在线数据源）。
