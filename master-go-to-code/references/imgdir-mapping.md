# imgDir 路径推断规则

> 本文件被 [SKILL.md](../SKILL.md) Step 1 引用。规定如何从 `pagePath` 推断图片资源目录。

## 推断规则(4 步)

1. **探测项目资源目录约定**(只做一次):
   ```bash
   ls -d src/assets/images/*/ 2>/dev/null | head -10
   # 或 public/img/* / src/static/images/* 等,看项目实际
   ```
   找到项目用的图片根目录(下面统称 `<imgRoot>`)。

2. **探测项目一级目录命名风格**:
   - 英文 camelCase(如 `marketing` / `customer` / `report` 等) → 主流
   - kebab-case(如 `marketing` / `in-hospital-service`)
   - 拼音(如 `yingxiao` / `zaiyuanfuwu`) → 不推荐,但有项目用

3. **从 `pagePath` 推断目录**:
   - 取 `pagePath` 第一段作为一级目录名(语义翻译,沿用第 2 步探测的命名风格)
   - 取 `pagePath` 最后一段作为二级目录名
   - 拼接 `<imgRoot>/<一级>/<二级>/`,单段时省略二级

4. **找不到对照时的兜底**:
   - 列出现有一级目录(`ls -d <imgRoot>/*/`),挑语义最贴近的复用
   - 没对应的一级 → 中文翻译为 camelCase 英文(如"风控管理" → `riskControl`)
   - 向用户确认推断结果

执行 `mkdir -p <推断 imgDir>` 确保目录存在。

## 示例(通用占位 → 项目示例)

通用占位:

| pagePath | imgDir |
|---|---|
| `<一级菜单>` | `<imgRoot>/<一级目录>/` |
| `<一级菜单> / <二级菜单>` | `<imgRoot>/<一级目录>/<二级目录>/` |

项目里的具体一级目录命名,**不要写在 skill 里**,直接 `ls -d <imgRoot>/*/` 查现有结构。新模块沿用相邻业务的目录命名风格。

## 一级目录命名建议(选英文 camelCase 时)

| 业务类型 | 推荐目录名 |
|---|---|
| 首页 / 工作台 | `home` / `workbench` |
| 营销 / CRM / 客户 | `marketing` / `crm` / `customer` |
| 任务 / 工单 | `task` / `workOrder` |
| 财务 / 账户 | `finance` / `account` |
| 系统设置 / 配置 | `systemManage` / `setting` |
| 数据统计 / 报表 | `statistic` / `report` |

具体以项目现有命名为准,不要新造一套。
