# 阶段 0 —— 桌面（Electron）事实提取

多数跨平台桌面应用（Claude、Codex、Obsidian、VS Code、Slack、Notion、Linear、Discord……）都是 Electron，并把渲染层以 `app.asar` 归档的形式发布。该归档就是真实发布的 CSS/JS——确切的颜色、字体、组件名、菜单字符串。提取它能让你得到一份*测量过*的基线，而不是靠截图猜测。

> 意图提醒：你提取是为了*精确理解设计*，然后在阶段 1 把它映射到用户自己的 token 上。你永远不发布源应用的色值 / 字体 / 商标。**例外：图标**——图标会按约定直接沿用源应用的原图标资源，所以提取时要把图标资源（SVG / 图标字体）一并保留下来。

## 1. 定位并解包 asar

随附的 `scripts/extract_asar.sh` 自动完成定位 + 解包 + 第一轮 grep：

```bash
scripts/extract_asar.sh "Claude"          # macOS: /Applications/Claude.app/...
scripts/extract_asar.sh "Codex" ~/some/dir # 可选：显式指定输出目录
```

它执行的等价操作是：

```bash
# macOS 默认位置
ASAR="/Applications/<AppName>.app/Contents/Resources/app.asar"
npx @electron/asar extract "$ASAR" "<outdir>"
```

注意事项：
- 有些应用拆分成 `app.asar` + `app.asar.unpacked`（原生部分以未打包形式存放；你要的渲染层 CSS/JS 在 `app.asar` 里）。
- 如果没有 `app.asar`，该应用可能是 Tauri / 原生，或使用普通的 `Resources/` —— 退而直接 grep `Contents/Resources/`，或者如果它加载的是远程 / 本地 URL，就当作 Web 应用处理（见 `extract-web.md`）。
- Windows 上路径通常是 `%LOCALAPPDATA%\<App>\app-*\resources\app.asar`；Linux 上是 `/opt/<App>/resources/app.asar` 或在 AppImage 内部。

## 2. 挖掘样式表 —— 颜色、变量、字体

找到渲染层 CSS（通常在某个 build/renderer/assets 目录下的 `*.css`）：

```bash
find <outdir> -name '*.css' -size +10k        # 大 CSS = token 样式表
grep -rEi '#[0-9a-f]{3,8}\b' <outdir> --include=*.css | sort -u   # 十六进制调色板
grep -rEi -- '--[a-z-]*color[a-z-]*\s*:' <outdir> --include=*.css # 颜色变量
grep -rEi 'font-family|@font-face|\.(ttf|otf|woff2?)' <outdir>    # 字体
```

你要找的是：
- **确切的强调 / 品牌色值**，以及它是否基于 HSL（这能告诉你色系家族）。
- 应用使用的**语义化 CSS 变量名**（`--color-background-surface`、`--accent-*` 等）。它们揭示了应用*自己*的 token 分类体系——有助于理解意图并镜像进你的映射。
- **亮色 vs 暗色**取值（查找 `.dark`、`prefers-color-scheme` 或成对的变量）。
- **字体族** —— 记录下来，以便阶段 1 刻意把它们*替换*成目标系统的 `--font-sans` / `--font-mono`。绝不重新发布 .ttf。

## 3. 挖掘 JS 资源名 —— 真实的组件 / 模块映射

资源和 chunk 的文件名就是应用真实的特性图谱——远比凭记忆或截图重建可靠：

```bash
find <outdir> -name '*.js' | sed 's#.*/##' | sort -u      # chunk 名
grep -rEoi '[A-Z][A-Za-z]+(Panel|Window|View|Shell|Sidebar|Composer|Dialog)' \
  <outdir> --include=*.js | sort -u                        # 组件名
```

每个命名的模块都是结构的线索（例如一组 `DocumentPanel` / `WorkbookPanel` / `PresentationPanel` 三件套，告诉你右栏是一个*多类型制品*面板，而不只是一个 markdown 预览）。据此搭建你的组件拆分。

注意：高度压缩的单包应用（某些 Vite 构建）会折叠组件名。你仍能拿到窗口 / 入口名；对于细粒度的组件边界，退回到截图 + 运行时 DevTools，并在基线中说明这一点。

## 4. 挖掘 JS 字符串 —— 菜单和选项集

菜单、模型列表、权限模式等，常常是静态字符串数组：

```bash
grep -rEoi '"[A-Za-z][A-Za-z0-9 ./·-]{2,40}"' <outdir> --include=*.js \
  | sort -u | less        # 然后扫描类似菜单的字符串簇
```

