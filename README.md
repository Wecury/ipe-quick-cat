# IPE Quick Cat

快速编辑页面分类的 [InPageEdit NEXT](https://www.ipe.wiki/)（IPE）插件。

在 IPE 工具箱中新增「编辑分类」按钮，点击后像可视化编辑器一样管理页面分类：重命名、改排序键、添加 / 删除（多选）、拖动排序，以及编辑默认排序键 `{{DEFAULTSORT}}`。

## ✨ 特性

- 像可视化编辑器一样编辑分类：重命名 / 排序键 / 添加 / 删除（多选）
- 添加分类自动补全，重定向分类自动指向正确分类
- 拖动排序调整分类书写顺序
- 编辑默认排序键 `{{DEFAULTSORT}}`，帮助文本自动读取站点系统消息
- 编辑摘要（默认 `[IPE-NEXT] Quick Cat`）/ 小编辑 / 保存后刷新
- 自动适配 IPE 主题（含深色模式），多语言

## 📥 安装

### 官方插件商店（推荐）

本插件预计收录于官方 [InPageEdit 插件注册表](https://registry.ipe.wiki/)：

1. 打开任一已安装 InPageEdit 的 wiki 页面
2. 悬停右下角 IPE 工具箱 → ⚙️ 偏好设置 → 插件商店
3. 搜索 **Quick Cat** → 安装
4. 刷新页面，工具箱出现「编辑分类」按钮即可使用

> 若商店暂时找不到，说明还没审核；可先按下方「开发者本地预览」方式体验。

### 开发者本地预览

clone [inpageedit/plugin-registry](https://github.com/inpageedit/plugin-registry)，`pnpm install && pnpm dev`，在 IPE 插件商店添加 `http://localhost:1029/registry.v1.json` 即可安装本插件实时预览。

## 🧰 使用

1. 打开任意**可编辑**页面，悬停右下角 IPE 工具箱，点击「编辑分类」。
2. 在弹窗中：
   - **顶部**：全选 / 已选计数 / 一键删除所选
   - **每行分类**：拖左侧把手调整顺序；名称可直接改名（带补全）；排序键可修改；点 `✕` 删除
   - **添加分类**：底部输入框输入分类名，回车或点「添加」加入列表
   - **默认排序键**：字段留空表示不设置；点 ℹ 图标查看说明
   - **底部选项**：编辑摘要、小编辑、保存后刷新页面
3. 点「保存」即通过 API 写入页面。

## 🛠️ 实现说明

```
src/
├── index.ts        # 插件入口与 UI（defineIPEPlugin；注入 toolbox / modal / wikiPage / api）
├── context.ts      # 上下文工厂：i18n（跟随 IPE 语言偏好）/ logger / 命名空间信息
├── parse.ts        # wikitext 解析 / 生成
├── categoryState.ts # 分类状态纯函数（选择 / 拖拽 / 删除）
├── autocomplete.ts # 分类搜索 + 自动补全下拉
├── dom.ts          # 元素工厂 h() + SVG 图标
├── types.ts        # Ctx / QuickCatContext 类型
└── style.scss      # 样式
harness/            # 独立构建外壳：defineIPEPlugin 助手 / Promise.withResolvers / 类型声明
                    #（内容与官方注册表 common/ 一致，`~~/defineIPEPlugin.js` 别名指向此处）
```

- 构建：`npm run build` → `dist/index.mjs` + `dist/style.css`
- 测试：`npm test`（解析逻辑）；类型检查：`npm run typecheck`
- 国际化：复用官方字典（`ctx.$$`）+ 内置 en/zh 兜底，语言跟随 IPE 偏好设置（`@user` / `@site` / 具体代码，`i18n/changed` 热切换）
- 上架：已按官方 `inpageedit/plugin-registry` 包结构组织，`package.json` 的 `$ipe` 字段已配置
