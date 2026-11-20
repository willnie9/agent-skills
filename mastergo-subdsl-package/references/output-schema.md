# Output Schema

每个子 DSL 文件都必须区分来源外层和当前节点：

```json
{
  "sourceOuterLayerId": "6:046046",
  "sourceOuterLink": "https://mastergo.com/goto/...",
  "selectedLayerId": "6:172948",
  "selectedLayerLink": "https://mastergo.com/goto/...?layer_id=6%3A172948",
  "extractedNodeIds": ["6:172948"],
  "nodes": []
}
```

`sourceOuterLayerId` 可以在一批文件中相同；`selectedLayerId` 必须指向该文件实际保存的 `nodes[0]`。

场景条目可以附带面向 AI 的画面摘要：

```json
{
  "visualSummary": {
    "title": "巡逻点位",
    "fields": ["点位名称", "巡逻类型"],
    "actions": ["搜索", "重置", "新增巡逻点位"],
    "columns": ["点位名称", "点位位置", "巡逻类型", "RFID标签"],
    "states": [],
    "relatedInteractions": ["新增巡逻点位", "启用点位", "禁用点位", "删除点位"]
  }
}
```

摘要只用于快速理解画面，不替代 DSL。完整文字保存在 DSL；交互规则保存在交互 DSL 和原文区块。摘要不得包含复制残留名称、重复数据或整页文字转储。

只有交互文案、没有独立画面节点的功能使用“行为变体”结构，不伪造独立画面 DSL 或图片：

```json
{
  "kind": "行为变体",
  "key": "编辑安保巡逻班次",
  "title": "编辑安保巡逻班次",
  "selectedLayerId": "6:211326",
  "selectedLayerLink": "https://mastergo.com/goto/...?layer_id=6%3A211326",
  "interactionDsl": "dsl/interaction-编辑安保巡逻班次.json",
  "reuseOf": {
    "sceneKey": "新增安保巡逻班次弹窗",
    "selectedLayerId": "6:208627",
    "selectedLayerLink": "https://mastergo.com/goto/...?layer_id=6%3A208627",
    "dsl": "dsl/新增安保巡逻班次弹窗.json",
    "image": "images/新增安保巡逻班次弹窗.png"
  }
}
```

行为变体的 `selectedLayerId` 是交互说明节点 ID；复用画面的节点 ID 必须放在 `reuseOf.selectedLayerId`。`interactionDsl` 与 `reuseOf.dsl` 是两个不同用途的文件。

图片映射使用以下结构：

```json
{
  "status": "matched | candidate | unmatched | reused",
  "confidence": "high | medium | low | unmatched",
  "originalFile": "导出的原始文件名",
  "reusedFrom": "复用的基础场景 key，可选",
  "evidence": [
    "图片尺寸与 DSL 节点尺寸一致"
  ]
}
```

没有足够证据时必须使用 `candidate` 或 `unmatched`，不能为了完整而硬配。
