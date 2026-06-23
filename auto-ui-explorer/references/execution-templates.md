# 执行模板速查

> 本文件收录 Step 2/4/5/6 的详细操作模板和示例。SKILL.md 只保留决策树和关键约束,具体模板按需读本文件。

## Step 2.3 搜索/筛选 SP 增强模板

如果 Step 0.9 审计报告标记了某列表接口"🔴 空参数调用"或"分页参数未传",对应搜索 SP 必须增加:

```markdown
### SP-XXX: [index.vue] 列表页搜索
- ...原有步骤...
- 额外验证（来自 API 审计）:
  - [ ] browser_console_messages() 检查是否有网络请求发出
  - [ ] 搜索后表格数据是否变化（对比搜索前后的行数）
  - [ ] 如果数据未变化 → 标记 [!][API参数未传递] 搜索参数未传给接口函数
```

## Step 2.3 分页 SP 模板

```markdown
### SP-XXX: [xxx.vue] 分页功能验证
- 前置条件: 在列表页，数据已加载
- 操作步骤:
  1. 记录当前底部分页显示的总条数 N
  2. 记录当前表格行数 M
  3. 验证 N >= M（总条数应大于等于当前页行数）
  4. 如果有翻页按钮且 N > pageSize，点击下一页
  5. 验证页码变化，数据刷新
- 预期结果: 分页总数与数据一致，翻页正常
- 状态: [ ]
```

## Step 2.4 CRUD 数据变更验证模板

```markdown
N. [数据变更验证] 新增完成后:
   a. browser_snapshot() 获取当前列表
   b. 记录新增后的表格行数 M2
   c. 对比新增前的行数 M1，验证 M2 > M1（或新增的数据出现在列表中）
   d. 验证底部分页总条数是否同步更新
   e. 如果 M2 == M1 → 标记 [!][数据变更未生效] 新增后列表未刷新
```

## Step 3 检查点报告模板

```markdown
📋 E2E 测试编排完成

测试模式: mock / real-api
API 审计: ✅ 通过 / ⚠️ N 个问题
扫描文件: N 个
过滤噪音组件: M 个
生成单点用例: P 个 (SP-001 ~ SP-0XX)
  - 含搜索验证 SP: X 个
  - 含分页验证 SP: Y 个
  - 含数据变更验证: Z 个
编排集成流程: Q 条 (Flow-001 ~ Flow-0XX)
覆盖弹窗空值拦截: R 个
词典校验: ✅ 通过
剧本校验: ✅ 通过 / ⚠️ N 个警告

剧本已落盘: .claude/skills/auto-ui-explorer/output/<module>-E2E-FLOW-PLAN.md
API审计报告: .claude/skills/auto-ui-explorer/output/<module>-API-AUDIT.md

确认无误后，将启动 Playwright MCP 逐点执行。是否开始？
```

## Step 4.1 执行前初始化

```
1. browser_navigate(baseURL + 初始路由)
2. browser_snapshot() → 确认登录态正常
3. 如果是列表页:
   a. 等待表格渲染完成（检查 snapshot 中是否有表格行）
   b. 记录初始状态:
      - 初始表格行数 = M0
      - 初始分页总条数 = T0（从分页组件读取）
   c. 将 M0 和 T0 记录到执行上下文中，供后续验证使用
4. browser_console_messages() → 清空/记录初始控制台
```

自检证据写入 FLOW-PLAN 头部:
```markdown
## 执行初始化
- 初始表格行数: M0 = <数字>
- 初始分页总条数: T0 = <数字>
- 登录态: ✅
- 初始化时间: <时间戳>
```

## Step 4.2 单点执行标准流程

```
对于每个 SP-XXX:
  1. browser_navigate(baseURL + SP的前置路由)（如果不在正确页面）
  2. browser_snapshot() → 确认在正确页面（检查 URL / 关键文本）
  3. 如果 SP 包含表单:
     a. 先执行空值提交测试（Fuzzing）:
        - 直接 browser_click 提交按钮
        - browser_snapshot() 检查红字校验
        - browser_take_screenshot(filename="runtime/screenshots/<module>-SP-XXX-fuzz.png")
     b. 再按测试数据表逐字段注入:
        - el-input → browser_type(ref, value)
        - el-select/CommonSelect → browser_click 展开 → browser_click 选项
        - el-radio → browser_click 目标 radio
        - el-date-picker → browser_click → 选日期
     c. browser_click 提交按钮
     d. browser_snapshot() 验证弹窗关闭或页面变化
  4. browser_take_screenshot(filename="runtime/screenshots/<module>-SP-XXX-done.png")
  5. 更新 E2E_FLOW_PLAN.md（状态标记详见 references/status-markers.md）
```

