# Benchmark Systems

## Roster vs. required floor (read first)

Two different lists, do not conflate them:

- **Research roster (this menu)** — the systems an audit *may and should* consider, by relevance to the asset. Source: the harness/layout benchmark report `docs/mindex-agentos/research/design-harness-layout-design-system-benchmark-2026-06-19.md`. Pick the systems where the asset (or an adjacent pattern) actually exists; you are not required to cover all of them.
- **Required floor (machine gate)** — the minimum every benchmark audit evidence MUST satisfy to pass `benchmark-audit:check`. Owned by `scripts/benchmark-audit-check.mjs` (`MIN_SYSTEMS`): a count floor of **at least 3 systems**, matching the current host benchmark standard. The gate is count-based, not a fixed name set — pick the 3+ systems by relevance to the asset. Raising the floor would not break existing evidence (all carry ≥3), but lowering below 3 or pinning specific names is a deliberate host-contract change.

Cover at least 3 relevant systems; add more roster systems whenever they are better evidence for the specific asset.

## Research roster

Benchmark audit draws official guidance from (pick by relevance):

| System | Official docs | Best evidence for |
|---|---|---|
| Atlassian Design System | <https://atlassian.design/> | AI-readable design intent, page shell / panel, anatomy + do/don't |
| Ant Design | <https://ant.design/> | Broadest React component + example matrix; ProComponents data patterns |
| Material Design (M3) | <https://m3.material.io/> | Most balanced generalist coverage + visualized guidance |
| IBM Carbon | <https://carbondesignsystem.com/> | Completeness ceiling, data-dense states, AI transparency (Carbon for AI) |
| Salesforce Lightning (SLDS) | <https://www.lightningdesignsystem.com/> | Complex object / record page, related list, activity timeline, data table |
| Shopify Polaris | <https://polaris.shopify.com/> | Admin task flows, ResourceList / IndexTable, UX writing, layout primitives |
| Adobe React Spectrum / React Aria | <https://react-spectrum.adobe.com/> | Complex interaction, a11y, keyboard, collection/selection models |
| Microsoft Fluent 2 | <https://fluent2.microsoft.design/> | Enterprise component ecosystem, Copilot AI-embedded productivity patterns |
| shadcn/ui | <https://ui.shadcn.com/> | Distribution mechanism (registry / CLI / MCP / copy-source); same lineage as Daren |
| Untitled UI | <https://www.untitledui.com/> | Page-level examples, state coverage, modern SaaS visual completeness bar |

Considered but not in the default ten (swap in when relevant): SEEK Braid (layout-contract母体, not a component-example source), Ant Design X (niche AI-chat toolkit; use for AI primitive expressiveness only), GitHub Primer, Apple HIG (principles, no component implementation).

## Rules

- Use official docs or official examples only.
- Do not use unofficial mirrors as evidence.
- Provide direct links that the user can open to inspect source examples.
- Record source URL, access time, summary, adoption decision, and failure downgrade.
- Do not store long external excerpts.
- Do not copy external source code or visual assets.

## Dimensions

Collect:

- Variants.
- Sizes and density.
- States.
- Slots and anatomy.
- Option/content model.
- Interaction behavior.
- Keyboard and accessibility.
- Empty, loading, and error states.
- Real scenarios.
- Usage guidance.

## Output

Benchmark evidence must include:

- Per-system findings: whether the system has the component/pattern, which examples it provides, and what is adjacent but not equivalent.
- Common capabilities shared by at least three systems.
- Useful ideas from one or two systems.
- Explicitly rejected ideas with reasons.
- Daren gaps.
- Suggested refill actions.

Machine gates validate schema and source records only. Human review validates research quality and adoption judgment.

## Benchmark-First Report Shape

Use this shape for `proposal` and for report-only `upgrade` / `realign`. Updating an existing component must not collapse into a compliance-only gap report; the user should first see the benchmark basis for the suggested refill.

This shape applies to both written evidence reports and the user-facing final response. A final response that only says "I wrote <proposal.md>" and then lists P0/P1/P2 compliance gaps is incomplete.

0. **Current Daren state**
   - 2-4 bullets: source/example/evidence status, whether the asset is missing, source-ready, registered, or pre-verification.
   - Keep this brief; do not let local compliance replace benchmark research.

