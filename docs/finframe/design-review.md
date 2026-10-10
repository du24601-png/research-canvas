# FinFrame 界面设计评审（2026-10-10）

依据：现有截图 `docs/finframe/screens/m3a-*.png`、`client-ui` 代码（主题 token、对话、过程、活报告组件），以及下文列出的 UX / AI 原生设计手册。只评审、不改代码。

已定：取数过程用方案 B（一张进度卡，完成后收成一行摘要），见样张 https://claude.ai/artifact/6Y8k47AQZFEqGVmUSPJcXa 。

## 结论

1. **现在的界面是「开发工具」的骨架，不是「研究报告」的骨架。** 字号阶梯 10–16px、正文 13px、满屏灰字、模型名和 token 数常驻，都继承自 Cursor 式 IDE 风格。投资者读的是报告，字要更大、层级要更分明、数字要成为主角。
2. **回答的主角应该是数字，现在主角是解释文字。** 正文写「具体点位以图为准」，数字只在图里。要让关键数字以大号、可点溯源的形式出现在回答最前面（指标卡、带数句子）。
3. **AI 过程信息太多、太早、太灰；结果信息太少。** 过程收成一行（方案 B），把空间还给报告。
4. **出错与空状态在伤害信任。** 「此浏览器暂时无法读取这份研究数据」占据回答主体；看板空状态用示例公司画了一张像真数据的图。
5. **缺少 AI 原生产品该有的几样东西**：开始前能改的计划、进行中能停 / 改、引用和正文明显区分并提示核对、追问建议、口径偏好记忆、版本之间「什么变了」。

## 1. 参照的原则（提炼成 FinFrame 的 8 条）

| # | FinFrame 原则 | 来源 |
|---|---|---|
| 1 | **先给答案，再给过程**：回答第一屏是结论和关键数字；过程默认收起 | NN/g「Less Chat, More Answer」；Apple「简单是去掉摩擦」 |
| 2 | **说清能做什么、做得多好**：首页和空状态说明能查哪些市场、指标、年份；覆盖不到的直说 | Microsoft HAX G1、G2；PAIR「Mental Models」 |
| 3 | **每个数字可核对，且引用看起来就是引用**：来源与正文样式明显区分，并提示「点开核对」 | NN/g「Explainable AI in Chat Interfaces」；Shape of AI「Citations」 |
| 4 | **动手前给计划，过程中能叫停**：多公司 / 多年份查询先展示计划，可改；流式中可停、可改口径 | Shape of AI「Action plan」「Controls」「Verification」；HAX G9、G10 |
| 5 | **过程可审计，但不打扰**：步骤、口径、缺失可展开查看，默认一行 | Shape of AI「Stream of Thought」；HAX G11 |
| 6 | **出错要优雅**：说清发生了什么、还能看到什么、下一步怎么办；绝不让错误占满回答 | PAIR「Errors + Graceful Failure」；HAX G9 |
| 7 | **记住用户的口径偏好，并让用户看得到、改得了** | HAX G12、G13、G17；Shape of AI「Memory」 |
| 8 | **改动要告知**：新版本标出哪些数字变了、来源换了 | HAX G18；Shape of AI「Footprints」 |

## 2. 逐处问题与改法

优先级：P0 影响信任或主路径，P1 明显影响观感，P2 打磨。

