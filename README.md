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

> 本仓库作为**自建注册表版本**维护，可通过下方自建注册表直接安装使用；官方商店收录后也可从官方商店安装。

### 自建注册表（当前可用）

本插件通过 [GitHub Pages](https://wecury.github.io/ipe-quick-cat/) 自建注册表分发：

1. 打开任一已安装 InPageEdit 的 wiki 页面
2. 悬停右下角 IPE 工具箱 → ⚙️ 偏好设置 → **插件商店**
3. 添加自定义注册表，填入：`https://wecury.github.io/ipe-quick-cat/registry.v1.json`
4. 找到 **Quick Cat** → 安装
5. 刷新页面，工具箱出现「编辑分类」按钮即可使用

### 官方插件商店

本插件正在申请收录于官方 [InPageEdit 插件注册表](https://registry.ipe.wiki/)，审核通过后可直接在商店搜索 **Quick Cat** 安装。

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
├── index.tsx       # 插件入口与 UI（defineIPEPlugin；注入 toolbox / modal / wikiPage / api / i18n）
├── context.ts      # 上下文工厂：i18n（registerMessages + ctx.$$）/ logger / 命名空间信息
├── parse.ts        # wikitext 解析 / 生成
├── categoryState.ts # 分类状态纯函数（选择 / 拖拽 / 删除）
├── autocomplete.tsx # 分类搜索 + 自动补全下拉
├── dom.ts          # SVG 图标
├── types.ts        # Ctx / QuickCatContext 类型
└── style.scss      # 样式
harness/            # 独立构建外壳：defineIPEPlugin 助手 / Promise.withResolvers / 类型声明
                    #（内容与官方注册表 common/ 一致，`~~/defineIPEPlugin.js` 别名指向此处）
```

- 构建：`npm run build` → `dist/index.mjs` + `dist/style.css`（自包含产物，可直接被 IPE 加载）
- 测试：`npm test`（解析逻辑）；类型检查：`npm run typecheck`
- 国际化：`registerMessages` 注册多语言 + 复用官方字典（`ctx.$$`），语言跟随 IPE 偏好设置
- 自动发布：push 到 `main` 时 GitHub Actions 自动构建并发布到 GitHub Pages（自建注册表）

## 📣 反馈

发现 bug 或想提建议？欢迎提交 [Issue](https://github.com/Wecury/ipe-quick-cat/issues) 或发起 [Pull Request](https://github.com/Wecury/ipe-quick-cat/pulls)。
