# 页面模板代码

> 本文件被 [SKILL.md](../SKILL.md) Step 4/5 引用。提供主页面、弹窗、详情抽屉的完整骨架。
>
> 模板里的 `<项目封装表格组件>` / `<项目主按钮 class>` / `<项目封装下拉选择>` 等占位符,以 SKILL.md Step 1 探测项目参考页时抽取的实际组件名/class 名替换。Customer 是业务示例,新模块换实际名。

## 主页面骨架(列表 + 筛选 + 表格)

```vue
<script setup lang="ts">
// 1. vue/vue-router 导入
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// 2. 组件导入(全部以 Step 1 探测得来的项目封装为准)
import <项目封装表格组件> from '<项目封装表格组件路径>';
import { <项目封装下拉选择> } from '<项目封装下拉选择路径>';
import { <项目封装操作按钮组> } from '<项目封装表格组件路径>';
import AddOrEditDialog from './components/AddOrEditDialog.vue';
import DetailDrawer from './components/DetailDrawer.vue';
import StatusTag from './components/StatusTag.vue';

// 3. API / define 导入
import { queryCustomerPage, deleteCustomer } from '<接口目录>/customer/api';
import type { CustomerItem, QueryCustomerRequest } from '<接口目录>/customer/define';
import { CUSTOMER_STATUS_MAP } from '<接口目录>/customer/define';

// 4. 类型定义
interface FilterForm {
  keyword: string;
  status?: number;
}

// 5. 响应式数据
const filterForm = reactive<FilterForm>({
  keyword: '',
  status: undefined,
});

const pagination = reactive({
  currentPage: 1,
  pageSize: 20,
  total: 0,
});

const tableData = ref<CustomerItem[]>([]);
const tableLoading = ref(false);
const addOrEditVisible = ref(false);
const detailVisible = ref(false);
const currentRowData = ref<CustomerItem | null>(null);
const currentRowId = ref<string>('');

const statusOptions = Object.entries(CUSTOMER_STATUS_MAP).map(([value, label]) => ({
  value: Number(value),
  label,
}));

// 6. 业务方法

// 查询参数构建
function getApiParams(): QueryCustomerRequest {
  return {
    pageNum: pagination.currentPage,
    pageSize: pagination.pageSize,
    keyword: filterForm.keyword || undefined,
    status: filterForm.status,
  };
}

// 查询列表
async function fetchData() {
  tableLoading.value = true;
  try {
    const { data } = await queryCustomerPage(getApiParams());
    //         ↑ 响应壳字段名以 yapi-to-code Step 0 探测结果为准(.data / .result / ...)
    tableData.value = data.list;
    pagination.total = data.total;
  } catch (e) {
    ElMessage.error('查询失败');
  } finally {
    tableLoading.value = false;
  }
}

// 搜索/重置/分页/新增/编辑/查看/删除省略,参考项目同类页面(Step 1 探测得来)
// ...

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="<module>-wrapper">
    <!-- 筛选区 -->
    <section class="<module>__filter">
      <el-form :model="filterForm" inline class="<项目搜索表单 class>">
        <el-form-item label="关键词">
          <el-input
            v-model="filterForm.keyword"
            placeholder="请输入"
            clearable
            class="<项目输入框 class>"
          />
        </el-form-item>
        <el-form-item label="状态">
          <<项目封装下拉选择>
            v-model:value="filterForm.status"
            :options="statusOptions"
            placeholder="请选择"
          />
        </el-form-item>
        <el-form-item>
          <button class="<项目主按钮 class>" @click="handleSearch">查询</button>
          <button class="<项目次按钮 class>" @click="handleReset">重置</button>
        </el-form-item>
      </el-form>
    </section>

    <!-- 表格区 -->
    <section class="<module>__table">
      <div class="<module>__table-header">
        <button class="<项目主按钮 class>" @click="handleAdd">新增</button>
      </div>

      <<项目封装表格组件>
        :data="tableData"
        :loading="tableLoading"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <<项目封装操作按钮组>
              :buttons="[
                { label: '查看', onClick: () => handleView(row) },
                { label: '编辑', onClick: () => handleEdit(row) },
                { label: '删除', onClick: () => handleDelete(row), danger: true },
              ]"
            />
          </template>
        </el-table-column>
      </<项目封装表格组件>>
    </section>

    <!-- 弹窗 -->
    <AddOrEditDialog
      v-if="addOrEditVisible"
      v-model:visible="addOrEditVisible"
      :detail="currentRowData"
      @submit="handleSubmitSuccess"
    />

    <!-- 详情抽屉 -->
    <DetailDrawer
      v-if="detailVisible"
      v-model:visible="detailVisible"
      :id="currentRowId"
    />
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #233a6d;
$border-color: #e2e8f2;

.<module>-wrapper {
  // 视觉细节从 dom-tree.json 的 style 字段映射而来,严格按设计稿 1:1 还原
}

.<module>__filter {
  // ...
}

.<module>__table {
  &-header {
    // ...
  }
}

:deep(.el-table) {
  // 必要的 Element Plus 覆盖
}
</style>
```

## 弹窗骨架(AddOrEditDialog)

**完整弹窗规范 + Vue 模板代码 + 8 条强制条款**(el-dialog 属性 / el-form 属性 / 表单标签对齐 / 下拉用法 / emit 类型 / 按钮样式 / 样式作用域 / style 禁忌)详见 [./code-style.md#弹窗规范](./code-style.md) 「弹窗规范」段。

**速查 5 个关键点**:
- `<el-dialog>` 必须 `align-center` + `width="520px"` + `:close-on-click-modal="false"`
- `<el-form>` 必须 `label-width="110px"` + `ref="formRef"`
- 下拉用项目封装的下拉组件(Step 1 探测得来),不是 UI 框架原生
- 按钮用原生 `<button>` + 项目主按钮 class / 次按钮 class(Step 1 探测得来,不是 UI 框架原生按钮组件)
- `<style lang="scss">` **不加 scoped**,用 `<module>-dialog-wrapper` 命名空间隔离

权威参考实例:看项目里现有的弹窗组件(SKILL.md Step 1 探测得来)

## 详情抽屉骨架

参考项目里现有的详情抽屉组件(SKILL.md Step 1 探测得来)。核心:

```vue
<el-drawer
  :model-value="visible"
  size="600px"
  :with-header="false"
  @close="handleClose"
>
  <!-- 内容 -->
</el-drawer>
```

## 状态标签组件骨架

```vue
<script setup lang="ts">
import { CustomerStatus, CUSTOMER_STATUS_MAP } from '<接口目录>/customer/define';

defineProps<{
  status: CustomerStatus;
}>();
</script>

<template>
  <span
    class="status-tag"
    :class="{
      'status-tag--enabled': status === CustomerStatus.Enabled,
      'status-tag--disabled': status === CustomerStatus.Disabled,
    }"
  >
    {{ CUSTOMER_STATUS_MAP[status] }}
  </span>
</template>

<style lang="scss" scoped>
.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;

  &--enabled {
    background: rgba(82, 196, 26, 0.1);
    color: #52c41a;
  }

  &--disabled {
    background: rgba(170, 179, 191, 0.1);
    color: #aab3bf;
  }
}
</style>
```
