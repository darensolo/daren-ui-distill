---
name: ui-replica-engine
description: "粒度感知 UI 复刻引擎（D24 v0.1）。当用户要求复刻、克隆、重建、1:1 还原某个应用界面或界面资产，或输入本地应用、公开网页、图标/组件/区块/页面 asset-ref 时使用。本 skill 先按阶段 -1 自动路由到 icon / component / block / page 分支，再按 D24 invocation contract 执行；唯一硬必填是 source，默认 target=Daren、granularity=auto、reproductionDepth=source+adapt 且保留 Source Replica。v0.1 目标侧固定 Daren Design，任意目标设计系统是 v0.2 参数化路线；治理 grade/license/canRealClone/stable 归 D16/D13，本 skill 只透传 governanceRef。机读门仅 tokens:lint / design-harness:check / 结构报告；截图 diff、状态矩阵、交互巡检为人工 evidenceRef。"
metadata: {"skill_id":"ui-replica-engine","governance_status":"active","required_references":[],"optional_references":["references/source-replica.md","references/replicate.md","references/plan.md","references/distill-integration.md"],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# 应用界面复刻引擎（UI Replica Engine）

当请求明确使用 Daren UI Distill、有效 Blueprint 或新阶段组合时，先读 `references/distill-integration.md`。有效 Blueprint 直接复刻，不重新捕获；“原样复刻”不得隐式适配。未命中新集成时，保留下文既有 D24 手工流程与兼容默认。

把一个现有应用或界面资产高保真地复刻进 Daren Design。D24 v0.1 的引擎**输入侧源无关**：源可以是用户指定的本地应用、公开网页，或调用方传入的图标/组件/区块/页面资产引用；**目标侧固定为 Daren Design**。任意目标设计系统属于 v0.2 的参数化路线，不在 v0.1 冒充通用。

本技能以当前文件的调用约定、`references/*` 分支说明，以及插件自带的 `packages/contracts` JSON Schema 为分发真源。宿主若提供更严格的治理契约，可以追加约束，但不得放宽这里的来源、保真和授权边界。

唯一硬必填参数是 `source`。`granularity` 缺省自动识别，`targetDesignSystem` 缺省 Daren，`reproductionDepth` 缺省 `source+adapt` 且 `keepSourceReplica=true`。对话发起时不弹全字段表单；只在 source 缺失、粒度歧义、block/page 成本确认时回问。

## 阶段 -1 —— 粒度路由与调用契约

先按 D24 invocation contract 解析调用：

```ts
replica.invoke({
  source: { kind: "local-app" | "web-url" | "asset-ref", ref: string },
  granularity?: "icon" | "component" | "block" | "page",
  targetDesignSystem?: "none" | { tokensSource: string },
  reproductionDepth?: "source-only" | "source+adapt",
  governanceRef?: { grade?: string; licenseRef?: string; antiCopyEvidenceRef?: string; provenanceRef?: string },
  accept?: { fidelityProfile?: string; viewport?: { w: number; h: number }; breakpoints?: number[] },
  keepSourceReplica?: boolean,
  dryRun?: boolean,
})
```

路由优先级遵守 fidelity contract §0.1：

1. 单一 SVG/path 资产 → `icon`
2. 单一可独立渲染 primitive + 状态集 → `component`
3. 多 primitive 组合段 + slots/区域拓扑 → `block`
4. 整页 shell + 导航模型 + 多区块 → `page`
5. 仍歧义 → 返回 `needs-human-granularity`，不自由发挥

输入边界：

- `local-app`：用户本机应用；桌面/Electron 可进入 `extract-desktop.md`。
- `web-url`：仅公开页面；遇登录态、cookie、私有 session 返回 `needs-human-source`，不自行登录、不存凭据。
- `asset-ref`：调用方传入的图标/组件/区块/页面资产引用；无法解析返回 `asset-ref-unresolved`。

治理边界：

- D24 不定义 grade、canRealClone、stable/fast-path 或车道政策；这些属于 D16/D13。
- 受治理调用方可传 `governanceRef`，本技能只保留并原样回传到 fidelity report。
- 个人复刻自有源不强制治理校验；唯一例外是图标：无 license/source 证据默认 HOLD。

失败语义固定为：`hard-fail`、`needs-human-source`、`fallback-to-page`、`asset-ref-unresolved`、`needs-human-granularity`。调用方传 token/时间预算时，超限按这些语义降级，不静默烧预算。

## 四条粒度分支

| 粒度 | 设计层 | 参考文件 | 流程重量 | 关键保真门 |
|---|---|---|---|---|
| `icon` | L1 | `references/replicate-icon.md` | 极轻；不走 5 阶段 | SVG normalize、license/source 证据、D11 候选兼容 |
| `component` | L2 | `references/replicate-component.md` | 中；scope 锁单件 | requiredStates/requiredVariants、a11y、token + primitive machine gates |
| `block` | L3 | `references/replicate-block.md` | 中重；组合契约 | slots/组合拓扑、内部组件状态覆盖、响应式人工证据 |
| `page` | L4 | `references/source-replica.md` + `references/replicate.md` | 重；沿用既有全流程 | 整页 shell、导航模型、可见交互点巡检 |

机读门 v0.1 只有 `pnpm tokens:lint`、`pnpm design-harness:check`、结构/source 报告。状态矩阵、截图 diff、交互巡检均为人工门，必须在 `fidelityReport.gates[]` 留 `evidenceRef`；不要引用 D17 作为像素 diff 阈值真源。

## 定义本技能的两条规则

**先保留原版，再替换视觉身份。**

第一段产出 **源版复刻（Source Replica）**：尽可能 1:1 复制源应用的布局、交互、状态、菜单、面板、主题、图标、字体近似和颜色近似，形成一个可运行的原版基准版本（benchmark）。它是阶段性产物，必须能单独保留、单独验收、供后续复用。

第二段产出 **设计系统适配（Design-System Adaptation）**：在源版复刻（Source Replica）的结构与交互不变的基础上，把视觉身份替换成用户自己的设计系统。你**不**复制目标应用专有的视觉身份——它确切的品牌色值、定制字体或商标。每一处颜色、字体、圆角、间距，都要通过*用户自己的设计系统 token* 重新表达。

**交互不可降级。**你复刻的是*结构*（区域布局、尺寸、导航模型、面板解剖）和*行为*（悬停、展开 / 折叠、缩放、菜单、状态图标、动效手感）。**每一个源应用主界面上可见的按钮 / tab / 菜单入口 / 折叠器 / split 控件，都必须有对应的点击交互、状态变化、禁用 / 空态或占位反馈；不能只画静态壳。**

**唯一例外：图标。** 图标**直接沿用源应用的原图标资源**，不替换、不映射到其他图标库——以保证图形语言与源应用 1:1 一致。除图标外的其余视觉（颜色、字体、圆角、间距）以及组件库，仍一律走重新表达 / 映射。

**交付前必须执行持续差异发现。** 对 component/block/page 的来源与候选使用相同状态、容器宽度、视口、主题、locale 和裁片，随后按 `ui-audit-repair` 的高保真闭环核对图标身份、关键节点几何/对齐、尺寸/溢出约束、视觉内容与交互时序。每个新 finding 都必须同时修资产并固化成回归 oracle；只通过结构、可点击或单张截图检查，不得声称复刻就绪。

为什么这件事在两个层面都重要：
- **质量** —— 一个建立在你自己语义化 token 之上的复刻品，能与产品其余部分保持一致，并免费获得主题切换（亮 / 暗）能力。一堆写死的外来色值会立刻腐烂。
- **边界** —— 你是在用*你自己*产品的方式去诠释一套被验证过的布局，而不是冒充别人的品牌。提取真实色值 / 字体是为了*精确理解设计意图*，然后刻意地把它映射到你自己的调色板上——绝不直接发布源应用的色值 / 字体 / 商标（图标除外，见上文例外）。

当提取暴露出一个真实值（例如强调色 `#d97757`）时，它会变成一个*映射决策*（「暖陶土色强调 → 我们的 `--color-brand`，仅用于微小的焦点 / 图标点缀，绝不作为背景」），而不是一次粘贴。

## 页面级工作流一览

以下 0-3 阶段只适用于 `granularity=page`，以及需要回退页面级重流程的 block/page 任务。`icon`、`component`、`block` 先按对应 reference 执行；不要把图标塞进整页 5 阶段流程。

```
阶段 0  从应用的真实资源中提取一份事实基线
         └─ 桌面 / Electron → references/extract-desktop.md （配合 scripts/extract_asar.sh）
         └─ Web 应用          → references/extract-web.md      （预留；目前较精简）
         └─ 按 L1 令牌（Tokens） / L2 组件（Components） / L3 模式（Patterns） / L4 模板（Templates） 提取
         └─ 产出：一份「测量基线」文档（原型骨架、尺寸、调色板、组件、菜单、交互契约）

阶段 0.5 输出复刻计划与验收清单
         └─ references/plan.md
         └─ 产出：L1-L4 拆解、原版复刻任务、设计系统替换任务、交互矩阵、验收标准

阶段 1  源版复刻（Source Replica）：原版 1:1 可运行复刻
         └─ references/source-replica.md
         └─ 产出：保留源应用视觉身份的 基准版本（benchmark），可单独验收与复用

阶段 2 设计系统适配（Design-System Adaptation）：替换进目标设计系统
         └─ references/replicate.md  （方法论、token 映射、验证坑点）
         └─ 产出：结构和交互沿用源版复刻（Source Replica），视觉落到用户自己的 token / primitive / pattern / template

阶段 3  检查、改进、再验收
         └─ 对照阶段 0.5 清单逐项验收；失败项必须返工，直到缺口只剩明确记录的后续项
```

页面分支按顺序执行各阶段。阶段 0 的基线是事实来源，阶段 0.5 的计划是执行合同；在两者存在之前不要开始写复刻代码，否则你会退回到靠截图猜测、凭空编造数值和漏掉交互。除非用户明确只需要最终设计系统版本，否则必须保留源版复刻（Source Replica） 作为阶段性产物。

设计系统适配（Design-System Adaptation）可以交给独立的 `design-system-adapter` skill。`ui-replica-engine` 仍负责事实基线、计划、源版复刻（Source Replica），以及把源版复刻（Source Replica）、L1-L4 映射表和交互矩阵交接给适配器（adapter）；适配器（adapter） 负责目标设计系统替换和把实践中发现的 Foundations / 组件（Components） / 模式（Patterns） / 模板（Templates） 候选资产反哺设计系统。

## 阶段 0 —— 提取事实基线

目标：得到一份精确、有来源的基线，让阶段 1 永远不用猜。光靠截图是不够的——截图给你拓扑结构和大致尺寸，但颜色 / 字体 / 组件名 / 菜单项应当来自应用*真实发布的资源*。

1. **判断应用类型。**
   - 发布了 `app.asar` 的桌面应用（多数 Electron 应用）→ 阅读 `references/extract-desktop.md` 并运行 `scripts/extract_asar.sh <AppName>`。
   - Web 应用 → 阅读 `references/extract-web.md`（DevTools 计算样式 + DOM）。
2. **按 L1-L4 挖掘真实资源**（细节见参考文档）：L1 提取 token / 色值 / 字体 / 间距 / 圆角 / 动效；L2 从 CSS / JS / DOM 中提取基础组件；L3 提取场景化模式、状态流和交互契约；L4 提取整页 shell、页面骨架、区域拓扑和窗口 / 响应式规则。
3. **从截图测量结构**——针对那些不在 CSS 里的东西（区域宽度、行高）。注意 Retina → 逻辑像素的换算，并把估算值标记为 ⚠️「需在真机上校正」——不要把截图猜测当成官方数值呈现。
4. **撰写基线文档。** 使用 `references/extract-desktop.md` §「基线文档模板」中的结构：原型骨架（区域示意图）、L1-L4 分层事实表、真实调色板、组件清单、菜单集，以及一份明确的「交互契约」列表。这份文档就是阶段 0 的交付物。

## 阶段 0.5 —— 输出复刻计划 / 任务验收清单

在写代码前，必须先阅读 `references/plan.md` 并输出一份计划。计划不是泛泛的 TODO，而是对照复刻对象和目标设计系统拆出的执行合同：

1. **界面区域拆解。** 逐区列出标题栏 / ribbon / 左栏 / 工作区 / tab group / 编辑器 / 右栏 / 状态栏等区域的结构、尺寸、状态和响应式规则。
2. **L1-L4 分层拆解。** L1 列源 token 与目标 token；L2 列源组件与目标 primitive；L3 列源场景化模式与目标 patterns；L4 列源页面骨架与目标 templates / shell。
3. **交互矩阵。** 列出主界面每个可见按钮、tab、菜单、树节点、split 控件、状态入口的真实行为、复刻行为、空态 / disabled 状态和验收方式。
4. **两段任务拆分。** 把实现拆成源版复刻（Source Replica） 任务与设计系统适配（Design-System Adaptation）任务；每个任务带输入依据、产出文件、验收标准。
5. **风险与缺口。** 标记仍需运行时确认、无法从资源推断、或暂不接入真实业务的项，并给出占位反馈方案。

## 阶段 1 —— 源版复刻（Source Replica）：原版 1:1 可运行复刻

完整方法论见 `references/source-replica.md`。阶段 1 只能执行阶段 0.5 计划中的源版复刻（Source Replica） 任务；若执行中发现计划缺项，先补计划和验收标准，再改代码。大致流程：

1. **保留源应用视觉身份用于校准。** 颜色、字体近似、间距、圆角、图标、状态、主题都尽量贴近源应用，形成可对照的基准版本（benchmark）。
2. **完整实现结构与交互。** 主界面所有可见操作点都有点击反馈、状态变化、菜单 / 弹层 / 空态 / disabled 反馈。
3. **不引入目标设计系统改写。** 除非为运行环境所需，不在此阶段替换为目标设计系统 token；目标是先验证“像不像源应用”。
4. **单独验收并保留。**源版复刻（Source Replica）必须能作为独立路由、独立页面、独立分支或独立组件状态保留，供后续设计系统替换和其它项目复用。

## 阶段 2 —— 设计系统适配（Design-System Adaptation）：替换进目标设计系统

优先使用独立的 `design-system-adapter` skill；本 skill 的 `references/replicate.md` 保留为 ui-replica-engine 内部调用适配器（adapter）时的衔接说明。阶段 2 只能执行阶段 0.5 计划中的设计系统适配（Design-System Adaptation）任务；若执行中发现计划缺项，先补计划和验收标准，再改代码。大致流程：

1. **先学习目标 token。** 找到用户的设计 token 来源（例如某个 `generated-tokens.css`、Tailwind 配置、主题文件），读懂已经存在哪些语义化 token——颜色、间距刻度、圆角、排版、控件尺寸。你是*映射到这些之上*；不要另起一套平行调色板。
2. **构建一个共享外壳**，把导航模型和面板内容做成*可插拔*的，这样两个相似应用（或未来的变体）可以共享同一套骨架。
3. **把结构映射到一个专用的布局 token 组**（例如 `--layout-<thing>-*`），它*只*承载结构尺寸；其余一切都复用已有的语义化 token。
4. **按源版复刻（Source Replica） 与阶段 0 建立的表格，把视觉映射到语义化 token。** 强调色 / 品牌色只出现在源应用使用它的地方（图标、链接、焦点、徽标）——绝不提升为大面积背景。选中状态保持中性，除非目标系统另有规定。
5. **实现交互契约。** 主界面上任何可见可操作元素都必须能被点击或明确呈现 disabled 状态：tab 切换、面板展开 / 折叠、侧栏开关、菜单 / 更多按钮、搜索入口、文件树展开、split / view 操作、状态栏入口、主题切换等。若真实功能尚未接入，至少实现与源应用一致的本地 UI 状态、弹层、空态或占位反馈。
6. **不要为用户可调整的东西编造「官方」数值**（侧边栏 / 面板宽度存在本地状态里，而非规格中）。挑选合理的默认值并把它们标注为默认值，配上合理的最小 / 最大值。
7. **验证** —— 见 `references/replicate.md` 中的「验证坑点」一节（开发服务器端口要与配置一致、预览代理无法硬跳转子路由所以要用客户端路由 / `pushState`、确认开发服务器跑的是正确的仓库 / worktree）。在宣布完成前，争取做到零类型错误、控制台干净，并完成主界面按钮点击巡检。
8. **反哺设计系统。** 若适配过程中发现可复用的 Foundations / 组件（Components） / 模式（Patterns） / 模板（Templates），交给 `design-system-adapter` 形成演进报告（Evolution Report）；不要只把页面改完。

## 「完成」长什么样

- 一份阶段 0 基线文档，任何 agent 都能把它交给阶段 1 据以重建。
- 一份阶段 0.5 复刻计划 / 任务验收清单，覆盖 L1-L4、区域、token、组件、设计模式、交互矩阵、两段执行任务和验收标准。
- 一个运行中的源版复刻（Source Replica），其**布局、视觉和交互读起来与源应用 1:1 一致**，主界面每个可见按钮 / tab / 菜单入口都有真实点击反馈或明确 disabled / 空态。
- 一个运行中的设计系统适配（Design-System Adaptation），其结构与交互沿用源版复刻（Source Replica），**每一处颜色 / 字体 / 圆角 / 间距都是用户自己的 token**、组件库也是用户自己的，且能干净地切换主题；**图标则沿用源应用原图标**。
- 一份设计系统反哺记录：本次适配复用了、扩展了、候选新增了或拒绝了哪些 L1-L4 资产。
- 一份阶段 3 验收记录：哪些项通过、哪些项返工过、哪些项作为明确后续缺口保留。
- 产出中不携带外来的色值、字体或商标——图标除外（按约定保留源应用原图标）。
- 一份 D24 `fidelityReport`：逐门返回 `machine` / `manual`、`pass` / `fail` / `n/a`、`evidenceRef`、`commandsRun`、`governanceRef` 回传、`gaps` 和可复现命令。
