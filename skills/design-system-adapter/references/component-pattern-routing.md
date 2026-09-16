# Component And Pattern Routing

读取时机：任务涉及组件选型、页面骨架、工作台 shell、Agent Dock、表格、列表、表单、弹窗、菜单、composer、状态流或交互模式。

## 读取真源

- 分层原则：`daren-design/src/daren-design/registry/data/design-layers.ts`
- 基础组件：`daren-design/src/daren-design/registry/data/components.ts`
- 通用交互：`daren-design/src/daren-design/registry/data/interactions.ts`
- 通用 UX patterns：`daren-design/src/daren-design/registry/data/ux-patterns.ts`
- Client patterns：`daren-design/src/daren-design/extensions/client/data/client-patterns.ts`
- Admin patterns：`daren-design/src/daren-design/extensions/admin/data/patterns.ts`
- Fields / forms：`daren-design/src/daren-design/extensions/admin/data/fields.ts`
- Agent UI：`daren-design/src/daren-design/extensions/agent/sections/AIAgentUISection.tsx`

只读与当前任务相关的文件，不要一次性读取所有 sections。

## L2 primitive 路由

| 需求 | 优先使用 |
|---|---|
| 普通按钮 / icon button | `components/ui/button.tsx` 或本项目既有 IconButton primitive |
| 文本输入 / textarea | `input.tsx`、`textarea.tsx` |
| 选择器 | `select.tsx`、`dropdown-menu.tsx`、`popover.tsx` |
| Dialog / confirm | `dialog.tsx` |
| 长表单 / 侧边编辑 | `sheet.tsx` |
| Tabs | `tabs.tsx` |
| Badge / chip | `badge.tsx` 或已有 chip primitive |
| Tooltip | `tooltip.tsx` |
| 普通 table primitive | `table.tsx`、data-table components；适合少列、静态、无宽表压力的语义表格 |
| Table Layout Contract | `daren-design/src/daren-design/registry/data/table-layout-contract.ts#TABLE_LAYOUT_CONTRACT_SYSTEM`；适合多列说明表、token 表、宽表、长内容、状态 / action / badge 混合表格 |
| Object Data Recipe | `daren-design/src/daren-design/registry/data/object-data-recipes.ts#OBJECT_DATA_RECIPE_SYSTEM`；适合对象列表页、对象详情页、相关列表、row detail、row edit drawer、collection-detail workspace |
| Layout Recipe | `daren-design/src/daren-design/registry/data/layout-recipes.ts`；适合页面模板、布局配方、可复用工作台区域沉淀 |
| Asset Hub | `daren-design/src/daren-design/registry/data/asset-hub-data.json`；适合资产货架、模板 / primitive / pattern 登记与搜索 |
| Data Grid runtime | 另走 D13 external/intake 或明确产品 spec；适合虚拟滚动、列 resize、pinning、inline edit、filter builder、batch action 等运行时能力 |
| Scroll area | `scroll-area.tsx` |

在原型或 Source Replica 中可以保留局部 primitive，但适配后必须让视觉状态和 token 与 Daren Design 一致。

## Pattern 横轴路由

| 场景 | 读取 / 复用 |
|---|---|
| 客户端三栏工作台、Vault Dock、Agent Dock | `client-patterns.ts` 的 `client-shell-three-column` |
| 浏览器 / Tauri / desktop 顶部栏 | `client-adaptive-app-chrome` |
| 右侧 composer / 浮动控件遮住滚动内容 | `client-edge-fade-cushion` |
| 列表行尾状态和更多按钮 | `client-persistent-edge-actions` |
| Agent 确认台、参考范围、预览修改 | Client / Agent UI patterns；同时对照 specs 中 Agent Dock contract |
| 管理端列表、分组目录、表格分页 | admin `patterns.ts`；若是对象数据工作流，先对照 D36 Object Data Recipe |
| 长表单 / 字段只读编辑态 | admin `fields.ts` |
| Daren Design 组件详情页 / golden page | `references/component-detail-golden-page.md`；Input 页是黄金样本 |

## L4 template 路由

- 客户端 / Editor Mode：三栏单壳，中心 workspace view slot，右侧 Agent / context rail 常驻。
- Admin：AppShell + PageHeader + content region；列表页不要重造 shell。
- 复刻 / lab：保留 Source Replica 的结构，Design-System Adaptation 只替换视觉身份和可复用 primitive。

## 决策纪律

