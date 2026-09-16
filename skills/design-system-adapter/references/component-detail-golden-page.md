# Component Detail Golden Page

读取时机：创建、升级、评审 Daren Design 组件详情页，尤其是组件页补货、golden-published 前验收、数据输入组件页面统一化。

Input 组件详情页是当前黄金样本。后续组件详情页先对齐本规范，再判断是否有组件特有差异。

## 真源

- 黄金样本实现：`daren-design/src/daren-design/site/component-pages/InputComponentPage.tsx`
- Input primitive：`daren-design/src/components/ui/input.tsx#Input`
- Input 组件规则：`daren-design/src/daren-design/registry/data/components.ts` 与消费副本 `daren-design/src/daren-design/data/components.ts`
- 组件目录与质量态：`daren-design/src/daren-design/site/shell/components-catalog.ts`、`asset-status.ts`
- token 真源：`daren-design/src/styles/generated-tokens.css`

不要用截图反推字号；必须用 token 或 computed style 验证。

## 页面结构

组件详情页固定为 6 个一级章节，顺序不可漂移：

1. `组件示例`
2. `命令行`
3. `用法`
4. `验收规范`
5. `最佳实践`
6. `元信息`

页面顶部标题区包含：

- 页面标题：组件中文名 + 英文名，例如 `输入框 Input`。不要在标题右侧放质量标签、状态标签或 badge。
- 如果该组件是黄金样本锚点，标题区可展示 `黄金样本 / Golden sample` 皇冠标识；这只表示规范参考样本，不等同 `golden-published` 质量状态。
- 简短描述：一句说明组件用途、尺寸/主题策略和核心状态覆盖。
- 右上角更新按钮：由站点壳层统一提供；组件页面内部不要自行增加或删除“更新组件 / 请求补货”按钮。

一级章节内可以有说明文案，但不要在一级标题右侧追加局部标签。质量状态、成熟度、依赖、token 等信息统一放入 `元信息`。

## 标题层级

三层标题必须使用以下 token，并用浏览器 computed style 验证实际值等于 token：

| 层级 | 示例 | token |
|---|---|---|
| 页面标题 | `输入框 Input` | `--text-title-xl` / `--leading-title-xl` / `--weight-title-xl` |
| 一级章节标题 | `组件示例`、`命令行`、`用法`、`验收规范`、`最佳实践`、`元信息` | `--text-ui-title-large` / `--leading-ui-title-large` / `--weight-ui-title-large` |
| 二级分组标题 | `样式变体`、`状态变体`、`形态变体` | `--text-ui-title-small` / `--leading-ui-title-small` / `--weight-ui-title-small` |

实现可用 class 或 style，但验收以 computed style 为准。若 Tailwind 任意值 class 未生成或被覆盖，改为直接绑定 CSS variable。

每个一级章节顶部必须有分割线：

- `border-t border-[var(--color-border-subtle)]`
- 上内边距使用 spacing token，例如 `pt-[var(--space-400)]`
- 首个 `组件示例` 章节也要有分割线，页面标题区和示例区边界必须清楚

## 示例分组

`组件示例` 下只允许三个二级分组：

1. `样式变体`
2. `状态变体`
3. `形态变体`

不要再按“前后缀 / 特殊文本 / 场景 / 尺寸”等拆成额外二级分组；这些差异统一归入 `形态变体`。尺寸样例默认不进入单组件详情页，除非组件自身的公开 API 明确以 size 为核心能力；普通数据输入组件的尺寸后续由整站主题配置调节。

### 样式变体

所有数据输入组件都必须有 `样式变体`，且排序一致：

1. `边框式（默认）` / `Outlined (default)`
2. `填充式` / `Filled`
3. `下划线` / `Underlined`

API 命名使用英文：`outlined` / `filled` / `underlined`。如果存在历史 `default`，只作为 `outlined` 的兼容别名，不在详情页作为独立样式展示。

样式变体说明：

- `outlined`：显性四边描边，是默认视觉。
- `filled`：背景填充替代显性边框，中文叫“填充式”或“填充形态”，不要叫“填充态”。
- `underlined`：常态只保留下划线；点击 / focus 后仍然是下划线，只允许底线加粗或变为 active 色，不出现四周边框。

