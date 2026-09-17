# ChatGPT public homepage — Source Replica plan

## 1. Scope

| Item | Decision |
|---|---|
| Source | `https://chatgpt.com/`, public logged-out state |
| Target | standalone local Source Replica |
| Viewport | 1440 × 900, light theme, `en-US` |
| Reproduction depth | `source-only`; no Daren adaptation |
| Keep Source Replica | yes |
| Non-goals | authentication, OpenAI API calls, uploads, live voice, saved history, publishing |

## 2. Region contract

| Region | Structure | Default size/state | Acceptance |
|---|---|---|---|
| Sidebar | brand, primary tools, history, utility links, login card | 260 px, expanded | aligns full height; every visible item responds |
| Header | model label and auth actions | 64 px | actions align to 16 px outer inset |
| Empty state | heading and composer | centered, max 768 px | no overlap at 1440 × 900 or 768 px width |
| Composer | textarea and bottom controls | 116 px minimum, 28 px radius | input grows; send state changes with content |
| Footer | legal disclosure and links | bottom-centered | readable and keyboard reachable |
| Overlays | search palette, auth dialog, attachment menu, toast | closed initially | Escape/outside dismissal and focus return |

## 3. L1–L4 execution map

| Layer | Input | Implementation | Acceptance |
|---|---|---|---|
| L1 tokens | baseline estimates | scoped CSS custom properties | no unexplained values in component rules |
| L2 components | visible public controls | semantic buttons, textarea, dialog, menu | hover/focus/active/disabled feedback |
| L3 patterns | navigation, search, auth gate, submit | local JavaScript state machine | zero inert visible controls |
| L4 shell | sidebar/header/main/footer topology | CSS grid plus responsive breakpoints | matches reference topology at desktop and mobile |

## 4. Interaction matrix

| ID | Element | Behavior | State coverage | Verification | Status |
|---|---|---|---|---|---|
| INT-001 | Sidebar toggle | collapse/restore | expanded, collapsed | click + screenshot | verified |
| INT-002 | New chat | reset local conversation | empty, populated | click test | verified |
| INT-003 | Search chats | open empty search palette | open, query, closed | click/type/Escape | verified |
| INT-004 | Images | show Images destination placeholder | active, return | click test | verified |
| INT-005 | Plugins | show Plugins destination placeholder | active, return | click test | verified |
| INT-006 | Deep research | show research destination placeholder | active, return | click test | verified |
| INT-007 | Plans/settings/help | visible local feedback or official link | default, feedback | click test | verified |
| INT-008 | Log in | open auth explanation | dialog open/closed | click/Escape | verified |
| INT-009 | Sign up | open auth explanation | dialog open/closed | click/Escape | verified |
| INT-010 | Composer | type, expand, submit | empty, focus, ready, submitted | type/Enter | verified |
| INT-011 | Attachment | open menu and select an option | open, selected, closed | click/outside | verified |
| INT-012 | Microphone | toggle listening simulation | off, on | click test | verified |
| INT-013 | Voice | show local-only feedback | default, toast | click test | verified |
| INT-014 | Legal links | open official pages | default, hover, focus | link inspection | verified |

## 5. Tasks

| Task | Output | Acceptance |
|---|---|---|
| SRC-001 shell | `index.html`, `styles.css` | reference regions align at 1440 × 900 |
| SRC-002 interactions | `app.js` | INT-001…014 produce feedback |
| SRC-003 structural checks | `tests/verify.mjs` | semantics and required labels pass |
| SRC-004 visual evidence | `evidence/candidate-1440x900.png` | candidate screenshot captured at target viewport |
| SRC-005 fidelity record | `fidelity-report.json` | each gate has status, evidence and gaps |

## 6. Acceptance and stop conditions

- HTML loads with no external runtime dependency.
- No console errors in the initial state or interaction smoke path.
- Keyboard focus is visible; Escape dismisses all overlays.
- Every visible control is verified, disabled with explanation, or explicitly deferred with feedback.
- Candidate screenshot is reviewed against the observed topology.
- The result is described as high-fidelity but not pixel-verified until source screenshot capture succeeds.

## 7. Improvement loop

| Round | Planned check | Exit condition |
|---|---|---|
| 1 | topology, spacing, typography, overflow | passed after fixing hidden-state CSS precedence |
| 2 | interactive and keyboard smoke | passed; 26 bound buttons and no console errors |
| 3 | responsive and evidence audit | passed for candidate; source pixel baseline remains blocked and documented |
