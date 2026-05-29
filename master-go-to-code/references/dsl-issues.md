# DSL 精修问题清单

> 每次遇到新问题就追加一条 + 解决方案 + 影响范围 + 处理优先级。
> 是 master-go-to-code/scripts/refine-dom-tree.py 的需求和验收文档。

## 状态图例

- ✅ 已实现
- 🟡 部分实现
- ❌ 待实现
- 🔴 不打算实现(代价大于收益)

---

## Phase 1 · 布局偏移(优先级最高)

### #1 relativeX/Y → padding/margin
- **状态**: ❌
- **现象**: 子节点 relativeX:20, relativeY:20 时 flex 父没 padding,子节点紧贴父左上角
- **DSL 字段**: 子节点 layoutStyle.relativeX/Y
- **CSS 翻译**:
  - 父有 flexContainerInfo → 取所有子 min(relativeX) 作 padding-left,min(relativeY) 作 padding-top,右下边距同理
  - 父无 flex → position:relative + 子 position:absolute + left/top = relativeX/Y
- **影响**: 全局位置错位,卡片之间贴边

### #2 constraints → right/bottom 锚点
- **状态**: ❌
- **现象**: 节点本意"靠右上",DSL 用 constraints:RIGHT,精修直接用 left 错位
- **DSL 字段**: layoutStyle.constraints / 或某些容器的右锚点暗示
- **CSS 翻译**: constraints=RIGHT → right: (父宽 - relativeX - 自身宽); BOTTOM 同理
- **影响**: 操作列、关闭按钮跑左边

### #3 flexContainerInfo.justifyContent
- **状态**: 🟡(部分读)
- **现象**: 分页右对齐变左对齐
- **DSL 字段**: flexContainerInfo.justifyContent
- **CSS 翻译**: 同名映射 (flex-start / center / space-between / flex-end)

### #4 flexContainerInfo.padding
- **状态**: ❌
- **现象**: flexContainerInfo 内部带的 padding 字段没读
- **DSL 字段**: flexContainerInfo.paddingTop/Right/Bottom/Left
- **CSS 翻译**: padding: top right bottom left

---

## Phase 2 · 装饰

### #5 effect → box-shadow / filter
- **状态**: ❌
- **现象**: 卡片没阴影,毛玻璃效果消失
- **DSL 字段**: effect (effect_xxx 引用 styles 表)
- **CSS 翻译**:
  - effect type=DROP_SHADOW → box-shadow: x y blur spread color
  - effect type=LAYER_BLUR → filter: blur(N px)
  - effect type=BACKGROUND_BLUR → backdrop-filter: blur(N px)

### #6 fill 渐变
- **状态**: ❌
- **现象**: 渐变背景变黑或单色
- **DSL 字段**: fill 引用 styles 表里的 paint 节点,paint.value 是数组 + type=GRADIENT_LINEAR
- **CSS 翻译**: linear-gradient(angle, stop1 pos1, stop2 pos2, ...)

### #7 opacity
- **状态**: ❌
- **现象**: 半透明文字/装饰节点变实色
- **DSL 字段**: node.opacity (0~1 浮点)
- **CSS 翻译**: opacity: <value>

### #8 rotation
- **状态**: ❌
- **现象**: 旋转的图标/箭头方向错
- **DSL 字段**: layoutStyle.rotation (角度)
- **CSS 翻译**: transform: rotate(N deg)

---

## Phase 3 · 文字精修

### #9 lineHeight
- **状态**: ❌
- **现象**: 行间距全用浏览器默认
- **DSL 字段**: font.lineHeight ("auto" / "Npx" / 数字)
- **CSS 翻译**: line-height: <value>

### #10 letterSpacing
- **状态**: ❌
- **现象**: 字间距错
- **DSL 字段**: font.letterSpacing
- **CSS 翻译**: letter-spacing: <value>

### #11 textDecoration (underline / strikethrough)
- **状态**: ❌
- **现象**: 链接没下划线
- **DSL 字段**: font.decoration
- **CSS 翻译**: text-decoration: underline / line-through

