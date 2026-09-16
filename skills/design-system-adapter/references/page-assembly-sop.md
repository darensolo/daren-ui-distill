# 页面组装 SOP（按 UIOM/LOM 从面级组装）

> 何时读这份：要**从面级组装/改造一个工作台页面或 surface**（worksheet、note、canvas、dock、review 等整面），或被要求「按 UIOM/LOM 严格构建页面」时。单个组件的小改走 `component-pattern-routing.md` 即可，不必读这份。

组装不是「手工攒 JSX」，是**按固定顺序消费已有零件**。下面七步源自 D41 的反推漏斗（`specs/D41-uiom-reverse-derivation-seed/spec.md`）。

## live / planned 边界（先读，别踩坑）

- **方法论七步现在全部可用**——它是思维框架，不依赖任何文件存在。
- **下游零件与机读门已 live**：LOM(D29)、原语(D30)、recipe(D31)、对象投影(D36)、壳 profile(D35)，验收门见末节。
- **D41 自己的专用真源与门仍是 planned**（draft）：`shell-mount-contract.ts` / `surface-taxonomy.ts` / `interaction-matrix.ts` / `leaf-seam-contract.ts` / `uiom-composition.ts` / `derivation-ledger.ts` 与 `uiom:check` **尚未落地**。涉及它们的步骤照方法论做，但**别引用这些文件当 live、别把 `uiom:check` 当现成门**——缺口走 D33 intake，等 D41 accepted 再接。

## 七步 checklist

1. **面分类（概念判断，live）**——先判这个面是 `object-data | editor-leaf | composite`，定建模深度 `full | seam-only`。object-data ⇒ full（深建）；editor-leaf ⇒ seam-only（只管外缝）。这一步决定后面读哪些零件。
2. **壳挂载（钉 D35，live）**——面绑定一个 D35 `LayoutProfile.id`（真源 `core/data/intrinsic-layout-axes.ts`，按 `surface=editor/worksheet/workbench/agent-dock/canvas` 选）。布局几何/滚动归属/overlay/抽屉折叠**一律由 D35 profile 承载，不新增 axis、不裸值**。面↔壳的接线（命令/抽屉/焦点/保存路由）属 D41 契约 A（planned）——现在按现有 `chrome.tsx`/`left-dock.tsx` 的既有接线模仿，别私自另接。
3. **组装（钉 D29/D30/D31/D36，全 live）**——object-data 面 = LOM 树（D29 `layout-object-model.ts`）+ 语义槽（D30，门 `semantic-slot:check`）+ pattern recipe（D31 `layout-recipes.ts`）+ 对象投影（D36 `object-data-recipes.ts`）。**只引用、不内联复制零件定义**。组装前先 `pnpm agent:search -- "<关键词>" --json` 查有没有现成 recipe/slot 可复用，命中 `pnpm agent:info -- <id> --json` 看详情；Fit Packet 的 file+symbol proof 仍要亲读真源。
4. **交互矩阵（方法 live，专用门 planned）**——object-data 面逐个交互（select / expand-row / inline-edit / group / filter / sort / batch / open-drawer）声明**适用状态子集**，取自面级全集 `idle → hover → active → loading → settled | error` + `empty / disabled / optimistic`。每个声明的状态必须有**机读 evidence 锚点**（`data-state` / aria / computed），不能只存在于视觉；optimistic 交互必须声明回滚路径。〔专用契约 `interaction-matrix.ts` + `uiom:check` 是 D41 planned；现在照此建，逐页手写最常漏的就是空/禁用/加载/乐观这几态。〕
5. **叶子缝（方法 live，专用门 planned）**——editor-leaf 面（笔记/画布）**只定义外缝**：`mountSlot`（经第 2 步壳挂载）、`toolbarSlot`（用壳的 toolbar 槽，不私造）、`stateEvents`（selection/dirty/save/focus，且必须覆盖 dirty/save）、`shellBoundary`。**编辑器内部结构显式 out-of-scope**——UIOM 永不伸进富文本/画布内部。〔专用契约 `leaf-seam-contract.ts` 是 D41 planned。〕
6. **消费即验证（用 live 下游门；`uiom:check` planned）**——见末节命令清单。`uiom:check` 落地前，用下游 live 门兜底验收。
7. **缺口即 intake，不飞线**——撞到「UIOM/现有零件表达不了的东西」时，**落一条 D33 intake（`design-intake:check` live），别直接 hardcode**。未建模的局部细节/创意表达允许由现有组件或手工兜底，**但必须可见可追**：标 `covered`（被某条视图/role 覆盖）、`waiver`（显式豁免带理由）、或 D33 intake 三者之一，不留隐形实现区。

## 三条红线

- **框架严格、叶子自由**：壳/挂载/接线/交互按契约走；编辑器与画布内部不建模。
- **只引用不复制**：所有零件 by-reference，组装层不内联复制 LOM/slot/recipe/投影定义。
- **验收用真源门**：下面的 live check 直跑；`agent:check` 只用于快速看状态，不替代真源门（同 `quick-start.md` 红线②）。

## 验收命令（live；按面类型择跑）

```bash
pnpm tokens:lint              # L1：裸色/裸值/主题风险（所有面必跑）
pnpm design-harness:check     # primitive source mismatch（所有面必跑）
pnpm intrinsic-layout:check   # 第 2 步：壳布局 profile（D35）
pnpm layout-object:check      # 第 3 步：LOM 树合法性（D29）
pnpm layout-primitive:check   # 第 3 步：原语用法（D30）
pnpm semantic-slot:check      # 第 3 步：语义槽（D30）
pnpm layout-recipe:check      # 第 3 步：pattern recipe（D31）
pnpm object-data-recipe:check # 第 3 步：对象投影（D36，object-data 面）
# planned（D41 accepted 后接）：pnpm uiom:check —— 编排 A–E 一致性 + dogfood conformance
```
