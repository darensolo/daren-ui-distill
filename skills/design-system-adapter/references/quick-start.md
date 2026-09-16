# Design System Quick Start

最小必读。任何 UI、frontend、prototype、app shell、组件、页面视觉整改、设计 token review 都先读这里。

## 判断

设计系统强约束是必要的。原因不是 Agent 不会设计，而是多 Agent、长上下文、原型迭代和复刻适配会自然产生页面方言。规则必须有三个层次：

1. **Skill / memory 入口**：让 Agent 在 UI 任务前加载正确上下文。
2. **代码和 token 真源**：让实现只能落到可复用变量、组件、区块、模板和 pattern。
3. **检查 / evidence**：用 build、视觉截图、computed style、token scan 发现漂移。

Skill 是主要的 in-band 约束；它不能替代 CI / hook。真正不可绕过的硬门应下沉到 lint、token check、pre-commit 或 CI。

## Harness ROI Gate

先判断任务档位，再决定读多少真源、跑多少 gate。普通 UI 不默认进入 Full Contract。

| 档位 | 适用任务 | Agent 动作 | 验证 |
|---|---|---|---|
| **Lite** | 文案、小样式、已有 primitive 的局部调整 | 说明使用的 token / primitive；不写完整 Fit Packet | 最小直接 smoke / static / unit；只在相关时选 typecheck 或 `tokens:lint` |
| **Normal** | 普通页面、表单、弹层、列表、状态补齐 | 写 Mini Fit Packet | 从 `tokens:lint`、相关 harness、DOM/browser 中选能发现本次失败的最小项 |
| **Reusable Pattern** | 跨页面组件 / pattern / template 候选、Asset Hub 条目 | 完整 Fit Packet + evolution 判断 | 只运行受影响的 asset/harness/report 或一条必要交互 smoke，不默认全跑 |
| **Full Contract** | token 真源、harness/gates、表格契约、对象数据 recipe、layout recipe | 完整 Fit Packet + Harness / gate calibration | 首次验证可更强，但仍只选受影响 recipe/gate/build；同一候选不重复 |

若任务没有高复用、跨页面、复杂表格 / 对象数据、Agent 写回、Asset Hub / template、设计系统真源或 harness/gate 变更，不要主动引入 D34/D35/D36/LRC 等 contract。

## 必守原则

- **L1 先行**：颜色、字体、间距、圆角、阴影、动效、focus、布局尺寸先找 token。
- **L2 复用**：按钮、输入、select、tabs、dialog、sheet、popover、tooltip、table、badge 优先用现有 primitive。
- **L3 组合**：字段组、工具栏、Agent Dock 片段、Review Queue、Evidence Console 等复合段优先复用 block。
- **L4 稳定**：页面骨架、三栏 shell、设置页、详情页、列表页不要每页重做。
- **Pattern 横轴对齐**：列表、工作台、Agent Dock、composer、行尾操作、确认流、empty / loading / error 都按 pattern。
- **Fit Packet 先行**：写 UI 前先给出 Design System Fit Packet；L2/L3/L4 的“已查”必须附 `file + exported symbol` 或 spec section，Pattern 轴必须附文件或 spec section。
- **Harness / gate calibration**：Fit Packet 必须说明已从当前仓库 `package.json` 核对可用脚本；涉及表格、对象数据、layout recipe、模板或 Asset Hub 时，必须声明对应 check 或 waiver。
- **尺寸行为先声明**：不要只写“自适应”。宽度 / 高度分别标注 hug-content（贴合内容）、fill-container（撑满容器）、fixed-token（固定令牌）、bounded-fluid（有界自适应）、scroll-contained（滚动容纳）或 collapse-or-overlay（折叠/浮层降级）。
- **Table layout contract checked**：涉及数据类表格 / 多列说明表 / token 表时，Fit Packet 的 verification evidence 必须说明是否已检查 `table-layout:check`，或引用对应 Table Layout Contract fixture / waiver。
- **Object data recipe checked**：涉及对象列表页、对象详情页、相关列表、row detail、row edit drawer 或 collection-detail workspace 时，Fit Packet 的 verification evidence 必须说明是否已检查 `object-data-recipe:check`，或引用对应 Object Data Recipe fixture / waiver。
- **Layout recipe checked**：涉及页面模板、layout recipe、工作台/页面骨架沉淀时，Fit Packet 必须说明是否已检查 `layout-recipe:check`，或写明 waiver。
- **Asset Hub checked**：新增 / 更新设计资产登记、模板、可复用组件货架时，Fit Packet 必须说明是否已检查 `asset-hub:check`，或写明 waiver。
- **不把一次页面修补提升为全局规则**：新资产先进入 Proposal，人工确认后才回流设计系统。

## 常见禁令

