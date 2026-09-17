# 组件复刻分支（component · L2）

本分支用于 `granularity=component`：一个可独立渲染的 primitive 或 field-level component，包含完整状态集和必要变体。组件可以来自 demo 页，但 scope 必须锁定为单件组件，不扩展成整页复刻。

兼容锚点：宿主提供旧 D24 fidelity/invocation、D17 machine-gate 与 D20 field-state contract 时读取 component 条款；独立插件不假设固定仓库或绝对路径。缺失时使用随插件发行的 UI Distiller contracts/runtime，无法安全映射的旧字段 fail closed。

## 输入与路由

支持 release contract 声明的本地来源、公共 HTTPS `web-url`、证据包，以及可解析的 `asset-ref`。URL 必须先按 `extract-web.md` 生成证据；无法解析 asset-ref 返回 `asset-ref-unresolved`。

`granularity=auto` 时，命中单一 primitive + 状态集即进入本分支。若源实际包含多 primitive 组合与 slots，转 `block`；若无法裁决，返回 `needs-human-granularity`。

## requiredStates / requiredVariants

组件复刻必须先写状态/变体清单，不使用“如适用”口头判断。默认 profile 来自 D24 fidelity contract 与 Daren blueprint 状态矩阵；调用方可用 `accept.fidelityProfile` 指定 profile。

基础状态：

- `default`
- `hover`
- `focus`
- `active`
- `disabled`
- `error`
- `loading`
- `empty`

字段类组件还必须覆盖 D20 的 view/edit 状态：

- `view`
- `edit`
- `readonly`
- `locked`
- `invalid`
- `loading`
- `conflict`

AI/agent 组件若 profile 声明，还需覆盖 pending、stale、evidence 或待确认态。

## 流程

1. 采集单组件 DOM/CSS/截图/计算样式与可见交互。
2. 记录 `requiredStates`、`requiredVariants`、a11y 要求和源证据。
3. 产出源版组件基准；保持源结构、视觉和交互用于对照。
4. 若 `reproductionDepth=source+adapt`，委托 `design-system-adapter` 映射到 Daren token、primitive、pattern。
5. 从当前宿主 `package.json` 发现并运行相关 machine gates（候选名：`tokens:lint`、`design-harness:check`、`design-harness:report`），不硬编码宿主路径。
6. 人工补齐状态截图、截图对照、交互巡检、a11y 记录。
7. 返回结构化 `fidelityReport`。

## a11y 保真

不得因复刻降低：

- focus ring 与键盘可达性
- aria 关系与 label
- contrast
- reduced-motion
- disabled 与 loading 的可感知反馈

## 验收门

机读门：

- `tokens:lint` pass/fail。
- `design-harness:check` pass/fail。
- 结构/source report 已生成。

人工门：

- `requiredStates` / `requiredVariants` 全覆盖，逐态留 `evidenceRef`。
- 截图 diff 由人看图确认，留 `evidenceRef`；v0.1 不做像素阈值。
- 交互矩阵逐项点击巡检，留 `evidenceRef`。
- a11y 不降级，留 `evidenceRef`。

失败语义：

- 源不可达：`hard-fail`
- 登录态/私有源：`needs-human-source`
- 单组件提取失败但可采页面：`fallback-to-page`
- 预算超限：返回降级状态并记录 `gaps`

本分支末尾必须链回 fidelity §2，并在 `fidelityReport.gates[]` 区分 `machine` 与 `manual`。
