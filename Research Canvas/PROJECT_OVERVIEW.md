# Research Canvas 项目文档

> **实现进度以 [`HANDOFF.md`](./HANDOFF.md) 为准（2026-09-12：Phase 4C.5 Chat 流式 UX + Composer 已完成）。** 本文档描述产品愿景与 V1 边界；阶段验收、代码地图、门禁见交接文档。

## 1. 项目名称

**Research Canvas**

副标题：

> **Ask for data. Get the view.**

中文定位：

> **面向投研场景的 AI 原生数据分析画布。**

---

## 2. 项目背景

传统行业研究和公司研究中，分析师在形成观点之前，往往需要经历大量重复、机械的数据处理工作。

典型工作流：

```text
提出研究问题
↓
打开 Wind / iFinD
↓
搜索指标
↓
选择公司和时间范围
↓
导出 Excel
↓
清洗与整理
↓
套模板
↓
制作图表
↓
观察数据
↓
形成判断
```

例如：

> “我想比较赛轮轮胎、玲珑轮胎、森麒麟过去五年的毛利率。”

分析师真正想做的是：

> **观察不同公司的毛利率变化，并形成判断。**

但在真正进入分析前，需要完成大量：

* 找数据
* 配字段
* 导 Excel
* 整理表格
* 调格式
* 做图
* 修改时间范围

等低价值工作。

Research Canvas 的目标，是压缩这段工作流。

---

## 3. 核心问题

Research Canvas 要解决的不是：

> AI 能不能帮用户分析股票。

而是：

> **用户已经知道自己想研究什么，能否直接通过自然语言，把研究意图转换成可观察的数据视图？**

目标流程：

```text
Research Question
↓
AI Understands Intent
↓
Fetch Data
↓
Generate Dataset
↓
Build Canvas
↓
Human Observes
↓
Export Excel
```

例如：

用户输入：

> 比较赛轮、玲珑和森麒麟过去五年的毛利率和营收增长。

系统直接生成：

```text
毛利率趋势图
+
营收增长趋势图
+
最新年度横向排名
+
原始数据表
+
数据来源
```

用户不再需要：

> Wind → Excel → Chart

而是：

> **Question → Canvas**

---

## 4. 产品定位

Research Canvas 不是：

* Bloomberg / Wind 替代品
* AI 股票推荐工具
* 自动交易系统
* 通用 BI 平台
* AI 自动研报生成器

它是：

> **AI 驱动的 Research Data Workspace。**

更具体：

> **通过自然语言调用金融数据，并自动形成可操作、可调整、可导出的分析看板。**

---

## 5. 核心用户

第一阶段目标用户：

### 核心用户

* 券商行业研究实习生
* 买方研究实习生
* 战略 / 商业分析实习生
* 金融专业学生
* 个人深度投资者

### 用户共同特征

用户：

* 会分析
* 知道自己想看什么
* 但不想把大量时间花在数据整理和画图上

所以产品不是替代用户判断。

而是：

> **让用户更快进入判断。**

---

## 6. 核心价值主张

传统金融数据工具解决：

> **“数据在哪里？”**

Research Canvas 解决：

> **“把我脑子里的研究问题直接变成数据视图。”**

核心价值可以概括成：

```text
Natural Language
        ↓
Financial Data
        ↓
Visual Research Workspace
        ↓
Editable Deliverable
```

---

## 7. 产品核心体验

整个产品只有两个主要区域。

```text
┌───────────────────────────────────────────────────┐
│ Research Canvas                                   │
├──────────────────┬────────────────────────────────┤
│                  │                                │
│                  │                                │
│    AI Agent      │          Canvas                │
│                  │                                │
│    Conversation  │     Chart / Table / Source    │
│                  │                                │
│                  │                                │
├──────────────────┴────────────────────────────────┤
│                                        Export     │
└───────────────────────────────────────────────────┘
```

### 左侧

AI Research Agent。

负责：

* 理解用户研究意图
* 判断公司
* 判断指标
* 判断时间范围
* 调用数据
* 创建 / 修改 Canvas

### 右侧

Research Canvas。

展示：

* Bar Chart
* Line Chart
* Table
* Sources
* 后续其他 Widget

所有 Widget：

* 可拖动
* 可缩放
* 可删除
* 可调整位置
* 可导出

---

## 8. MVP 场景

第一版只跑通一个最典型场景：

> **上市公司财务指标横向 / 时间序列比较**

例如：

用户输入：

> 对比赛轮轮胎、玲珑轮胎、森麒麟 2021–2025 年毛利率。

系统：

```text
1. 识别公司
2. 识别 metric = gross_margin
3. 识别 period = 2021–2025
4. AKShare 取数
5. 标准化 Dataset
6. 生成折线图
7. 生成数据表
8. 展示数据来源
```

随后用户：

> 再加一个营收增长。

系统创建第二个 Widget。

用户：

> 把玲珑删掉。

两个相关 Widget 自动更新。

用户：

> 把毛利率改成柱状图。

只改变视图，不重新请求数据。

最后：

> 导出 Excel。

获得：

```text
Research.xlsx

Dashboard
Data
Sources
```

---

## 9. MVP 功能边界

### 必须做

#### Agent

* 自然语言输入
* 公司识别
* 指标识别
* 时间范围识别
* 调用数据
* 操作 Canvas

#### Canvas

支持四种 Widget：

```text
Bar Chart
Line Chart
Table
Sources
```

支持：

```text
Create
Update
Delete
Move
Resize
Save Layout
```

#### 数据

第一版：

> AKShare

主要覆盖：

* 营业收入
* 营收增长
* 净利润
* 毛利率
* 净利率
* ROE
* 经营现金流
* 资产负债率

第一版不追求所有指标。

#### 导出

Excel：

* Dashboard
* Data
* Sources

---

## 10. 暂不做

MVP 明确不做：

```text
实时行情
交易
账户连接
Portfolio
量化策略
回测
选股器
期权
自动荐股
社区
复杂 RAG
新闻系统
大量 Skills
多 Agent
OpenBB 全量迁移
Wind 接口
iFinD 接口
```

判断原则：

> **任何不能直接证明“Question → Data View → Excel”价值的功能都不进入 V1。**

---

## 11. 产品成功标准

V1 不以用户量衡量。

只看一个指标：

> **能否完整跑通一个真实投研数据工作流。**

Demo 验收：

```text
输入：
比较三家公司过去五年毛利率

↓

10–30 秒内

↓

生成：
趋势图
数据表
来源

↓

用户：
再加营收增长

↓

生成新 Widget

↓

用户：
删掉某家公司

↓

Canvas 更新

↓

Export Excel

↓

得到可继续使用的数据文件
```

这条流程稳定运行，即视为 MVP 成功。

---

## 核心架构

> **Opptrix 提供 Agent / App 骨架；OpenBB 只借鉴 Data Provider 架构思想；AKShare 提供第一版真实数据；react-grid-layout + ECharts 提供 Canvas；Excel Export 完成交付闭环。**
