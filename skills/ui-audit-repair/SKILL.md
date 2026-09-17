---
name: ui-audit-repair
description: "独立检查已有 UI 资产或 Blueprint，并在用户明确要求时执行有范围、最多三轮的修复。纯检查现有资产（含 Daren 合规）统一走此入口；默认 audit-only，不重采来源、不改基准。"
metadata: {"skill_id":"ui-audit-repair","governance_status":"active","required_references":[],"optional_references":[],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# UI 质检修复（UI Audit & Repair）

对已有资产或 Blueprint 做独立检查；只有用户明确说“检查并修复 / repair / 修好”才进入有界修复。默认模式始终是 `audit-only`。

验证与复检采用 single-pass evidence；风险决定首次 checkset，已绑定当前候选的有效结果不重复执行。

## 路由与模式

- `$ui-audit-repair`、UI 检修、质检、audit、inspect、只检查 → `audit-only`。
- 检查并修复、repair、修好 → `repair`，且必须有明确 subject revision、finding 范围、write scope 和剩余预算。
- 用户要求创建、修改或适配到 Daren 时先走 `design-system-adapter`，完成后可将其产物交本 skill 独立验收；终点只是检查时不调用 adapter。

## 执行契约

1. 接收已有资产或 Blueprint，无需历史 job 或 capture；不得为了检查而重新捕获、生成或适配。
2. `audit-only` 只写独立报告/隔离缓存，不改被检对象、来源或基准。报告必须绑定 profile、checkset、subject revision 和 freshness。
3. Blueprint 本期仅支持完整性检查，repair 为 typed `unsupported`。
4. 资产 repair 只改选定 open finding，复检通过才接受；同一 job 总计最多三轮，恢复不得重置预算。
5. 本 skill 不执行 `register` 或 `publish`；通过检查的资产仍须显式交给 `design-asset-registrar` / `design-asset-publisher`，两类写入分别审批。

缺隔离、缺基线、报告过期或权限不足时返回 blocked/unsupported，不降低检查标准。

## 用户可见的开始与交付

开始 `audit-only` 前，用一句话明确说明：当前操作只读取被检对象，不修改被检对象、来源或基准；允许的写入仅限独立报告或隔离缓存，并说明其位置（若已知）。不要要求用户先记住 skill 名称。

QualityReport 的用户可见结尾必须包含：

- 当前模式、subject revision、profile/checkset 与 freshness；
- 按严重级别汇总的 finding 数量，以及仍为 unknown/unclassified 的必检项；
- 推荐的下一步顺序，并提供一条可以直接使用的自然语言指令，例如“只修复这份报告中的 P1 finding，完成后对受影响状态重新审计”；
- repair 会触及的 finding 范围和 write scope；用户只要求检查时不得自动进入 repair。用户已经明确要求修复且范围清楚时，不再追加机械式二次确认。

若存在同一 subject 的上一份新鲜报告，结果应区分 resolved、persisting、new 和 not-rechecked；无法建立稳定 finding 身份时明确说明当前不能可靠比较，不按文案相似度猜测。

## 高保真资产的持续差异发现闭环

当目标包含“高保真、1:1、复刻、对齐旧版”时，结构完整性和交互可触发只能算开始，不能据此交付。审计必须先把来源与候选锁在相同的 `state × viewport × theme × locale × container width/crop`；整页截图与组件裁片、不同状态或不同容器宽度不得直接互判。

每个已观察状态至少建立以下 oracle。缺任一项时记 `unknown`，高保真结论不得为 passed：

1. **图标身份**：记录来源图标库、导出名或 SVG path digest，并核对候选身份与 14/16 等实际尺寸；语义名称相同不等于图形身份相同，禁止用另一图标库的同名 glyph 冒充。
2. **几何与对齐**：记录关键节点 bounding box 及父子相对关系，至少包含元素顺序、起始边、交叉轴对齐、gap、padding、宽高；检查目标设计系统基础组件的默认 `justify-content`、padding、min-width 等是否覆盖源样式。
3. **尺寸与溢出约束**：记录 min/max width/height 的计算值、overflow、scrollHeight/clientHeight、折叠后占位高度、line-clamp 和遮挡；短内容、刚好到阈值、长内容都要覆盖。
4. **视觉与内容**：核对可见文案、换行、字重、颜色、边框、圆角、背景与层级；只允许预先登记的动态区域 mask，不能遮掉组件主体。
5. **交互时序**：核对 hover/focus/keyboard/click、流式追加、动画时长、延迟收起、用户滚动打断与恢复；静态截图不能替代动态证据。

修复采用发现闭环：先产出 finding → 修选定 finding → 把 finding 固化为可复跑 oracle 或回归测试 → 对最新 revision 定向重跑该 oracle 与受影响状态。只有共享 token、primitive、layout 或运行时变化可能影响矩阵多个状态时，才补跑对应矩阵切片；不重复无关状态，也不在 PR、CI 或 merge 重跑同一候选已通过的矩阵。若定向复检发现新的差异，继续登记并进入下一轮。三轮预算耗尽仍有 residual 时，明确返回 residual，不得把“用户可以先看看”包装成验收就绪。

用户人工验收发现的任何本可由上述 oracle 检出的差异，都同时视为审计 checkset 的缺陷：修资产之外，还必须补对应 oracle，并证明该负例会失败、修复后会通过。只有最新 revision 的受影响矩阵无新增 P0/P1、无 unclassified/unknown 必检项，才可邀请用户验收；未受影响且仍新鲜的矩阵结果直接复用。
