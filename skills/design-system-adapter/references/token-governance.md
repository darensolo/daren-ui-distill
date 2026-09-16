# Token Governance

读取时机：涉及颜色、主题、字号、行高、间距、圆角、控件尺寸、图标尺寸、阴影、动效、focus ring、layout width 或视觉 token 漂移。

## 真源优先级

1. `daren-design/design-tokens/tokens/semantic.json`：跨平台 token 单一真源。
2. `daren-design/design-tokens/dist/desktop/generated-tokens.css`：token build 产物。
3. `daren-design/src/styles/generated-tokens.css`：Daren Design 当前消费的生成 CSS 副本。
4. `daren-design/examples/mindex-workbench/src/styles/generated-tokens.css`：下游案例消费副本。
5. 目标项目自己的 `src/styles/generated-tokens.css` 或等价文件：其他下游消费副本。
6. `daren-design/src/daren-design/registry/data/tokens.ts`：展示和说明数据，必须与 token 真源一致。

不要用旧路径或截图估色作为真源。

## L1 映射规则

| 视觉角色 | 优先 token |
|---|---|
| 页面背景 | `--color-background` |
| 次级 surface / sidebar | `--color-background-secondary` |
| hover / weak active | `--color-background-tertiary`、`--color-accent` |
| 卡片 / popover | `--color-card`、`--color-popover` |
| 主文字 | `--color-foreground` |
| 次文字 | `--color-foreground-secondary`、`--color-muted-foreground` |
| 弱文字 / placeholder | `--color-foreground-tertiary` |
| 标准边框 | `--color-border` |
| 弱分隔 | `--color-border-subtle` |
| 标准边框属性 | `--border-solid-neutral`、`--border-dashed-neutral`、`--border-solid-interactive`、`--border-dashed-interactive` |
| 品牌交互 | `--color-brand`、`--color-brand-muted`、`--color-brand-foreground` |
| 成功 / 警告 / 危险 | `--color-success`、`--color-warning`、`--color-destructive` 及 muted/foreground |
| 特殊/高级状态 | `--color-purple`、`--color-purple-muted` |
| 二级强调 | `--color-blue`、`--color-blue-muted` |
| 信息/中性强调 | `--color-cyan`、`--color-cyan-muted` |
| focus | `--color-focus-ring`、`--focus-ring-width`、`--focus-ring-offset` |

## 尺寸刻度

- 间距只用 `--space-1` 到 `--space-8`：4 / 8 / 12 / 16 / 20 / 24 / 28 / 32。
- 圆角只用 `--radius-sm` 4、`--radius-md` 8、`--radius-lg` 12、`--radius-xl` 16、`--radius-full`。
- 边框宽度只用 `--border-width-thin` 1px、`--border-width-strong` 2px；普通 border 不设 3px，3px 留给 focus ring 或特殊 outline。
- 边框基础组合只用四套：`--border-solid-neutral`、`--border-dashed-neutral`、`--border-solid-interactive`、`--border-dashed-interactive`。组件状态优先消费 `--border-control-default`、`--border-control-hover`、`--border-control-active`；active 的视觉 2px 用 `--shadow-border-control-active` 叠加，避免布局抖动。
- 控件高度：紧凑 `--size-control-sm` 28，默认 `--size-control-md` 32，大号 `--size-control-lg` 36。
- 图标尺寸：`--size-icon-xs` 12、compact 14、sm 16、md 20、lg 24、xl 28。
- 工具型界面默认正文：`--text-ui-body-default` 14 / `--leading-ui-body-default` 22。
- 文档正文可用 `--text-ui-body-large` 16，但 compact panel、sidebar、dock、dashboard 不要默认 16px。

## 尺寸行为词表

尺寸行为不是新 token，而是描述组件如何消费 token、父容器和 min/max 护栏：