- 先按纵轴问“这个 UI 问题是否已有 token / primitive / block / template”，再按横轴问“它应遵循哪个 pattern”，最后再写 CSS。
- 先定 Harness ROI Gate：Lite / Normal 任务只查实际用到的 primitive / pattern；Reusable Pattern / Full Contract 才查 Asset Hub、layout recipe、table/object recipes 或 design gates。
- 先写 Design System Fit Packet，再写 CSS / JSX。`checked` 必须是可证伪的引用：`file + exported symbol`、pattern 文件或 spec section。
- 表格先分四路：普通 table primitive 解决语义与基础视觉；Table Layout Contract 解决 column role、width、content behavior、overflow owner、responsive degradation；Object Data Recipe 解决对象列表 / 详情 / 相关列表 / 行详情 / 行编辑抽屉的字段投影和页面配方；Data Grid runtime 只在产品 spec 明确需要虚拟滚动、resize、pinning、inline edit、filter builder 或 batch action 时引入。
- Layout Recipe 只在页面骨架 / template / 可复用布局配方沉淀时使用；不要为了普通页面局部排版创建 layout recipe。
- Asset Hub 只在登记、搜索、展示或演进可复用资产时使用；不要把一次性页面修补登记成资产。
- 组件详情页按 Input 黄金样本统一：页面标题 / 一级标题 / 二级标题分别使用 `--text-title-xl`、`--text-ui-title-large`、`--text-ui-title-small`；一级章节固定为 `组件示例 / 命令行 / 用法 / 验收规范 / 元信息`，且每个一级章节顶部都有 `--color-border-subtle` 分割线。
- 数据输入组件示例统一按 `样式变体 / 状态变体 / 形态变体` 三组组织。样式变体所有数据输入组件都必须有，排序固定为 `边框式（默认） / 填充式 / 下划线`，API 命名为 `outlined / filled / underlined`。
- D34 首版不引入字段类型强约束；调用方把字段类型或业务 schema 映射到 `role + width + content behavior + responsive`，不要把 `token` role 当领域字段类型。
- D36 首版引用 D20 FieldKind，但不新增字段类型、不改 D34 core；字段类型由调用方映射到 D36 `FieldProjection`，再通过 D34 `columnRef` 取得真正 table role / width / content。
- 若已有资产覆盖，直接复用；若 partial，局部扩展并记录 Proposal；若 missing，先 local-only 实现并产出候选，不直接改真源。
- 若 missing 涉及外部组件或新组件候选，走 D13 intake；涉及菜单 / 弹层 primitive 选型，消费 D12；涉及图标，消费 D11。不要在业务页面里自定平行契约。
- 菜单、弹层、badge、button、dialog、sheet、tooltip 是 protected surface：实际实现的 import path + symbol 必须来自设计系统允许源，或在 Fit Packet 中记录 Daren 确认的 waiver。
- 先声明尺寸行为，再写宽高：inline-size / block-size 分别使用 hug-content、fill-container、fixed-token、bounded-fluid、scroll-contained、collapse-or-overlay。不要只写“自适应”。
- hug-content 用于短菜单、按钮、Badge、Tooltip；fill-container 用于 Input、表格、工作区；bounded-fluid 用于 Dialog、Sheet、Dock、Cascader、Panel；scroll-contained 用于长列表和面板 body。
- 组件状态至少覆盖 default / hover / focus-visible / disabled / active / selected；交互组件还要覆盖 empty / loading / error / readonly / stale / conflict。
- 工具型页面避免装饰性 landing page 风格；信息密度高但可读。
- 不把 cards 套 cards；页面 section 用 layout band / unframed layout，card 用于重复项、modal、工具框。
- 图标优先 lucide 或现有图标 registry，尺寸使用 icon tokens。

## 验收

- 脚本校准：先从当前 `package.json` 核对可用命令。`daren-design` 当前常用：`asset-hub:check`、`table-layout:check`、`object-data-recipe:check`、`layout-recipe:check`、`tokens:lint`、`design-harness:check`、`design-gates:report`、`build`。
- 视觉：token、字号、间距、圆角、边框、hover、focus 与真源一致。
- 结构：页面骨架和主交互不无计划漂移。
- 行为：可见按钮 / tab / menu / resize / collapse / composer / dock 都有点击反馈或明确 disabled。
- 响应式：dock 和 panel 低于 min width 不挤压；进入折叠、overlay 或 drawer。
- 尺寸行为：短内容不出现固定宽度空白，容器内容不撑爆父级，长内容到 max 后滚动，低于 min 后有明确降级策略。
- 证据：截图、computed style、browser smoke 或 interaction checklist。

## Harness 触发路由

| 触发条件 | 必须声明 |
|---|---|
| 表格、多列说明表、宽表、token 表 | `table-layout:check` 或 waiver |
| 对象列表、详情、相关列表、row detail / row edit drawer | `object-data-recipe:check` 或 waiver |
| 页面模板、layout recipe、可复用工作台骨架 | `layout-recipe:check` 或 waiver |
| Asset Hub 资产登记 / 修改 / 搜索索引 | `asset-hub:check` 或 waiver |
| 设计 gate / harness 本身 | `design-gates:report`、`design-harness:check`、`build` |
