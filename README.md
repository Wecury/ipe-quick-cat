# IPE Quick Category

为 [InPageEdit NEXT](https://www.ipe.wiki/)（IPE）编写的第三方插件：**快速编辑页面分类**。

在 IPE 工具箱中新增一个「🏷️ 编辑分类」按钮，点击后弹出分类编辑弹窗，功能与 MediaWiki 可视化编辑器（VisualEditor）的分类编辑面板类似：

- 查看 / **重命名** 当前页面直接书写的分类
- 修改每个分类的**排序键**（sort key）
- **添加分类**（带自动补全，重定向分类以颜色区分并指向正确分类）、**删除分类**（支持多选批量删除）
- **拖动排序**调整分类在页面中的书写顺序
- 编辑页面的**默认排序键** `{{DEFAULTSORT:...}}`
- 支持**编辑摘要（默认 `[IPE-NEXT] Quick category`）/ 小编辑 / 保存后刷新**选项
- 自动适配 IPE 主题（含深色模式）

## ✨ 特性

- **纯前端、零依赖**：不依赖 React/Vue 等框架，不要求构建步骤
- **双形态**：既可作为 ES Module 插件接入 IPE 插件商店 / 自建注册表，也可作为普通用户脚本（userscript）直接加载
- **安全保存**：通过 IPE 的 `WikiPageService.edit()` 保存，自动携带编辑令牌与基线版本（baserevid），冲突时给出明确报错
- **智能整理**：保存后分类与 `DEFAULTSORT` 会被整理到页面末尾（与 VE 一致），分类排序键与默认排序键重复时自动省略显式排序键
- **健壮解析**：支持本地化分类前缀（`Category:` / `分类:` / `分類:`）、`[[:Category:...]]` 展示链接的忽略、`{{DEFAULTSORT:{{PAGENAME}}}}` 等嵌套模板
- **智能补全**：只列出分类命名空间下真实存在的页面；重定向分类以斜体+灰色区分并显示「→ 正确分类名」，点击即填入正确分类
- **国际化**：复用 IPE 官方字典（Crowdin 多语言）+ 内置 `en`/`zh` 兜底，并注册进官方 i18n 命名空间（`quickCategory.*`）
- **BEM 样式**：CSS 类名遵循 `ipe-quickCategory__*` 规范（与 `ipe-quickEdit__form` 等内置插件一致）

## 📁 项目结构

```
ipe-quick-category/
├── src/
│   └── index.js                 # 插件主模块（ES Module，export default）
├── scripts/
│   └── build-userscript.mjs     # 构建脚本：由 src/index.js 生成经典单文件版
├── dist/
│   └── ipe-quick-category.user.js  # 经典单文件版（构建产物，可直接粘贴使用）
├── registry.example.json        # 自建注册表 manifest 示例
├── userscript.js                # 经典脚本加载器（动态 import 主模块）
├── package.json                 # 元数据 + 官方上架所需的 $ipe 字段
├── README.md
└── LICENSE
```

## 👀 如何查看效果（快速验证）

> 前提：目标 wiki 已安装并运行 InPageEdit NEXT。若未安装，先按官方[安装方法](https://www.ipe.wiki/guide/installation)装好。

### 方式一：经典单文件版（最快，无需托管）

1. 在仓库根目录运行构建脚本，生成经典单文件版：

   ```sh
   node scripts/build-userscript.mjs
   ```

   得到 `dist/ipe-quick-category.user.js`。

2. 打开目标 wiki 的任一**可编辑**普通页面，按 `F12` 打开控制台，把该文件**全部内容**粘贴进去，回车执行。

3. 悬停页面右下角 IPE 工具箱，看到标签（tag）图标按钮即成功，点击即可测试编辑分类。

> 之后每次修改 `src/index.js`，重新跑一次构建脚本并再次粘贴即可。也可以用这个方式把内容放到个人 JS 页（`Special:MyPage/common.js`）实现持久化。

### 方式二：自建注册表 + 插件商店（正式安装流程）

1. 把 `src/index.js` 托管到**公网 HTTPS** 可访问的地址（GitHub + jsDelivr、GitHub Pages、Cloudflare Pages、或你自己的 Wiki 资源页均可）。
2. 编辑 `registry.example.json`：
   - 将 `base_url` 改为托管根目录（模块 URL = `base_url` + `entry`）。
   - 例如用 jsDelivr 托管 GitHub 仓库：`"base_url": "https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/<仓库名>@main/"`，`entry` 保持 `src/index.js`。
3. 把 `registry.example.json` 也托管到公网，得到一个 JSON URL。
4. 在 wiki 页面打开 IPE 工具箱 → ⚙️ 偏好设置 → 切换到「插件商店」标签页 → 添加该注册表 URL → 手动刷新注册表（缓存 TTL 24 小时，修改注册表后需刷新）→ 找到 **Quick Category** → 安装。
5. 刷新页面即可在工具箱看到按钮。

## 🚀 安装

### 方式一：插件商店 / 自建注册表（正式安装）

1. 将本仓库中的 `src/index.js` 托管到可访问的 URL（例如 GitHub + jsDelivr、Cloudflare Pages 等）。
2. 参考[自建注册表](https://www.ipe.wiki/plugins/thirdparty/self-hosted)与[贡献插件](https://www.ipe.wiki/plugins/thirdparty/contributing)，在 IPE 插件商店中添加自定义注册表并安装。

可直接使用仓库根目录的 [`registry.example.json`](registry.example.json)（已按官方 schema 写好），只需把 `base_url` 改为你的托管地址、并托管该 JSON 本身。符合 [registry.v1.schema.json](https://registry.ipe.wiki/registry.v1.schema.json) 的最小示例：

```json
{
  "manifest_version": 1,
  "name": "My InPageEdit Plugins",
  "base_url": "https://your-server.example.com/plugins/",
  "packages": [
    {
      "id": "quick-category",
      "name": "Quick Category",
      "version": "1.0.0",
      "description": "快速编辑页面分类（添加/删除/修改分类与排序键）",
      "author": "your-name",
      "license": "MIT",
      "loader": {
        "kind": "module",
        "entry": "src/index.js"
      }
    }
  ]
}
```

> 说明：`loader.kind` 为 `module`（ES Module 动态加载）；`entry` 相对 `base_url` 解析；本插件为默认导出，无需 `main_export`。

### 方式二：用户脚本（userscript）

把 `userscript.js` 的内容粘贴到你的 `MediaWiki:Common.js` / `User:<你>/common.js`，或通过 `mw.loader.load('...userscript.js', 'text/javascript')` 加载。

**重要**：请先修改 `userscript.js` 顶部的 `MODULE_URL`，指向你托管 `src/index.js` 的地址。例如使用 jsDelivr：

```js
const MODULE_URL = 'https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/<仓库名>@main/src/index.js'
```

如果不想托管、也不想用插件商店，**推荐直接用构建产物** `dist/ipe-quick-category.user.js`（经典单文件版，自带 `mw.hook` 注册，无需任何外部地址）：把它的内容粘贴到 `MediaWiki:Common.js` / `User:<你>/common.js` 或浏览器控制台即可，详见上文「如何查看效果」。

## 🧰 使用

1. 打开任意**可编辑**的普通页面（非特殊页、非编辑/历史等 action）。
2. 鼠标悬停右下角 IPE 工具箱，点击「🏷️ 编辑分类」。
3. 在弹出的弹窗中：
   - **顶部工具栏**：全选 / 已选计数 / 一键删除所选。
   - **分类列表**：每行一个分类——拖动左侧把手可调整顺序，可修改名称（带补全）、修改排序键，点击 `✕` 删除。
   - **添加分类**：输入关键字自动补全分类命名空间下真实存在的页面；重定向分类以斜体+灰色显示并标注「→ 正确分类名」，点击即填入正确分类；回车或点「添加」加入列表。
   - **默认排序键**：DEFAULTSORT 字段，留空表示不设置。
   - **底部选项**：编辑摘要、小编辑、保存后刷新页面。
   - 点击「保存」即通过 API 写入页面。
4. 保存成功后按「保存后刷新页面」勾选状态决定是否自动刷新。

## ⚙️ 配置

注册插件时可传入配置（例如在插件商店之外手动调用时）：

```js
ipe.plugin(QuickCategoryPlugin, {
  summary: '[MyWiki] 编辑分类', // 自定义默认编辑摘要
})
```

## 📦 上架官方注册表

如果你想将本插件提交到 [inpageedit/plugin-registry](https://github.com/inpageedit/plugin-registry)（官方插件注册表），官方推荐流程：

1. **Clone 仓库**并安装依赖：

   ```sh
   git clone https://github.com/inpageedit/plugin-registry.git
   cd plugin-registry
   pnpm install
   ```

2. **用脚手架创建插件模板**（`pnpm run new`），在 `packages/<你的插件名>/src/` 下编写代码（可参考本仓库的 `src/index.js` 实现）。
3. **本地调试**：`pnpm dev` 会在 `http://localhost:1029/` 启动开发服务器，把 `http://localhost:1029/registry.v1.json` 添加到 IPE 插件商店即可实时预览。
4. **提交 PR**，维护团队审核通过后即出现在官方注册表。

> 官方插件模板的 `package.json` 需要包含 `$ipe` 字段（本仓库的 `package.json` 已按规范写好，可参考）：
>
> ```json
> "$ipe": {
>   "name": "Quick Category",
>   "description": "快速编辑页面分类…",
>   "categories": ["editor", "utility"],
>   "loader": { "kind": "module", "entry": "src/index.js", "main_export": "default" }
> }
> ```

## 🌐 国际化

- **复用官方字典**：插件内置 `OFFICIAL_KEYS` 映射（`Cancel` / `Save` / `Add` / `Remove` / `Minor edit` / `Reload after save` / `Summary` / `No changes` / `Not editable` / `Your changes have been saved.` 等），这些通用词优先用 `ctx.$$` 查 IPE 官方字典——官方已通过 [Crowdin](https://crowdin.com/project/inpageedit) 覆盖全语言，直接复用无需自维护翻译。
- **内置兜底**：插件同时内置 `en`（完整英文）与 `zh` 双语字典，`i18n()` 按 `wgUserLanguage` 选择，官方字典未命中或经典脚本场景（无 `ctx`）时回退自建字典。
- **注册官方命名空间**：插件在 `apply` 中调用 `ctx.i18n.registerMessages('en'|'zh', {...}, { namespace: 'quickCategory' })`，消息进入官方 i18n 命名空间（`$$`quickCategory.xxx`` 可用，支持 qqx 调试与语言热切换）。
- **贡献翻译**：如需覆盖更多语言，可把自建字典贡献给官方 i18n 索引（[registry.ipe.wiki/i18n/index.json](https://registry.ipe.wiki/i18n/index.json)），并通过 [InPageEdit 的 Crowdin 项目](https://crowdin.com/project/inpageedit) 协作翻译。

## 🛠️ 开发说明

- 插件基于 IPE 的依赖注入体系，注入的服务为 `toolbox`、`modal`、`wikiPage`、`api`。
- 读取页面内容：`ctx.wikiPage.newFromTitle(title)` → `page.revisions[0].content`。
- 保存页面：`page.edit({ text, summary, minor })`（内部使用 `postWithEditToken`），默认编辑摘要 `[IPE-NEXT] Quick category`。
- 分类自动补全：`action=query&generator=allpages&gapnamespace=14&gapprefix=...&prop=pageprops&ppprop=redirect`——只列出分类命名空间下真实存在的页面，并通过 `pageprops.redirect` 识别重定向及其目标。
- 分类前缀本地化：通过 `mw.config.get('wgNamespaceIds')` 自动识别 `Category:` / `分类:` / `分類:` 等本地化写法。
- 样式使用 IPE 弹窗的主题 CSS 变量（`--ipe-modal-*`）自动适配明暗主题，类名遵循 BEM 风格（`ipe-quickCategory__*`，与 `ipe-quickEdit__form` 等内置插件一致）。

## 📚 相关链接

- [第三方插件 | InPageEdit NEXT](https://www.ipe.wiki/plugins/thirdparty/)
- [开发者指南 | InPageEdit NEXT](https://www.ipe.wiki/development/)
- [第一个插件 | InPageEdit NEXT](https://www.ipe.wiki/development/plugins-101/1.first-plugin)
- [InPageEdit NEXT 仓库](https://github.com/inpageedit/inpageedit-next)
- [API:Edit](https://www.mediawiki.org/wiki/API:Edit)

## 📄 许可证

[MIT](LICENSE)