有些数组被压缩到单字母变量后面，无法静态完全恢复——把那些标记为 ⚠️，并注明它们需要运行时 DevTools 或后续截图来确认。不要凭空编造菜单项。

## 5. 结构尺寸 —— 来自截图，诚实标注

区域宽度和行高通常存在于压缩 JS 里的 Tailwind / 工具类中，而不在干净的 CSS 里。从截图测量它们，但要：
- Retina 截图约为设备像素的 2 倍——在记录前换算成**逻辑像素**。
- 把每个测量出的尺寸标记为 ⚠️「估算值，需真机校正」。
- 侧边栏 / 面板宽度是用户可调整的本地状态——记录一个*默认值*，而非「官方」值，也不要假装它是官方的。

如果某个内容列宽*确实*在 CSS 里（例如 `max-width: 48rem`），优先采用那个确切值，而不是截图估算。

## 基线文档模板

按以下形态撰写阶段 0 的交付物（这正是阶段 1 所消费的）：

```markdown
# <App> UI —— 测量基线（阶段 0）
**来源**：<应用版本> · <asar 路径> · 样式表 <文件> · 字体 <文件>
**精度说明**：颜色 / 字体 / 组件 / 菜单 = 真实提取值；
结构像素 = 截图估算（⚠️），需真机校正。

## 0. 原型骨架
<ASCII 区域示意图：标题栏 / 左侧栏 / 中部 / 右面板 / 输入区>
<每个区域一行描述 + 导航模型>

## 1. 结构尺寸（逻辑像素，⚠️ = 估算）
| 项目 | 取值 | 备注 | → 布局 token |

## 2. L1 Tokens（源应用事实）
| Token 角色 | 亮色 / 默认 | 暗色 | 源变量 / 来源 | Source Replica 用法 | Adaptation 映射 |
|---|---|---|---|---|---|
| 背景 | | | | | |
| 文本 | | | | | |
| 边框 / divider | | | | | |
| hover / active / focus | | | | | |
| 字体 / 字号 / 行高 | | | | | |
| 间距 / 圆角 / 阴影 | | | | | |
| 动效 | | | | | |

## 3. L2 Components（源应用事实）
| 源组件 | 来源 / 证据 | 状态 | Source Replica 要求 | Adaptation 映射 |
|---|---|---|---|---|
| button / icon button | | default / hover / active / disabled | | |
| tab / tab group | | | | |
| tree row / nav item | | | | |
| menu / popover | | | | |
| split / resize divider | | | | |
| status item | | | | |

## 4. L3 Patterns（源应用事实）
| 场景化模式 | 真实行为 | 状态 / 空态 | Source Replica 要求 | Adaptation 映射 |
|---|---|---|---|---|
| 文件树 / 导航树 | | | | |
| tab group / split | | | | |
| side dock / panel group | | | | |
| command palette / more menu | | | | |
| 搜索 / 筛选 / 空状态 | | | | |

## 5. L4 Templates / Shell（源应用事实）
| 页面骨架 | 区域拓扑 | 尺寸 / 响应式 | Source Replica 要求 | Adaptation 映射 |
|---|---|---|---|---|
| 主应用壳 | | | | |
| 工作台页面 | | | | |
| 设置 / 次级页面 | | | | |
| 窄屏 / 折叠布局 | | | | |

## 6. 调色板（真实色值 → 目标 token 映射）
| 角色 | 亮色 | 暗色 | 源变量 | → 目标语义 token |
<强调 / 品牌色这一行必须注明：仅用于图标 / 链接 / 焦点，绝不作背景>

## 7. 组件 / 模块清单（来自资源名）
| 模块（资源名） | 复刻含义 |

## 8. 菜单 / 选项集（来自 JS 字符串；⚠️ = 需运行时确认）

## 9. 交互契约（需 1:1 复制）
| 可操作元素 | 真实行为 | 状态 / 空态 | Source Replica 验收 | Adaptation 回归 |
|---|---|---|---|---|
| <按钮 / tab / 菜单 / 树节点 / split 控件> | <点击 / hover / 拖拽 / 键盘行为> | <active / disabled / empty / loading> | <可见反馈与验证方式> | <替换设计系统后不退化> |

覆盖主界面上每一个可见操作点。无法从静态资源确认的交互标为 ⚠️「需运行时确认」，但 Source Replica 不能留下无响应按钮；Adaptation 不能让已通过的交互退化。
```

这份文档存在之后，继续阅读 `plan.md`，然后按顺序执行 `source-replica.md` 与 `replicate.md`。
