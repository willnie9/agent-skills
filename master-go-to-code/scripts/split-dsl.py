#!/usr/bin/env python3
"""
split-dsl.py — 把根 DSL 按大小阈值切成多个 chunk 文件

策略:
  - 节点 > 30KB → 继续向下递归
  - 节点 20-30KB → 推荐切(默认切)
  - 节点 < 20KB → 直接当一个 chunk 落盘
  - 叶子节点 / TEXT / PATH 不切

输入: <skill>/output/dsl.json (或参数指定);也可设 MASTERGO_OUT_DIR 环境变量
输出:
  <outDir>/chunks/_manifest.json
  <outDir>/chunks/<idx>-<slug>.json
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = Path(os.environ.get("MASTERGO_OUT_DIR", str(SKILL_DIR / "output")))

# 第 1 个参数:dsl.json 路径(默认 <outDir>/dsl.json)
# 第 2 个参数:outDir(默认 <skill>/output 或 MASTERGO_OUT_DIR)
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else (DEFAULT_OUT_DIR / "dsl.json")
OUT_BASE = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT_DIR
OUT_DIR = OUT_BASE / "chunks"

THRESH_BIG = 30 * 1024     # > 30KB 必切
THRESH_REC = 20 * 1024     # > 20KB 推荐切
# < 20KB 直接落

d = json.load(open(SRC))
nodes = d.get('dsl', {}).get('nodes', d.get('nodes', []))
styles = d.get('dsl', {}).get('styles', d.get('styles', {}))

if not nodes:
    print('❌ 无节点')
    sys.exit(1)


def bytes_of(n):
    return len(json.dumps(n, ensure_ascii=False).encode())


def count_nodes(n):
    c = 1
    for k in n.get('children', []) or []:
        c += count_nodes(k)
    return c


def slugify(name, idx):
    s = re.sub(r'[^\w一-鿿-]+', '-', name or '')
    s = s.strip('-')[:30]
    return f'{idx:02d}-{s or "chunk"}'


def is_splittable(n):
    """可以单独切出来作 chunk 的节点条件"""
    nid = n.get('id', '')
    tp = n.get('type', '')
    return (
        re.match(r'^\d+:[0-9a-fA-F]+$', nid) and
        tp in ('FRAME', 'INSTANCE')
    )


chunks = []   # 收集要落盘的 chunk 信息
counter = [0]  # idx 计数器(用列表绕过闭包)


def emit_chunk(node, parent_id, position):
    """把 node 整棵子树落成一个 chunk 文件"""
    counter[0] += 1
    idx = counter[0]
    name = node.get('name', '') or node.get('id', '')
    slug = slugify(name, idx)
    payload = {
        'chunk_id': slug,
        'source_node_id': node.get('id'),
        'parent_id': parent_id,
        'position': position,
        'node_count': count_nodes(node),
        'bytes': bytes_of(node),
        'node': node,
    }
    fpath = OUT_DIR / f'{slug}.json'
    with open(fpath, 'w') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    chunks.append({
        'chunk_id': slug,
        'file': fpath.name,
        'source_node_id': node.get('id'),
        'parent_id': parent_id,
        'position': position,
        'node_count': payload['node_count'],
        'kb': round(payload['bytes'] / 1024, 1),
    })
    return slug


def split(node, parent_id=None, position=0):
    """递归决定切还是不切"""
    sz = bytes_of(node)

    # 不可切的小节点直接 emit
    if not is_splittable(node):
        # 注意: 不可切但本身有 children 的节点也直接整块 emit
        emit_chunk(node, parent_id, position)
        return

    if sz < THRESH_REC:
        # < 20KB 直接落
        emit_chunk(node, parent_id, position)
        return

    # >= 20KB: 看是否要继续向下切
    kids = node.get('children', []) or []
    if not kids:
        # 没子节点就别管,直接落
        emit_chunk(node, parent_id, position)
        return

    # 把当前节点落成"骨架"(去掉 children),记录孩子位置
    skeleton = {k: v for k, v in node.items() if k != 'children'}
    skeleton['__has_children_in_chunks'] = True
    skeleton['__children_count'] = len(kids)

    counter[0] += 1
    idx = counter[0]
    name = node.get('name', '') or node.get('id', '')
    slug = slugify(name + '-shell', idx)
    payload = {
        'chunk_id': slug,
        'source_node_id': node.get('id'),
        'parent_id': parent_id,
        'position': position,
        'is_shell': True,
        'node_count': 1,  # 仅自身
        'bytes': bytes_of(skeleton),
        'node': skeleton,
    }
    fpath = OUT_DIR / f'{slug}.json'
    with open(fpath, 'w') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    chunks.append({
        'chunk_id': slug,
        'file': fpath.name,
        'source_node_id': node.get('id'),
        'parent_id': parent_id,
        'position': position,
        'is_shell': True,
        'children_count': len(kids),
        'kb': round(payload['bytes'] / 1024, 1),
    })

    # 递归处理孩子
    for i, c in enumerate(kids):
        split(c, parent_id=node.get('id'), position=i)


# 清空整个 chunks/ 目录(包括 _manifest.json 和所有 *.json),重头来
if OUT_DIR.exists():
    shutil.rmtree(OUT_DIR)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 从根开始
for i, root in enumerate(nodes):
    split(root, parent_id=None, position=i)

# 写 manifest
manifest = {
    'source': str(SRC),
    'styles': styles,  # 全局共享,合并时还原用
    'total_chunks': len(chunks),
    'total_kb': round(sum(c['kb'] for c in chunks), 1),
    'chunks': chunks,
}
with open(OUT_DIR / '_manifest.json', 'w') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f'✅ 切成 {len(chunks)} 个 chunk')
print(f'\n{"idx":<4} {"KB":>6}  {"node":>5}  {"shell":>5}  {"id":<14}  name')
print('-' * 80)
for c in chunks:
    shell = '✓' if c.get('is_shell') else ''
    nc = c.get('children_count', c.get('node_count', '?'))
    name = c['chunk_id']
    print(f'{c["chunk_id"][:3]:<4} {c["kb"]:>6.1f}  {nc:>5}  {shell:>5}  {c["source_node_id"]:<14}  {name}')
