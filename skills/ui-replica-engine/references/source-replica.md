# 阶段 1 —— 源版复刻（Source Replica）：原版 1:1 可运行复刻

D24 page 分支兼容锚点：

- 宿主提供旧 D24 `replica-fidelity-contract.md` / `invocation-contract.md` 时，读取其中 page 契约；独立插件不得假设固定仓库或绝对路径。
- 宿主未提供旧契约时，以随插件发行的 UI Distiller contracts/runtime 为准；无法安全映射的旧字段 fail closed。
- v0.1 machine gates：`pnpm tokens:lint`、`pnpm design-harness:check`、结构/source report
- v0.1 manual gates：状态矩阵、截图 diff、交互巡检，均留 `evidenceRef`

源版复刻（Source Replica） 是源应用的可运行 基准版本（benchmark）。它的目标不是替换进用户设计系统，而是先回答一个问题：**我们是否已经准确复刻了源应用本身？**

没有 源版复刻（Source Replica），后续设计系统适配（Design-System Adaptation）很容易混淆两类问题：到底是源应用没复刻准，还是设计系统替换把结构破坏了。

## 核心原则

1. **先像源应用，再像自己。** 本阶段尽量保留源应用的布局、颜色、字体近似、间距、圆角、图标、状态、菜单、主题和交互动效。
2. **只做可运行复刻，不接真实业务。** 可以使用 fixture 数据、mock 菜单和本地状态；但按钮不能无响应。
3. **保持可分离。**源版复刻（Source Replica）应当能以独立路由、独立组件状态、独立页面或独立分支保留，供后续对照、复用和回归。
4. **按 L1-L4 验收。** 令牌（Tokens）、组件（Components）、模式（Patterns）、模板（Templates） 都要有基线、实现和验收项。

## L1 —— Source 令牌（Tokens）

记录并实现源应用的视觉变量：

- 亮 / 暗主题背景、文字、边框、hover、active、focus、accent。
- 字体族近似、字号、行高、字重。
- 间距、圆角、阴影、动效时长。
- 图标尺寸、线宽、对齐规则。

在本阶段允许使用源应用真实或近似值作为 基准版本（benchmark），但必须标明来源。不要把这些值混进最终设计系统适配（Design-System Adaptation）的 token 真源。

## L2 —— Source 组件（Components）

主界面可见基础组件必须有源应用同类行为：

- icon button、普通按钮、segmented control、tab、tree row、menu item、input/search、popover、dialog/sheet、status item。
- default / hover / active / focus / disabled / empty / loading。
- 键盘和关闭行为：Esc、点击外部关闭、焦点返回、菜单关闭。

## L3 —— Source 模式（Patterns）

按场景复刻源应用的组合行为：

- 文件树 / 导航树：展开、折叠、选中、缩进 guide、长文本截断、空文件夹。
- tab group：新建、切换、关闭、active 焦点态、拖拽或占位反馈。
- side dock：展开、折叠、切 tab、固定底部区域。
- command palette / more menu：菜单壳、分组、分隔线、禁用项、关闭行为。
- split / resize：拖拽调宽、min / max、collapse / restore。
- 状态栏：可点击项、tooltip / menu / disabled 反馈。

真实业务不可用时，也要提供源应用风格的本地 UI 反馈。

## L4 —— Source 模板（Templates） / Shell

复刻整页骨架：

- 应用壳、窗口 / 浏览器运行时差异、titlebar / tab strip / header。
- 主区域拓扑：ribbon、左栏、中央工作区、右栏、状态栏。
- 默认布局、折叠布局、窄屏或最小窗口布局。
- 侧栏宽度、右栏宽度、split 比例等用户状态的默认值和持久化策略。

## 验收

源版复刻（Source Replica） 通过条件：

1. 构建 / 类型检查通过，控制台无错误。
2. 首屏与源应用截图能逐区对照，明显差异有记录。
3. 主界面交互矩阵中源版复刻（Source Replica）列全部为 `verified`、`blocked` 或 `deferred`。
4. 无响应按钮为 0；不可用功能必须有 disabled / 空态 / 占位反馈。
5.源版复刻（Source Replica）可以独立打开，不依赖设计系统适配（Design-System Adaptation）才能运行。

完成后再进入 `replicate.md` 做设计系统适配（Design-System Adaptation）。
