# Design System Evolution Loop

每次适配页面都是设计系统进化的素材来源。不要只把页面改完；要判断这次实践是否暴露出值得沉淀的资产。

Evolution 默认产出 **Proposal**，不是自动修改设计系统。只有人工确认后的项，才进入 Design System Update。

先经过 Harness ROI Gate：Lite / Normal 任务默认不触发设计系统演进；只有跨页面复用、template / Asset Hub、复杂表格 / 对象数据、layout recipe、token 真源或 harness/gate 变更，才需要 Evolution Proposal。

## 分类

| 分类 | 含义 | 处理方式 |
|---|---|---|
| `reuse` | 现有设计系统资产已经覆盖 | 记录使用证据，必要时补示例 |
| `extend` | 现有资产方向正确，但缺状态 / 尺寸 / 场景 | 提出扩展项，附适用范围 |
| `new-candidate` | 出现新的可复用资产 | 建候选规范，先不直接合并 |
| `local-only` | 只适合当前页面 | 留在页面，不进入设计系统 |
| `not-now` | 可能有价值，但证据不足或时机不对 | 记录原因，等待更多页面验证 |

## L1 Foundations 候选

适合反哺的情况：

- 多个页面重复需要同一语义色、surface、border、focus、motion。
- 现有 token 无法表达某个稳定语义，只能临时硬编码。
- 明暗主题切换暴露出 token 粒度不足。

候选格式：

| 候选 token | 层级 | 语义 | 来源证据 | 建议值 / 映射 | 使用范围 | 风险 |
|---|---|---|---|---|---|---|

## L2 Components 候选

适合反哺的情况：

- 同一种控件组合在多个页面重复出现。
- primitive 缺状态、尺寸、a11y、键盘或菜单行为。
- 页面里出现了“自己写 div + onClick”的可复用控件。

候选格式：

| 候选组件 | 来源证据 | 解决的问题 | API 草案 | 状态覆盖 | 依赖 token | DO / DON'T |
|---|---|---|---|---|---|---|

## Pattern 横轴候选

适合反哺的情况：

- 不是单个控件，而是一组组件解决同一类 UX 问题。
- 包含明确状态流：empty / loading / error / permission / disabled / batch / collapse / resize。
- 可复用到多个页面或产品模式。

候选格式：

| 候选 pattern | UX 问题 | 适用场景 | 组成组件 | 状态流 | 验收标准 | 反模式 |
|---|---|---|---|---|---|---|

## L4 Templates 候选

适合反哺的情况：

- 出现可复用的整页工作台、列表页、设置页、详情页、应用壳。
- 页面级布局能让团队“填内容即可开工”。
- 具有稳定的响应式 / 折叠 / split / panel 规则。

候选格式：

| 候选 template | 页面问题 | 区域拓扑 | 默认焦点 | 适用产品 | 依赖 patterns | 验收标准 |
|---|---|---|---|---|---|---|

## 触发时机

Evolution 由三个时机触发：

1. **适配前审计**：执行 `asset-audit.md`，比较输入界面资产和设计系统现有资产。
2. **适配中发现**：实现时发现更好的状态、模式、组件或模板缺口，补进 Proposal。
3. **适配后复盘**：验收完成后输出 Evolution Report；即使没有候选，也必须写“本次无新增候选”。

不要把一次性页面修补、局部 CSS 调整、普通状态补齐自动登记为 Asset Hub 或新 contract。若任务只是 Lite / Normal，最终说明“本次无 design-system backflow”即可。

## 决策门槛

进入人工确认前，候选资产至少满足：

1. 有明确来源证据，不是主观偏好。
2. 能描述解决的 UX 问题。
3. 至少有一个当前页面使用场景，最好有第二个潜在复用场景。
4. 有 DO / DON'T 和验收标准。
5. 不破坏现有 token / component / pattern 命名体系。
6. 能被浅 / 深色主题和目标平台约束覆盖。

进入设计系统真源前，还必须满足：

1. 用户明确确认 `accepted`。
2. 已写入 Adapter Plan 的执行任务。
3. 有回滚方式或影响范围说明。
4. 修改后能通过设计系统自身验收。
5. 已从当前 `package.json` 核对并运行相关 gate；Asset Hub 走 `asset-hub:check`，layout recipe 走 `layout-recipe:check`，表格走 `table-layout:check`，对象数据走 `object-data-recipe:check`，聚合证据走 `design-gates:report`。

## 输出 Evolution Proposal / Report

| ID | 层级 | 候选资产 | 审计判断 | 推荐动作 | 人工状态 | 证据 | 下一步 |
|---|---|---|---|---|---|---|---|
| EVO-001 | Pattern | <pattern name> | better-than-current | extend | pending-human | <页面 / 交互 / 截图> | <补规范 / 补组件 / 暂缓> |

`人工状态` 只能是：

- `pending-human`
- `accepted`
- `backlog`
- `rejected`
- `local-only`
- `not-now`

最终交付时要说明：

- 本次适配复用了哪些现有资产。
- 哪些资产建议扩展。
- 哪些资产建议新增候选。
- 哪些想法被判定为 local-only，不进入设计系统。
- 哪些候选已被人工确认，哪些仍待确认。