### 状态变体

所有可输入 / 可操作组件都必须显性展示关键状态。数据输入组件按以下顺序：

1. `正常`
2. `悬浮`
3. `点击`
4. `禁用`
5. `校验失败`

`点击` 按 focus 态展示，不按瞬时 active pressed 态展示。预览可用固定 class 显示 focus 边框 / ring，但代码示例必须诚实表达该状态如何生成或仅用于展示。

状态文案和验收矩阵用中文名，代码和 API 保留英文名，例如 `aria-invalid`、`disabled`、`focus`。

### 形态变体

形态变体承载组件差异化能力。Input 当前排序是黄金样本：

1. 第一行，不带说明文本，保持输入框视线对齐：`前置图标` > `前缀文本` > `后缀文本`
2. 第二行，带说明文本：`密码` > `电话` > `可清空`
3. 第三行，不带说明文本，名称不带“能力演示”：`数字` > `金额` > `百分比`
4. 第四行，带说明文本：`帮助图标` > `复制图标`

其他组件的形态变体可以差异化，但必须满足：

- 都归入 `形态变体` 分组，不新增并列二级分组。
- 同一行尽量统一是否带说明文本，避免输入框 / 触发器视线错位。
- icon、prefix、suffix、clear、help、copy、password toggle 等交互必须用已有 primitive / icon registry。
- 帮助图标必须有 tooltip，hover 与键盘 focus 都可触发。
- 复制图标必须有点击成功反馈，例如短暂切换 icon / tooltip / aria-label。
- 数字、金额、百分比这类演示若只是 Input 能力展示，不要标“能力演示”；若需要步进、min/max、精度格式化，应导向 NumberInput。

## 示例卡

示例卡必须做到预览与代码 1:1：

- 每张卡有卡片标题、`预览 / 代码` tabs。
- `预览` 只展示组件本体和必要说明文本，不展示额外教程文字。
- `代码` 与预览一致；新增 variant、状态、prefix/suffix、tooltip、copy feedback 都必须同步到代码片段。
- 示例 `id` 全局唯一，避免 React key、anchor 和 conformance 误判。
- 示例卡使用 bounded-fluid 网格：小屏 1 列，中屏 2 列，桌面 3 列。推荐 `grid gap-[var(--space-200)] md:grid-cols-2 lg:grid-cols-3`。
- 示例画布使用稳定最小高度 token，避免不同 helper 文案导致卡片跳动。
- 卡片用于重复项；不要把页面 section 再做成外层卡片，也不要 card 套 card。
- 若组件页面受主题设置影响，例如 Input 高度跟随“间距密度”，预览和代码必须同源变化；Input 当前 contract 是紧凑 28px（`--size-control-sm`）、默认 32px（`--size-control-md`）、舒展 36px（`--size-control-lg`）。

## 元信息与标签

质量、成熟度、依赖、token、源文件、测试证据等统一放入 `元信息` 章节。

- 页面标题右侧不要放质量标签。
- 黄金样本锚点可在左侧导航和详情页标题区展示皇冠标识，字段名使用 `goldenStandard`；不要把它混同为质量状态 badge。
- 一级标题右侧不要放局部 badge。
- 示例卡标题右侧只放 `预览 / 代码` tabs，不放额外状态标签。
- `元信息` 可展示成熟度 badge、质量状态 badge、依赖、token、source。

## 命令行、用法、验收

`命令行`：

- 展示 add 命令和 check 命令，下方必须有简短说明文案：add 做什么、check 验什么、这些示例如何对应同一个 primitive。
- 命令行可复制，并有成功反馈。
- 不把 CLI 文案放入示例分组。

`用法`：

- 左侧写“何时用”，右侧写“何时不用”。
- 使用 Input 黄金页同款 DO / DON'T 双栏彩色面板：左侧 success soft，右侧 destructive soft；每条用短 checklist，不写长教程。
- 对数据输入组件，必须说明何时改用 Textarea / NumberInput / Select 等更准确 primitive。

`验收规范`：

