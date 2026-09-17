# ChatGPT public homepage — Source Replica baseline

## Scope and evidence

- Source: <https://chatgpt.com/>
- State: public, logged out, light theme, English locale.
- Reference viewport: 1440 × 900 CSS pixels.
- Observation date: 2026-09-17.
- Runtime evidence: current public accessibility content plus OpenAI's public home-page guidance.
- Capture limitation: the isolated, cookie-free Chromium capture timed out at the local network boundary. Exact DOM, computed styles and a pixel screenshot are therefore not verified.

This baseline distinguishes observed facts from visual estimates. Values marked `estimated` are calibration defaults, not claims about ChatGPT's internal design tokens.

## Page skeleton

```text
┌──────── sidebar, ~260 px ────────┬──────────────── main surface ───────────────────┐
│ brand / collapse                  │ ChatGPT ▾                    Log in  Sign up     │
│ New chat                          │                                                 │
│ Search chats                      │              Where should we begin?             │
│ Images · Updated                  │        ┌────────────────────────────────┐       │
│ Plugins                           │        │ Ask anything                   │       │
│ Deep research                     │        │ +                         mic ◉ │       │
│                                   │        └────────────────────────────────┘       │
│ Chat history · empty              │                                                 │
│ plan / settings / help            │                  legal notice                   │
│ login benefit card                │                                                 │
└───────────────────────────────────┴─────────────────────────────────────────────────┘
```

## L1 — tokens

| Role | Baseline value | Status | Evidence |
|---|---:|---|---|
| Canvas | `#ffffff` | estimated | current ChatGPT light appearance |
| Sidebar | `#f9f9f9` | estimated | current ChatGPT light appearance |
| Primary text | `#0d0d0d` | estimated | current ChatGPT light appearance |
| Secondary text | `#5d5d5d` | estimated | current ChatGPT light appearance |
| Subtle border | `#e5e5e5` | estimated | current ChatGPT light appearance |
| Hover surface | `#ececec` | estimated | current ChatGPT light appearance |
| Focus outline | `#0d0d0d` at 2 px | estimated | accessibility requirement |
| Font | system sans stack | deliberate approximation | source font file not captured |
| Sidebar width | 260 px | estimated default | 1440 px reference viewport |
| Header height | 64 px | estimated | 1440 px reference viewport |
| Composer width | 768 px max | estimated | current desktop composition |
| Composer radius | 28 px | estimated | current desktop composition |
| Motion | 160–220 ms | estimated | local interaction parity |

## L2 — components

| Component | Observed role | Replica contract |
|---|---|---|
| Brand/collapse button | sidebar top action | collapses and restores sidebar |
| Sidebar navigation row | New chat, Search chats, Images, Plugins, Deep research | hover, active state and click feedback |
| Authentication buttons | Log in, Sign up for free | open local explanatory dialog; no real auth |
| Composer | public prompt entry | multiline input, send state and local demo response |
| Attachment button | composer secondary action | opens a menu with explicit local-only feedback |
| Microphone/voice actions | composer media actions | visible listening/unavailable feedback |
| Login benefit card | logged-out education | opens the same local auth dialog |
| Footer links | Terms, Privacy, Learn more | link to official public destinations |
| Toast | local feedback | announces mock/deferred behavior accessibly |

## L3 — patterns

| Pattern | Source behavior | Replica behavior |
|---|---|---|
| New chat | starts a fresh unsaved logged-out conversation | clears local demo state after confirmation feedback |
| Search chats | opens chat search; logged-out history is empty | opens a command-style palette with empty/login guidance |
| Tool destinations | switch to Images/Plugins/Deep research | update the center state and expose a return action |
| Composer submit | begins a public chat where available | renders the user message and a clearly labelled local demo response |
| Authentication gate | enters OpenAI authentication | local dialog explains that authentication is intentionally not connected |
| Popover/dialog dismissal | outside click or Escape | implemented with focus restoration |

## L4 — shell

- Desktop: fixed left sidebar and flexible main canvas.
- Narrow desktop/tablet: sidebar becomes an icon rail.
- Mobile: sidebar is hidden by default and opens as an overlay.
- Main empty state stays vertically centered with the composer immediately beneath the heading.
- Legal notice remains at the bottom of the main surface.

## Known gaps

1. Pixel calibration cannot be verified until a same-state source screenshot can be captured.
2. Source SVG icon paths were not available; the replica uses locally drawn, visually compatible line icons.
3. Login, signup, voice, uploads, Plugins and Deep research are deliberately local placeholders.
4. Authenticated chat history and account menus are outside this scope.
