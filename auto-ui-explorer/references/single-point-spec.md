# 单点测试用例编写规范 (Single Point Test Spec)

## 什么是单点测试

单点测试（Single Point Test, SP）是对**一个独立可交互节点**的完整最小可测单元。
它不关心上下游流转，只关心"这个按钮/弹窗/表单本身的功能是否正常"。

## SP 用例标准模板

```markdown
### SP-XXX: [来源文件] 功能描述
- 前置条件: 在 /#/xxx 页面（或某弹窗已打开）
- 操作步骤:
  1. 具体的点击/输入/选择动作
  2. ...
- 预期结果: 明确的可验证断言
- 测试数据: { key: value, ... }
- 表单字段来源(如有表单):
  | 字段名 | 组件类型 | 是否必填 | 测试值 | 值来源 |
  |--------|---------|---------|--------|--------|
  | xxx    | el-input | 是      | "测试" | 源码 maxlength=50, placeholder="请输入" |
- 状态: [ ]
```

## SP 的分类

### 1. 按钮类 SP
只需要点击并验证响应（路由跳转 / 状态变化 / 弹窗打开）。

### 2. 弹窗表单类 SP（最复杂）
必须包含**两轮测试**：
- **第一轮 Fuzzing**：所有字段留空，直接点提交，截图红字校验
- **第二轮合规提交**：按测试数据表填满，点提交，验证闭环

### 3. 搜索/筛选类 SP
填入筛选条件 → 点搜索 → 验证表格刷新 → 点重置 → 验证清空。

## 测试数据生成规则

| 源码线索 | 生成策略 |
|---------|---------|
| `el-input` + `maxlength="50"` | 生成 `"AutoTest-" + 随机4位` |
| `el-input` + `type="number"` / `el-input-number` | 生成整数 `100` 或 `1.5` |
| `el-select` + `:options="xxxOptions"` | 读源码找 `xxxOptions` 的定义，取第一个 `value` |
| `el-select` + 接口动态加载 | 标注 `[数据依赖接口]`，测试时从 snapshot 取第一个可见选项 |
| `el-radio-group` | 读源码 `el-radio` 子节点，取第一个 `label` |
| `el-date-picker` | 当天日期 `dayjs().format('YYYY-MM-DD')` |
| `el-switch` | `true` |
| `:rules` 含 `required: true` | 该字段标记为必填 |
| `:rules` 含 `pattern` / `validator` | 需按正则或自定义规则生成合规值 |
