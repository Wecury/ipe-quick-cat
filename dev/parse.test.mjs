// 解析/生成逻辑测试：直接测试 src/parse.ts（单一来源，与插件共用同一份实现）
// 运行：node --import tsx dev/parse.test.mjs
import {
  buildWikitext,
  getCategoryNamespaceAlt,
  getCategoryNamespaceName,
  isUnchanged,
  parseCategories,
  stripCategoryPrefix,
} from '../src/parse.js'

// 模拟 MediaWiki 环境：中文 wiki，分类命名空间本地化名「分类」+ 别名「分類/Cat」。
// src/parse.ts 读取全局 mw（与注册表版本一致），因此同时设置 globalThis.mw 与 window.mw。
const mwMock = {
  config: {
    get: (key) => {
      if (key === 'wgNamespaceIds') return { category: 14, 分类: 14, 分類: 14, Cat: 14 }
      if (key === 'wgFormattedNamespaces') return { '14': '分类' }
      return undefined
    },
  },
}
globalThis.mw = mwMock
globalThis.window = { mw: mwMock }

// 提取内容字段（忽略 _id/start/end 等位置信息）
const catsPlain = (cats) => cats.map((c) => ({ ns: c.ns, name: c.name, sortkey: c.sortkey }))

let failures = 0
function assertEq(label, actual, expected) {
  const ok = actual === expected
  if (!ok) {
    failures++
    console.log(
      `✗ ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
    )
  } else {
    console.log(`✓ ${label}`)
  }
}

// ---- 基础 ----
assertEq('本地化前缀集合', getCategoryNamespaceAlt(), 'Category|category|Cat|分类|分類')
assertEq('站点规范命名空间名', getCategoryNamespaceName(), '分类')

// ---- 解析（含位置 _id/start/end）----
let parsed = parseCategories('Hello\n[[Category:Foo]]\n[[分类:中文类]]\n[[分類:繁中|排序]]\n[[:分类:仅展示]]\n')
assertEq(
  '解析英文/本地化分类(含ns)',
  JSON.stringify(catsPlain(parsed.categories)),
  JSON.stringify([
    { ns: 'Category', name: 'Foo', sortkey: '' },
    { ns: '分类', name: '中文类', sortkey: '' },
    { ns: '分類', name: '繁中', sortkey: '排序' },
  ])
)
assertEq('忽略展示链接', parsed.categories.length, 3)
assertEq('_id 连续', JSON.stringify(parsed.categories.map((c) => c._id)), '[1,2,3]')
assertEq('位置递增且不重叠', parsed.categories.every((c, i, arr) => i === 0 || c.start > arr[i - 1].end), true)

// 注释 / 模板 / nowiki 内的分类链接不视为页面分类
parsed = parseCategories(
  'A\n<!-- [[Category:InComment]] -->\n{{Navbox|[[Category:InTemplate]]}}\n<nowiki>[[Category:InNowiki]]</nowiki>\n[[分类:Real]]\n'
)
assertEq(
  '忽略注释/模板/nowiki内分类',
  JSON.stringify(catsPlain(parsed.categories)),
  JSON.stringify([{ ns: '分类', name: 'Real', sortkey: '' }])
)

parsed = parseCategories('{{DEFAULTSORT:{{PAGENAME}}}}\n[[Category:X | sk ]]')
assertEq('嵌套模板 DEFAULTSORT', parsed.defaultSort, '{{PAGENAME}}')
assertEq(
  '分类名/排序键 trim',
  JSON.stringify(catsPlain(parsed.categories)),
  JSON.stringify([{ ns: 'Category', name: 'X', sortkey: 'sk' }])
)

// ---- 前缀剥离 ----
assertEq('剥离英文前缀', stripCategoryPrefix('Category:Foo'), 'Foo')
assertEq('剥离简体前缀', stripCategoryPrefix('分类:中文类'), '中文类')
assertEq('剥离繁体前缀', stripCategoryPrefix('分類:繁中'), '繁中')
assertEq('剥离无前缀', stripCategoryPrefix('普通类'), '普通类')

// ============ 生成：原位更新（HotCat 风格） ============
const CONTENT = 'A\n[[分类:Foo]]\n[[Category:Bar|b]]\n'
const CATS = parseCategories(CONTENT).categories // _id1=分类:Foo, _id2=Category:Bar

// 只改 Foo 的排序键 -> Foo 原位更新，Bar 原地不动
let out = buildWikitext(
  CONTENT,
  [
    { _id: 1, name: 'Foo', sortkey: 'k', ns: '分类' },
    { _id: 2, name: 'Bar', sortkey: 'b', ns: 'Category' },
  ],
  '',
  CATS
)
assertEq('修改排序键(原位, Bar不变)', out, 'A\n[[分类:Foo|k]]\n[[Category:Bar|b]]\n')

// 删除 Bar -> 原位删除，Foo 不动
out = buildWikitext(CONTENT, [{ _id: 1, name: 'Foo', sortkey: '', ns: '分类' }], '', CATS)
assertEq('删除分类(原位删除, Foo不动)', out, 'A\n[[分类:Foo]]\n')

// 新增分类 -> 追加到末尾，已有分类位置不变
out = buildWikitext(
  CONTENT,
  [
    { _id: 1, name: 'Foo', sortkey: '', ns: '分类' },
    { _id: 2, name: 'Bar', sortkey: 'b', ns: 'Category' },
    { name: 'New', sortkey: '', ns: null },
  ],
  '',
  CATS
)
assertEq('新增分类(追加末尾)', out, 'A\n[[分类:Foo]]\n[[Category:Bar|b]]\n[[分类:New]]\n')

// 新增分类：分类不在末尾时，紧跟最后一个分类链接（HotCat 风格），而非页尾
const CONTENT_MID = 'Lead paragraph.\n[[分类:Foo]]\nTail paragraph.\n'
const CATS_MID = parseCategories(CONTENT_MID).categories
out = buildWikitext(
  CONTENT_MID,
  [
    { _id: 1, name: 'Foo', sortkey: '', ns: '分类' },
    { name: 'New', sortkey: '', ns: null },
  ],
  '',
  CATS_MID
)
assertEq(
  '新增分类(紧跟已有分类, 不落页尾)',
  out,
  'Lead paragraph.\n[[分类:Foo]]\n[[分类:New]]\nTail paragraph.\n'
)

// DEFAULTSORT 原位更新
const CONTENT2 = 'X\n{{DEFAULTSORT:D}}\n[[分类:Foo]]\n'
const CATS2 = parseCategories(CONTENT2).categories
out = buildWikitext(CONTENT2, [{ _id: 1, name: 'Foo', sortkey: 'E', ns: '分类' }], 'E', CATS2)
assertEq('DEFAULTSORT 原位更新', out, 'X\n{{DEFAULTSORT:E}}\n[[分类:Foo]]\n')

// 清空默认排序键（配合 UI：继承默认键的行排序键已一并清空）-> 不产生冗余显式 |D
out = buildWikitext(CONTENT2, [{ _id: 1, name: 'Foo', sortkey: '', ns: '分类' }], '', CATS2)
assertEq('清空默认排序键(无冗余显式键)', out, 'X\n\n[[分类:Foo]]\n')

// ============ 生成：拖动重排 -> 整体重建末尾 ============
const CONTENT3 = 'A\n[[Category:Bar|b]]\n[[分类:Foo]]\n'
const CATS3 = parseCategories(CONTENT3).categories // _id1=Bar, _id2=Foo
out = buildWikitext(
  CONTENT3,
  [
    { _id: 2, name: 'Foo', sortkey: '', ns: '分类' },
    { _id: 1, name: 'Bar', sortkey: 'b', ns: 'Category' },
  ],
  '',
  CATS3
)
assertEq('拖动重排(整体重建末尾)', out, 'A\n[[分类:Foo]]\n[[Category:Bar|b]]\n')

// 拖动重排时保留注释/模板内的分类链接（不被当作页面分类删除）
const CONTENT_IGN = 'A\n<!-- [[Category:Keep]] -->\n{{T|[[Category:InT]]}}\n[[Category:Bar|b]]\n[[分类:Foo]]\n'
const CATS_IGN = parseCategories(CONTENT_IGN).categories // 只有 Bar, Foo
out = buildWikitext(
  CONTENT_IGN,
  [
    { _id: 2, name: 'Foo', sortkey: '', ns: '分类' },
    { _id: 1, name: 'Bar', sortkey: 'b', ns: 'Category' },
  ],
  '',
  CATS_IGN
)
assertEq(
  '重排保留注释/模板内分类',
  out,
  'A\n<!-- [[Category:Keep]] -->\n{{T|[[Category:InT]]}}\n[[分类:Foo]]\n[[Category:Bar|b]]\n'
)

// ============ isUnchanged ============
let state = {
  content: CONTENT,
  categories: CATS,
  originalDefaultSort: '',
  defaultSort: '',
  rows: CATS.map((c) => ({ _id: c._id, name: c.name, sortkey: c.sortkey || '', ns: c.ns })),
}
assertEq('未改动 -> unchanged', isUnchanged(state), true)

state.rows[0].sortkey = 'k'
assertEq('改排序键 -> changed', isUnchanged(state), false)

state = {
  content: CONTENT3,
  categories: CATS3,
  originalDefaultSort: '',
  defaultSort: '',
  rows: CATS3.map((c) => ({ _id: c._id, name: c.name, sortkey: c.sortkey || '', ns: c.ns })),
}
assertEq('未拖动顺序不变 -> unchanged', isUnchanged(state), true)

if (failures === 0) console.log('\n全部通过 ✅')
else {
  console.log(`\n${failures} 个用例失败 ❌`)
  process.exit(1)
}