- 禁止业务 UI 写裸 hex / rgb / hsl / rgba 颜色，除非文件或区域有明确 exemption。
- 禁止任意 spacing / radius / font-size magic number；优先 `--space-*`、`--radius-*`、`--text-*`、`--leading-*`、`--size-*`。
- 禁止用 Tailwind `gray-*`、任意 `[#...]`、随手 `text-base` 做工具型界面默认正文。
- 禁止绕过 primitive 重造 button、input、select、dialog、sheet、menu 的状态和 a11y。
- 禁止用本地 helper / local primitive 冒充设计系统 primitive。若必须 local-only，先问 Daren，并在 Fit Packet 中记录 D13 / D12 / D11 / local-only 路线。
- 禁止让页面结构为了适配窄屏无限挤压；dock 低于 min width 应 collapse / overlay / drawer。
- 禁止用固定宽度 / min-height 假装自适应；短内容组件优先 hug-content，容器型组件才 fill-container 或 bounded-fluid。

## 发现已有资产（先检索，再读真源）

> D46 `agent:*` 只读消费面已 live。要发现「有哪些组件 / 区块 / token / asset 可复用」时，先检索、命中后再深读真源——别一上来手动通读下方整张清单。

- 检索：`pnpm agent:search -- "<关键词>" --json` → `data.results[]`（含 `id` / `kind` / `maturity` / `status` / `refs`；`kind` 取 registry-item / asset-hub / site-page / gate / skill / contract）。
- 取详情：`pnpm agent:info -- <id> --json` → files / tokens / dependencies / provenance / maturity / fitPacket / evidence。
- 两条红线：① Fit Packet 的 file+symbol proof 仍要**亲读真源**，`agent:info` 输出只是发现线索，不能顶替「已读源码」；② 验收 check **不**用 `agent:check` 替代，仍直跑真源门（见「最小流程」第 7 步）。

## 当前 Daren Design 真源（agent:info 命中后按需深读）

- `daren-design/design-tokens/tokens/semantic.json`
- `daren-design/design-tokens/dist/desktop/generated-tokens.css`
- `daren-design/src/styles/generated-tokens.css`
- `daren-design/examples/mindex-workbench/src/styles/generated-tokens.css`
- `daren-design/src/daren-design/registry/data/tokens.ts`
- `daren-design/src/daren-design/registry/data/design-layers.ts`
- `daren-design/src/daren-design/registry/data/components.ts`
- `daren-design/src/daren-design/registry/data/asset-hub-data.json`
- `daren-design/src/daren-design/registry/data/table-layout-contract.ts`
- `daren-design/src/daren-design/registry/data/object-data-recipes.ts`
- `daren-design/src/daren-design/registry/data/layout-recipes.ts`
- `daren-design/src/daren-design/registry/data/design-gates.ts`
- `references/component-detail-golden-page.md`
- `daren-design/src/daren-design/registry/data/ux-patterns.ts`
- `daren-design/src/daren-design/registry/data/interactions.ts`
- `daren-design/src/daren-design/extensions/client/data/client-patterns.ts`
- `daren-design/src/daren-design/extensions/admin/data/patterns.ts`
- `daren-design/src/daren-design/registry/data/ai-guide.ts`

## 最小流程

1. 先 `pnpm agent:search` 检索可复用资产，再定位页面实现、样式文件和 token CSS。
2. 先判断 Harness ROI Gate 档位；Lite / Normal 不默认读取 Full Contract 真源。
3. 先产出对应档位的 Fit Packet：Lite 用一句话；Normal 用 Mini Fit Packet；Reusable / Full 用完整 Fit Packet。只为实际受影响的表格、对象数据、layout recipe 或 Asset Hub 选择对应 check；已有同一候选证据直接复用。
4. 先审 L1：裸色、裸 px、字号、圆角、阴影、focus、布局尺寸。
5. 再审 L2-L4：是否绕过 primitive、是否已有 pattern、是否页面骨架漂移。
6. 先列整改清单；用户要求直接执行时，按清单逐项改。
7. 验证前从当前 `package.json` 核对脚本，并按 `testing-policy.yaml` 只选能直接发现本次失败的项。`daren-design` 的候选工具包括：`asset-hub:check`、`table-layout:check`、`object-data-recipe:check`、`layout-recipe:check`、`tokens:lint`、`design-harness:check`、`design-gates:report`、`build`；它们不是固定串行清单。

## 继续读取

- 改颜色、字号、间距、圆角、主题：读 `token-governance.md`。
- 改组件、页面结构、工作台、Agent Dock、表格、列表、弹层：读 `component-pattern-routing.md`。
- 创建、升级、评审 Daren Design 组件详情页 / golden page：读 `component-detail-golden-page.md`。
- 迁移 / 复刻 / 全页面审计：读 `asset-audit.md` 和 `adapter-plan.md`。
- 要把实践回流设计系统：读 `evolution-loop.md`。