1. **Benchmark conclusion table**
   - Columns: system, comparable asset availability, example coverage, adoption note, official links.
   - Include official links close to each row, not only in evidence.

2. **Per-system absorbable points**
   - For each system, give a short paragraph or bullets:
     - what this system is best evidence for;
     - concrete absorbable examples/states/anatomy;
     - comment on fit for Daren;
     - what to reject or defer.
   - Do this even when the asset already exists.

3. **Examples to absorb**
   - P0: examples required for a credible reusable asset.
   - P1: examples that materially improve usability, accessibility, or real-world fit.
   - P2: polish, advanced scenarios, or second-pass expansion.
   - Phrase each item as a concrete example section to prepare, not as an abstract gap.

4. **Common practices**
   - Synthesize shared anatomy, states, interaction patterns, accessibility guidance, density/layout choices, and real scenarios.

5. **Daren positioning**
   - State how Daren should interpret the asset: standalone component, composition primitive, pattern, template, or helper-only.
   - Name what to absorb and what to reject.

6. **Host compliance tail**
   - Briefly list registry/source/example/evidence/conformance gaps after benchmark recommendations.
   - Do not let this section replace the benchmark proposal unless the user explicitly asks for a compliance-only audit.

7. **Evidence / verification / residual risk**
   - List evidence files written, gates run, expected failures, and human-review status.

For component assets, prefer reusable example-section names such as `basic`, `variants`, `states`, `slots`, `validation`, `accessibility`, `composition`, `scenario`, or a family-specific equivalent from the host contract. A later publisher may project the same example bundle without changing its registration semantics.

## Evidence Shape Additions

Benchmark JSON may include extra human-readable research fields in addition to the required gate fields:

- `reportStyle`: e.g. `simplified-research-template`.
- `researchBoundary`: asset, mode, local truth checked.
- `benchmarkConclusion[]`: system, comparable asset, example coverage, absorbable points, comment, official link.
- `perSystemAbsorbablePoints`: keyed by normalized system name.

Keep the required top-level `systems[]`, `commonCapabilities[]`, `adoptedIdeas[]`, `rejectedIdeas[]`, `darenGaps[]`, and `suggestedRefillActions[]` so `benchmark-audit:check` can still validate the report.

## Asset Research Prompt

Use this prompt shape when Darren wants to launch an asset research / refill proposal:

```text
请使用 design-asset-registrar skill 对 Daren Design 资产发起 benchmark-driven refill proposal。

assetKind: component
assetId: <asset-id>
mode: proposal
intent:
  调研大厂官方设计系统中是否有这个组件 / 相邻模式 / 字段 primitive；
  梳理各家的官方示例矩阵、状态、变体、交互、a11y 和真实场景；
  提炼 Daren Design 应吸收的具体组件页示例清单，按 P0 / P1 / P2 分级；
  最后只附简短站内合规缺口，不要让合规审计替代 benchmark proposal。

要求：
1. 先读取 design-asset-registrar 的 SKILL.md，以及 workflow / benchmark-systems / approval-policy / evidence-schema。
2. proposal 模式不得修改资产、源码、组件页、registry、catalog 或设计系统真源；只允许新增 evidence 报告。
3. 使用官方来源，并在最终输出中给出可点击链接，方便直接打开源头页面。
4. 对每家系统说明：有没有对应组件；如果没有，是否有相邻 field / pattern / template；它提供了哪些示例。
5. 输出顺序必须是：
   - 当前 Daren 状态
   - 大厂 benchmark 结论表
   - 逐家可吸收点和评论
   - P0 / P1 / P2「建议吸收的具体示例」清单
   - 共性做法
   - Daren Design 定位与取舍
   - 站内合规缺口尾部
   - evidence / 验证 / 残余风险
6. 如果源码缺失，先给实现方案和示例矩阵；只有我确认切换到 prepare 后才写代码。
7. 如果源码存在，也要先做 benchmark proposal，再把源码、页面、示例矩阵、交互状态、token、evidence 缺口放在合规尾部。
```

Keep the user-facing prompt focused on research output. Avoid leading with registration blockers unless the user asks for compliance-only audit.
