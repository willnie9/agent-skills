---
inclusion: auto
---

# 项目代码风格规范

> **本文件是 `frontend-page-design` 的 reference 文件,499 行。** 章节较多,先看目录定位再读。
>
> **占位符约定**:模板里的 `<项目封装表格组件>` / `<项目主按钮 class>` / `<项目封装下拉选择>` 等占位符,以 SKILL.md Step 1 探测项目参考页时抽取的实际组件名/class 名替换。Customer 是业务示例,新模块换实际名。

## 目录

- [目录结构](#目录结构)
- [Script 规范](#script-规范)
- [公共组件清单](#公共组件清单)
- [弹窗规范](#弹窗规范)
- [Template 规范](#template-规范)
- [布局规范](#布局规范)
- [Style 规范](#style-规范)
- [BEM 容器层命名约定](#bem-容器层命名约定)
- [命名规范](#命名规范)
- [路由规范](#路由规范)
- [API 规范](#api-规范)
- [Mock 规范](#mock-规范)

---

## 目录结构

```
<项目视图目录>/<module>/
├── Index.vue               ← 列表页(或 XxxPage.vue)
├── <module>Common.scss     ← 模块公共样式
├── components/             ← 弹窗、子组件
│   └── element/            ← 基础UI封装(项目封装表格/下拉等)
├── detail/                 ← 详情子页面
│   ├── index.vue
│   ├── types.ts
│   └── components/
└── hooks/                  ← 组合式逻辑(useXxx.ts)

<项目接口目录>/<module>/
├── api.ts                  ← API 函数,每个函数有编号注释
├── define.ts               ← 所有 interface / enum / type
└── mock.ts                 ← mock 数据(可选)

<项目视图目录>/<module>/images/   ← 模块图片统一放这里(语义化命名)
```

(`<项目视图目录>` 常见 `src/views/` / `src/pages/`,`<项目接口目录>` 常见 `src/cache/` / `src/api/`,以 SKILL.md Step 0 探测结果为准)

---

## Script 规范

```vue
<script setup lang="ts">
// 1. vue/vue-router 导入
// 2. 组件导入
// 3. API / define 导入
// 4. 类型定义（interface / enum）
// 5. 响应式数据
// 6. 业务方法（按职责分块，块间空行+注释）
</script>
```

- 必须用 `<script setup lang="ts">`，不用 Options API
- `reactive` 用于表单对象和分页，`ref` 用于单值状态
- 业务逻辑按职责分块，每块前加注释：`// 搜索方法`、`// 重置方法`
- API 调用统一 try/catch，catch 里 `ElMessage.error`
- 查询参数构建抽成 `getApiParams()` 函数

---

## 公共组件清单

> 完整清单(必用 + 按需 + 全局 class + 视觉边界)详见 [./component-catalog.md](./component-catalog.md)。

**速查 5 个必用公共组件**(实际名以 Step 1 探测得来):
- 项目封装表格(代替 UI 框架原生表格)
- 项目封装 tabs(代替 UI 框架原生 tabs)
- 项目封装下拉选择(代替 UI 框架原生 select)
- 项目封装分页器 + 操作按钮组
- 弹窗用 UI 框架原生 `el-dialog` / `a-modal` 等,无需封装

**速查全局 class**(实际名以 Step 1 探测得来):
- 项目主按钮 class / 次按钮 class
- 项目输入框统一 class
- 项目搜索表单容器 class

**视觉边界一句话**:公共组件外部位置间距按设计稿 1:1 还原,内部样式不动。非公共组件全部 1:1 还原。

---

## 弹窗规范

**参考模板:** 项目里现有的弹窗组件(SKILL.md Step 1 探测得来,优先挑同业务域的复杂弹窗作参考)

### 基础结构

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import <项目封装下拉选择> from '<项目封装下拉选择路径>';

// Props & Emits
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: FormData): void;
}>();

// 表单数据
const formRef = ref<FormInstance>();
const formData = ref<FormData>({
  // ...
});

const rules: FormRules = {
  // ...
};

// 方法
function handleClose() {
  emit('update:visible', false);
  formRef.value?.resetFields();
}

function handleSubmit() {
  formRef.value?.validate((valid) => {
    if (valid) {
      emit('submit', formData.value);
      ElMessage.success('操作成功');
      handleClose();
    }
  });
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    class="xxx-dialog-wrapper"
    title="弹窗标题"
    width="520px"
    align-center
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="110px"
      class="xxx-dialog__form"
    >
      <!-- 表单项 -->
      <el-form-item label="字段名称" prop="fieldName" required>
        <<项目封装下拉选择>
          v-model:value="formData.fieldName"
          :options="options"
          placeholder="请选择"
          width="337px"
          @change="formData.fieldName = $event"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="xxx-dialog__footer">
        <button class="<项目次按钮 class>" @click="handleClose">取消</button>
        <button class="<项目主按钮 class>" @click="handleSubmit">确定</button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss">
.xxx-dialog-wrapper {
  .el-dialog__header {
    padding: 15px;
    border-bottom: none;
  }

  .el-dialog__body {
    padding: 0 20px 20px;
  }

  .el-dialog__footer {
    padding: 15px 0;
    border-top: 1px solid #dfe3eb;
  }

  .xxx-dialog__form {
    .el-form-item {
      margin-bottom: 15px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .el-form-item__label {
      font-family: PingFang SC, sans-serif;
      font-size: 14px;
      line-height: 16px;
      color: #222222;
      text-align: right;
      display: inline-flex;
      justify-content: flex-end;
      align-items: center;

      &::before {
        color: #ec4f58;
      }
    }
  }

  .xxx-dialog__footer {
    display: flex;
    justify-content: center;
    gap: 15px;

    button {
      min-width: 78px;
      height: 36px;
      padding: 8px 25px;
      border: none;
      border-radius: 8px;
      font-family: PingFang SC, sans-serif;
      font-size: 14px;
      line-height: 19px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .<项目次按钮 class> {
      border: 1px solid rgba(35, 58, 109, 0.5);
    }
  }
}
</style>
```

### 关键规范

1. **el-dialog 属性（必须）：**
   - `align-center` — 垂直居中对齐
   - `width="520px"` — 默认宽度（根据内容可调整）
   - `:close-on-click-modal="false"` — 禁止点击遮罩关闭

2. **el-form 属性（必须）：**
   - `label-width="110px"` — 标签宽度统一 110px
   - `ref="formRef"` — 用于表单验证

3. **表单标签对齐（必须）：**
   ```scss
   .el-form-item__label {
     display: inline-flex;
     justify-content: flex-end;
     align-items: center;  // 关键：垂直居中对齐
   }
   ```

4. **下拉选择(必须):**
   - 使用项目封装的下拉组件(Step 1 探测得来),不用 UI 框架原生 select
   - 用法:
     ```vue
     <<项目封装下拉选择>
       v-model:value="formData.field"
       :options="options"
       placeholder="请选择"
       :filterable="true"
       width="337px"
       @change="formData.field = $event"
     />
     ```

5. **emit 类型定义（必须）：**
   ```ts
   const emit = defineEmits<{
     (e: 'update:visible', value: boolean): void;
     (e: 'submit', data: FormData): void;
   }>();
   ```

6. **按钮样式(必须):**
   - 主按钮: 项目主色按钮 class(Step 1 探测得来,如 `custom-btn-style-normal` / `app-btn-primary` 等)
   - 次按钮: 项目次色按钮 class(Step 1 探测得来,如 `custom-btn-style-white` / `app-btn-default` 等)
   - 不要用 UI 框架原生按钮组件(如 `el-button` / `a-button`),用原生 `<button>` + 项目全局 class

7. **样式作用域：**
   - 弹窗样式用 `<style lang="scss">` 不加 scoped
   - 非弹窗样式用 `<style lang="scss" scoped>` 必须加 scoped
   - 用 `.xxx-dialog-wrapper` 作为命名空间隔离 
8. **style标签里面禁止使用&作为父元素继承必须class全称：**


---

## Template 规范

- 结构分 `section`,class 用 BEM:`module-name__filter`、`module-name__table`
- 筛选区 + 表格区两段式布局
- 表格用项目封装的表格组件(SKILL.md Step 1 探测得来),不直接裸用 UI 框架原生表格
- 操作按钮统一用项目主/次按钮 class(Step 1 探测得来)
- 弹窗组件放模板最底部,用 `v-if` + `v-model` 控制
- Tab 切换统一用项目封装的 tabs 组件(Step 1 探测得来),不要裸用 UI 框架原生 tabs

---

## 布局规范

- 优先用 `flex` 布局，不用 `float`
- 禁止无必要的 `position: absolute`，仅在以下场景使用：
  - 遮罩层、浮层、tooltip
  - 设计稿明确要求绝对定位的元素
- 页面整体纵向布局用 `flex-direction: column` + `flex: 1` 撑满高度
- 横向排列元素用 `display: flex` + `gap` 控制间距，不用 `margin` 堆叠
- 响应式优先用 `flex-wrap: wrap`，不用媒体查询硬断点

---

## Style 规范

```vue
<style lang="scss" scoped>
$primary-color: #233a6d;
$border-color: #e2e8f2;

.module-name {
  &__filter { ... }
  &__table { ... }

  .status-tag {
    &.running { ... }
    &.completed { ... }
  }
}

:deep(.el-table) { ... }
</style>
```

- `<style lang="scss" scoped>` — **必须加 scoped**，避免样式污染
- 变量定义在顶部
- SCSS 嵌套，子元素用 `&__xxx`，状态用 `&.xxx` 或 `&--xxx`
- `:deep()` 穿透覆盖 Element Plus 样式
- 公共样式抽到 `moduleCommon.scss`，顶部 `@import`

---

## BEM 容器层命名约定

根元素 class 固定为模块名（kebab-case），容器层按语义选用后缀：

| 后缀 | 用途 |
|---|---|
| `module-name-wrapper` | 页面最外层包裹，负责整体布局/背景，挂在根 `<div>` 上（与模块 BEM 根并列） |
| `module-name__container` | 内容区域，控制最大宽度、内边距 |
| `module-name__inner` | 容器内的次级包裹，用于进一步限制布局 |
| `module-name__content` | 具体内容块 |
| `module-name__box` | 独立的卡片/区块容器 |

示例（参考 `CallTask.vue`）：

```html
<!-- 根元素：模块 BEM 根 + wrapper 布局类并列 -->
<div class="life-service-wrapper ">
  <section class="life-service__filter"> ... </section>
  <section class="life-service__table"> ... </section>
</div>
```

- 根 `<div>` 同时挂模块名和 `xxx-wrapper`，模块名用于 BEM 作用域，`wrapper` 用于全局布局复用
- 不要只写裸模块名（如 `life-service`）而缺少容器语义后缀

---

## 命名规范

| 类型 | 规则 | 示例 |
|---|---|---|
| 事件处理 | `handle` 前缀 | `handleSearch`、`handleReset`、`handlePageChange` |
| 弹窗可见性 | `xxxVisible` | `createTaskVisible`、`reassignVisible` |
| 当前操作行 | `currentRowData`、`currentXxxId` | `currentTaskId`、`currentRowData` |
| 加载状态 | `xxxLoading` | `tableLoading`、`creatorSearchLoading` |
| 选中数据 | `multipleSelection` | — |
| 分页 | `pagination.currentPage / pageSize / total` | — |

---

## 路由规范

> 完整路由模板(3 处同步注册:`<module>Router.ts` / `pages.ts` / `routers.ts` + meta 字段约定 + 详情页特殊处理 + Hash 路由说明)详见 [./routing-patterns.md](./routing-patterns.md)。

**速查要点**:
- 路由文件名按项目现有约定(常见 `<路由目录>/<module>Router.ts`)
- 项目路由相关文件全部同步注册(SKILL.md Step 0 探测得来,1-3 处不等)
- `meta.moduleCode` 占位规则见 [./module-code-policy.md](./module-code-policy.md)
- 详情页 `meta.menu` 必须指向列表页(面包屑高亮用)

---

## API 规范

> 完整 API 模板(define.ts 含 enum + MAP / api.ts 编号注释 / 类型断言)详见 [../../yapi-to-code/references/api-templates.md](../../yapi-to-code/references/api-templates.md)。

**速查要点**:
- 响应类型用项目主流响应壳泛型(yapi-to-code Step 0 探测得来,字段名 `.data` / `.result` 等以项目实际为准)
- enum + Map 必须配对:`XxxStatus` enum + `XXX_STATUS_MAP` 对象
- 所有 interface/enum/type 集中 `define.ts`,`api.ts` 只调用
- 如项目 HTTP 客户端返回弱类型(如 `Promise<unknown>`),函数签名必须 `as Promise<XxxResponse>` 断言

---

## Mock 规范

> 完整 Mock 模板(axios-mock-adapter + 项目 mock 开关 + 注册步骤)详见 [../../yapi-to-code/references/mock-template.md](../../yapi-to-code/references/mock-template.md)。

**速查要点**:
- 后端未就绪用 `VITE_<MODULE>_MOCK=true` 拦截(开关字段名以项目实际为准),不污染业务代码
- `mock.ts` 文件位置:`<接口目录>/<module>/mock.ts`(按项目接口目录约定)
- 注册入口以项目现有 mock 总入口为准(常见 `<接口目录>/mock/index.ts`)
- `onNoMatch: 'passthrough'` 保证未注册接口走真实服务器
- 后端就绪后关掉 mock 开关,api.ts 和页面代码不用动
