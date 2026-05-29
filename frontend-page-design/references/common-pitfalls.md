# Frontend-Page-Design 常见踩坑

> 本文件被 [SKILL.md](../SKILL.md) 引用。

## 类型 / 数据相关

### 响应字段访问错(`Property 'xxx' does not exist`)
**症状**:TS 编译报错,访问响应字段名失败
**原因**:响应壳字段名跟项目实际不符
**修复**:看 yapi-to-code Step 0 探测到的项目主流响应壳字段名(常见 `.data` / `.result` / `.body` 等),按它访问

### Mock 数据塞进 api.ts
**症状**:页面用得欢,后端就绪后忘了清理
**原因**:用了 mock 但写错位置
**修复**:用项目 mock 开关(如 `VITE_<MODULE>_MOCK`) + mock.ts 机制,api.ts 永远只调真实路径

## 路由 / 菜单相关

### 路由 404
**症状**:访问新模块路由显示 404
**原因**:违反铁律 3——项目路由相关文件漏改
**修复**:Step 0 探测到几处路由文件就同步几处(常见 1-3 处)

### 菜单不显示
**症状**:登录后菜单栏没有新模块
**原因**:权限码占位 ID 不在当前用户权限范围
**修复**:
- 短期:看项目是否有"绕过权限检查"开关字段,临时启用
- 长期:用项目兜底权限码常量(如 `WORKBENCH` / `HOME` / `COMMON`),所有人可见
- 正式:让后端分配真实 ID

### 面包屑高亮在错位置
**症状**:进详情页,菜单栏不再高亮"列表"
**原因**:详情页路由 meta.menu 没指向列表
**修复**:详情页 meta 字段(如 `menu`)必须指向列表路由名

## 组件 / 样式相关

### 弹窗按钮颜色不对
**症状**:弹窗按钮是 UI 框架默认色,不是项目主色
**原因**:用了 UI 框架原生按钮组件而不是项目全局按钮 class
**修复**:弹窗按钮统一原生 `<button>` + 项目全局按钮 class(铁律 5)

### `:deep()` 选择器不生效
**症状**:覆盖 UI 框架原生组件内部样式没效果
**原因**:弹窗样式加了 `scoped`,导致 `:deep()` 作用域不对
**修复**:弹窗用 `<style lang="scss">` **不加 scoped**,用 `<module>-dialog-wrapper` 命名空间隔离(铁律 6)

### SCSS 嵌套 `&` 失效
**症状**:子元素样式没应用
**原因**:`<style scoped>` 内用了 `&` 父元素继承(违反 code-style.md 第 8 条)
**修复**:scoped 样式内 class 全称,如:
```scss
// ❌
.<module>__filter {
  &__title { ... }   // 实际编译为 .<module>__filter__title,可能不是你想要的
}
// ✅
.<module>__filter { ... }
.<module>__filter__title { ... }
```

### 表格样式异常
**症状**:斑马纹/分页/空状态不对
**原因**:裸用了 UI 框架原生表格组件(铁律 1)
**修复**:换成项目封装的表格组件(SKILL.md Step 1 探测得来)

## 工作流相关

### 改文件前没出方案
**症状**:用户已经看到一半的代码才想"诶我没说要这么改"
**原因**:违反铁律 8——≥ 3 文件 / 含子组件 / 含弹窗的变更必须 Step 2 预览
**修复**:Step 2 必须列文件清单 + 等用户"确认"

### dom-tree.json 校验没跑
**症状**:Stage A 产物有问题,Stage C 生成出来代码引用错图片/缺 svg
**原因**:Step 0 没跑 master-go-to-code 的 validate-dom-tree.mjs
**修复**:Step 0 强制执行 `node .claude/skills/master-go-to-code/scripts/validate-dom-tree.mjs`(默认 outDir = skill 内部 output/,可加 MASTERGO_OUT_DIR 覆盖)

### `vue-tsc` 没跑
**症状**:写完代码进浏览器才发现类型错
**原因**:Step 9 自检忘记跑 `npx vue-tsc --noEmit`
**修复**:Step 9 强制跑,失败立即修

## 公共组件相关

### 项目公共组件 v-model 用错
**症状**:某项目封装组件的双向绑定不工作
**原因**:用了 `v-model="value"` 但该组件实际是 `v-model:xxx="value"`
**修复**:看公共组件实际 v-model 修饰符,Step 1 探测参考页时一并确认

### 远程搜索组件没响应
**症状**:输入关键字没触发请求
**原因**:`:remote="true"` 但没传 `:remote-method`
**修复**:远程模式必须传 `remote-method`,看项目封装组件实际 props

---

发现新坑?追加。每月把高频项升级为铁律。
