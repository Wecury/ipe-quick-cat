# IPE Quick Category

为 [InPageEdit NEXT](https://www.ipe.wiki/)（IPE）编写的第三方插件：**快速编辑页面分类**。

在 IPE 工具箱中新增一个「编辑分类」按钮，点击后弹出分类编辑弹窗，功能与 MediaWiki 可视化编辑器（VisualEditor）的分类编辑面板类似：

- 查看 / **重命名**当前页面直接书写的分类
- 修改每个分类的**排序键**（sort key）
- **添加分类**（带自动补全，重定向分类以颜色区分并指向正确分类）、**删除分类**（支持多选批量删除）
- **拖动排序**调整分类在页面中的书写顺序
- 编辑页面的**默认排序键** `{{DEFAULTSORT:...}}`（帮助文本自动读取站点系统消息）
- 支持**编辑摘要（默认 `[IPE-NEXT] Quick category`）/ 小编辑 / 保存后刷新**选项
- 自动适配 IPE 主题（含深色模式）

## ✨ 特性

- **安全保存**：通过 IPE 的 `wikiPage.edit()` 保存，自动携带编辑令牌与基线版本（baserevid），冲突时给出明确报错
- **智能整理**：未拖动排序时分类在原文位置原位更新（HotCat 风格），不会强行移到末尾；拖动重排时才整体重建到末尾
- **健壮解析**：支持本地化分类前缀（`Category:` / `分类:` / `分類:`）、忽略 `[[:Category:...]]` 展示链接、`{{DEFAULTSORT:{{PAGENAME}}}}` 嵌套模板
- **智能补全**：只列出分类命名空间下真实存在的页面（`prop=info`，轻量快速）；硬重定向以斜体+灰色区分并显示「→ 正确分类名」，点击即填入正确分类
- **国际化**：复用 IPE 官方字典（Crowdin 多语言）+ 内置 `en`/`zh` 兜底，并注册进官方 i18n 命名空间（`quickCategory.*`）
- **BEM 样式**：CSS 类名遵循 `ipe-quickCategory__*` 规范（与内置插件一致），样式独立为 `style.scss` 由注册表分发

## 📁 项目结构

```
ipe-quick-category/
├── src/
│   ├── index.ts       # 插件入口（TypeScript，defineIPEPlugin 风格）
│   ├── parse.ts       # wikitext 解析 / 生成（纯逻辑，可独立测试）
│   ├── define.ts      # 与官方注册表对齐的 defineIPEPlugin 助手
│   ├── style.scss     # 样式（构建为 dist/style.css）
│   └── env.d.ts       # mw 全局类型声明
├── dev/
│   └── parse.test.mjs # 解析逻辑测试
├── vite.config.ts     # 构建配置（vite lib 模式）
├── tsconfig.json
├── package.json       # 元数据 + 官方上架所需的 $ipe 字段
├── README.md
└── LICENSE
```

## 🛠️ 开发

```sh
npm install        # 安装依赖
npm run dev        # 启动 vite 开发服务器（配合官方 plugin-registry 的 dev 流程）
npm run build      # 构建 → dist/index.mjs + dist/style.css
npm test           # 运行解析逻辑测试
npm run typecheck  # tsc 类型检查
```

## 📦 上架官方注册表

1. Clone [inpageedit/plugin-registry](https://github.com/inpageedit/plugin-registry) 并安装依赖（`pnpm install`）。
2. `pnpm run new` 用脚手架在 `packages/quick-category/` 生成模板，把本仓库 `src/` 下的代码移植进去。
3. `pnpm dev` 在 `http://localhost:1029/` 启动开发服务器，把 `http://localhost:1029/registry.v1.json` 添加到 IPE 插件商店即可实时预览。
4. 提交 PR，维护团队审核通过后即出现在官方注册表。

> 本仓库的 `package.json` 已按官方规范写好 `$ipe` 字段：
>
> ```json
> "$ipe": {
>   "name": "Quick Category",
>   "description": "Edit page categories in a dialog similar to VisualEditor, including sort keys and the default sort key, with autocomplete and drag-to-reorder.",
>   "categories": ["editor", "utility"],
>   "loader": {
>     "kind": "module",
>     "entry": "dist/index.mjs",
>     "styles": ["dist/style.css"],
>     "main_export": "default"
>   },
>   "dev_loader": {
>     "entry": "src/index.ts",
>     "styles": ["src/style.scss"]
>   }
> }
> ```

## 🧰 使用

1. 打开任意**可编辑**的普通页面（非特殊页、非编辑/历史等 action）。
2. 悬停右下角 IPE 工具箱，点击「编辑分类」。
3. 在弹出的弹窗中：
   - **顶部工具栏**：全选 / 已选计数 / 一键删除所选。
   - **分类列表**：每行一个分类——拖动左侧把手可调整顺序，可修改名称（带补全）、修改排序键，点击 `✕` 删除。
   - **添加分类**：输入关键字自动补全分类命名空间下真实存在的页面；重定向分类以斜体+灰色显示并标注「→ 正确分类名」，点击即填入正确分类；回车或点「添加」加入列表。
   - **默认排序键**：DEFAULTSORT 字段，留空表示不设置；点击 ℹ 图标可查看说明。
   - **底部选项**：编辑摘要、小编辑、保存后刷新页面。
   - 点击「保存」即通过 API 写入页面。

## ⚙️ 配置

注册插件时可传入配置（例如在插件商店之外手动调用时）：

```ts
ipe.plugin(QuickCategoryPlugin, {
  summary: '[MyWiki] 编辑分类', // 自定义默认编辑摘要
})
```

## 🌐 国际化

- **复用官方字典**：插件内置 `OFFICIAL_KEYS` 映射（`Cancel` / `Save` / `Add` / `Remove` / `Minor edit` / `Reload after save` / `Summary` / `No changes` / `Not editable` / `Your changes have been saved.` 等），这些通用词优先用 `ctx.$$` 查 IPE 官方字典——官方已通过 [Crowdin](https://crowdin.com/project/inpageedit) 覆盖全语言。
- **内置兜底**：同时内置 `en`（完整英文）与 `zh` 双语字典，`i18n()` 按 `wgUserLanguage` 选择，官方字典未命中时回退自建字典。
- **注册官方命名空间**：`apply` 中调用 `ctx.i18n.registerMessages('en'|'zh', {...}, { namespace: 'quickCategory' })`，支持 qqx 调试与语言热切换。

## 📚 相关链接

- [第三方插件 | InPageEdit NEXT](https://www.ipe.wiki/plugins/thirdparty/)
- [贡献插件 | InPageEdit NEXT](https://www.ipe.wiki/plugins/thirdparty/contributing)
- [开发者指南 | InPageEdit NEXT](https://www.ipe.wiki/development/)
- [InPageEdit NEXT 仓库](https://github.com/inpageedit/inpageedit-next)

## 📄 许可证

[MIT](LICENSE)
