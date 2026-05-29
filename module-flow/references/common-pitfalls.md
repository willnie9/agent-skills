# Module-Flow 常见踩坑

> 本文件被 [SKILL.md](../SKILL.md) 引用。

## 编排逻辑相关

### Stage A 失败但继续跑 Stage B
**症状**:Stage A 报错,但 module-flow 继续启动 Stage B
**原因**:违反铁律 3(A/B/C 失败立即停)
**修复**:Stage A/B/C 任一失败立即 return,Stage D 才允许警告不打断

### Stage D 失败把整个流程算失败
**症状**:e2e 没过,产物清单/git 建议都没给
**原因**:违反铁律 4(D 失败警告不打断)
**修复**:Stage D 失败 → 把 exit code 和截图记入报告,**仍然继续 Step 5**

### 多个任务并行处理
**症状**:用户贴了 3 个 PROJECT-TASK,本 skill 同时跑
**原因**:违反铁律 6(一次只跑一个完整任务)
**修复**:检测多个任务时拒绝,告诉用户分批跑

## 字段解析相关

### pagePath 用 `/` 而不是 ` / `
**症状**:解析 pagePath 时分段错误
**原因**:用户写的是 `<父级菜单>/<目标菜单>`(无空格)
**修复**:解析时按 `\s*/\s*` 容错,但要标准化到 ` / `

### module 推断含中文
**症状**:推断出 `module: <目标菜单>`
**原因**:从 pagePath 末段直接取,没转 camelCase
**修复**:先查项目现有路由文件命名找最贴近,再用拼音首字母 + 描述性英文

### stages 写错
**症状**:`stages: A B C D` 或 `stages: A→B→C`
**原因**:格式不符合 schema
**修复**:严格 `^[ABCD](,[ABCD])*$`,逗号分隔

## 数据策略相关

### 没问数据策略默认走 mock
**症状**:用户只给 mastergo,本 skill 直接默认 mock 跑了
**原因**:违反铁律 7(主动弹 A/B/C/D)
**修复**:Step 2 检测 apiLink 为空时必须展示 data-strategy-options.md 的 4 选项

### 用户说"D" 但没生成 mock.ts
**症状**:选了"半 mock"模式,但 `<接口目录>/<module>/` 没有 mock.ts
**原因**:Stage B 调 yapi-to-code 时没传 dataStrategy=auto 让它生成 mock.ts
**修复**:Stage B 输入必须含 `dataStrategy`,yapi-to-code 才知道要不要产 mock

## Git 相关

### 自动 commit / push
**症状**:用户没说要提交,本 skill 自己 git commit 了
**原因**:违反铁律 6
**修复**:Step 5 只给 git 建议命令,**不执行**

### Git 建议不全
**症状**:建议命令漏了菜单文件 / 路由文件
**原因**:Step 5 没收集所有修改文件
**修复**:从 Stage C 输出的 `files.modified` 完整取(含项目路由/菜单同步处)

## 取消 / 恢复相关

### 用户说"算了" 但产物被删了
**症状**:用户改主意继续不行了
**原因**:违反取消铁律(保留已落盘产物)
**修复**:取消时只暂停,**不删任何文件**,告诉用户产物位置

### "继续 <module>" 时全部重跑
**症状**:Stage A 产物还在,但本 skill 又跑了一次
**原因**:没做产物检测
**修复**:cancel-and-resume.md 场景 4,启动前先检测 dom-tree.json / define.ts / Index.vue 各自是否存在

## 工作流相关

### Stage 之间不给检查点
**症状**:用户输完任务指令,本 skill 从 A 一气跑到 D 才停
**原因**:违反铁律 1
**修复**:每个 Stage 内部完成必停一下,等用户"继续"

### 直接生成代码
**症状**:module-flow 自己写了 Vue SFC
**原因**:违反铁律 2(只编排不实现)
**修复**:把 dom-tree.json 委托给 frontend-page-design,自己不动手

---

发现新坑?追加。每月把高频项升级为铁律。