## Step 4.3 搜索/筛选 SP 增强执行

```
对于搜索/筛选类 SP:
  1. 搜索前:
     a. browser_snapshot() → 记录搜索前表格行数 M_before
  2. 填入搜索条件 + 点击搜索
  3. 搜索后:
     a. browser_snapshot() → 记录搜索后表格行数 M_after
     b. 对比 M_before vs M_after:
        - M_after < M_before → ✅ 搜索有过滤效果
        - M_after == M_before 且搜索条件不为空:
          ├─ mock 模式 → [?][待确认] Mock 未实现搜索过滤
          └─ real-api 模式 → [!][搜索无效] 后端未按参数过滤
     c. browser_console_messages() → 检查是否有 API 请求发出
  4. 点击重置:
     a. browser_snapshot() → 确认筛选条件已清空
     b. 记录重置后行数 M_reset，验证 M_reset >= M_after
```

## Step 4.4 分页 SP 增强执行

```
对于分页验证 SP:
  1. browser_snapshot() → 读取分页组件:
     a. 当前页码 P / 总条数 T / 每页条数 S / 表格实际行数 M
  2. 验证逻辑一致性:
     a. T >= M
     b. T > S → 应有多页,验证翻页按钮可点击
     c. T <= S → 只有一页,翻页按钮应禁用
  3. 翻页测试（如果有多页）:
     a. 点击下一页 → 验证页码 P+1,数据刷新
     b. 点击返回上一页 → 验证数据恢复
  4. 失败标记:
     - T == 0 但表格有数据 → [!][分页总数错误]
     - 翻页后数据不变 → [!][分页功能无效]
```

## Step 4.5 CRUD 数据变更 SP 增强执行

```
对于新增/删除/编辑操作:
  1. 操作前: 记录 M_before + T_before
  2. 执行操作
  3. 操作后:
     a. 如需返回列表页 → browser_navigate
     b. browser_snapshot() → 记录 M_after + T_after
     c. 验证:
        ├─ 新增: M_after > M_before 或 T_after > T_before
        ├─ 删除: M_after < M_before 或 T_after < T_before
        └─ 编辑: 目标行数据已变化
     d. 数据未变化:
        ├─ mock → [!][Mock数据未变更]
        └─ real-api → [!][接口问题]
```

## Step 5 集成串联数据一致性检查

```
串联结束后,回到列表初始页面:
  1. browser_snapshot() → 记录 M_final + T_final
  2. 与 Step 4.1 初始状态对比:
     - 含新增操作 → M_final 应 > M0
     - 含删除操作 → M_final 应 < M0
     - 只有查看/编辑 → M_final 应 == M0
  3. 不一致 → 标记具体原因
```

## Step 6 测试报告模板

```markdown
# E2E 测试报告 — <模块名>

## 测试概况

| 项目 | 值 |
|-----|-----|
| 测试模式 | mock / real-api |
| 测试时间 | <时间> |
| API 审计 | ✅ / ⚠️ N 个问题 |
| 总 SP 数 | N |
| ✅ 通过 | X |
| ❌ 失败 | Y |
| ❓ 待确认 | Z |
| 页面覆盖 | M/N |
| 按钮覆盖 | M/N |
| 弹窗覆盖 | M/N |

## 单点结果明细

| SP编号 | 功能描述 | 状态 | 标签 | 截图 | 备注 |
|--------|---------|------|------|------|------|

## 集成流程结果

| Flow编号 | 描述 | 结果 | 数据一致性 |
|---------|------|------|-----------|

## 问题汇总

### 🔴 阻断问题
### 🟡 非阻断问题
### 🟢 已通过

## 截图清单
```

## Step 7 完成自检清单

```
☐ Step 0.9 API 审计报告已落盘
☐ Step 1 词典已生成并通过校验
☐ Step 2 剧本已生成并通过校验
☐ Step 4 所有 SP 都已执行（增量模式下 SKIP-UNCHANGED 不算遗漏）
☐ Step 4 所有截图已保存
☐ Step 5 集成串联已执行
☐ Step 6 测试报告已落盘
☐ 搜索/重置功能已验证（如有）
☐ 分页功能已验证（如有）
☐ CRUD 数据变更已验证（如有）
☐ E2E-FLOW-PLAN.md 中无残留 [ ] 标记
☐ baseline.json 已更新（所有 SP 的 status + fileHashes + lastTestedAt）
☐ experience.json 已更新（所有 SP 的 testData + lessons）
```
