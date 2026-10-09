# FinFrame M4 笔记：Composer、Action Bridge、取数前确认（2026-10-09）

结论：Composer 已接通。开启对话优先布局后，每轮回答在原预览卡出现之后，会被一份经校验的 UI Spec 替换；任何失败都保留原预览卡。三次种子运行中 Composer 产出合规 Spec 25/30，合规的 Spec 里没有一个数字。取数前确认（方案 B）已实现，开关默认关。

## 提交

| commit | 内容 |
|---|---|
| `75244fa` | O6-A 真实快照 snapshot-v1（见 `eval/finframe/fixtures/snapshot-v1/README.md`） |
| `9a1f417` | Composer、`research_ui_spec` 事件、ResearchTurnUi、Action Bridge |
| `08bc49f` | 评测：冻结工具清单加入 yoy_delta；Composer 评分器；`ui_expect` |
| `2c2a900` | 两次 eval:agent 与两次种子运行的存档；Spec 的 title 改为所有组件都可选 |
| `dc46b35` | 改 title 后又跑一次种子 |
| `0f2d785` | 种子夹具的计划文案改为与生产一致（见「评测缺陷」） |
| `32ef386` | 取数前确认（方案 B），开关 `finframe.planConfirm` 默认关 |

## 怎么工作

1. 客户端在对话优先布局下，且 `finframe.composer` 不为 `'0'`（默认开）时，请求里带 `ui_composer: true`。
2. 工具循环结束、写入回答之前，engine 调用 `runResearchUiComposer`（engine.ts 只加了一个钩子）。它只把本轮 `query_data` / `refine_dataset` 产出的数据集元数据交给模型（id、指标、公司、期间、覆盖度），不给任何数值。
3. 模型的输出经 `parseResearchUiSpec` 整份校验。通过后发 `research_ui_spec` 事件，事件携带合成步骤 `compose_research_ui`。这个步骤也随本轮写入历史，所以历史回放与实时看到的一致。Spec 怎么保存选的是方案 A（合成步骤，不改会话存储格式）；方案 B 是在 assistant 消息上加新字段，要改存储格式，没选。
4. 客户端 `ResearchTurnUi`：本轮有合规 Spec 时，用 SpecRenderer 替换预览卡；没有 Spec、Spec 不合规、或本浏览器里没有对应数据集，都保留原预览卡。
5. Action Bridge：
   - **钉住**：只在用户点击时执行，走 `widget_adopted` → `adoptProposal`，优先用本轮对应的预览提案。
   - **查看来源**：滚到本段回答的「来源与口径」。
   - **再查一次**：把一句重查放进输入框，不自动发送。
   - **看变化最大的年份**：TrendView 本地用 shared 的 `yoyDeltaDataset` 计算；Spec 也可以直接引用 refine 出的 yoy_delta 数据集。
6. 请求开关的位置选的是方案 A（请求体加 `ui_composer` 字段，服务端只在被要求时才调模型）；方案 B 是服务端总是组装、客户端不用时丢弃，浪费 token，没选。

## 评测（deepseek-flash，temperature 0）

**eval:agent**：各层分开读，不合成总分。M1 两次跑在 `9e630ee` / `6297fbe`，M4 两次跑在 `08bc49f`。

| 层 | M1 第 1 次 | M1 第 2 次 | M4 第 1 次 | M4 第 2 次 |
|---|---|---|---|---|
| component | 94/99 | 92/99 | 93/99 | 92/99 |
| planning | 24/24 | 24/24 | 23/24 | 23/24 |
| prompt | 21/24 | 23/24 | 22/24 | 23/24 |
| 耗时 | 6m05s | 6m09s | 5m46s | 6m18s |

