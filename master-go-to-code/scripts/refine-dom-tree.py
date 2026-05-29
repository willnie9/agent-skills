#!/usr/bin/env python3
"""
⚠️ 备用脚本(默认不用,AI 精修失败时才回退到机械提取)
精修 DSL → dom-tree.v1.json (机械提取,完整保留 layoutStyle/字体/颜色/间距)
默认流程: master-go-to-code Step 2 调 mcp__getDsl 让 AI 精修,质量更高
回退场景: 画板太大 AI 跑不动 / DSL 节点太多 / AI 反复出错

用法:
  python3 .claude/skills/master-go-to-code/scripts/refine-dom-tree.py <dsl-file.txt> [--style-scope=content-only|full-page] [--img-prefix=@/assets/images/<your-dir>]

输出:
  <MASTERGO_OUT_DIR 或默认 <skill>/output>/dom-tree.json
  <MASTERGO_OUT_DIR 或默认 <skill>/output>/svg-paths.json
"""
import json
import re
import sys
import os
from pathlib import Path

# ── 参数 ──
if len(sys.argv) < 2:
    print("用法: python3 refine-dom-tree.py <dsl-file> [--style-scope=...] [--img-prefix=...]")
    sys.exit(2)

dsl_file = sys.argv[1]
style_scope = "content-only"
img_prefix = "@/assets/images"  # 项目图片资源 import 前缀,按需 --img-prefix 覆盖
for arg in sys.argv[2:]:
    if arg.startswith("--style-scope="):
        style_scope = arg.split("=", 1)[1]
    elif arg.startswith("--img-prefix="):
        img_prefix = arg.split("=", 1)[1].rstrip("/")

# ── 读 DSL ──
raw = open(dsl_file).read()
# MCP 返回是 JSON 数组,第一个元素的 text 是真实 DSL
try:
    data = json.loads(raw)
    if isinstance(data, list) and data and "text" in data[0]:
        dsl = json.loads(data[0]["text"])
    else:
        dsl = data
except Exception as e:
    print(f"❌ 解析 DSL 失败: {e}")
    sys.exit(1)

styles = dsl.get("dsl", {}).get("styles", {}) or dsl.get("styles", {})
nodes = dsl.get("dsl", {}).get("nodes", []) or dsl.get("nodes", [])
if not nodes:
    print("❌ DSL 无节点")
    sys.exit(1)

root = nodes[0]
_rls = root.get('layoutStyle', {}) or {}
print(f"📄 根节点: {root.get('name')} ({_rls.get('width', '?')}x{_rls.get('height', '?')})")

# ── 样式 token 解析 ──
def resolve_paint(ref):
    """paint_xxx → 颜色值 / 渐变字符串"""
    if not ref or not isinstance(ref, str):
        return None
    s = styles.get(ref)
    if not s:
        return ref if ref.startswith("#") or ref.startswith("rgb") else None
    v = s.get("value")
    if isinstance(v, list) and v:
        return v[0]
    return v

def resolve_font(ref):
    """font_xxx → {family, size, style, lineHeight, letterSpacing}"""
    s = styles.get(ref)
    return s.get("value") if s else None

# ── DSL → dom-tree.v1 ──
svg_paths = {}  # 收集 PATH 数据

def to_kebab(s):
    return re.sub(r'([A-Z])', r'-\1', s).lower()

def infer_padding_from_children(n):
    """父节点有 flexContainerInfo 时,从子节点的 relativeX/Y 推 padding"""
    fci = n.get("flexContainerInfo")
    if not fci:
        return None
    # 有 justifyContent / alignItems 时,子位置是 flex 自动计算的,不能反推 padding
    if fci.get("justifyContent") or fci.get("alignItems"):
        return None
    kids = n.get("children", []) or []
    if not kids or len(kids) == 1:
        # 单子节点反推 padding 不可靠(无法区分"padding"还是"justify-content")
        return None
    ls = n.get("layoutStyle", {})
    pw, ph = ls.get("width"), ls.get("height")
    if not pw or not ph:
        return None

    def rect(k):
        kls = k.get("layoutStyle", {}) or {}
        x = kls.get("relativeX") or 0
        y = kls.get("relativeY") or 0
        w = kls.get("width") or 0
        h = kls.get("height") or 0
        return x, y, w, h

    # 跳过没坐标的兄弟,只看 FRAME/INSTANCE/TEXT
    rects = [rect(k) for k in kids if k.get("layoutStyle")]
    if not rects:
        return None
    min_x = min(r[0] for r in rects)
    min_y = min(r[1] for r in rects)
    max_right = max(r[0] + r[2] for r in rects)
    max_bottom = max(r[1] + r[3] for r in rects)
    pad_left = round(min_x)
    pad_top = round(min_y)
    pad_right = round(pw - max_right)
    pad_bottom = round(ph - max_bottom)
    # 全 0 不输出
    if pad_left == 0 and pad_top == 0 and pad_right == 0 and pad_bottom == 0:
        return None
    # 负数(子节点超父)归零
    pad_left = max(0, pad_left)
    pad_top = max(0, pad_top)
    pad_right = max(0, pad_right)
    pad_bottom = max(0, pad_bottom)
    return f"{pad_top}px {pad_right}px {pad_bottom}px {pad_left}px"