- 必须覆盖样式变体、状态变体、形态变体、可访问性。
- 状态矩阵使用中文名：`正常 / 悬浮 / 点击-focus / 禁用 / 校验失败`。
- 使用 Input 黄金页同款三列结构：`验收项清单` / `验收手段` / `报告输出`，下方可追加一个 `报告示例`。不要只放一组扁平 checklist。
- 机器证据至少包含 `tokens:lint`、相关 conformance、`design-harness:check` 或 `build`；视觉关键项用浏览器 computed style / screenshot 验证。

`最佳实践`：

- 必须展示为 `Benchmark 参考卡片`，放在 `验收规范` 之后、`元信息` 之前；不要再使用表格，也不要使用旧的 benchmark 表标题。
- 默认 benchmark 备选池共 10 家：Ant Design、Material Design、Untitled UI、shadcn/ui、Atlassian Design System、Carbon Design System、Salesforce Lightning Design System / SLDS、Shopify Polaris、Apple Human Interface Guidelines、Salesforce Lightning。
- 组件补货或更新时，调研必须从这 10 家范围内选择，默认至少覆盖 5 家；最终页面展示最值得吸收的 3 家。
- 展示为三列卡片：桌面三列、窄屏单列；每张卡纵向排布 `logo 标识`、`系统名`、`可比资产`、`示例覆盖`、`可吸收点`、`官方链接`。
- logo 必须优先展示本地图片资产，默认放在 `public/benchmark-logos/` 并通过 `/benchmark-logos/<name>.svg|ico` 引用；有本地资产时禁止只用纯字母占位。
- 不在运行时热链外部 logo。若官方 / Simple Icons 下载失败，可用本地自绘几何 fallback，但必须在报告里说明降级。
- 官方链接优先指向一手文档；不要用博客、截图或二手总结替代官方真源。
- 若弱组件、内部场景或小众能力没有足够可比资产，可以展示 1-2 家，甚至不展示；但必须在报告中说明降级原因。
- 对话报告中也必须输出 3 个可吸收点和链接，供用户判断是否写回页面。

`元信息`：

- 使用字段式 `dl` 行布局，外层必须有 Button / Input 黄金页同款整体容器：`divide-y rounded-[var(--radius-lg)] border bg-card px-[var(--space-150)]`。
- 元信息是一个整体信息面板，不拆成多张独立卡片；内部字段用横向分隔线区分。
- 字段至少包含：类型、适用端、成熟度、质量状态、依赖、Token、源文件；如页面有 importLine，可补导入方式。
- 元信息不得承载教程文案，教程内容放在 `用法` 或 `验收规范`。

## 形态变体边界

- `形态变体` 只展示组件公开 API、插槽、方向、组合或交互能力。
- 禁止用页面占位文案、普通工具栏筛选、字段布局、章节边界、报告输出等“页面结构”凑形态变体。
- 如果某组件没有足够独立的形态能力，可以少放形态示例；不要为了凑三张卡制造假变体。
- 形态示例标题应是能力名，例如 `图标按钮`、`外链`、`上下分栏`；不要写“能力演示”“占位文案”“字段布局”这类泛称。

## 验证

组件详情页升级至少运行：

- `pnpm component-golden:check`
- `pnpm tokens:lint`
- `pnpm conformance:check <component-id>`，若该组件已纳入 conformance
- `pnpm design-harness:check` 或 `pnpm build`

`component-golden:check` 必须检查：

- Input 黄金样本仍读取主题密度，并保持紧凑 28px、默认 32px、舒展 36px。
- Input 预览和代码片段都跟随密度变化。
- benchmark 参考卡使用 `/benchmark-logos/` 本地 logo 资产，不退回纯字母占位。
- 左侧导航和 Input 详情页仍能展示黄金样本皇冠标识。

涉及页面标题、一级标题、二级标题时，必须用浏览器 computed style 验证：

- 页面标题实际 `font-size / line-height / font-weight` 等于 `--text-title-xl`
- 一级标题实际等于 `--text-ui-title-large`
- 二级标题实际等于 `--text-ui-title-small`

验收报告不要只说“用了 token”，要报告实际 computed 值。
