# Adapter Plan

在完成 `asset-audit.md` 并得到人工确认后，再输出本计划。它是界面适配进设计系统的执行合同。未经确认的 Evolution Proposal 不能进入执行任务。

## 1. 输入与目标

| 项目 | 内容 |
|---|---|
| 输入界面 | <Source Replica / 现有页面 / 原型 / 截图> |
| 输入来源 | <文件 / 路由 / 截图 / app-replica plan> |
| 目标设计系统 | <Daren Design / 其他> |
| 目标 token 真源 | <路径> |
| 目标组件 / pattern 文档 | <路径> |
| 本轮范围 | <页面 / shell / 区域 / 组件> |
| 非目标 | <本轮不改的结构 / 业务 / 后端> |
| 已确认审计项 | <AUD / EVO id 列表> |
| 暂缓 / 拒绝项 | <backlog / rejected / local-only> |

## 2. L1 Foundations / Tokens 映射

| 源角色 | 源值 / 证据 | 目标 token | 替换规则 | 审计判断 | 是否需新增 / 扩展 | 验收 |
|---|---|---|---|---|---|
| 主背景 | | | | | | |
| 次背景 / surface | | | | | | |
| 文本层级 | | | | | | |
| 边框 / divider | | | | | | |
| hover / active / focus | | | | | | |
| 字体 / 行高 | | | | | | |
| 间距 / 圆角 | | | | | | |
| 动效 | | | | | | |

## 3. L2 Components 映射

| 源组件 | 源行为 / 状态 | 目标 primitive / 组件 | 替换策略 | 审计判断 | 是否需新增 / 扩展 | 验收 |
|---|---|---|---|---|---|
| icon button | | | | | | |
| tab | | | | | | |
| tree row | | | | | | |
| menu item | | | | | | |
| popover / dialog / sheet | | | | | | |
| split divider | | | | | | |
| status item | | | | | | |

## 4. Pattern 横轴映射

| 源模式 | 源 UX 问题 | 目标 pattern | 替换策略 | 审计判断 | 候选资产 | 验收 |
|---|---|---|---|---|---|
| 文件树 / 导航树 | | | | | | |
| tab group / split | | | | | | |
| side dock / panel group | | | | | | |
| command palette / more menu | | | | | | |
| empty / loading / error | | | | | | |

## 5. L4 Templates / Shell 映射

| 源页面骨架 | 源结构 | 目标 template / shell | 替换策略 | 审计判断 | 候选资产 | 验收 |
|---|---|---|---|---|---|
| app shell | | | | | | |
| workbench shell | | | | | | |
| settings / detail page | | | | | | |
| responsive / collapsed shell | | | | | | |

## 6. 执行任务

| 任务 ID | 任务 | 输入依据 | 产出文件 | 页面验收 | 设计系统反馈 |
|---|---|---|---|---|---|
| ADAPT-001 | 替换 L1 token | L1 映射表 | | 无硬编码漏色，主题可切换 | token 候选已记录 |
| ADAPT-002 | 替换 L2 primitive | L2 映射表 | | hover / focus / disabled 正常 | 组件缺口已记录 |
| ADAPT-003 | 替换 / 对齐 pattern | Pattern 映射表 | | 交互不退化 | pattern 候选已记录 |
| ADAPT-004 | 替换 L4 shell | L4 映射表 | | 布局不漂移 | template 候选已记录 |

只有 `accepted` 的审计项可以进入执行任务。`backlog` 可以记录为后续任务，但本轮不得修改设计系统真源。

## 7. 页面验收

1. 构建 / 类型检查通过。
2. 控制台无错误。
3. 浅 / 深色主题可切换，无硬编码漏色。
4. 主界面交互矩阵通过；适配后不比输入界面少交互反馈。
5. 与输入界面对照：结构、区域、状态流不无计划漂移。

## 8. 设计系统反馈验收

每个候选资产必须给出：

- 层级：L1 / L2 / L3 / L4。
- 证据：来自哪个页面、截图、交互、代码或用户反馈。
- 适用范围：哪些产品 / 页面 / 场景可复用。
- 命名建议：token / component / pattern / template 名。
- DO / DON'T。
- 依赖：已有 token、primitive、pattern。
- 推荐动作：`reuse` / `extend` / `new-candidate` / `local-only`。
