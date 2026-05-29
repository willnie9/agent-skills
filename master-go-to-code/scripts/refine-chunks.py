#!/usr/bin/env python3
"""
refine-chunks.py — A 路径自动化 baseline runner

读 <outDir>/chunks/_manifest.json 和各 chunk 文件,逐个跑 refine-dom-tree.py
产 <outDir>/chunks-refined/<chunk_id>.refined.json

shell chunk 的 children 留 _children_placeholder,leaf chunk 完整翻译。
装饰节点(滚动轴/补空)按预设规则删除。

用法:
  python3 refine-chunks.py [<outDir>]
  默认 outDir = .claude/skills/master-go-to-code/output
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path(os.environ.get("MASTERGO_OUT_DIR", str(SKILL_DIR / "output")))
OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
CHUNKS_DIR = OUT_DIR / "chunks"
REFINED_DIR = OUT_DIR / "chunks-refined"
DSL_PATH = OUT_DIR / "dsl.json"
REFINE_SCRIPT = SKILL_DIR / "scripts" / "refine-dom-tree.py"

if not CHUNKS_DIR.exists():
    print(f"❌ chunks 目录不存在: {CHUNKS_DIR}")
    sys.exit(1)

# 装饰节点删除清单(按 name 匹配 — 5/21 讨论结论)
DELETE_DECORATIONS = ["滚动轴 横", "滚动轴 纵"]

# 重置 chunks-refined
if REFINED_DIR.exists():
    shutil.rmtree(REFINED_DIR)
REFINED_DIR.mkdir(parents=True)

# 读 manifest + dsl(取 styles 表)
manifest = json.loads((CHUNKS_DIR / "_manifest.json").read_text())
dsl = json.loads(DSL_PATH.read_text())
styles = dsl.get("dsl", {}).get("styles") or dsl.get("styles") or {}

print(f"📦 准备精修 {len(manifest['chunks'])} 个 chunk")
print()

stats = {"shell": 0, "leaf": 0, "deleted": 0}
tmp_dir = OUT_DIR / "_tmp_chunk_dsl"
if tmp_dir.exists():
    shutil.rmtree(tmp_dir)
tmp_dir.mkdir()

for c in manifest["chunks"]:
    chunk_id = c["chunk_id"]
    fname = c["file"]
    cdata = json.loads((CHUNKS_DIR / fname).read_text())
    node = cdata["node"]
    is_shell = cdata.get("is_shell", False)
    name = node.get("name", "")

    # 装饰删除
    if name in DELETE_DECORATIONS:
        out_path = REFINED_DIR / f"{chunk_id}.refined.json"
        out_path.write_text(json.dumps({"_deleted": True, "reason": f"装饰: {name}"}, ensure_ascii=False, indent=2))
        stats["deleted"] += 1
        print(f"🗑️  {chunk_id} 删除(装饰)")
        continue

    if is_shell:
        # shell chunk:留壳,children 用 placeholder
        # 先用 refine-dom-tree.py 跑一遍只有当前 node 的 mini-dsl(不含 children),拿到样式
        node_only = {k: v for k, v in node.items() if k not in ("children", "__has_children_in_chunks", "__children_count")}
        mini_dsl = {"dsl": {"nodes": [node_only], "styles": styles}}
        mini_path = tmp_dir / f"{chunk_id}.dsl.json"
        mini_path.write_text(json.dumps(mini_dsl, ensure_ascii=False))
        # 找出本 shell 的子 chunk 们
        children_refs = [
            f'ref:{cc["source_node_id"]}'
            for cc in manifest["chunks"]
            if cc.get("parent_id") == c["source_node_id"]
        ]
        # 执行 refine-dom-tree(style-scope=full-page 不挑根)
        env = os.environ.copy()
        env["MASTERGO_OUT_DIR"] = str(tmp_dir / chunk_id)
        (tmp_dir / chunk_id).mkdir(exist_ok=True)
        r = subprocess.run(
            ["python3", str(REFINE_SCRIPT), str(mini_path), "--style-scope=full-page"],
            env=env, capture_output=True, text=True
        )
        if r.returncode != 0:
            print(f"❌ {chunk_id} refine 失败: {r.stderr}")
            continue
        refined = json.loads((tmp_dir / chunk_id / "dom-tree.json").read_text())
        refined["_children_placeholder"] = children_refs
        # shell chunk 不该留 children 字段
        refined.pop("children", None)
        out_path = REFINED_DIR / f"{chunk_id}.refined.json"
        out_path.write_text(json.dumps(refined, ensure_ascii=False, indent=2))
        stats["shell"] += 1
        print(f"📦 {chunk_id} shell ({len(children_refs)} 子 ref)")
    else:
        # leaf chunk:完整翻译
        mini_dsl = {"dsl": {"nodes": [node], "styles": styles}}
        mini_path = tmp_dir / f"{chunk_id}.dsl.json"
        mini_path.write_text(json.dumps(mini_dsl, ensure_ascii=False))
        env = os.environ.copy()
        env["MASTERGO_OUT_DIR"] = str(tmp_dir / chunk_id)
        (tmp_dir / chunk_id).mkdir(exist_ok=True)
        r = subprocess.run(
            ["python3", str(REFINE_SCRIPT), str(mini_path), "--style-scope=full-page"],
            env=env, capture_output=True, text=True
        )
        if r.returncode != 0:
            print(f"❌ {chunk_id} refine 失败: {r.stderr[:200]}")
            continue
        refined = json.loads((tmp_dir / chunk_id / "dom-tree.json").read_text())
        out_path = REFINED_DIR / f"{chunk_id}.refined.json"
        out_path.write_text(json.dumps(refined, ensure_ascii=False, indent=2))
        stats["leaf"] += 1
        # 节点统计
        def cnt(n):
            x = 1
            for k in n.get("children") or []:
                x += cnt(k)
            return x
        print(f"🍃 {chunk_id} ({cnt(refined)} 节点)")

# 清临时
shutil.rmtree(tmp_dir, ignore_errors=True)

print()
print(f"✅ 精修完成: shell {stats['shell']} | leaf {stats['leaf']} | deleted {stats['deleted']}")
print(f"   产物: {REFINED_DIR}")