- planning 两次都在 `pl-023`（招商银行净息差，指标不支持）失败。第 1 次模型悄悄改查净利率，属于 F2 类「缺数时自己找替代」；第 2 次先调了 financials 再问用户。M1 两次都通过。规划层这次唯一的输入变化是冻结工具清单里 refine_dataset 的描述，但还**没有证实**是它导致的。
- component 两次都失败的题与 M1 相同（qc-017、qg-006/013/014/015）。

**种子集（12 题）**：三个评分器仍用合成数值夹具，与 M1 可比；Composer 单独计分，数据集覆盖度换成 snapshot-v1 的真实值。

| 评分 | M1 A | M1 B | M4 第 1 次 | M4 第 2 次 | M4 第 3 次（改 title 后） |
|---|---|---|---|---|---|
| numbers_grounded | 10/12 | 10/12 | 11/12 | 11/12 | 11/12 |
| source_period | 9/9 | 9/9 | 9/9 | 8/9 | 9/9 |
| refusal | 10/12 | 9/12 | 10/12 | 10/12 | 10/12 |
| 决策链 | 9/12 | 8/12 | 10/12 | 10/12 | 9/12 |
| Composer 合规且组件选对 | — | — | 8/10 | 9/10 | 8/10 |
| Composer Spec 零数值（合规的里面） | — | — | 8/8 | 9/9 | 8/8 |

- Composer 前两次不合规的 3 例，都是模型给 EvidencePanel / MissingData 加了 title：提示词允许，schema 不允许。已改为所有组件都可选 title（仍禁止数字）。第 3 次不合规的 2 例：一次输出不是 JSON，一次给 EvidencePanel 加了 actions。这类失败会回退到原预览卡，用户不会看到坏界面。
- ff-004（问变化明显的年份）里，模型两次都调用了新的 `refine_dataset` yoy_delta，但仍然调用 get_instrument_financials（M1 的 F4）。
- ff-009 再次出现 F2：「约 30%」来自模型记忆。
- 种子运行耗时约 2m21s–2m31s。Composer 每次调用平均 2.2–2.4 秒，最长 3.6 秒；它在终答写入前执行，所以每轮的完成事件会晚这么多。
- 种子运行的 token 约 105–110 万 prompt（缓存命中约 98%），约 2 万 completion，含 Composer。

## 评测缺陷（已修，影响历史可比性）

种子夹具的 `query_data` 桩把指标 id 字符串直接传给 `buildResearchFetchPlan`：计划文案里的指标显示为「undefined」，1–3 家时也没有返回生产会返回的 plan / statement 字段。M1 到 M4 的种子运行都带着这个缺陷：彼此可比，但与生产不完全一致。`0f2d785` 已修，之后的种子运行不能和之前的直接比较。

## 取数前确认（方案 B）

- 开关：localStorage `finframe.planConfirm` = `'1'`，且只在对话优先布局下生效，默认关。请求体带 `plan_confirm: true`。
- 只对 1–3 家的 `query_data` 生效；4 家以上沿用原有的 plan_preview 确认卡。
- 流程：服务端在执行前发 `research_plan`，等 4 秒。期间收到 soft steer 就跳过本次取数，工具结果为 `plan_cancelled`，下一轮模型先读用户的补充说明；没收到就继续取数。
- 客户端：计划卡放在本轮最上方，带倒计时。「先别查」发停止的 steer；「修改」也先发停止的 steer，再把计划放进输入框。
- engine.ts 只把一处守卫改成 `checkSpinGuard(...) ?? await runPlanGate(...)`。

## 未做 / 已知

- 视图切换（改周期、换图种）还没有做成 Spec 动作。预览卡上原有的「调整」仍可用，但 Spec 组件上没有对应按钮。
- Composer 每次多花约 2 秒、一次模型调用。M2 可以考虑先给出确定性的默认 Spec，再让模型改。
- 冻结评测清单里的工具描述现在与生产一致到 yoy_delta 为止，其他工具描述未同步。
- 截图仍未提交（`docs/finframe/screens/`），因为画面里有真实会话。
