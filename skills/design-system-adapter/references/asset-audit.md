# Design Asset Audit

在适配前先做资产审计。目标是自动比较「本次输入界面里的好资产」和「目标设计系统已有资产」，提出查缺补漏建议。此阶段只输出建议，不改代码、不改设计系统真源。

## 输入

- 输入界面：Source Replica / 现有页面 / 原型 / 截图 / 代码。
- 输入界面的计划或验收记录：若来自 `app-replica`，读取阶段 0.5 plan、Source Replica 验收记录和交互矩阵。
- 目标设计系统资产：
  - L1 Foundations / Tokens：token 真源、生成 CSS、主题规则。
  - L2 Components：primitive / component specs。
  - L3 Blocks：复合区段、字段组、工具栏、状态栏、dock 片段、review/evidence 区段等。
  - L4 Templates：页面骨架、应用壳、工作台 shell、设置页 / 列表页 / 详情页模板。
  - Pattern 横轴：场景化模式、交互反馈、空态、错误态、菜单、split 等。

## 审计流程

1. **提取输入界面资产。**
   - L1：颜色、字号、间距、圆角、阴影、动效、主题变量。
   - L2：按钮、tab、tree row、menu、popover、split、status item、input。
   - L3：tab group 区段、side dock 片段、文件树区段、命令面板区段、toolbar / statusbar / evidence panel。
   - L4：app shell、workbench shell、设置页、详情页、折叠布局、响应式结构。
   - Pattern 横轴：空态、resize/collapse、权限 / 错误反馈、确认流、渐进披露。
2. **对照设计系统现有资产。**
   - 查 token 是否有对应语义。
   - 查 primitive 是否覆盖状态和 a11y。
   - 查 pattern 是否覆盖场景行为。
   - 查 template 是否覆盖页面骨架。
3. **分类判断。**
   - `covered`：现有设计系统已覆盖，可直接复用。
   - `partial`：已有资产方向对，但缺状态、尺寸、平台或示例。
   - `missing`：设计系统没有对应资产。
   - `better-than-current`：输入界面的做法明显比现有设计系统成熟。
   - `local-only`：只适合当前页面，不建议进入设计系统。
4. **输出 Evolution Proposal 草案。**
5. **等待人工确认。**

## 审计表

| ID | 层级 | 输入资产 | 来源证据 | 设计系统现状 | 判断 | 建议 | 风险 | 是否执行 |
|---|---|---|---|---|---|---|---|---|
| AUD-001 | Pattern | <Tab Group Pattern> | <Source Replica / 截图 / 交互矩阵> | <现有 pattern> | better-than-current | 扩展 tab group pattern | 不引入源应用品牌视觉 | 待确认 |

`是否执行` 只能是：

- `pending-human`：待人工确认。
- `accepted`：本轮执行。
- `backlog`：进入设计系统 backlog，本轮不执行。
- `rejected`：拒绝。
- `local-only`：留在页面，不进入设计系统。

## Evolution Proposal 格式

```text
EVO-001 · Pattern · <资产名>
来源：<输入界面 / 截图 / 代码 / 用户反馈>
判断：covered | partial | missing | better-than-current | local-only
建议：reuse | extend | new-candidate | local-only | not-now
理由：<为什么值得吸收或为什么不吸收>
风险：<品牌视觉、复杂度、平台约束、命名冲突>
建议执行：待人工确认
```

## 人工确认规则

未经人工确认，不允许：

- 修改设计系统 token 真源。
- 新增 / 修改 primitive spec。
- 新增 / 修改 pattern recipe。
- 新增 / 修改 template shell。
- 把某次复刻里的偶然规则推广成全局规则。

人工确认后，才允许进入 `adapter-plan.md` 的执行任务，或进入 `evolution-loop.md` 的 Design System Update。