### #12 textCase
- **状态**: ❌
- **现象**: 英文大小写不一致
- **DSL 字段**: font.case (upper / lower / title)
- **CSS 翻译**: text-transform: uppercase/lowercase/capitalize

---

## Phase 4 · 边缘情况

### #13 mask / clipPath
- **状态**: ❌
- **现象**: 圆形头像不裁圆
- **DSL 字段**: node.mask = alpha
- **CSS 翻译**: 父容器 overflow:hidden + border-radius

### #14 strokeAlign (inside/outside/center)
- **状态**: ❌
- **现象**: 边框位置偏 1-2px
- **DSL 字段**: strokeAlign
- **CSS 翻译**: outside → outline 替代 border; inside → box-sizing:border-box

### #15 borderRadius 单角
- **状态**: ❌
- **现象**: 只能识别统一圆角,不支持单角
- **DSL 字段**: layoutStyle.borderRadius 可能是字符串 "8px" 或对象 {topLeft, topRight, ...}
- **CSS 翻译**: border-top-left-radius / border-top-right-radius / ...

### #16 多 stop 渐变
- **状态**: ❌(等 #6 完成顺便)
- **现象**: 三色渐变只取头尾
- **CSS 翻译**: 同 linear-gradient 但多个 stop

---

## 组件识别(MasterGo componentInfo)

### #widget-1 componentInfo.类型 字典命中
- **状态**: ❌(刚撤销过,等下次加回)
- **现象**: 输入框/选择框/按钮 都是裸 div
- **DSL 字段**: componentInfo.properties.类型
- **翻译**: 标 data-widget=el-input/el-select/el-button-primary 等
- **依赖**: 项目级 widget-dict.json

### #widget-2 componentId 重复实例
- **状态**: ❌
- **现象**: 100 个相同 cell 不知道是模板
- **DSL 字段**: componentId
- **翻译**: componentId 出现 ≥3 次 → 标 data-instance-of + data-instance-total
- **下游**: frontend-page-design 看到这俩字段 → 出 v-for

### #widget-3 INSTANCE 字段并集 + 组件定义二次拉取
- **状态**: ✅(2026-05-20 fetch-and-parse 实现)
- **现象**: 同 componentId 的多个 INSTANCE 字段深浅不一致 ——
  第一个含完整字段(borderRadius / flexContainerInfo / padding / strokeColor / effect 等),
  后续 instance 只返回最简版,且 dsl.components 数组通常为空。
  典型 bug: 主按钮组件被复用 3 次,精修产物只有 1 个有圆角,其余圆角丢失。
- **修复机制**: fetch-and-parse 自动两段式补全
  1. **第一段并集**: 扫所有 instance,按 componentId 取字段并集,A 缺的从 B 抄
  2. **第二段拉组件**: 对所有 componentId 单独 `layerId=cid` 请求一次组件定义,补并集中仍缺的字段
  3. **缓存**: 落 `<outDir>/component-cache.json`,key=`<fileId>:<componentId>`,跨运行复用,后续运行 0 网络
- **涉及字段(白名单)**: borderRadius / flexContainerInfo / fill / strokeColor / strokeType / strokeAlign / strokeWidth / effect / opacity
- **不补字段**: id / name / layoutStyle / children / componentInfo(实例独有)
- **影响**: 所有按钮/输入框/选择框/标签组件圆角、内边距、阴影等视觉属性零丢失
- **铁律**: SKILL.md 铁律 #6 禁止绕过此逻辑

---

## 切分策略

### #split-1 大于 30KB 必切
- **状态**: ✅(split-dsl.py 已实现)
- **阈值**: > 30KB 必切 / 20-30KB 推荐切 / < 20KB 直接落

### #split-2 切完保留 parent_id + position
- **状态**: ✅
- **格式**: 每个 chunk 文件带 source_node_id / parent_id / position 三字段
- **manifest**: chunks/_manifest.json 是总目录

### #split-3 合并器
- **状态**: ✅(2026-05-20 merge-refined.py 实现)
- **目的**: 14 个精修后 chunk → 合并回完整 dom-tree.json
- **规则**: 读 chunks/_manifest.json 拿到所有 chunk 的 source_node_id 和 file 映射,递归展开 `_children_placeholder: ["ref:<id>"]`,校验无残留 placeholder
- **入口**: `python3 merge-refined.py --in <outDir>/chunks-refined --manifest <outDir>/chunks/_manifest.json --out <outDir>/dom-tree.json`

---

## 修改记录

| 日期 | 改动 | 影响项 |
|---|---|---|
| 2026-05-19 | 建本清单 | 全部 |
| 2026-05-20 | #split-3 合并器实现 (merge-refined.py) | 切分 → 精修 → 合并闭环打通 |
| 2026-05-20 | #widget-3 INSTANCE 字段补全 + 组件二次拉取 + 缓存 | 按钮/输入框等组件圆角、padding、阴影零丢失 |
| 2026-05-20 | dom-tree-spec.md 新增 3 条布局规则 | 见下方 |
| 2026-05-20 | SKILL.md 升级 v1.0.0,工作流改为 Step 1.1 拉资源 + 1.2 切 chunk → Step 2.1-2.4 分块精修 + 合并 + 校验 | 与实际跑通流程对齐 |
| 2026-05-20 | SKILL.md 增铁律 #6:Step 1.1 INSTANCE 字段补全不可绕过 | 数据完整性强制约束 |
| 2026-05-20 | 产物清理补全:fetch-and-parse 清 chunks + chunks-refined;split-dsl 整目录 rmtree | 跨画板重跑无残留旧 chunk |

---

## dom-tree-spec.md 新增规则(2026-05-20)

均放置在「布局处理」章节,有对应 checklist 项。

### #spec-1 absolute 子要求父 relative(强制约束)
- **状态**: ✅(已写入 dom-tree-spec.md)
- **现象**: shell chunk 自身无 flex,子 chunk 是 absolute 定位时,absolute 一路向上找到画板,绕过中间 overflow:hidden 裁切
- **真实 bug**: 24-操作大类 absolute left:990,但祖先链(11/12/09/07)无 position:relative,操作列飞到画板右上角
- **规则**: 任何节点 style 含 position:absolute,直接父必须显式 position:relative
- **特例**: shell 容器(只有 _children_placeholder)精修产物若子是 absolute chunk,父必须加 position:relative

### #spec-2 flex 容器混合定位(常见陷阱)
- **状态**: ✅(已写入 dom-tree-spec.md)
- **现象**: flex 容器里有 LAYER 装饰兄弟用 absolute,精修被误传染,把同级 FRAME/INSTANCE 也写成 absolute,脱离 flex 主轴
- **规则**:
  - DSL 子 type 是 FRAME/INSTANCE/GROUP → 必为 flex item,不允许 position:absolute
  - DSL 子 type 是 LAYER 且 name 含"滚动轴/投影/阴影/氛围" → 可 absolute,但父必须 position:relative

### #spec-3 TEXT 在 flex 容器内的尺寸保留
- **状态**: ✅(已写入 dom-tree-spec.md,修正旧规则)
- **现象**: 旧规则"TEXT 不设 width/height"过于绝对。flex 容器内 TEXT 默认 flex-shrink:1,被 fixed-width 兄弟挤压换行
- **真实 bug**: 08-筛选项的"所属部门"label 被 240px 输入框挤压换行
- **规则细化**:
  - TEXT 在 absolute 父下(无 flex) → 不设 width/height
  - TEXT 在 flex 容器内,所有兄弟都 auto-size → 不设 width/height
  - TEXT 在 flex 容器内,**有 fixed-width 兄弟**(DSL `mainSizing: "fixed"`)→ 必须保留 figma width 作 min-width,或加 flex-shrink:0,二选一
