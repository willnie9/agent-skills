# 公共组件清单与全局样式 class

> 本文件被 [SKILL.md](../SKILL.md) Step 1/4 引用。
>
> **本文件只描述"如何探测项目公共组件清单"的方法学,不预设具体清单**。项目实际有哪些公共组件、叫什么名,由 Claude 在 SKILL.md Step 1 读 1-2 个现有同类页面抽取得来。

## 探测方法

### 1. 找项目封装组件入口

```bash
# 项目通常有一个 components/ 目录,里面是项目自封装的组件
ls -d src/components/*/ 2>/dev/null | head -20

# 或者按业务领域散落在 views 下
find src/views -name "*.vue" -path "*/components/element/*" | head -10
```

### 2. 在 1-2 个同类页面里抓 import 列表

```bash
# 拿一个项目里的现有 Index.vue,看它 import 了什么组件
grep -E "^import .* from " <参考页路径>
```

把 `from '<UI 框架>'` 之外的所有 import 视为**项目封装组件**,这就是你这个新模块应该优先使用的组件清单。

### 3. 抽取全局样式 class

```bash
# 项目通常在 styles/ 或 assets/styles/ 下有全局 class
grep -rE "^\.[a-z-]+\s*\{" src/styles/ src/assets/styles/ 2>/dev/null | head -30
# 关注命名特征:custom-* / common-* / global-* / app-* / proj-* 等前缀
```

或者直接看参考页 `<template>` 里裸用了哪些 class(没有 `:class` 绑定的字面量 class),这些就是全局 class。

## 公共组件优先级铁律

| 优先级 | 做法 |
|---|---|
| 1 | **能用项目封装组件就用项目封装**(Step 1 探测得来) |
| 2 | 项目封装组件没覆盖到的场景,才用 UI 框架原生组件(如 Element Plus / Ant Design) |
| 3 | 都没有的情况下,才用原生 HTML 标签 |

新模块**禁止凭印象造"项目应该有 XX 组件"**。Step 1 探测不到的组件就是没有,缺什么找用户确认。

## 公共组件的视觉边界

| 不能改的(内部样式) | 必须还原的(布局/间距) |
|---|---|
| 项目封装组件的内部颜色/字体/圆角/阴影 | 公共组件容器的 `padding` / `margin` / `gap` / `width` |
| 项目封装按钮 class 的视觉 | 公共组件与周围元素的间距关系 |
| 项目封装输入框 class 的视觉 | 非公共组件的所有元素:颜色/字体/圆角/阴影/间距全部 1:1 还原 |
| UI 框架原生组件(如 el-dialog)的默认视觉 | — |

**一句话**:公共组件的外部位置和间距按设计稿还原,内部样式不动。非公共组件全部 1:1 还原。

## 参考页选用指南

不预设清单,从项目现有页面里挑同类:

```bash
# 列出所有 Index.vue 候选
ls -d src/views/*/Index.vue 2>/dev/null

# 按关键词找业务最相近的
grep -rl "<新模块关键词>" src/views/ | head -5
```

如果项目有目录嵌套(如 `src/views/<一级业务>/<二级业务>/Index.vue`),用 `find` 递归找:

```bash
find src/views -maxdepth 4 -name "Index.vue" | head -20
```

选 1-2 个语义最贴近的作为参考页,完整读它的:
- 主页面(Index.vue) — 学整体结构、import 清单、表格/筛选风格
- 详情(常见名 DetailDrawer.vue / Detail.vue) — 学抽屉/详情风格
- 弹窗(常见名 AddOrEditDialog.vue / CreateXxxDialog.vue) — 学弹窗风格

这些**抽取出来的具体组件名 / class 名 / 路径,只在当前会话的内存里有效**,不要回写到本文件——不同项目命名不同。