| 位置 | 问题 | 改法 | 原则 | 优先级 |
|---|---|---|---|---|
| 全局字号 | 正文 13px、阶梯 10–16px，中文长段阅读吃力 | 正文 15px、行高 1.7；阶梯 12 / 13 / 15 / 17 / 20 / 28；数字单独用等宽数字（tabular） | 1 | P0 |
| 回答结构 | 先一段解释，再一张图；关键数字不在正文 | 顺序改为：一句结论（带数句子）→ 指标卡 → 主图 → 表格 / 证据；解释文字缩到 2 行内 | 1、3 | P0 |
| 历史回答读不到数据 | 「此浏览器暂时无法读取」占据主体 | 保留标题、时间、口径摘要和「重新查询」按钮，压成一行提示；长期做数据集服务端保存（见 ui-research 第 4 节第 6 项） | 6 | P0 |
| 过程条 | 灰条「1 次查询 · 1 张图表」，信息量低 | 方案 B 进度卡；完成后一行摘要：公司、指标、年份、口径、缺失 | 5 | P0 |
| 引用 | 来源只在卡片外，样式与正文相近 | 数字旁小角标，悬停卡片写报告期、口径、取数时间、「打开原文」；回答底部一行「数字来自年报，建议点开核对关键数字」 | 3 | P0 |
| 开发者信息外露 | 模型名「deepseek-flash」、token「本轮 199.2k」、右下角无说明的转圈 | 模型选择收进设置；token 只在调试模式显示；转圈改为带文字的状态 | 2 | P1 |
| 标题重复 | 会话标题、用户气泡、看板标题三处同一句话 | 顶栏显示会话标题；用户气泡保持原话；看板标题改为「看板 · 3 张图」 | 1 | P1 |
| 输入框 | 上方小字「@ 选股票 · / 引用技能 · Enter 发送」常驻；移动端默认「按住说话」 | 提示改为输入框内占位文字，首次使用后隐藏；移动端默认文字输入，语音放按钮里 | 2 | P1 |
| 首页 | 只有标题和 3 个示例问题 | 增加「能查什么」一行（A 股 / 美股、财务指标、K 线、年份范围）；示例按场景分组（对比、走势、排名）；最近研究入口 | 2 | P1 |
| 看板空状态 | 示例图用「赛轮轮胎」等真公司名、像真数据 | 改成线框示意（无公司名、无刻度数值），或用当前会话的数据做预览 | 3、6 | P1 |
| 追问 | 结尾一段文字建议「可以切成柱状图……」 | 改成 2–3 个可点的追问建议按钮（加一家公司 / 换成排名 / 看季度） | 2 | P1 |
| 计划确认 | 默认关闭 | 多公司或跨 5 年以上的查询默认开启，计划可勾选修改（Plan 卡） | 4 | P1 |
| 流式控制 | 只能等 | 流式中显示「停止」；停止后保留已取到的数据，可改口径继续 | 4 | P1 |
| 口径偏好 | 每次都由模型猜 | 记住「年报口径 / 合并报表 / 人民币」等偏好，在回答摘要里显示，可一键改 | 7 | P2 |
| 版本 | M4b 已有追问出新版本 | 新版本顶部写「较上版：新增 1 家公司，2 个数字更新」，变化的数字高亮 | 8 | P2 |
| 宽度 | 1440 宽屏下正文列约 770px，图表也被限制在这一列 | 文字列 720px，报告组件可以放宽到 960px，两侧留白不变 | 1 | P2 |
| 颜色 | 全单色，没有给数据留颜色；状态色只有绿色 | 界面保持黑白灰；图表用一组克制的数据色；语义色只保留琥珀（缺失 / 注意）和涨跌色 | 3 | P2 |
| 动效 | 进出场几乎没有，或用三点跳动 | 按 ui-research 第 7 节：Fluent motion 预设 + motion；统一时长 150 / 250 / 400ms 与一条缓动曲线；尊重「减少动态效果」 | — | P2 |

## 3. 设计系统层面的调整

- **字体**：中文正文保持系统字体（苹方 / 微软雅黑），数字用等宽数字特性；标题可用略重的字重拉开层级，不引入花哨字体。
- **字号**：见上表，基准 15px。现有 `--opptrix-font-*` 是全局变量，改动面大，建议只在对话优先布局下覆盖（同一开关体系），旧布局不动。
- **颜色**：界面层继续用 Opptrix 黑白灰；新增「数据色」一组（6 色，深浅两套），只给图表和指标卡用；语义色：琥珀（缺失 / 注意）、红绿（涨跌，A 股红涨绿跌，跟随设置）。
- **密度**：回答里组件之间 24px，组件内 12px；卡片只给「需要被单独操作的对象」（可钉住的图、计划卡），其余用留白分组，避免满屏边框。
- **动效**：三档时长 + 一条缓动；进行中用流光文字，不用无意义的转圈。

## 4. 落地顺序

1. **P0（一个里程碑）**：字号与回答结构、进度卡 B、引用样式、历史回答降级。
2. **P1**：去开发者信息、首页与空状态、追问按钮、计划卡默认策略、停止按钮、动效基础件。
3. **P2**：口径记忆、版本差异、宽度与数据色。
4. 图表库与通用组件按 `chart-upgrade-proposal.md` 并行推进。

以上每一步改代码前，都按 AGENTS.md 先出方案、由 Quinn 选定。

## 出处

- Microsoft, [Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)（18 条，HAX Toolkit）
- Google PAIR, [People + AI Guidebook](https://pair.withgoogle.com/guidebook/)（Mental Models、Explainability + Trust、Feedback + Control、Errors + Graceful Failure 等章）
- Emily Campbell, [Shape of AI](https://www.shapeof.ai/)（Governors：Action plan、Citations、Controls、Memory、Stream of Thought、Verification；Trust builders：Caveat、Disclosure、Footprints）
- Nielsen Norman Group, [Explainable AI in Chat Interfaces](https://www.nngroup.com/articles/explainable-ai/)、[Less Chat, More Answer](https://www.nngroup.com/articles/less-chat-more-answer/)、[10 Guidelines for Designing Your Site's AI Chatbots](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)
- Apple, WWDC26 设计原则讲座（[链接](https://developer-rno.apple.com/videos/play/wwdc2026/250)，二手摘要，未直接核对 HIG「Generative AI」一节原文）

改版主界面样张（示例数据）：https://claude.ai/artifact/EBTvcciqHDTcQ7CJ2xAu6g

## 补充（2026-10-10）：简洁优先

Quinn 要求不增加过多按钮、以对话为主。上文第 2 节中「追问按钮」「计划卡可勾选」「停止后改口径」等新增控件取消或改为在对话中完成；图上只保留「钉住」。改版样张已同步（第 2 版）。
