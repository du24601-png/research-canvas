# finframe-snapshot-v1：真实数据的时点快照

- **性质**：真实数据，时点快照，不会随上游更新。取数时间见 `manifest.json` 的 `fetchedAt`（2026-10-09）。
- **来源**：应用自己的取数路径（`ResearchHub` + `query_data`，`confirmed: true`）。Provider 为 `tushare`，每个数据点的 provider / period / fetchedAt 都写在各文件的 `sources` 里。
- **范围**：11 家 A 股（seed-v1 用到的公司，加上 Demo C「平安」对应的中国平安和平安银行）× 净利率 / ROE / 毛利率 × 2021–2025 年报。
- **覆盖**：净利率 55/55、ROE 55/55、毛利率 40/55。缺的 15 格是招商银行、平安银行、中国平安：银行和保险没有毛利率，按 null 记，不补。
- **注意**：
  - 实体名按解析器原样保存，海天味业显示为「佛山市海天调味食品」，华虹公司显示为「华虹宏力」（取数时用代码 688347）。
  - 第一次三个指标并行取数被上游限频，大面积缺值；脚本已改为逐个指标串行并间隔 65 秒。
- **重取**：`node eval/finframe/snapshot/fetch-snapshot.mjs`。重取会覆盖本目录，应升版本号另存。
- **用途**：数字层评测和 Demo 用。策略层评测继续用合成夹具 `finframe-synth-v1`。
