#!/usr/bin/env python3
"""
合并 chunks-refined/*.refined.json -> dom-tree.json

读取 chunks/_manifest.json 拿到所有 chunk 的 source_node_id 和 file 映射,
然后从 01 (画板) 开始递归展开 _children_placeholder 中的 ref:<id>。

用法:
  python3 .claude/skills/master-go-to-code/scripts/merge-refined.py \
    [--in <chunks-refined dir>] \
    [--manifest <chunks/_manifest.json>] \
    [--out <dom-tree.json>]

默认产物路径: <skill>/output/  (支持 MASTERGO_OUT_DIR 环境变量覆盖)
"""
import argparse
import copy
import json
import os
from pathlib import Path
import sys

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = Path(os.environ.get("MASTERGO_OUT_DIR", str(SKILL_DIR / "output")))


def load_chunks(refined_dir: Path, manifest: dict) -> dict:
    """source_node_id -> refined json node。"""
    id_to_node = {}
    for c in manifest["chunks"]:
        chunk_id = c["chunk_id"]
        node_id = c["source_node_id"]
        # 文件名跟 chunks/<file> 是一致的，只是后缀换成 .refined.json
        refined_file = refined_dir / f"{chunk_id}.refined.json"
        if not refined_file.exists():
            print(f"[ERROR] 缺失精修产物: {refined_file}", file=sys.stderr)
            sys.exit(1)
        with refined_file.open("r", encoding="utf-8") as f:
            id_to_node[node_id] = json.load(f)
    return id_to_node