def style_from_node(n, parent_node=None, parent_main_axis_remain=None):
    """提取节点的 CSS 样式

    parent_main_axis_remain: 父节点 row-flex 时,本节点可分到的剩余主轴宽度
                              (用于 mainSizing=auto 但 layoutStyle.width 缺失的兜底)
    """
    st = {}
    ls = n.get("layoutStyle", {})

    # 尺寸
    w, h = ls.get("width"), ls.get("height")
    tp = n.get("type", "")

    # width 缺失时,用父分配的剩余主轴宽度兜底(防止子撑爆)
    # 触发条件:父是 row-flex,本节点 width 缺失,父算出剩余宽 → 把剩余宽分给本节点
    if w is None and parent_main_axis_remain is not None:
        w = max(0, parent_main_axis_remain)

    if tp != "TEXT":  # TEXT 不设宽高(防截断)
        if w is not None:
            st["width"] = f"{round(w)}px"
        if h is not None:
            st["height"] = f"{round(h)}px"

    # 位置: 父无 flexContainerInfo 时,用 absolute 兜底
    if parent_node is not None:
        parent_fci = parent_node.get("flexContainerInfo")
        if not parent_fci:
            rx = ls.get("relativeX")
            ry = ls.get("relativeY")
            if rx is not None or ry is not None:
                # 看是否要走 absolute (父需要 position:relative,但加在父那边)
                # 这里子节点用 absolute
                st["position"] = "absolute"
                if rx is not None:
                    st["left"] = f"{round(rx)}px"
                if ry is not None:
                    st["top"] = f"{round(ry)}px"

    # flex 布局
    flex = n.get("flexContainerInfo")
    if flex:
        st["display"] = "flex"
        direction = flex.get("flexDirection") or "row"
        if flex.get("flexDirection"):
            st["flex-direction"] = flex["flexDirection"]
        if flex.get("justifyContent"):
            st["justify-content"] = flex["justifyContent"]
        if flex.get("alignItems"):
            st["align-items"] = flex["alignItems"]
        if flex.get("gap"):
            st["gap"] = flex["gap"]
        if flex.get("padding"):
            st["padding"] = flex["padding"]
        else:
            # flex 父没显式 padding → 从子节点 relativeX/Y 推
            inferred = infer_padding_from_children(n)
            if inferred:
                st["padding"] = inferred
        # 子主轴总尺寸 > 父 → overflow:hidden 防止子失控外溢
        # 注意:任一子缺主轴尺寸时跳过(求和会偏小,误判父超出)
        kids = n.get("children", []) or []
        if kids and w and h:
            try:
                if direction == "row":
                    sizes = [(k.get("layoutStyle") or {}).get("width") for k in kids]
                    if all(s is not None for s in sizes):
                        total = sum(sizes)
                        if total > w + 1:
                            st["overflow"] = "hidden"
                else:
                    sizes = [(k.get("layoutStyle") or {}).get("height") for k in kids]
                    if all(s is not None for s in sizes):
                        total = sum(sizes)
                        if total > h + 1:
                            st["overflow"] = "hidden"
            except Exception:
                pass
    else:
        # 非 flex 父也需要 position:relative 让子的 absolute 生效
        if n.get("children"):
            st["position"] = "relative"

    # 圆角
    br = n.get("borderRadius")
    if br:
        st["border-radius"] = br

    # 背景填充
    fill_ref = n.get("fill")
    fill = resolve_paint(fill_ref)
    if fill and tp != "TEXT":  # TEXT 的 fill 是字体颜色
        if isinstance(fill, str) and fill.startswith("#"):
            st["background"] = fill
        elif isinstance(fill, str) and "gradient" in fill:
            st["background"] = fill
        elif isinstance(fill, str) and fill.startswith("rgb"):
            st["background"] = fill

    # 边框
    stroke = resolve_paint(n.get("strokeColor"))
    sw = n.get("strokeWidth")
    if stroke and sw:
        st["border"] = f"{sw} solid {stroke}"

    # 阴影/特效
    effect_ref = n.get("effect")
    if effect_ref:
        ev = styles.get(effect_ref, {}).get("value")
        if isinstance(ev, list):
            for e in ev:
                if isinstance(e, str):
                    if "box-shadow" in e or "filter" in e or "backdrop" in e:
                        kv = e.split(":", 1)
                        if len(kv) == 2:
                            st[kv[0].strip()] = kv[1].strip().rstrip(";").strip()

    # 透明度
    op = n.get("opacity")
    if op is not None and op < 1:
        st["opacity"] = str(op)

    # TEXT 节点的字体
    if tp == "TEXT":
        text_arr = n.get("text", [])
        if text_arr and isinstance(text_arr, list):
            t0 = text_arr[0]
            if isinstance(t0, dict):
                font_ref = t0.get("font")
                font = resolve_font(font_ref)
                if font:
                    if font.get("family"):
                        st["font-family"] = f"'{font['family']}', sans-serif"
                    if font.get("size"):
                        st["font-size"] = f"{font['size']}px"
                    fstyle = font.get("style", "")
                    # style 可能是 "Regular" 或 JSON 字符串
                    if "Medium" in fstyle or "中黑" in fstyle:
                        st["font-weight"] = "500"
                    elif "Bold" in fstyle:
                        st["font-weight"] = "bold"
                    lh = font.get("lineHeight")
                    if lh and lh != "auto":
                        st["line-height"] = f"{lh}px" if str(lh).replace('.','').isdigit() else lh
        # 文字颜色
        tc = n.get("textColor", [])
        if tc and isinstance(tc, list) and tc[0].get("color"):
            color = resolve_paint(tc[0]["color"])
            if color:
                st["color"] = color
        # 文字对齐
        ta = n.get("textAlign")
        if ta:
            st["text-align"] = ta

    return st

