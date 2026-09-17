# 公共 Web 应用事实提取

`release.json` 是来源能力的机器真源。`web-url` 仅支持公共 HTTPS 默认端口，并且必须使用插件打包的隔离 Chromium WebCaptureDriver；完整边界见 [`docs/web-capture-rfc.md`](../../../docs/web-capture-rfc.md)。不得改用宿主现有浏览器标签页、DevTools 会话或已登录 Profile，因为那些路径无法证明凭据隔离和公网网络边界。

## 入口和产物

用运行时 CLI 捕获 URL，并把证据写到用户明确选择的本地目录：

```bash
printf '%s' '{"source":{"kind":"web-url","url":"https://example.com/"},"viewport":{"width":1440,"height":900},"theme":"light","locale":"en-US"}' \
  | node <plugin-root>/bin/ui-distiller.mjs capture --base-dir "$PWD" --out-dir captures/example --json
```

捕获成功必须同时产生：

- `capture.json`；
- 当前 DOM 的静态 HTML；
- 固定视口截图；
- accessibility tree；
- DOMSnapshot 计算样式。

CLI 输出是已校验的 CaptureBundle。后续分解必须引用其中的 evidence refs，不要重新截图后凭印象补数值。若浏览器未安装，返回 `WEB_CAPTURE_DRIVER_UNAVAILABLE` 并请用户安装 Chrome/Chromium/Edge/Brave 或设置 `UI_DISTILLER_BROWSER_PATH`。

## 硬边界

- 只接受 `https://`、默认 443 端口和主机名；HTTP、IP literal、localhost、内网、任意端口直接拒绝。
- 不执行登录、验证码、同意流，不读取或导入 cookie、密码、系统钥匙串或既有浏览器会话。
- 每次捕获使用新的临时 Profile/Context；下载、扩展、Service Worker、QUIC 和非代理 WebRTC 均被阻断。
- 页面与子资源连接必须经过固定 IP 的 CONNECT 代理；任一 DNS 答案为私网、保留或文档地址时整次连接拒绝。
- 只声明实际观察到的默认状态。隐藏交互、登录后状态、其他断点和主题仍是未知项，除非分别捕获并提供对应 evidence refs。
- 截图本身不是完整来源；不得绕过 DOM、a11y 和 computed-style 证据要求。

## 从证据建立事实基线

目标与桌面路径相同：按 L1 Tokens / L2 Components / L3 Patterns / L4 Templates 产出可追溯的测量基线，而不是靠截图猜测。

- **L1 Tokens**：从 computed-style、DOM 中的 CSS 自定义属性和可见资源记录颜色、字体、间距、圆角、阴影、动效；品牌字体只用于识别和映射，不重新发布。
- **L2 Components**：结合 DOM 层级、ARIA role/name、可访问状态和重复样式识别 primitive；不要把类名当成组件事实。
- **L3 Patterns**：记录导航、表单、列表、对话框等组合拓扑。只有证据中观察到的状态才能标为 observed。
- **L4 Templates**：从页面主要 landmark、区域尺寸和滚动归属建立 shell/页面骨架。

`getBoundingClientRect()` 对当前固定视口的逻辑尺寸比截图估算可靠，但它不证明其他断点。用户关心多个视口或主题时，每个组合单独捕获，不要用一次结果外推响应式规则。

## 继续流程

1. 用 CaptureBundle 生成带 evidence refs、未知项和 rights 状态的 Blueprint。
2. 先阅读 `plan.md`，明确 L1-L4、交互矩阵和验收范围。
3. 按 `source-replica.md` 生成并保留 Source Replica。
4. 需要目标设计系统时再进入 `replicate.md` / `design-system-adapter`。
5. 用 `ui-audit-repair` 在相同 viewport/theme/locale 下审计；不得把未捕获状态标成已验证。
