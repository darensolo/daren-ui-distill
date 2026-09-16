---
name: ui-decomposer
description: "拆解受授权的外部 UI 来源或证据，交付带来源、未知项和生成就绪状态的 C9 Blueprint。用户要求 UI 拆解、界面提炼、decompose 或 dissect-only 时使用；不用于生成、适配、入库或上架。"
metadata: {"skill_id":"ui-decomposer","governance_status":"active","required_references":[],"optional_references":[],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# UI 拆解提炼（UI Decomposition）

把已授权来源或证据整理成可校验的 C9 Blueprint 和同源人读投影。这个入口只负责 `dissect`；不生成组件、不改变目标风格，也不写资产库或设计站。

## 路由

- `$ui-decomposer`、UI 拆解、界面提炼、decompose、dissect-only → 本技能。
- 用户要求复刻、适配或检修时，交付 Blueprint 后按明确终点转交相应入口；不得自行追加阶段。

## 执行契约

1. 确认来源属于工具声明的 supported source，并锁定 `baseDir`、read roots、selectors 与权限。网页 URL、账号数据、cookie/session 和未授权来源返回 typed unsupported/blocked。
2. 已有有效 CaptureBundle 时直接编译；没有时仅捕获明确选择的资源。静态内容不得执行，未知状态保持 unknown。
3. 校验并交付 Blueprint、digest、runtime evidence gaps 和同源投影。`generationReady` 与来源运行已验证是两条独立结论。
4. 只拆解必须是零 Generator、零适配、零候选执行、零 Library/Site effect。需要入库或上架时显式交给 `design-asset-registrar` / `design-asset-publisher`，不得由本 skill 顺带执行。

所有写入仍受调用时 scope 约束；skill 文本不能扩大权限。