def get_text(n):
    """从 TEXT 节点提取真实文字"""
    if n.get("type") != "TEXT":
        return None
    text_arr = n.get("text", [])
    if isinstance(text_arr, list) and text_arr:
        return "".join(t.get("text", "") for t in text_arr if isinstance(t, dict))
    return None

def get_tag(n):
    tp = n.get("type", "")
    if tp == "TEXT":
        return "span"
    if tp == "PATH":
        return None  # path 不直接生成,用 svgRef
    return "div"

def is_decoration(n):
    """识别纯装饰节点(蒙版/极小空间补位)"""
    name = n.get("name", "")
    if n.get("mask") == "alpha":
        return True
    # 补空节点
    if "补空" in name:
        return True
    return False

def to_dom(n, path="root", parent_id=None, parent_node=None, parent_main_axis_remain=None):
    """递归把 DSL 节点转 dom-tree

    parent_main_axis_remain: 父 row-flex 时,本节点可分到的剩余主轴宽
                              (用于 mainSizing=auto 但 width 缺失的兜底)
    """
    if is_decoration(n):
        return None

    tp = n.get("type", "")
    nid = n.get("id", "")
    name = n.get("name", "")

    # PATH 节点 → 用 svgRef 引用
    if tp == "PATH":
        path_data = n.get("path", [])
        if path_data:
            # 用节点 ID 简化版本(取最后一段)作 svgRef
            short_id = nid.split("/")[-1] if "/" in nid else nid
            if not re.match(r'^[0-9]+:[0-9a-fA-F]+$', short_id):
                return None  # 不符合 ID 格式跳过
            svg_paths[short_id] = [
                {
                    "data": p.get("data", ""),
                    "fill": resolve_paint(p.get("fill")) or "#000",
                } for p in path_data if p.get("data")
            ]
            ls = n.get("layoutStyle", {})
            return {
                "tag": "div",
                "attrs": {
                    "data-name": f"svgRef:{short_id}",
                },
                "style": {
                    "width": f"{round(ls.get('width', 0))}px",
                    "height": f"{round(ls.get('height', 0))}px",
                }
            }

    tag = get_tag(n)
    if not tag:
        return None

    node = {
        "tag": tag,
        "attrs": {"data-name": name[:50] if name else f"node-{tp.lower()}"},
        "style": style_from_node(n, parent_node, parent_main_axis_remain),
    }

    # TEXT 节点 text
    text = get_text(n)
    if text:
        node["text"] = text

    # 图片节点
    if tp == "LAYER":
        # 看 fill 是否是图片
        img = n.get("imageUrl") or n.get("backgroundImage")
        if img:
            node["tag"] = "img"
            filename = img.split("/")[-1]
            node["attrs"]["src"] = f"{img_prefix}/{filename}"

    # children
    # 计算下传给子节点的"剩余主轴宽"(仅 row-flex 才传):
    #   父总宽 - 已有 width 的子之和 - gap 总和,平摊给 width 缺失的子
    fci = n.get("flexContainerInfo") or {}
    is_row_flex = fci.get("flexDirection") == "row"
    parent_w = (n.get("layoutStyle") or {}).get("width")
    child_remain_for_missing = None
    if is_row_flex and parent_w is not None:
        kids_raw = n.get("children", []) or []
        widths = [(c.get("layoutStyle") or {}).get("width") for c in kids_raw]
        missing_count = sum(1 for w in widths if w is None)
        if missing_count > 0:
            known_total = sum(w for w in widths if w is not None)
            gap_str = fci.get("gap") or "0"
            try:
                gap_val = float(re.sub(r'[^0-9.]', '', str(gap_str)) or 0)
            except Exception:
                gap_val = 0
            gap_total = gap_val * max(0, len(kids_raw) - 1)
            remain = parent_w - known_total - gap_total
            # 即使 remain<=0 也要传(传 0 让缺 width 的列折叠,而非撑爆)
            child_remain_for_missing = max(0, remain) / missing_count

    kids = []
    for c in n.get("children", []):
        c_w = (c.get("layoutStyle") or {}).get("width")
        # 仅当子 width 缺失时,才传剩余宽兜底
        # remain <= 0 也要传(传 0),让缺 width 的列折叠,而非撑爆
        remain_arg = child_remain_for_missing if c_w is None else None
        d = to_dom(c, f"{path}.children", nid, parent_node=n,
                   parent_main_axis_remain=remain_arg)
        if d:
            kids.append(d)
    if kids:
        node["children"] = kids

    return node

