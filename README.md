# IPE Quick Category

快速编辑页面分类的 [InPageEdit NEXT](https://www.ipe.wiki/)（IPE）插件。

在 IPE 工具箱中新增「编辑分类」按钮，点击后像可视化编辑器一样管理页面分类：查看 / 重命名、修改排序键、添加 / 删除（支持多选）、拖动排序，以及编辑默认排序键 `{{DEFAULTSORT}}`。

## ✨ 特性

- 查看 / **重命名**当前页面直接书写的分类
- 修改每个分类的**排序键**（sort key）
- **添加分类**（自动补全，重定向分类自动指向正确分类）、**删除分类**（支持多选批量删除）
- **拖动排序**调整分类在页面中的书写顺序
- 编辑页面的**默认排序键** `{{DEFAULTSORT:...}}`，帮助文本自动读取站点系统消息
- 支持**编辑摘要（默认 `[IPE-NEXT] Quick category`）/ 小编辑 / 保存后刷新**选项
- 自动适配 IPE 主题（含深色模式），多语言

## 📥 安装（给 wiki 编辑者）

### 官方插件商店（推荐）

本插件已收录 / 即将收录于官方 [InPageEdit 插件注册表](https://registry.ipe.wiki/)：

1. 打开任一**已安装 InPageEdit** 的 wiki 页面
2. 悬停右下角 IPE 工具箱 → ⚙️ 偏好设置 → **插件商店**
3. 搜索 **Quick Category** → 点击**安装**
4. 刷新页面，工具箱出现「编辑分类」按钮即可使用

> 若商店中暂时找不到，说明插件仍在审核中；也可先按下方「开发者」一节的本地注册表方式预览。

### 开发者本地预览

clone [inpageedit/plugin-registry](https://github.com/inpageedit/plugin-registry)，运行 `pnpm install && pnpm dev`，然后在 IPE 插件商店中添加注册表地址 `http://localhost:1029/registry.v1.json`，即可安装本插件并实时预览。

## 🧰 使用

1. 打开任意**可编辑**的普通页面（非特殊页、非编辑/历史等 action）。
2. 悬停右下角 IPE 工具箱，点击「编辑分类」。
3. 在弹出的弹窗中：
   - **顶部工具栏**：全选 / 已选计数 / 一键删除所选。
   - **分类列表**：每行一个分类——拖动左侧把手调整顺序，可修改名称（带补全）、修改排序键，点击 `✕` 删除。
   - **添加分类**：输入关键字自动补全分类命名空间下真实存在的页面；重定向分类以斜体+灰色显示并标注「→ 正确分类名」，点击即填入正确分类；回车或点「添加」加入列表。
   - **默认排序键**：`DEFAULTSORT` 字段，留空表示不设置；点击 ℹ 图标查看说明。
   - **底部选项**：编辑摘要、小编辑、保存后刷新页面。
   - 点击「保存」即通过 API 写入页面。

## 🛠️ 为开发者 / 复用本项目

### 项目结构

```
ipe-quick-category/
├── src/
│   ├── index.ts       # 插件入口（TypeScript，defineIPEPlugin 风格）与 UI 逻辑
│   ├── parse.ts       # wikitext 分类解析 / 生成（纯逻辑，可独立测试）
│   ├── define.ts      # 与官方注册表对齐的 defineIPEPlugin 助手
│   ├── style.scss     # 样式（构建为 dist/style.css）
│   └── env.d.ts       # mw 全局类型声明
├── dev/parse.test.mjs # 解析逻辑测试
├── vite.config.ts     # vite lib 构建配置
├── tsconfig.json
└── package.json       # 元数据 + 官方上架所需的 $ipe 字段
```

本仓库按官方 [inpageedit/plugin-registry](https://github.com/inpageedit/plugin-registry) 的包结构组织，`package.json` 已写好 `$ipe` 字段，可作为上架官方注册表的实现参考。

### 开发命令

```sh
npm install        # 安装依赖
npm run build      # 构建 → dist/index.mjs + dist/style.css
npm test           # 运行解析逻辑测试
npm run typecheck  # tsc 类型检查
```

### 代码说明

- **逻辑与 DOM 隔离**：wikitext 的解析 / 生成全部在 `src/parse.ts`（纯函数，只依赖 `mw.config`），便于单测与复用。
- **本地化前缀**：通过 `mw.config.get('wgNamespaceIds')` 自动识别 `Category:` / `分类:` / `分類:` 等写法，无需硬编码。
- **轻量补全**：分类自动补全仅请求 `prop=info`（含硬重定向识别），并按前缀缓存 5 分钟。
- **主题样式**：使用 IPE 弹窗的主题 CSS 变量（`--ipe-modal-*`），类名遵循 BEM（`ipe-quickCategory__*`）。

### 国际化

- **复用官方字典**：内置 `OFFICIAL_KEYS` 映射，通用词优先用 `ctx.$$` 查 IPE 官方字典（[Crowdin](https://crowdin.com/project/inpageedit) 覆盖全语言）。
- **内置兜底**：同时内置 `en` / `zh` 字典，按 `wgUserLanguage` 选择。
- **注册官方命名空间**：`apply` 中调用 `ctx.i18n.registerMessages('en'|'zh', {...}, { namespace: 'quickCategory' })`，支持 qqx 调试与语言热切换。

## ⚙️ 配置（可选）

注册插件时可传入配置（例如在插件商店之外手动调用时）：

```ts
ipe.plugin(QuickCategoryPlugin, {
  summary: '[MyWiki] 编辑分类', // 自定义默认编辑摘要
})
```
