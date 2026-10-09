# FinFrame M2 后续（2026-10-09）

| 项 | 结论 | commit |
|---|---|---|
| a. 旧布局失去 AI 改图 | 已修 | `19a9feb` |
| b. pl-023 | 评测短提示词补上规则后 planning 24/24 ×2 | `340cda4` |
| c. ff-004 停答 | 更像评测运行器的 max_tokens 截断，已让运行器把截断如实标出；未发现 engine 问题 | 本次提交 |
| d. ff-011 | 记为下一个 M2 候选，本次不改 | — |

## a. 旧双栏布局恢复 AI 改图（`19a9feb`）

- 对话优先开关关闭时，客户端每次请求带 `canvas_edit: true`。engine 按会话记住这个值，冻结工具里加入 `research_canvas_edit`；值变化时重建冻结集，做法和 artifacts 开关一样。系统提示也随之恢复编辑规则。
- 对话优先布局保持不加载。
- 顺带修了 E4 引入的漏洞：打开 artifacts 时，原来用 `allToolPackIds()`，会连带加载改画布三件套。现在每个可选包只跟随自己的开关。
- 怎么做的选择：方案 A 是每次请求带标记、不改存储（已选）；方案 B 是写进会话记录，要改会话存储格式。
- 测试：`tests/session-canvas-edit-pack.test.mjs`（已进 `test:gate`），`client-ui/src/api/streamFlags.test.ts`。

## b. pl-023 与评测短提示词（`340cda4`）

planning 层的评测短提示词只补了 E1 的「不支持的指标照实说明并停下」一条，与生产 playbook 同步。之后 planning ×2 都是 24/24，pl-023 两次通过。改之前，最近 4 次里 pl-023 失败了 3 次。这符合「短提示词缺这条规则」的假设，但只跑了两次。

## c. ff-004 做完 yoy_delta 后没有回答

- 存档里的失败那次：一共 3 轮，completion 合计 3309，而前两轮通常各约 300–900。第 3 轮很可能用满了评测运行器的 `max_tokens: 2048`。
- 复现：同一题又跑了 3 次（脚本记录每轮 finish_reason），3 次都正常收尾。其中一轮用了 1760 token，离上限很近。
- 判断：截断时，工具调用 JSON 可能残缺、解析结果为空；评测循环把这当成「模型没有调用工具」而结束，于是留下一个空回答。生产 engine 对「用满额度」已有专门处理（`EMPTY_REPLY_REASONING_HINT` / `hitBudget`），没有看到 engine 循环在工具结果之后不收尾的问题。
- 改动（只改评测侧）：`completePlanningRound` 返回 `finishReason`；planning 循环在没有工具调用且 finish_reason 为 `length` 时标记 `truncated`；种子运行器把这种情况记为运行器错误「输出被 max_tokens 截断」，不再算作 Agent 主动停答。加了测试。
- 未做：没有调高 max_tokens，以免改变测量口径。生产里如果工具调用被截断，会怎样显示，**尚未验证**。

## d. ff-011（F4：取数后又去调 get_instrument_financials）

记为下一个 M2 单因素候选，本次不改。M1 的 F4、M2 终态 ff-011 第 1 次（4 次调用超过 3 次上限）都是这个问题。

- 可能的改动：工具选型卡或 playbook 写明「query_data 已给出数据集后，不要再调 get_instrument_financials 补数」；或者 `get_instrument_financials` 在本轮已有同指标数据集时返回提示。
- 按单因素方法先测前者。