# ── 决定根节点 ──
if style_scope == "content-only":
    # 在 root.children 里找"内容区"(名字含"内容区"或最大的非侧边栏 FRAME)
    target = None
    for c in root.get("children", []):
        if "内容区" in c.get("name", ""):
            target = c
            break
    if not target:
        # 兜底:第一个不是侧边栏/顶栏/背景的
        for c in root.get("children", []):
            name = c.get("name", "")
            if not any(k in name for k in ["侧边", "顶栏", "面包屑", "背景"]):
                target = c
                break
    if not target:
        target = root
else:
    target = root

print(f"🎯 精修根: {target.get('name')}")

dom_tree = to_dom(target)

# ── 写文件 ──
# 产物路径与 fetch-and-parse.mjs 保持一致,支持 MASTERGO_OUT_DIR 覆盖
import os
SKILL_DIR = Path(__file__).resolve().parent.parent
out_dir = Path(os.environ.get("MASTERGO_OUT_DIR", str(SKILL_DIR / "output")))
out_dir.mkdir(parents=True, exist_ok=True)

with open(out_dir / "dom-tree.json", "w", encoding="utf-8") as f:
    json.dump(dom_tree, f, ensure_ascii=False, indent=2)

with open(out_dir / "svg-paths.json", "w", encoding="utf-8") as f:
    json.dump(svg_paths, f, ensure_ascii=False, indent=2)

# 统计
def count(n):
    if not n:
        return 0
    return 1 + sum(count(c) for c in n.get("children", []))

print(f"")
print(f"✅ dom-tree.json: {count(dom_tree)} 个节点")
print(f"✅ svg-paths.json: {len(svg_paths)} 个 SVG")
print(f"   输出到 {out_dir}/")
