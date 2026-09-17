# 区块复刻分支（block · L3）

本分支用于 `granularity=block`：由多个 primitive 组成、有明确 slots/区域拓扑、但不是整页 shell 的可复用组合段。

兼容锚点：宿主提供旧 D24 fidelity/invocation 与 D20 registry contract 时读取 block 条款；独立插件不假设固定仓库或绝对路径。缺失时使用随插件发行的 UI Distiller contracts/runtime，无法安全映射的旧字段 fail closed。

## 输入与路由

支持 `local-app`、公开 `web-url`、`asset-ref`。遇登录态返回 `needs-human-source`；无法解析 asset-ref 返回 `asset-ref-unresolved`。

`granularity=auto` 时，多 primitive 组合、有 slots/区域拓扑、但不含整页导航模型时进入本分支。若包含完整 shell、路由、导航模型和多个区块，转 `page`；若只是一件独立 primitive，转 `component`。

## Slots / 组合契约

区块复刻先写组合契约：

| 字段 | 要求 |
|---|---|
| `slots` | 每个 slot 的名称、职责、默认内容、empty 状态 |
| `layout` | 区域拓扑、尺寸行为、断点行为 |
| `children` | 内部 primitive 列表及对应 component fidelity 门 |
| `states` | 区块态与内部组件态如何组合 |
| `a11y` | heading、landmark、keyboard flow、focus trap（如有） |
| `registryType` | D20 映射为 `registry:block` |

## 流程

1. 采集区块边界、内部 primitive、slots、响应式断点和交互点。
2. 输出区块 source baseline 与组合契约。
3. 对内部每个 primitive 套用 component 分支的 `requiredStates` / a11y 清单。
4. 若 `reproductionDepth=source+adapt`，委托 `design-system-adapter` 映射到 Daren token、primitive、pattern。
5. 从当前宿主 `package.json` 发现并运行相关 machine gates（候选名：`tokens:lint`、`design-harness:check`、`design-harness:report`），不硬编码宿主路径。
6. 人工补齐响应式截图、截图对照、交互巡检和 slots 证据。
7. 返回结构化 `fidelityReport`。

## 验收门

机读门：

- 组合后整体 `tokens:lint` pass/fail。
- `design-harness:check` pass/fail。
- 结构/source report 已生成。
- slots 契约存在并映射到 Daren registry `registry:block`；不新增平行 registry type。

人工门：

- 内部 primitive 状态矩阵全覆盖，逐态留 `evidenceRef`。
- 大尺寸与响应式截图对照，人工看图并留 `evidenceRef`。
- 交互矩阵逐项点击巡检，留 `evidenceRef`。
- a11y 不降级，留 `evidenceRef`。

失败语义：

- 源不可达：`hard-fail`
- 登录态/私有源：`needs-human-source`
- block 边界无法裁决：`needs-human-granularity`
- 细粒度提取失败但可采整页：`fallback-to-page`
- 预算超限：返回降级状态并记录 `gaps`

本分支末尾必须链回 fidelity §3，并在 `fidelityReport.gates[]` 区分 `machine` 与 `manual`。
