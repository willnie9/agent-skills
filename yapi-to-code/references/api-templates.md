# define.ts / api.ts 文件模板

> 本文件被 [SKILL.md](../SKILL.md) Step 4 引用。
>
> 模板里的 `<ResponseWrapper>` / `<httpClient>` / `<响应壳基础目录>` 占位符替换为 SKILL.md Step 0 探测到的项目实际值。下面的 `Customer` 是示例业务,新模块换成实际业务名。

## define.ts 模板

```ts
import type { <ResponseWrapper>, PaginationDataList } from '<响应壳基础目录>/define';

/** 客户状态 */
export enum CustomerStatus {
  Enabled = 0,
  Disabled = 1,
}

export const CUSTOMER_STATUS_MAP: Record<CustomerStatus, string> = {
  [CustomerStatus.Enabled]: '启用',
  [CustomerStatus.Disabled]: '停用',
};

/** 列表项 (XxxListItem) */
export interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  status: CustomerStatus;
  createTime: number;
}

/** 查询列表请求 (QueryXxxPageRequest) */
export interface QueryCustomerRequest {
  pageSize: number;
  pageNum: number;
  keyword?: string;
  status?: CustomerStatus;
}

/** 新增客户请求 */
export interface CreateCustomerRequest {
  name: string;
  phone: string;
  status: CustomerStatus;
}

export type XxxListResponse = <ResponseWrapper><PaginationDataList<CustomerItem>>;
export type CustomerDetailResponse = <ResponseWrapper><CustomerItem>;
export type CustomerOperationResponse = <ResponseWrapper><null>;
```

## api.ts 模板

```ts
import { <httpClient> } from '<响应壳基础目录>/api';
import type {
  QueryCustomerRequest,
  CreateCustomerRequest,
  XxxListResponse,
  CustomerDetailResponse,
  CustomerOperationResponse,
} from './define';

// 1. 查询列表
export function queryCustomerPage(params: QueryCustomerRequest): Promise<XxxListResponse> {
  return <httpClient>.post('/api/<resource>/queryPage', params) as Promise<XxxListResponse>;
}

// 2. 新增客户
export function createCustomer(params: CreateCustomerRequest): Promise<CustomerOperationResponse> {
  return <httpClient>.post('/api/customer/create', params) as Promise<CustomerOperationResponse>;
}

// 3. 修改客户
export function updateCustomer(params: CreateCustomerRequest & { id: string }): Promise<CustomerOperationResponse> {
  return <httpClient>.post('/api/customer/update', params) as Promise<CustomerOperationResponse>;
}

// 4. 删除客户
export function deleteCustomer(id: string): Promise<CustomerOperationResponse> {
  return <httpClient>.post('/api/customer/delete', { id }) as Promise<CustomerOperationResponse>;
}

// 5. 获取客户详情
export function getCustomerDetail(id: string): Promise<CustomerDetailResponse> {
  return <httpClient>.post('/api/customer/detail', { id }) as Promise<CustomerDetailResponse>;
}
```

`as Promise<XxxResponse>` 断言是否需要、`<httpClient>` 函数签名、import 路径,**全部以 SKILL.md Step 0 探测到的项目惯例为准**。

## 文件已存在时的冲突处理

```ts
// 伪代码
if (existsSync('<接口目录>/<module>/define.ts')) {
  // 1. 读现有内容
  // 2. 检查同名 interface/enum/type
  // 3. 有冲突 → 给用户三选:
  //    A. 覆盖旧版
  //    B. 新接口的类型改名为 XxxItemV2
  //    C. 跳过新接口
  // 4. 无冲突 → 文件末尾追加,保留原内容
}
```
