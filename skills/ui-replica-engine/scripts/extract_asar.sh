#!/usr/bin/env bash
# 定位某个桌面应用的 Electron app.asar，解包它，并运行第一轮
# 提取 grep（调色板 / CSS 变量 / 字体 / 组件名）。
#
# 用法：
#   extract_asar.sh "<AppName>" [output_dir]
#   extract_asar.sh "Claude"
#   extract_asar.sh "Codex" ~/replica/codex-asar
#
# 注意：
# - 定位逻辑以 macOS 为先；会回退到 `find` 扫描，也接受直接传入 .asar 路径作为第一个参数。
# - 需要 Node/npx（使用 @electron/asar）。不会全局安装任何东西。
# - 本脚本只做「提取」和「报告」。之后你阅读这些数值并在阶段 1 把它们映射到
#   目标设计系统上——绝不发布源应用的色值 / 字体 / 商标。
#   例外：图标按约定直接沿用源应用原图标资源（提取时一并保留 SVG / 图标字体）。
set -euo pipefail

APP="${1:?用法：extract_asar.sh \"<AppName>\" [output_dir]}"
OUTDIR="${2:-}"

# --- 解析 asar 路径 ----------------------------------------------------------
ASAR=""
if [[ "$APP" == *.asar && -f "$APP" ]]; then
  ASAR="$APP"
  APP="$(basename "${APP%.asar}")"
else
  CANDIDATES=(
    "/Applications/${APP}.app/Contents/Resources/app.asar"
    "$HOME/Applications/${APP}.app/Contents/Resources/app.asar"
  )
  for c in "${CANDIDATES[@]}"; do
    [[ -f "$c" ]] && ASAR="$c" && break
  done
  if [[ -z "$ASAR" ]]; then
    echo "默认位置未找到；正在 /Applications 中扫描 ${APP}*.app ……" >&2
    ASAR="$(find /Applications "$HOME/Applications" -maxdepth 3 \
            -path "*${APP}*.app/Contents/Resources/app.asar" 2>/dev/null | head -1 || true)"
  fi
fi

if [[ -z "$ASAR" || ! -f "$ASAR" ]]; then
  cat >&2 <<EOF
找不到 "$APP" 的 app.asar。
- 确认应用已安装（macOS：/Applications/${APP}.app）。
- 该应用可能是 Tauri / 原生（没有 asar）—— 可在授权范围内直接检视本地 Contents/Resources/。
- 如果应用只加载公共 HTTPS URL，转入 references/extract-web.md 的隔离 Web Capture 流程；不要提取或复用桌面会话凭据。
- Windows：%LOCALAPPDATA%\\${APP}\\app-*\\resources\\app.asar
- Linux：  /opt/${APP}/resources/app.asar  （或在 AppImage 内部）
你也可以直接传入路径：extract_asar.sh /path/to/app.asar
EOF
  exit 1
fi

[[ -z "$OUTDIR" ]] && OUTDIR="./${APP}-asar"
echo "应用：   $APP"
echo "Asar：  $ASAR"
echo "输出：   $OUTDIR"
echo

# --- 解包 --------------------------------------------------------------------
echo "==> 正在提取（npx @electron/asar）…"
npx --yes @electron/asar extract "$ASAR" "$OUTDIR"
echo "    完成。"
echo

# --- 第一轮提取报告 ----------------------------------------------------------
echo "==> 样式表（按大小降序 —— 最大的那个通常是 token 样式表）："
find "$OUTDIR" -name '*.css' -print0 2>/dev/null \
  | xargs -0 ls -S 2>/dev/null | head -10 || echo "    （未找到 .css）"
echo

echo "==> 十六进制颜色值（去重样本）："
grep -rhoEi '#[0-9a-f]{3,8}\b' "$OUTDIR" --include=*.css 2>/dev/null \
  | sort -u | head -60 || echo "    （无）"
echo

echo "==> 颜色类 CSS 自定义属性（样本）："
grep -rhoEi -- '--[a-z0-9-]*(color|background|accent|brand|surface|border|foreground)[a-z0-9-]*[[:space:]]*:[^;]*' \
  "$OUTDIR" --include=*.css 2>/dev/null | sort -u | head -60 || echo "    （无）"
echo

echo "==> 字体族 / 字体文件："
grep -rhoEi 'font-family[^;]*' "$OUTDIR" --include=*.css 2>/dev/null | sort -u | head -20 || true
find "$OUTDIR" \( -name '*.ttf' -o -name '*.otf' -o -name '*.woff' -o -name '*.woff2' \) 2>/dev/null \
  | sed 's#.*/##' | sort -u | head -20 || true
echo

echo "==> 组件 / 模块名（来自 JS 资源名 + 标识符名）："
grep -rhoEi '[A-Z][A-Za-z]+(Panel|Window|View|Shell|Sidebar|Composer|Dialog|Thread|Editor)' \
  "$OUTDIR" --include=*.js 2>/dev/null | sort -u | head -60 || echo "    （无 —— 很可能是压缩后的单一 bundle；退回到截图 / DevTools）"
echo

echo "下一步：阅读 references/extract-desktop.md 并撰写测量基线文档。"
echo "用以下命令挖掘菜单：  grep -rhoEi '\"[A-Za-z][A-Za-z0-9 ./·-]{2,40}\"' \"$OUTDIR\" --include=*.js | sort -u | less"
