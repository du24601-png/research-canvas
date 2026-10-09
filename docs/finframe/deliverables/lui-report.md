# FinFrame LUI 报告（草稿，2026-10-09）：从双栏画布到活报告

结论：

- 界面从「左聊天、右画布」改成「全宽对话、回答即报告、结果钉进看板」，旧布局保留在开关后面。
- 回答里的组件由一次独立的模型调用（Composer）按数据集元数据挑选，不碰数值；不合规就整份回退到原预览卡。
- 研究者任务测试（没有真实用户）显示：首个反馈时间不变（约 8–10 秒）；活报告多花约 2.5–4 秒组装，换来更少的操作、本地即时的「变化最大年份」和每段都带来源。

## 1. 演进与提交

| 里程碑 | 内容 | commit | 文档 |
|---|---|---|---|
| M3a | 对话优先布局（开关默认开）、看板抽屉、「钉住」、计划卡置顶、对外品牌 FinFrame | `d10fe22`、`c3f9555` | `docs/finframe/m3a-notes.md` |
| M3 | UI Spec（shared，整份校验）、4 个组件、yoy_delta 派生 | `eaf41d0` | `docs/finframe/m3-notes.md` |
| M4 | Composer、`research_ui_spec` 事件、ResearchTurnUi、Action Bridge；取数前确认（方案 B，默认关） | `9a1f417`、`32ef386` | `docs/finframe/m4-notes.md` |
| M4 遗留 | 组件内切换图种 / 年份、钉住带上当前视图、「调整」动作 | `faca8e2` | `docs/finframe/m2-report.md`（加做一节） |
| M2 后续 | 旧双栏布局自动加载改画布工具 | `19a9feb` | `docs/finframe/m2-followups.md` |
| M5 | 研究者任务测试 | `f5efa66`、`6b749bf` | `docs/finframe/m5-report.md` |

## 2. 设计约束（都由代码执行，不靠提示词）

- **数字只来自 Dataset**：
  - Spec 不含数值，标题里出现年份以外的数字就整份拒绝（`packages/shared/src/research-ui-spec.ts`）；
  - Composer 只看数据集的 id、指标、公司、期间和覆盖度（`packages/agent/src/research-ui-composer.ts`）；
  - 「变化最大的年份」由 `yoyDeltaDataset` 计算。
- **AI 不写看板**：
  - 钉住只在用户点击时发生，走原来的 `widget_adopted → adoptProposal`；
  - 对话优先布局下看板忽略 `widget_created`；
  - 改画布三件套不在默认工具里（E4，`e88fb8b`）。
- **失败就回退**：Spec 不合规、数据集不在本浏览器、Composer 出错，都显示原预览卡。
- **开关**：
  - `finframe.chatFirst`：默认开，关掉回到旧双栏，并保留 AI 改图；
  - `finframe.composer`：默认开；
  - `finframe.planConfirm`：默认关。

## 3. 评测

- **Composer 合规率**：
  - M4 三次种子运行 25/30（失败原因：标题字段被 schema 拒绝 → 已修 `2c2a900`；非 JSON；EvidencePanel 带了 actions）；
  - M2 各组 7–10 / 10。
  - 合规的 Spec 里数字为 0（记录见 `docs/finframe/m4-notes.md`、`docs/finframe/m2-report.md`）。
- **M5 节奏**（`eval/finframe/m5/records/2026-10-09T21-42-18-667Z-pacing.json`，中位数，秒）：

| Demo A | 首个反馈 | 最终布局 | 操作数 |
|---|---|---|---|
| C1 旧双栏 | 10.2 | 10.2 | 4 |
| C2 对话优先 + 固定卡 | 8.9 | 8.9 | 4 |
| C3 活报告 | 8.0 | 12.4 | 3 |

- **Composer 回退率**：M5 中 1/8。

## 4. 已知问题

- Demo C「平安」：实体解析把它直接当成中国平安，没有澄清（M5 六次全部如此），下一步修解析器。
- Composer 让完成时间晚 2.5–4 秒。可以先给一份由代码生成的默认 Spec，再让模型细化（未做）。
- 数据集只存在浏览器 localStorage：换浏览器后，历史回答显示「暂时无法读取」（早已存在的限制）。
- 研究者任务测试没有真实用户，点击数是按规则推算的。
