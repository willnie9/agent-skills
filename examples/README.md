# Examples · 示例产物

> 这些文件展示了 skill 流水线在实际运行中产出的中间产物和报告。
> 以「客户列表」模块为例，展示完整流水线 A → B → C → A.recall → D 的产出。

## 文件说明

| 文件 | 阶段 | 产出者 | 说明 |
|---|---|---|---|
| [stage-a-report.json](./stage-a-report.json) | Stage A | master-go-to-code | 设计稿解析完成报告 |
| [stage-b-report.json](./stage-b-report.json) | Stage B | yapi-to-code | 接口代码生成完成报告 |
| [stage-c-report.json](./stage-c-report.json) | Stage C | frontend-page-design | 页面组装完成报告 |
| [token-diff-report.json](./token-diff-report.json) | Stage A.recall | master-go-to-code | DSL ↔ SCSS token 对比报告 |
| [stage-d-report.json](./stage-d-report.json) | Stage D | playwright-skill | 浏览器验收报告 |
| [dom-tree-snippet.json](./dom-tree-snippet.json) | Stage A | master-go-to-code | dom-tree.json 片段（展示结构，非完整） |

## 如何阅读

所有 stage report 遵循 `_shared/schemas/stage-report.schema.json` 统一格式：

```json
{
  "stage": "A | B | C | A.recall | D",
  "skill": "产出此报告的 skill 名称",
  "module": "模块标识",
  "timestamp": "ISO 8601 时间戳",
  "verdict": "pass | warn | fail",
  "summary": { "skill 特定的摘要数据" },
  "issues": ["待人工处理的事项"],
  "artifacts": { "new": ["新增的文件"], "modified": ["修改的文件"] }
}
```

`verdict` 决定了 module-flow 的 stage-gate 是否放行：

- `pass` → 继续下一个 stage
- `warn` → 打印警告，继续（适用于 A.recall 和 D）
- `fail` → 熔断，停止流水线（适用于 A / B / C）
