# FinFrame 界面模仿对象（2026-10-10）

前提（已定）：对话为主、不加多余按钮、界面简洁；数字只来自代码，每个数字可查来源。
本文挑「界面」值得模仿的产品，功能对照见 2026-10-06 的竞品调研 https://claude.ai/artifact/4U2P222MGjzvMEtpLdxxg2 。
资料来自官网与公开评测；没有实际登录试用这些产品的付费版，界面细节以各家当前版本为准。

## 结论：一个骨架 + 三处借鉴

**主模仿对象：Perplexity（含 Perplexity Finance）的回答页骨架。**
它和我们的形态最接近：一个输入框，回答先给结论，来源紧跟在旁边，金融数据以图表 / 卡片嵌在回答里，追问还是在同一个输入框里。按钮极少，符合「靠对话」。

再借三处：

| 借鉴谁 | 借什么 | 不借什么 |
|---|---|---|
| **Claude / ChatGPT** | 对话外壳：居中阅读列、克制的字体层级、悬浮输入框、侧边打开的结果面板（对应我们的看板抽屉） | 回答里的数字由模型写；长篇解释 |
| **Fiscal.ai（原 FinChat）** | 金融图表的做法：标准化指标、多公司对比、**图下附精确数值表**；数据标明来自 S&P 数据源 | 指标库式的多层菜单与大量筛选控件 |
| **Robinhood（Cortex）** | 面向普通投资者的「大数字 + 一句话」：关键数字放大、涨跌颜色清楚、对话层嵌在原有页面里而不是另开一个复杂工具 | 交易入口、营销式动效 |

Koyfin 作为图表观感的参照（专业、干净、密度高），但它的界面控件太多，只学图表本身，不学布局。

## 逐家：具体模仿哪几处

### 1. Perplexity：页面骨架
- 回答页顺序：问题 → 一行来源 → 结论段 → 嵌入的数据卡片 / 图 → 相关追问（我们用输入框代替追问按钮）。
- 来源是一排小标记，和正文分开，点开才展开。对应我们的「数字即引用」与一行取数摘要。
- 金融组件嵌在回答里，不跳转到另一个页面；追问后生成新的视图。和我们的「活报告 + 新版本」一致。
- 首页只有一个输入框和少量示例，没有功能入口墙。

### 2. Claude / ChatGPT：对话外壳与排版
- 阅读列约 720px 居中，正文 15–16px，行高宽松；用户消息是浅色气泡，回答不加气泡。
- 输入框悬浮在底部，圆角大、阴影轻，附件、模型等次要功能收进「+」。
- 结果对象（Claude 的 Artifacts、ChatGPT 的 Canvas）在侧边打开，对话不被挤掉。对应我们的看板抽屉：抽屉打开时对话列不变宽窄。

### 3. Fiscal.ai：金融图表
- 一张图配一张小表：图看趋势，表给精确值，读者不用悬停找数。
- 多公司对比用同一套标准化指标，标题写清指标与口径。
- 图表风格偏「研究报告」：少网格、直接标值。

### 4. Robinhood：给普通投资者的清晰度
- 一个关键数字放大到页面最显眼处，旁边一行变化（带颜色）。
- 对话层嵌在已有页面里（个股、持仓），用户不用切到「AI 工具」。对应我们：自选股 / 持仓页面里也能直接问。

## 国内产品

- **同花顺问财**：用户已经习惯「一句话 → 一张表」，我们的表格视图可以沿用这个心智；但它的结果页信息过密、按钮多，不学布局。
- **东方财富妙想**：追问按钮、诊股打分，和我们「少按钮、不荐股」相反，不学。

## 不模仿

- 诊股评分、买卖信号、目标价：越界，且与「数字只来自代码」冲突。
- 终端式高密度多面板布局（Bloomberg、Koyfin 的工作台）：与「简洁好理解」冲突。
- 回答里大段模型写的分析文字。

## 对现有改版样张的影响

改版主界面样张（https://claude.ai/artifact/EBTvcciqHDTcQ7CJ2xAu6g）已经是「Perplexity 骨架 + Claude 排版」：一行取数摘要紧贴问题（对应 Perplexity 的来源行），结论在前，图嵌在回答里。
只差一处可选：主图下的精确数值小表（学 Fiscal.ai）。为了不加按钮，建议不常驻，用户在对话里说「列出数值」时再出。

## 出处

- Perplexity Finance：[Techpoint 评测](https://techpoint.africa/guide/perplexity-finance-review/)、[Perplexity Computer 接入 Lightweight Charts](https://fxnewsgroup.com/forex-news/platforms/perplexity-computer-integrates-tradingviews-lightweight-charts/)
- Fiscal.ai：[WallStreetZen 评测](https://www.wallstreetzen.com/blog/finchat-io-fiscal-ai-review/)、[FinChat 更名 Fiscal.ai](https://daytradingtoolkit.com/reviews/finchat-review)
- Robinhood Cortex：[Robinhood 帮助页](https://robinhood.com/us/en/support/articles/cortex)
- Koyfin：[The CFO Club 评测](https://thecfoclub.com/it/tools/recensione-koyfin/)
- 竞品功能对照（2026-10-06）：https://claude.ai/artifact/4U2P222MGjzvMEtpLdxxg2
