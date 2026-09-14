# Agent 指南

给人类贡献者的摘要。Agent 每轮约束以根目录 [`AGENTS.md`](../AGENTS.md) 为准。

## 主路径工具

- `query_data` / `refine_dataset`：取数、派生数据集。点名 ≤3 家直接取数；>3 家或行业对比先返回计划，用户确认后再查。
- `propose_widget`：聊天区预览，不写右侧画布；必须已有数据集。

报告 / 脑图 / 网页（`create_canvas` 等）默认不在工具列表。用户须在输入框 **+ → 报告与脑图** 勾选。`activate_tool_pack` 不能替用户打开。

画布「发布」只生成当前部署上的只读快照，不是公网分享。
- `create_widget` / `update_widget` / `delete_widget`：仅在用户明确改已有图，或 Adopt 之后的画布编辑

报告 / 脑图 / 网页（`create_canvas` 等）默认不在工具列表。用户须在输入框 **+ → 报告与脑图** 勾选。`activate_tool_pack` 不能替用户打开。

## 原则

1. LLM 只决定查什么、选哪种图；数字由 Provider 返回。
2. `null ≠ 0`，缺失显示「—」。
3. Dataset 语义变化必须新 `datasetId`。

## 技能

内置技能在 `packages/agent-skills/builtin/`。会话角色用默认 Researcher Persona，可在会话设置自定义。

## 相关

- 工具与 pack：[`packages/README.md`](../packages/README.md)
- 协议：`packages/shared` 的 `research-canvas-protocol`
- 评测：[`docs/AGENT-EVAL.md`](../docs/AGENT-EVAL.md)（与 `test:gate` 隔离）
