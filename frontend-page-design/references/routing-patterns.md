# 路由多处同步注册模板

> 本文件被 [SKILL.md](../SKILL.md) Step 7 引用。
>
> 项目通常有 1-3 处路由文件需要同步注册。具体几处、文件名是什么,以 SKILL.md Step 0 探测结果为准。下面以 3 处同步的常见模式举例,实际数量按项目调整。

## 必改文件(以 3 处同步模式为例)

```
<路由目录>/<module>Router.ts   ← 新建(模块自己的路由配置)
<路由常量文件>                 ← 加路由名常量
<路由入口文件>                 ← import + 注册到总数组
```

漏一处 → 路由 404。

## 1. 模块路由配置(新建)

```ts
import { RouteRecordRaw } from 'vue-router';
import { <路由常量枚举> } from '<路由常量文件>';
import { <项目权限码常量> } from '<权限码定义文件>';

const <module>Router: Array<RouteRecordRaw> = [
  {
    path: '/<module>',
    name: <路由常量枚举>.<module>,
    component: () => import('<项目布局组件>'),
    redirect: { name: <路由常量枚举>.<module> + 'index' },
    children: [
      {
        path: 'index',
        name: <路由常量枚举>.<module> + 'index',
        component: () => import('<视图目录>/<module>/Index.vue'),
        meta: {
          moduleCode: <项目权限码常量>.<占位项>,
          // TODO(perm): 借用 <相近模块>,等后端分配真实权限ID后替换
          menu: <路由常量枚举>.<module> + '/index',
          bread: '<页面名称>',
        },
      },
      // 详情页(如有)
      {
        path: 'detail/:id',
        name: <路由常量枚举>.<module> + 'detail',
        component: () => import('<视图目录>/<module>/Detail.vue'),
        meta: {
          menu: <路由常量枚举>.<module> + '/index',  // menu 指向列表页,面包屑高亮用
          bread: '<页面名称>详情',
        },
      },
    ],
  },
];

export default <module>Router;
```

## 2. 路由常量文件

在路由常量枚举末尾加:

```ts
export const <路由常量枚举> = {
  // ... 已有常量
  <module>: '<module>',
};
```

## 3. 路由入口文件

```ts
// 顶部 import
import <module>Router from './<module>Router';

// 总路由数组里加
export default [
  // ... 已有项
  ...<module>Router,
];
```

## 路由命名 / meta 字段约定

| 字段 | 用途 |
|---|---|
| `name: <路由常量枚举>.<module> + 'index'` | 路由唯一名,常量拼接子页 |
| `meta.moduleCode` | 权限标识,见 [module-code-policy.md](./module-code-policy.md) |
| `meta.menu` | 面包屑高亮 + 菜单激活定位 |
| `meta.bread` | 面包屑中文显示 |
| `meta.back: false` | 不显示返回按钮(列表页常用) |

具体 meta 字段名以项目现有路由配置为准,看参考页路由定义对齐。

## 详情页路由的特殊处理

```ts
{
  path: 'detail/:id',
  name: <路由常量枚举>.<module> + 'detail',
  meta: {
    menu: <路由常量枚举>.<module> + '/index',  // 重要:menu 指向列表,详情页菜单仍高亮在"列表"上
  },
}
```

## URL 路由模式

项目可能用 hash 模式(`createWebHashHistory`) 或 history 模式(`createWebHistory`)。看 router 入口文件确认:

```bash
grep -E "createWebHashHistory|createWebHistory" src/router/index.ts 2>/dev/null
```

| 模式 | URL 形态 |
|---|---|
| Hash | `http://<host>/#/<module>/index` |
| History | `http://<host>/<module>/index` |

写 playwright flow 时按对应模式拼 URL。
