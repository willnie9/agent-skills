# 表单测试数据自动生成规则 (Form Data Generation)

## 核心原则

测试数据**必须从源码推导**，禁止凭空编造。大模型在 Step 2.3 编写 SP 用例时，需要打开对应的 Vue 源码，提取以下信息来生成数据：

## 提取流程

```
1. 找到 <el-form> 的 :rules 绑定变量名（如 :rules="formRules"）
2. 在 <script setup> 中找到 formRules 的定义
3. 对每个 prop，读取 required / pattern / validator / min / max / type
4. 找到 <el-form> 的 :model 绑定变量名（如 :model="formData"）
5. 在 <script setup> 中找到 formData 的初始值定义
6. 结合 el-form-item 的组件类型，生成合规测试值
```

## 各类型生成策略

### el-input（文本输入）

| 源码线索 | 生成值 |
|---------|--------|
| 无特殊限制 | `"AutoTest-" + 4位随机字母` |
| `maxlength="N"` | 不超过 N 的测试字符串 |
| `type="number"` | `100` |
| `type="textarea"` | `"自动化测试备注内容"` |
| placeholder 含"手机" / "电话" | `"13800138000"` |
| placeholder 含"邮箱" | `"autotest@test.com"` |
| prop 含 "price" / "amount" / "money" | `"99.50"` |

### el-select / CommonSelect（下拉选择）

```
1. 找到 :options 绑定的变量名（如 :options="statusOptions"）
2. 在 <script setup> 中找到该变量的定义
3. 如果是硬编码数组 → 取第一个 { label, value } 的 value
4. 如果是接口动态加载 → 标注 [数据依赖接口]，执行时从 snapshot 取第一个可见选项
```

### el-radio-group（单选组）

```
1. 找到 el-radio-group 下的所有 <el-radio> 子节点
2. 取第一个 :label 或 label 属性的值
```

### el-date-picker（日期选择）

| type 属性 | 生成值 |
|-----------|--------|
| `date` / 默认 | 当天 `"2026-05-29"` |
| `daterange` | `["2026-05-01", "2026-05-31"]` |
| `datetime` | `"2026-05-29 10:00:00"` |

### el-switch（开关）

默认 `true`。

### el-input-number（数字输入）

读 `:min` `:max` `:precision`，取 `min + 1` 或中间值。

## 必填判定

```
源码中 formRules 对象的字段含 { required: true } → 该字段为必填
el-form-item 上有 required 属性 → 该字段为必填
```

## 边界值测试（高级，可选）

对于重要的表单，除了合规值，还可以生成：
- 空字符串 `""` → 验证必填拦截
- 超长字符串（超过 maxlength）→ 验证截断
- 特殊字符 `<script>alert(1)</script>` → 验证 XSS 防护
- 负数（对 price 类字段）→ 验证业务规则
