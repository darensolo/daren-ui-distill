---
name: design-system-adapter
description: "Use when planning or performing UI creation, editing, or adaptation against Daren Design, including Source Replicas, token cleanup, and internal golden-page recipe distillation. Pure inspection of an existing asset routes to ui-audit-repair."
metadata: {"skill_id":"design-system-adapter","governance_status":"active","required_references":["references/quick-start.md"],"optional_references":["references/token-governance.md","references/component-pattern-routing.md","references/asset-audit.md","references/adapter-plan.md","references/evolution-loop.md","references/page-assembly-sop.md","references/component-detail-golden-page.md","references/distiller-integration.md"],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# Design System Adapter

只有用户明确要求用 UI Distiller 适配已有 AssetPackage / Source Replica 时，才读取 `references/distiller-integration.md`。终点只是“检查现有资产/是否符合 Daren”时统一走 `ui-audit-repair`；本 skill 的 review 仅服务于即将实施的创建、修改或适配，不自动创建 adapt job。

把任何 UI 工作拉回 Daren Design，防止页面方言和 token 漂移。若当前项目没有 Daren Design 真源，只能交付 Source Replica 或使用调用方显式提供的版本化 `targetRef`；不得假设某个宿主仓库路径存在。

这个 skill 有两种执行强度和四档 Harness 闸门：

- **Govern**：普通 UI 改动 / review / token 清理。先读最小规则，直接执行并验证。
- **Adapt + Evolve**：把已有界面、原型、复刻件或 Source Replica 迁入设计系统，并提炼可反哺资产。

内部 golden page 的 recipe / model-instance 提炼归 `Adapt + Evolve`：读取 `asset-audit.md`，涉及页面配方时再读 `page-assembly-sop.md`。最小输出固定为 L1-L4 Snapshot、含字段投影与状态策略的 Model Instance Draft、Interaction Matrix、带 `reuse | extend | new-candidate | local-only | not-now` 和 `pending-human` 的候选清单、Harness Calibration。默认只交付 proposal；除非明确调用 UI Distiller，不产出 C9 Blueprint。

## Harness ROI Gate

先定档，再决定读多少真源、跑多少 gate。Harness 是防漂移系统，不是每个普通界面的合规海关。

| 档位 | 适用任务 | Fit Packet | 验证 |
|---|---|---|---|
| **Lite** | 文案、轻微样式、已有 primitive 的小改动；不改 token / pattern / template | 口头说明 primitive + token；不要求完整表格 | 最小直接 smoke / static / unit；typecheck、`tokens:lint` 仅在相关时选用 |
| **Normal** | 普通页面、表单、弹层、列表、状态补齐 | Mini Fit Packet：primitive、pattern、states、overflow、verification | 从 token/harness/DOM/browser 中选择能发现本次失败的最小项 |
| **Reusable Pattern** | 可复用组件、跨页面 pattern、模板候选、Asset Hub 条目 | 完整 Fit Packet + evolution 判断 | 只运行受影响的 asset/harness/report 或一条必要交互 smoke |
| **Full Contract** | token 真源、harness/gates、复杂表格、对象数据、layout recipe、设计系统真源 | 完整 Fit Packet + Harness / gate calibration | 首次验证可更强，但仍只选受影响 recipe/gate/build；同一候选不重复 |

普通 UI 不得主动引入新 contract。只有高复用、跨页面、复杂表格 / 对象数据、Agent 写回、Asset Hub / template、设计系统真源或 harness/gate 变更，才进入 Reusable Pattern 或 Full Contract。

## 核心规则

- **先读原则和 tokens。** 每次 UI 工作至少读取 `references/quick-start.md`。
- **一纵一横判断。** 纵轴按 L1 Foundations / Tokens、L2 Components、L3 Blocks、L4 Templates 判断；Patterns 是横切方法层，不占用 L 编号。不要只改颜色。
- **设计系统优先。** 复用已有 token、primitive、pattern、template；缺项先记录候选，不在业务页面里散落临时规则。
- **Fit Packet 先行。** UI 实现前先产出 Design System Fit Packet；L2/L3/L4 的“已查”必须附 `file + exported symbol` 或 spec section，Pattern 轴必须附文件或 spec section，不能只写口头勾选。
- **结构和交互不无计划漂移。** 适配已有界面时，不得随意改变拓扑、关键状态流或主交互；必须改时写入计划和验收。
- **反哺不是自动合并。** 候选资产先提出 Proposal；只有 Daren 明确确认后，才写设计系统真源。
- **缺资产先问。** 如果没有现成组件或模式，先停下问 Daren：走 D13 external/intake、D12 primitive proposal、D11 icon registry，还是一次性 local-only 豁免。
- **验证必须直接命中风险。** 采用 single-pass evidence：从静态断言、单测、token/harness、build、DOM/computed-style 或浏览器旅程中选择能发现本次失败的最小集合。build/typecheck/browser 不默认捆绑；同一候选已运行的有效结果不重复。`daren-design` 只有在 protected primitive source/import 或 harness 受影响时才选择 `design-harness:check`。
- **不滥用 Full Harness。** Lite / Normal 任务不得因为站点存在 D34/D36/D35 inspector 就默认读取或修改这些 contract；只在任务实际涉及表格、对象数据、layout recipe 或 gate 时使用。

## 渐进式读取

始终从最小上下文开始，不要一次性读取整个 `daren-design/`。

1. **所有 UI / 前端任务必读**：`references/quick-start.md`
2. **涉及颜色、字号、间距、圆角、阴影、动效、主题、裸 CSS 值**：再读 `references/token-governance.md`
3. **涉及按钮、输入、菜单、弹窗、表格、列表、工作台、Agent Dock、编辑器 surface**：再读 `references/component-pattern-routing.md`
4. **迁移 / 复刻 / 大面积改造 / 用户要求“检查全页面”**：再读 `references/asset-audit.md` 和 `references/adapter-plan.md`
5. **发现可复用新模式或要改设计系统真源**：再读 `references/evolution-loop.md`
6. **从面级组装/改造整个工作台页面或 surface（worksheet / note / canvas / dock / review），或要求"按 UIOM/LOM 严格构建页面"**：再读 `references/page-assembly-sop.md`
7. **创建、升级、评审 Daren Design 组件详情页或组件 golden page**：再读 `references/component-detail-golden-page.md`

## Daren Design 真源

- L1 token 数据：`daren-design/design-tokens/tokens/semantic.json`
- 生成 token CSS：`daren-design/src/styles/generated-tokens.css`
- token 展示数据：`daren-design/src/daren-design/registry/data/tokens.ts`
- 分层原则：`daren-design/src/daren-design/registry/data/design-layers.ts`
- 组件规则：`daren-design/src/daren-design/registry/data/components.ts`
- Design Gates：`daren-design/src/daren-design/registry/data/design-gates.ts`
- 通用 UX / 交互：`daren-design/src/daren-design/registry/data/ux-patterns.ts`、`interactions.ts`
- Client 模式：`daren-design/src/daren-design/extensions/client/data/client-patterns.ts`
- Admin 模式：`daren-design/src/daren-design/extensions/admin/data/patterns.ts`
- Agent UI 模式：`daren-design/src/daren-design/extensions/agent/sections/AIAgentUISection.tsx`
- AI 反模式和工具链说明：`daren-design/src/daren-design/registry/data/ai-guide.ts`

旧路径如 `docs/design/daren-design/daren-design.md` 或 `daren-design/src/core/...` 只可作为历史线索，不作为当前真源。

## 执行路径

### 普通 UI 改动 / token 清理

1. 读取 `quick-start.md`，必要时读取 token / component-pattern references。
2. 先定 Harness ROI Gate 档位；Lite / Normal 不默认读取 Full Contract 真源。
3. 定位页面实现、当前 token 真源、可复用 primitive / pattern / template。
4. 在写代码前输出对应档位的 Design System Fit Packet（见下节）。
5. 先列出不合规项：硬编码颜色、任意 spacing/font/radius、绕过 primitive、pattern 漂移、主题风险、响应式风险。
6. 用当前宿主提供的精确 patch/edit 工具做最小范围整改。
7. 运行能直接覆盖本次风险的最小检查；候选已有有效证据直接复用。
8. 汇报改动、验证和剩余风险。

## Design System Fit Packet

Normal 及以上 UI / frontend / prototype / component 改动在实现前必须给出 Fit Packet。Lite 任务可用 1-2 句话说明 primitive、token 和验证方式。Fit Packet 是 proof-of-work，不是自报勾选。

### Mini Fit Packet

| 字段 | 要求 |
|---|---|
| Primitive | 实际 import path + symbol；若无 primitive，说明 waiver。 |
| Pattern | 复用的 pattern / 页面骨架；若无，说明 local-only。 |
| States | default / hover / focus-visible / disabled / loading / empty / error / selected 等相关状态。 |
| Overflow / sizing | hug-content / fill-container / bounded-fluid / scroll-contained / collapse-or-overlay。 |
| Verification | 已从当前 `package.json` 核对脚本；列将运行的最小 gate / smoke。 |

### Full Fit Packet

| 字段 | 要求 |
|---|---|
| Surface / component class | 例如 `statusbar badge`、`dropdown menu`、`popover panel`、`Agent Dock confirmation list`。 |
| L1 tokens checked | 颜色、字号、间距、圆角、阴影、动效、focus 等相关 token。 |
| L2 primitives checked | 已查 primitive，必须附 `file + exported symbol`，例如 `src/components/ui/dropdown-menu.tsx#DropdownMenuContent`。 |
| Actual primitive source | 实际实现使用的 import path + symbol；若来自 local helper 而非允许源，必须有 waiver。 |
| L3 blocks checked | 已查 block，必须附 `file + exported symbol`；若不涉及区块，说明 no block impact。 |
| Pattern axis checked | 已查 pattern，必须附文件或 spec section。 |
| L4 template impact | 判断是否影响三栏 shell、dock、workspace、statusbar 等页面骨架。 |
| Decision | `reuse` / `compose` / `local-only` / `proposal-needed`。 |
| Missing asset route | 若为 `local-only` 或 `proposal-needed`，记录已问 Daren，并标明 D13 / D12 / D11 / local-only 路线。 |
| Verification evidence | 计划运行的 build、`tokens:lint`、`design-harness:check`、browser screenshot、computed style 或 visual smoke。 |

`daren-design` 的 `design-harness:check` 会扫描改动中的 UI 文件：若菜单、弹层、badge、button、dialog、sheet、tooltip 等 protected surface 使用本地 primitive 或局部 helper，而不是设计系统允许源，会报告 primitive source mismatch。CSS class 命中只是辅助信号，不能替代 import / symbol 证据。

### Source Replica / 现有界面适配

1. 若还没有源应用基线，先用 `ui-replica-engine`；本 skill 不负责阶段 0 Source Replica。
2. 执行 `asset-audit.md`，输出 L1-L4 Audit 和 Evolution Proposal 草案。
3. 用户确认 accepted / backlog / local-only 后，执行 `adapter-plan.md`。
4. 适配视觉和实现到目标 token / primitive / pattern / template。
5. 用 `evolution-loop.md` 输出设计系统反馈。

## 产出

- 普通 UI 改动：Design System Fit Packet、整改清单、代码改动、验证结果、残余风险。
- 大面积适配：Design Asset Audit、Adapter Plan、Adapted UI、Evolution Proposal / Report、Verification Record。
- 内部 recipe：L1-L4 Snapshot、Model Instance Draft、Interaction Matrix、Candidate List、Harness Calibration、pending-human Recommendation。