- `hug-content`（贴合内容 / Figma Hug Content）：短菜单、按钮、Badge、Tooltip。按内容自然宽高，但必须有 max-width 或文本截断 / 换行策略。
- `fill-container`（撑满容器 / Figma Fill Container）：Input、表格、主工作区、滚动列表。父级必须配 `min-w-0` / `min-h-0`、`flex-1` 或 `minmax(0,1fr)`。
- `fixed-token`：icon button、control height、固定 rail / ribbon。尺寸来自 `--size-*` 或 layout token，不随文案漂移。
- `bounded-fluid`：Dialog、Sheet、Dock、Panel、Cascader。必须说明 min / preferred / max，低于 min 后进入 collapse / overlay / drawer。
- `scroll-contained`：长菜单、面板 body、列表。按内容增长，到 max-height 后内部滚动。
- `collapse-or-overlay`：父容器低于可读下限时，不继续硬挤内容，改为折叠、浮层、drawer、分页或单列 drill-in。

## Client layout tokens

客户端工作台必须使用这些布局 token：

- Ribbon：`--layout-client-ribbon-w` = 44px
- Vault Dock：min / pref / max = `240 / 300 / 380px`
- Agent Dock：min / pref / max = `320 / 380 / 480px`
- Workspace min：`--layout-client-workspace-min-w` = 560px
- 文档阅读宽：`--layout-client-workspace-readable-w` = 700px

Dock 不要低于 min 后继续挤压内容；改为 collapse / overlay / drawer。

## 允许裸值的情况

- token 真源文件本身。
- 生成后的 token CSS。
- 明确有 `visual-token-exempt-file` 或 `intentional-raw-color` 注释的展示 / 反例 / palette 文件。
- 第三方源版复刻的 Source Replica 阶段；Design-System Adaptation 阶段必须映射回 token。
- 复杂图形、截图、canvas、真实资产颜色；需要在注释中说明它不是 UI token。

## 检查命令

先从当前仓库 `package.json` 核对脚本，再选择：

- token 生成：`pnpm tokens:build`
- token 漂移：`pnpm tokens:check`
- token schema：`pnpm tokens:schema`
- token snapshot：`pnpm tokens:snapshot:verify`
- **消费侧合规门禁（首选）：`pnpm tokens:lint`** —— 棘轮扫描 A–G 七类裸色/裸值/裸层级/原生件，出现 baseline 之外新增即 exit 1。这是 CI `design-system-gate` 与 run-iteration `verifying` 的机读验收口径。
  - 列全部存量供烧降：`pnpm tokens:lint:report`；批准烧降/豁免后收紧 baseline：`pnpm tokens:lint:update`
  - 豁免：行内 `token-lint-ignore: 理由`；区块 `/* token-lint-disable: 理由 */ … /* token-lint-enable */`
- layout token / LRC 漂移：`pnpm layout:lint`；报告：`pnpm layout:lint:report`
- 设计系统聚合报告：`pnpm design-gates:report`
- UI build / typecheck：项目 package 的 `build`
- 临时手动裸色扫描（无 tokens:lint 的下游仓兜底）：`rg -n "(#([0-9a-fA-F]{3,8})\\b|rgba\\(|hsla\\(|hsl\\(|rgb\\()" <ui-files>`

`tokens:lint` 已内置 exemption 与 baseline；手动 rg 命中不一定全是错误，要结合 exemption 和是否在 UI 业务样式中判断。

## Token 任务档位

- **Lite**：只消费已有 token，不改 token 文件；通常只需局部 smoke，必要时跑 `tokens:lint`。
- **Normal**：页面样式调整、状态补齐；跑 `tokens:lint`，必要时 `design-harness:check`。
- **Reusable Pattern**：新增可复用组件 / template 的 token 消费约束；跑 `tokens:lint`、`design-harness:check`、`design-gates:report`。
- **Full Contract**：修改 `semantic.json`、生成链路、layout token 或 DTCG schema；跑 `tokens:build`、`tokens:check`、`tokens:schema`、`tokens:lint`、`design-gates:report`、`build`，并说明哪些消费副本被更新。
