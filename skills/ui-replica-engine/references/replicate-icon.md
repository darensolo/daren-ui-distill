# 图标复刻分支（icon · L1）

本分支只用于 `granularity=icon`。它是极轻路径：提取单个 SVG/path，normalize 到 Daren 图标规范，登记为 D11 候选；**不走**页面级 5 阶段应用复刻流程。

兼容锚点：宿主提供旧 D24 fidelity/invocation 与 D11 icon-governance contract 时读取 icon 条款；独立插件不假设固定仓库或绝对路径。缺失时使用随插件发行的 UI Distiller contracts/runtime，无法安全映射的旧字段 fail closed。

## 输入

必须有 `source`：

- `asset-ref`：调用方传入单个 SVG/path 或图标资产标识。
- `web-url`：公开页面上的单个 SVG/icon 节点；需登录态返回 `needs-human-source`。
- `local-app`：用户本机应用资源中的单个图标；若无法定位到单个资产，返回 `needs-human-granularity` 或转人工指定。

## License 前置

图标是 D24 唯一保留源图形的粒度，所以 license/source 证据是前置人工门：

- 受治理调用方必须经 `governanceRef.licenseRef` 或 `governanceRef.provenanceRef` 传入证据。
- 个人复刻自有图标也应记录来源。
- 无 license/source 证据时默认 HOLD，不落候选、不继续 normalize。

## 流程

1. 解析单个 SVG/path。
2. 记录来源：URL/文件路径、版本、license/source 证据、调用方 `governanceRef`。
3. Normalize：
   - 语义名使用 kebab-case。
   - `viewBox` 保留源形态；目标规范默认 Daren 24 网格。
   - 颜色改为 `currentColor`。
   - 尺寸使用目标 size token；不写死外来颜色。
   - 移除运行时无关 metadata。
4. 生成 D11 候选注册建议：
   - `suggestedKey`
   - `sourceName`
   - `sourceRef`
   - `licenseRef`
   - `normalizedSvgRef`
5. 产出 `fidelityReport`。

## D11 兼容规则

D11 禁止复制第三方 SVG 整库。icon 分支只允许按需处理单个图标：

- 不复制整套图库。
- 不把来源不清图标直接收为 stable。
- 默认落 D11 registry 候选，由 D11 收录流程决定是否转长期资产。

## 验收门

机读门：

- SVG normalize lint：kebab-case、单色 `currentColor`、网格/描边合规。

人工门：

- license/source 证据已记录到 `evidenceRef`。
- D11 候选注册建议去重且语义名合法。

返回失败语义：

- 源不可达：`hard-fail`
- 登录态/私有源：`needs-human-source`
- 资产引用无法解析：`asset-ref-unresolved`
- 输入不是单图标或歧义：`needs-human-granularity`

本分支末尾必须链回 fidelity §1，并在 `fidelityReport.gates[]` 区分 `machine` 与 `manual`。
