# Research Canvas 产品需求文档 PRD

## 1. 产品目标

Research Canvas V1 解决：

> **研究人员从“研究问题”到“可观察数据视图”之间的机械数据处理问题。**

核心产品指标：

> **Time to Insight**

即从用户提出问题到看到可以用于分析的数据图表所需要的时间。

目标：

```text
传统流程
10–30 min

↓

Research Canvas
<30 sec
```

---

## 2. 核心用户故事

### User Story 1：横向比较

用户：

> 比较赛轮、玲珑、森麒麟 2025 年毛利率。

系统自动创建：

```text
Bar Chart
+
Data Table
```

---

### User Story 2：历史趋势

用户：

> 看一下过去五年的变化。

系统：

```text
2021–2025
Line Chart
```

---

### User Story 3：增加指标

用户：

> 再看看净利率。

系统：

```text
create_widget(
  type = line_chart,
  metric = net_margin
)
```

---

### User Story 4：修改公司

用户：

> 加入贵州轮胎。

系统更新相关 Dataset。

---

### User Story 5：修改视图

用户：

> 把这个改成柱状图。

系统：

```text
Line Chart
↓
Bar Chart
```

Dataset 不变。

---

### User Story 6：删除数据

用户：

> 把玲珑去掉。

系统：

```text
Dataset
entities -= Linglong
↓
All linked widgets refresh
```

---

### User Story 7：导出

用户：

> 把这些导出 Excel。

系统生成：

```text
Research.xlsx
```

---

## 3. 页面结构

### 3.1 全局布局

桌面端优先。

```text
┌─────────────────────────────────────────────────────┐
│ Logo / Project                         Export Excel │
├─────────────────┬───────────────────────────────────┤
│                 │                                   │
│                 │                                   │
│  Agent Panel    │          Research Canvas          │
│                 │                                   │
│                 │                                   │
│                 │                                   │
└─────────────────┴───────────────────────────────────┘
```

比例：

```text
Agent
25%

Canvas
75%
```

允许用户拖动中间 divider 调整比例。

---

## 4. Agent Panel

### 4.1 输入

用户可以输入自然语言：

```text
比较赛轮、玲珑、森麒麟过去5年的毛利率
```

输入框支持：

* Enter 发送
* Shift+Enter 换行
* 历史上下文

V1 暂不支持：

* 图片
* 文件
* 语音

---

## 5. Agent 状态

不要展示完整 Chain of Thought。

只展示任务状态：

```text
Understanding request
✓

Resolving companies
✓

Resolving metrics
✓

Fetching data
●

Building views
○
```

目标：

让用户知道系统正在执行什么。

而不是展示模型内部推理。

---

## 6. Intent Schema

用户输入首先转换为：

```json
{
  "entities": [
    "赛轮轮胎",
    "玲珑轮胎",
    "森麒麟"
  ],
  "metrics": [
    "gross_margin"
  ],
  "period": {
    "start": "2021",
    "end": "2025"
  },
  "comparison": "timeseries",
  "preferred_view": "line_chart"
}
```

AI 只负责：

> **理解语义。**

不能直接生成最终数据。

---

## 7. Entity Resolver

负责：

```text
赛轮
↓
赛轮轮胎
↓
601058.SH
```

标准 Entity：

```json
{
  "id": "601058.SH",
  "name": "赛轮轮胎",
  "market": "CN",
  "type": "equity"
}
```

必须解决：

* 简称
* 全称
* 股票代码
* 常见别名

---

## 8. Metric Resolver

建立统一 Metric Registry。

例如：

```json
{
  "id": "gross_margin",
  "name": "毛利率",
  "aliases": [
    "销售毛利率",
    "毛利水平"
  ],
  "unit": "%",
  "type": "ratio",
  "preferred_chart": "line"
}
```

第一版建议支持：

| Metric ID           | 中文    |
| ------------------- | ----- |
| revenue             | 营业收入  |
| revenue_growth      | 营收增速  |
| net_income          | 归母净利润 |
| net_income_growth   | 净利润增速 |
| gross_margin        | 毛利率   |
| net_margin          | 净利率   |
| roe                 | ROE   |
| operating_cash_flow | 经营现金流 |
| debt_ratio          | 资产负债率 |
| capex               | 资本开支  |

第一版控制在：

> **10–20 个指标。**

---

## 9. Dataset

Dataset 是产品的核心对象。

一个 Dataset：

```json
{
  "id": "dataset_001",
  "title": "主要轮胎公司毛利率",
  "metric": "gross_margin",
  "unit": "%",
  "entities": [
    "601058.SH",
    "601966.SH",
    "002984.SZ"
  ],
  "period": {
    "start": "2021",
    "end": "2025"
  },
  "data": [],
  "sources": []
}
```