def expand_placeholders(node, id_to_node, depth=0):
    """递归把 _children_placeholder 中的 ref:<id> 展开为对应 chunk 的精修产物。

    保留原 node 的 children(如果有),把 placeholder 展开后追加到 children 里。
    跳过精修标记为 _deleted 的 chunk(装饰节点删除)。
    """
    if not isinstance(node, dict):
        return node

    placeholders = node.pop("_children_placeholder", None)
    if placeholders is not None:
        existing = node.get("children", []) or []
        for ph in placeholders:
            if not (isinstance(ph, str) and ph.startswith("ref:")):
                print(f"[WARN] 非法 placeholder: {ph}", file=sys.stderr)
                continue
            ref_id = ph[4:]
            if ref_id not in id_to_node:
                print(f"[ERROR] 找不到 chunk: ref:{ref_id}", file=sys.stderr)
                sys.exit(1)
            ref_node = id_to_node[ref_id]
            if isinstance(ref_node, dict) and ref_node.get("_deleted"):
                # 精修阶段已决定删除该 chunk(装饰节点),跳过
                continue
            child = copy.deepcopy(ref_node)
            existing.append(child)
        node["children"] = existing

    # 递归处理 children
    for c in node.get("children", []) or []:
        expand_placeholders(c, id_to_node, depth + 1)

    return node


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--in",
        dest="in_dir",
        default=str(DEFAULT_OUT_DIR / "chunks-refined"),
        help="精修产物目录",
    )
    ap.add_argument(
        "--manifest",
        default=str(DEFAULT_OUT_DIR / "chunks" / "_manifest.json"),
        help="chunks manifest 路径",
    )
    ap.add_argument(
        "--out",
        default=str(DEFAULT_OUT_DIR / "dom-tree.json"),
        help="输出路径",
    )
    args = ap.parse_args()

    refined_dir = Path(args.in_dir)
    manifest_file = Path(args.manifest)
    out_file = Path(args.out)

    if not refined_dir.exists():
        print(f"[ERROR] 精修目录不存在: {refined_dir}", file=sys.stderr)
        sys.exit(1)
    if not manifest_file.exists():
        print(f"[ERROR] manifest 不存在: {manifest_file}", file=sys.stderr)
        sys.exit(1)

    with manifest_file.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    id_to_node = load_chunks(refined_dir, manifest)

    # 找根节点 (parent_id == null)
    root_chunk = next(
        (c for c in manifest["chunks"] if c.get("parent_id") is None),
        None,
    )
    if root_chunk is None:
        print("[ERROR] 找不到根 chunk(parent_id==null)", file=sys.stderr)
        sys.exit(1)

    root_id = root_chunk["source_node_id"]
    root = copy.deepcopy(id_to_node[root_id])
    expand_placeholders(root, id_to_node)

    # 父无 flex → 子加 absolute + left/top (按 DSL 结构平行遍历)
    dsl_path = DEFAULT_OUT_DIR / "dsl.json"
    if dsl_path.exists():
        dsl = json.loads(dsl_path.read_text())
        dsl_nodes = dsl.get("dsl", {}).get("nodes") or dsl.get("nodes") or []
        if dsl_nodes:
            dsl_root = dsl_nodes[0]

            def supplement(dom_node, dsl_node, parent_has_flex, is_root=False):
                if not isinstance(dom_node, dict) or not isinstance(dsl_node, dict):
                    return
                ls = dsl_node.get("layoutStyle") or {}
                # 父无 flex → 当前节点用 absolute (refine-dom-tree 翻译时漏了)
                # 跳过根节点(没有父)
                if not parent_has_flex and not is_root:
                    st = dom_node.setdefault("style", {})
                    rx = ls.get("relativeX")
                    ry = ls.get("relativeY")
                    if rx is not None or ry is not None:
                        # 强制覆盖,refine-dom-tree 写的 position:relative 是错的
                        st["position"] = "absolute"
                        if rx is not None:
                            st["left"] = f"{round(rx)}px"
                        if ry is not None:
                            st["top"] = f"{round(ry)}px"
                self_has_flex = bool(dsl_node.get("flexContainerInfo")) or dom_node.get("style", {}).get("display") == "flex"
                # 平行遍历 children (跳过装饰删除导致的不对齐)
                dom_kids = dom_node.get("children") or []
                dsl_kids = dsl_node.get("children") or []
                # 按 name 配对(更稳),装饰 chunk 已删,DSL 里有但 dom 里没有,跳过
                used_dom = [False] * len(dom_kids)
                for dk in dsl_kids:
                    dk_name = dk.get("name")
                    matched = None
                    for i, dom_c in enumerate(dom_kids):
                        if used_dom[i]:
                            continue
                        dom_name = (dom_c.get("attrs") or {}).get("data-name", "")
                        if dom_name == dk_name:
                            matched = i
                            break
                    if matched is not None:
                        used_dom[matched] = True
                        supplement(dom_kids[matched], dk, self_has_flex)

            supplement(root, dsl_root, False, is_root=True)

    # 校验:确保不再有任何 _children_placeholder
    leftover = []

    def find_leftover(n, path="root"):
        if isinstance(n, dict):
            if "_children_placeholder" in n:
                leftover.append(path)
            for i, c in enumerate(n.get("children", []) or []):
                find_leftover(c, f"{path}.children[{i}]")

    find_leftover(root)
    if leftover:
        print(
            f"[ERROR] 仍有 {len(leftover)} 个未展开的 placeholder: {leftover[:5]}",
            file=sys.stderr,
        )
        sys.exit(1)

    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(root, f, ensure_ascii=False, indent=2)

    # 节点统计
    counts = {"div": 0, "span": 0, "img": 0, "svgRef": 0, "total": 0}

    def walk(n):
        if not isinstance(n, dict):
            return
        counts["total"] += 1
        tag = n.get("tag", "div")
        if tag in counts:
            counts[tag] += 1
        if (n.get("attrs", {}).get("data-name") or "").startswith("svgRef:"):
            counts["svgRef"] += 1
        for c in n.get("children", []) or []:
            walk(c)

    walk(root)
    print(f"✅ 合并完成: {out_file}")
    print(
        f"   节点统计: total={counts['total']} div={counts['div']} "
        f"span={counts['span']} img={counts['img']} svgRef={counts['svgRef']}"
    )


if __name__ == "__main__":
    main()
