# 阶段 0 —— Web 应用事实提取（预留接口）

这是 `extract-desktop.md` 的 Web 应用对应版本。目前它有意做得较精简——桌面 / asar 路径才是久经实战的那条。当你真正做一次 Web 复刻时，把这份充实起来，并把经验回灌到这里（就像桌面路径在多次真实复刻中逐渐成熟那样）。

其*目标与桌面路径完全相同*：产出一份测量基线文档（与 `extract-desktop.md` §「基线文档模板」同一套模板），按 L1 Tokens / L2 Components / L3 Patterns / L4 Templates 提取真实的颜色、字体、组件结构、页面骨架和交互说明——而非靠截图猜测。只是提取的机制不同，因为 Web 应用的「真实资源」是实时 DOM 和计算样式，而不是一个 asar 归档。

## 事实存在于何处

- **计算样式**（经过 CSS 级联后真实渲染出的值）—— 相当于桌面路径里挖掘样式表。从 `:root` 以及关键元素上读取 CSS 自定义属性。
- **DOM 树** —— 相当于桌面路径里的组件 / 模块映射。区块 / 区域结构、ARIA 角色、类名模式揭示了布局解剖。
- **样式表 / CSS-in-JS** —— 设计 token 变量名和调色板。
- **网络 / 资源** —— 字体文件（用于识别需*替换*的字体族，绝不重新发布）、图标精灵图 / SVG（按约定**保留沿用**源应用原图标，需完整抓取），以及任何 token JSON。

## 实用提取途径（按可用性选择）

- **浏览器预览 / 自动化工具**（如果运行环境提供——例如 `preview_*` 或浏览器 MCP）：导航到该应用，然后执行 JS 来导出计算值和结构。草图：
  ```js
  // 声明在 :root 上的 CSS 自定义属性
  const cs = getComputedStyle(document.documentElement);
  // ……遍历 document.styleSheets 的 cssRules 收集 --* 名称，再用 cs.getPropertyValue(name) 读取

  // 区域解剖 —— 勾勒出主要的布局块
  [...document.querySelectorAll('header,nav,main,aside,[role]')]
    .map(el => ({ tag: el.tagName, role: el.getAttribute('role'),
                  w: el.getBoundingClientRect().width, cls: el.className }));
  ```
  来自 `getBoundingClientRect()` 的真实元素宽度*优于桌面*截图估算——它们是真实的逻辑像素，因此 ⚠️ 项更少。
- **手动 DevTools**（若没有自动化工具）：Elements → Computed，以及「Application → Frames」/ 样式面板。让用户粘贴数值，或引导用户操作。
- **静态源码**（如果是可开放 / 可检视的 bundle）：对所提供的 JS/CSS 执行与桌面路径相同的 grep。

## 与桌面相比需牢记的差异

- **没有 asar 要解包** —— 没有东西可 `extract`；你读取的是运行中的应用。
- **尺寸更可靠** —— `getBoundingClientRect()` 给出真实逻辑像素，因此估算更少。仍要记录哪些是响应式 / 取决于断点的。
- **响应式 + 主题** —— 在用户关心的断点处捕获，如果应用有主题就同时捕获亮色和暗色。
- **需登录 / 状态门控的页面** —— 有些区域只在登录后或特定状态下才渲染；记录你无法到达的部分。

然后用共享模板撰写基线，并继续阅读 `plan.md`、`source-replica.md`、`replicate.md` —— 无论阶段 0 的数值来源如何，都先产出 Source Replica，再做 Design-System Adaptation。