重要原则：

> **Data 与 View 分离。**

一个 Dataset 可以同时用于：

```text
Line Chart
Bar Chart
Table
Excel
```

---

## 10. Canvas Widget

统一 Widget Schema：

```json
{
  "id": "widget_001",
  "type": "line_chart",
  "title": "主要轮胎公司毛利率趋势",
  "datasetId": "dataset_001",
  "config": {},
  "layout": {
    "x": 0,
    "y": 0,
    "w": 6,
    "h": 4
  }
}
```

---

## 11. Widget 类型（ECharts）

研究画布图种全部走 ECharts；行情详情页 lightweight-charts 保留，画布 K 线用 `candlestick`。

| type | 场景 |
|------|------|
| `line_chart` | 时间序列、趋势 |
| `bar_chart` | 最新一期排名、截面对比 |
| `stacked_bar` | 多公司按期堆积（绝对值） |
| `stacked_bar_percent` | 多公司按期堆积（每期 100%） |
| `combo_bar_line` | 柱 + 均值折线 |
| `pie_chart` / `donut_chart` | 最新一期构成（仅正值） |
| `candlestick` | 日 K（`query_data` + `metric=kline`，Dataset 含 `ohlc[]`） |
| `table` | Dataset 明细 |
| `sources` | 数据来源 |

改图种走 `propose_widget`（同一 `datasetId`）；K 线需先 `query_data(metric=kline)`。

---

## 12. Canvas 交互

用户直接操作：

### Drag

拖动 Widget。

### Resize

自由调整大小。

### Delete

删除 Widget。

### Duplicate

V1 可不做。

### Change Chart

对话内改图种：`propose_widget`（折线 / 柱状 / 堆积 / 饼图 / 圆环 / 柱线混合 / K 线 / 表格）。右侧已有图改数据范围才 `update_widget`。

### Save Layout

用户布局自动保存。

---

## 13. Agent 操作 Canvas

Agent 拥有三个 Canvas Tool：

```text
create_widget
update_widget
delete_widget
```

### create_widget

例如：

用户：

> 再加一个净利率趋势。

Agent：

```json
{
  "action": "create_widget",
  "metric": "net_margin",
  "entities": [
    "601058.SH",
    "601966.SH",
    "002984.SZ"
  ],
  "period": {
    "start": "2021",
    "end": "2025"
  },
  "view": "line_chart"
}
```

### update_widget

用户：

> 改成柱状图。

```json
{
  "action": "update_widget",
  "widgetId": "widget_001",
  "changes": {
    "type": "bar_chart"
  }
}
```

### delete_widget

```json
{
  "action": "delete_widget",
  "widgetId": "widget_001"
}
```

---

## 14. 数据来源展示

每一个 Dataset 必须记录：

```text
Provider
Metric
Company
Period
Updated Time
```

V1 不要求做到财报页码级引用。

但必须做到：

> 用户知道数据来自哪里。

---

## 15. Excel Export

点击：

> Export Excel

生成：

### Sheet 1 — Dashboard

当前 Canvas 中的图表。

V1 可以先：

> 图表以高清图片插入。

### Sheet 2 — Data

所有 Dataset。

例如：

| Company | Year | Gross Margin |
| ------- | ---: | -----------: |
| Sailun  | 2021 |        18.2% |
| Sailun  | 2022 |        21.1% |

### Sheet 3 — Sources

| Dataset | Provider | Metric | Updated |
| ------- | -------- | ------ | ------- |

---

## 16. UI 风格

整体：

> **Dark Glass Financial Workspace**

视觉关键词：

```text
Dark
Glass
Quiet
Professional
High information density
Low decoration
```

参考：

* AInvest 的 Workspace 逻辑
* Codex / IDE 的左右分栏
* Apple 的玻璃层次
* 专业金融终端的信息密度

避免：

* 大面积渐变
* AI机器人形象
* 聊天气泡过重
* 赛博朋克
* 大量发光
* 花哨 animation

Canvas 才是视觉主角。

---

## 17. MVP 验收标准

必须通过以下 Demo：

```text
1.
用户：
比较赛轮、玲珑、森麒麟过去5年的毛利率

→
真实获取数据
→
生成 Line Chart
→
生成 Table


2.
用户：
加一个最新年度毛利率排名

→
生成 Bar Chart


3.
用户：
删掉玲珑

→
相关 Dataset 更新
→
图表同步更新


4.
用户：
把趋势图改成柱状图

→
View 更新
→
不重复取数


5.
用户拖动 Widget

→
刷新后布局仍然存在


6.
Export Excel

→
正常生成文件
```

做到这六件事，V1 即结束。
