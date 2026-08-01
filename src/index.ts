/**
 * IPE Quick Cat
 * ==================
 * InPageEdit NEXT 第三方插件：在工具箱新增「快速分类」按钮，
 * 以类似可视化编辑器分类面板的方式查看/编辑当前页面的分类、
 * 排序键与默认排序键 {{DEFAULTSORT}}。
 *
 * @license MIT
 */
import './style.scss'

import type { InPageEdit } from '@inpageedit/core'

import { defineIPEPlugin } from '~~/defineIPEPlugin.js'
import {
  buildWikitext,
  isUnchanged,
  parseCategories,
  stripCategoryPrefix,
  type CategoryRef,
  type CategoryRow,
} from './parse.js'

const PLUGIN_NAME = 'quick-cat'
const APPLIED_FLAG = Symbol.for('ipe-quick-cat.applied')

const log = {
  info: (...args: unknown[]) => console.info('[IPE-QuickCat]', ...args),
  warn: (...args: unknown[]) => console.warn('[IPE-QuickCat]', ...args),
  error: (...args: unknown[]) => console.error('[IPE-QuickCat]', ...args),
}

/**
 * IPE 上下文 + 本插件用到的扩展成员
 * （@inpageedit/core 类型未完整覆盖的服务用 any 兜底）
 */
type Ctx = InPageEdit & {
  $$: (strings: TemplateStringsArray, ...args: unknown[]) => string
  api: any
  i18n?: { registerMessages?: (lang: string, msgs: Record<string, string>, options?: unknown) => void }
  currentPage?: any
  modal: any
  wikiPage: any
  preferences: any
  [k: string]: any
}

/* ============================================================
 * 国际化
 * ============================================================ */
const I18N: Record<'zh' | 'en', Record<string, string>> = {
  zh: {
    tooltip: '快速分类',
    tooltipNotEditable: '当前页面不可编辑',
    modalTitle: '快速分类',
    cancel: '取消',
    save: '保存',
    add: '添加',
    addPh: '输入分类名以添加',
    namePh: '分类名',
    sortKeyPh: '排序键（可选）',
    remove: '移除该分类',
    drag: '拖动排序',
    selectAll: '全选',
    selectedCount: '已选 {{ $1 }} 项',
    deleteSelected: '删除所选',
    defaultSort: '默认排序键',
    noCategories: '此页面没有直接书写的分类。',
    loading: '正在加载分类…',
    loadFailed: '分类加载失败',
    invalidTitle: '分类名无效',
    invalidTitleDesc: '分类名不能为空，且不能包含 [ ] | # < > { } 等字符。',
    duplicate: '该分类已存在',
    noChange: '没有需要保存的更改',
    saved: '分类已保存',
    savedDesc: '页面分类已成功更新。',
    saveFailed: '分类保存失败',
    summaryLabel: '编辑摘要',
    summaryPh: '[IPE-NEXT] Quick Cat',
    summaryDefault: '[IPE-NEXT] Quick Cat',
    minorEdit: '小编辑',
    reloadAfterSave: '保存后刷新页面',
    notEditable: '当前页面不可编辑，无法修改分类。',
  },
  en: {
    tooltip: 'Quick Cat',
    tooltipNotEditable: 'Page is not editable',
    modalTitle: 'Quick Cat',
    cancel: 'Cancel',
    save: 'Save',
    add: 'Add',
    addPh: 'Type a category to add',
    namePh: 'Category name',
    sortKeyPh: 'Sort key (optional)',
    remove: 'Remove this category',
    drag: 'Drag to reorder',
    selectAll: 'Select all',
    selectedCount: '{{ $1 }} selected',
    deleteSelected: 'Delete selected',
    defaultSort: 'Default sort key',
    noCategories: 'This page has no directly written categories.',
    loading: 'Loading categories…',
    loadFailed: 'Failed to load categories',
    invalidTitle: 'Invalid category name',
    invalidTitleDesc: 'Category names cannot be empty or contain [ ] | # < > { }.',
    duplicate: 'Category already exists',
    noChange: 'No changes to save',
    saved: 'Categories saved',
    savedDesc: 'Page categories have been updated.',
    saveFailed: 'Failed to save categories',
    summaryLabel: 'Edit summary',
    summaryPh: '[IPE-NEXT] Quick Cat',
    summaryDefault: '[IPE-NEXT] Quick Cat',
    minorEdit: 'Minor edit',
    reloadAfterSave: 'Reload page after saving',
    notEditable: 'This page is not editable.',
  },
}

/**
 * 可复用的官方 i18n 消息键（registry.ipe.wiki/i18n 的键 = 英文文本）。
 * 这些通用词 IPE 官方字典已有全部语言的 Crowdin 翻译，直接复用。
 */
const OFFICIAL_KEYS: Record<string, string> = {
  cancel: 'Cancel',
  save: 'Save',
  add: 'Add',
  remove: 'Remove',
  minorEdit: 'Minor edit',
  reloadAfterSave: 'Reload after save',
  noChange: 'No changes',
  notEditable: 'Not editable',
  saved: 'Your changes have been saved.',
  summaryLabel: 'Summary',
}

/** 记录当前插件上下文，便于 i18n() 优先使用官方字典 */
let currentCtx: Ctx | null = null

/**
 * 轻量国际化：优先复用 IPE 官方字典（OFFICIAL_KEYS），否则回退自建 zh/en 字典。
 * 支持 {{ $1 }} 位置参数插值。
 */
function i18n(key: string, ...args: (string | number)[]): string {
  const interpolateMsg = (msg: string) =>
    args.length
      ? msg.replace(/\{\{\s*\$(\d+)\s*\}\}/g, (_, i) => String(args[Number(i) - 1] ?? ''))
      : msg

  // 官方字典优先（对映射到的通用键）
  const official = OFFICIAL_KEYS[key]
  if (official && currentCtx && currentCtx.$$) {
    try {
      // 手动构造 TemplateStringsArray 以标签形式调用 $$`...`
      const ts = Object.assign([official], { raw: [official] }) as unknown as TemplateStringsArray
      const officialMsg = currentCtx.$$(ts)
      if (officialMsg && officialMsg !== `(${official})`) {
        return interpolateMsg(officialMsg)
      }
    } catch {
      /* fallback to built-in dict */
    }
  }

  // 自建字典兜底
  let lang = 'zh-cn'
  try {
    lang = (mw.config.get('wgUserLanguage') as string) || lang
  } catch {
    /* ignore */
  }
  const table = String(lang).toLowerCase().startsWith('zh') ? I18N.zh : I18N.en
  return interpolateMsg(table[key] ?? I18N.en[key] ?? key)
}

/** 把插件消息注册进 IPE 官方 i18n 命名空间（qqx 调试、语言热切换等管道兼容） */
function registerPluginI18n(ctx: Ctx): void {
  if (!ctx.i18n?.registerMessages) return
  try {
    ctx.i18n.registerMessages('en', { ...I18N.en }, { namespace: 'quickCat' })
    ctx.i18n.registerMessages('zh', { ...I18N.zh }, { namespace: 'quickCat' })
  } catch (e) {
    log.warn('registerMessages failed:', e)
  }
}

/* ============================================================
 * DOM 工具
 * ============================================================ */
function h(
  tag: string,
  props: Record<string, any> = {},
  ...children: (Node | string | number | false | null | undefined)[]
): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k === 'class' || k === 'className') {
      el.className = v
      continue
    }
    if (k === 'style') {
      Object.assign(el.style, v)
      continue
    }
    if (k === 'value') {
      ;(el as HTMLInputElement).value = v
      continue
    }
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
      continue
    }
    el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) {
    if (c == null || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

/** 工具箱按钮图标（Tabler tag，SVG，通过 innerHTML 解析以获得正确命名空间） */
const TAG_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="icon icon-tabler icons-tabler-outline icon-tabler-tag">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" />
  </svg>
`
function createTagIcon(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = TAG_ICON_SVG.trim()
  return wrapper.firstElementChild as HTMLElement
}

/** 默认排序键帮助图标（Tabler info-circle，SVG） */
const INFO_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="icon icon-tabler icons-tabler-outline icon-tabler-info-circle">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
    <path d="M12 9h.01" />
    <path d="M11 12h1v4h1" />
  </svg>
`
function createInfoIcon(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = INFO_ICON_SVG.trim()
  return wrapper.firstElementChild as HTMLElement
}

/** 默认排序键帮助文本缓存（同一站点只查询一次） */
let _defaultSortHelpCache: string | null = null

/**
 * 获取「默认排序键」帮助文本：先经 API（allmessages，站点内容语言）查询，
 * 拿不到再用 mw.msg，最后回退内置英文。
 */
async function getDefaultSortHelp(ctx: Ctx): Promise<string> {
  if (_defaultSortHelpCache) return _defaultSortHelpCache
  const key = 'visualeditor-dialog-meta-categories-defaultsort-help'
  let lang: string = 'zh'
  try {
    lang =
      (mw.config.get('wgContentLanguage') as string) ||
      (mw.config.get('wgUserLanguage') as string) ||
      lang
  } catch {
    /* ignore */
  }

  // API 主路径（含本地 MediaWiki 命名空间覆盖）
  try {
    const { data } = await ctx.api.get({
      action: 'query',
      meta: 'allmessages',
      ammessages: key,
      amlang: lang,
      amincludelocal: 1,
    })
    const m = data?.query?.allmessages?.[0]
    // formatversion=2（mw.Api 默认）下消息字段为 content，旧格式为 *
    const text: string | undefined = m && (m['*'] || m.content)
    if (m && !m.missing && text && text !== key) {
      _defaultSortHelpCache = text
      log.info('default sort help resolved via API (lang=' + lang + ')')
      return text
    }
    log.warn('default sort help: API returned no message (lang=' + lang + ')')
  } catch (e) {
    log.warn('getDefaultSortHelp api failed:', e)
  }

  // mw.msg 兜底（页面已加载该消息时，按用户界面语言）
  try {
    if (mw.msg) {
      const msg = mw.msg(key)
      // mw.msg 对不存在的消息返回键名本身或 ⧼key⧽ / (key) 形式
      if (msg && msg !== key && !/^[⧼([<]/.test(msg)) {
        _defaultSortHelpCache = msg
        return msg
      }
    }
  } catch {
    /* ignore */
  }

  // 内置兜底
  _defaultSortHelpCache =
    'You can override how this page is sorted when displayed within a category by setting a different index to sort with instead. This is often used to make pages about people show by last name, but be named with their first name shown first.'
  log.warn('default sort help: fell back to built-in English')
  return _defaultSortHelpCache
}

/* ============================================================
 * 分类搜索（自动补全）
 * ============================================================ */
interface CategorySuggestion {
  name: string
  redirect: string | null
}

// 搜索结果缓存：按 ctx 隔离（避免跨 wiki 串数据），TTL 5 分钟
const searchCaches = new WeakMap<object, Map<string, { ts: number; items: CategorySuggestion[] }>>()
const SEARCH_CACHE_TTL = 5 * 60 * 1000

function getSearchCache(ctx: Ctx): Map<string, { ts: number; items: CategorySuggestion[] }> {
  let cache = searchCaches.get(ctx)
  if (!cache) {
    cache = new Map()
    searchCaches.set(ctx, cache)
  }
  return cache
}

/**
 * 搜索「分类命名空间下真实存在的页面」，含硬重定向。
 * 先用 prop=info 判断是否为重定向，再用 redirects=1 批量解析目标名；
 * 软重定向（模板式）暂不支持。结果按前缀缓存 5 分钟。
 */
async function searchCategories(ctx: Ctx, query: string): Promise<CategorySuggestion[]> {
  const q = stripCategoryPrefix(query)
  if (!q) return []
  const cache = getSearchCache(ctx)
  const hit = cache.get(q)
  if (hit && Date.now() - hit.ts < SEARCH_CACHE_TTL) return hit.items

  const nsId = Number((mw.config.get('wgNamespaceIds') as Record<string, number>)?.category) || 14
  try {
    const { data } = await ctx.api.get({
      action: 'query',
      generator: 'allpages',
      gapnamespace: nsId,
      gapprefix: q,
      gaplimit: 10,
      prop: 'info',
    })
    const pages = data?.query?.pages || {}
    const pageList = Object.values(pages).filter((p: any) => p && !p.missing && p.title)
    // prop=info 对重定向页返回 redirect 字段（新 MediaWiki 为布尔 true，旧版为字符串标记），
    // 但目标名不随 prop=info 返回，需再用 redirects=1 批量解析出 from→to。
    const redirectTitles = pageList
      .filter((p: any) => typeof p.redirect === 'string' || p.redirect === true)
      .map((p: any) => p.title)
    const redirectMap = new Map<string, string>()
    if (redirectTitles.length) {
      try {
        const { data: d2 } = await ctx.api.get({
          action: 'query',
          redirects: 1,
          prop: 'info',
          titles: redirectTitles.join('|'),
        })
        for (const r of d2?.query?.redirects || []) {
          if (r.from && r.to) redirectMap.set(r.from, r.to)
        }
      } catch (e) {
        log.warn('resolve redirect targets failed:', e)
      }
    }
    const items: CategorySuggestion[] = pageList.map((p: any) => {
      const target = redirectMap.get(p.title)
      return {
        name: stripCategoryPrefix(p.title),
        redirect: target ? stripCategoryPrefix(target) : null,
      }
    })
    cache.set(q, { ts: Date.now(), items })
    return items
  } catch (e) {
    log.warn('searchCategories failed:', e)
    return []
  }
}

/* ============================================================
 * 弹窗 UI
 * ============================================================ */
interface AutocompleteHandlers {
  onPick?: (cat: string) => void
  onEnter?: () => void
}

/**
 * 通用自动补全：为任意输入框挂载「分类搜索补全」下拉（防抖 + 请求序号防串扰）。
 */
function attachAutocomplete(
  ctx: Ctx,
  m: any,
  input: HTMLInputElement,
  suggest: HTMLElement,
  handlers: AutocompleteHandlers = {}
): { hideSuggest: () => void } {
  // 下拉挂到 body 用 fixed 定位，避免被可滚动的分类列表（overflow-y:auto）裁剪
  const hideSuggest = () => {
    suggest.remove()
    suggest.textContent = ''
  }
  const positionSuggest = () => {
    if (!suggest.children.length) return
    const ir = input.getBoundingClientRect()
    const vh = window.innerHeight
    const want = 220
    const spaceBelow = vh - ir.bottom
    const spaceAbove = ir.top
    suggest.style.width = `${Math.max(ir.width, 140)}px`
    if (spaceBelow >= Math.min(want, 200) || spaceBelow >= spaceAbove) {
      // 下方空间足够 -> 向下展开
      suggest.style.top = `${ir.bottom + 4}px`
      suggest.style.bottom = 'auto'
      suggest.style.maxHeight = `${Math.max(60, Math.min(want, spaceBelow - 8))}px`
    } else {
      // 上方空间更大 -> 向上展开
      suggest.style.top = 'auto'
      suggest.style.bottom = `${vh - ir.top + 4}px`
      suggest.style.maxHeight = `${Math.max(60, Math.min(want, spaceAbove - 8))}px`
    }
    suggest.style.left = `${ir.left}px`
    suggest.style.display = 'block'
    if (suggest.parentElement !== document.body) document.body.appendChild(suggest)
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let searchSeq = 0
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer)
    const q = stripCategoryPrefix(input.value)
    if (!q) {
      hideSuggest()
      return
    }
    const seq = ++searchSeq
    timer = setTimeout(() => {
      searchCategories(ctx, q)
        .then((items) => {
          if (m.isDestroyed || seq !== searchSeq) return
          suggest.textContent = ''
          if (!items.length) return
          for (const item of items) {
            const isRedirect = !!item.redirect
            const btn = h(
              'button',
              {
                class: isRedirect
                  ? 'ipe-quick-cat__suggest-item is-redirect'
                  : 'ipe-quick-cat__suggest-item',
                type: 'button',
                title: isRedirect ? item.redirect : undefined,
                onClick: () => {
                  // 重定向项点击后填入「重定向到的正确分类名」
                  const value = isRedirect ? (item.redirect ?? item.name) : item.name
                  if (handlers.onPick) handlers.onPick(value)
                  else input.value = value
                  hideSuggest()
                  input.focus()
                },
              },
              item.name
            )
            if (isRedirect) {
              btn.append(
                h('span', { class: 'ipe-quick-cat__suggest-redirect' }, `→ ${item.redirect}`)
              )
            }
            suggest.append(btn)
          }
          positionSuggest()
        })
        .catch(() => hideSuggest())
    }, 200)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (handlers.onEnter) handlers.onEnter()
    } else if (e.key === 'Escape') {
      hideSuggest()
      input.blur()
    }
  })
  // 点击其它区域时收起下拉
  const onDocClick = (e: MouseEvent) => {
    if (m.isDestroyed) {
      document.removeEventListener('click', onDocClick)
      return
    }
    if (!suggest.contains(e.target as Node) && !input.contains(e.target as Node)) hideSuggest()
  }
  document.addEventListener('click', onDocClick)
  m.on(m.Event.Close, () => {
    suggest.remove()
    document.removeEventListener('click', onDocClick)
  })
  return { hideSuggest }
}

interface CategoryState {
  title: string
  pageName: string
  page: any
  content: string
  categories: CategoryRef[]
  originalDefaultSort: string
  defaultSort: string
  summary: string
  minor: boolean
  reloadAfterSave: boolean
  selected: Set<CategoryRow>
  _dragIndex: number | null
  rows: CategoryRow[]
}

/** 创建一行分类编辑项：拖动把手 + 多选 + 名称（带补全）+ 排序键 + 移除 */
function createCategoryRow(
  ctx: Ctx,
  m: any,
  state: CategoryState,
  row: CategoryRow,
  refreshList: () => void,
  list: HTMLElement,
  refreshToolbar: () => void
): HTMLElement {
  const rowEl = h('div', { class: 'ipe-quick-cat__row' })

  // 拖动把手（HTML5 拖放排序）
  const grip = h(
    'span',
    { class: 'ipe-quick-cat__grip', title: i18n('drag'), 'aria-label': i18n('drag') },
    '⠿'
  )
  grip.draggable = true
  grip.addEventListener('dragstart', (e) => {
    state._dragIndex = state.rows.indexOf(row)
    e.dataTransfer!.effectAllowed = 'move'
    rowEl.classList.add('is-dragging')
  })
  grip.addEventListener('dragend', () => {
    rowEl.classList.remove('is-dragging')
    list.querySelectorAll('.ipe-quick-cat__row').forEach((el) =>
      el.classList.remove('is-drop-before', 'is-drop-after')
    )
    state._dragIndex = null
  })

  const check = h('input', {
    class: 'ipe-quick-cat__check',
    type: 'checkbox',
    checked: state.selected.has(row),
  }) as HTMLInputElement
  check.addEventListener('change', () => {
    if (check.checked) state.selected.add(row)
    else state.selected.delete(row)
    list.querySelectorAll('.ipe-quick-cat__row').forEach((el, i) => {
      const cb = el.querySelector('.ipe-quick-cat__check') as HTMLInputElement | null
      if (cb) cb.checked = state.selected.has(state.rows[i])
    })
    refreshToolbar()
  })

  const nameInput = h('input', {
    class: 'ipe-quick-cat__name',
    type: 'text',
    value: row.name,
    placeholder: i18n('namePh'),
    spellcheck: 'false',
    autocomplete: 'off',
  }) as HTMLInputElement
  nameInput.addEventListener('input', () => {
    row.name = nameInput.value.trim()
  })
  const nameSuggest = h('div', { class: 'ipe-quick-cat__suggest' })
  attachAutocomplete(ctx, m, nameInput, nameSuggest, {
    onPick: (cat) => {
      row.name = cat
      nameInput.value = cat
    },
  })
  const nameWrap = h('span', { class: 'ipe-quick-cat__namewrap' }, nameInput, nameSuggest)

  const sortInput = h('input', {
    class: 'ipe-quick-cat__sortkey',
    type: 'text',
    value: row.sortkey,
    placeholder: i18n('sortKeyPh'),
  }) as HTMLInputElement
  sortInput.addEventListener('input', () => {
    row.sortkey = sortInput.value.trim()
  })

  const removeBtn = h(
    'button',
    {
      class: 'ipe-quick-cat__remove',
      type: 'button',
      title: i18n('remove'),
      'aria-label': i18n('remove'),
      onClick: () => {
        state.rows = state.rows.filter((r) => r !== row)
        state.selected.delete(row)
        refreshList()
        refreshToolbar()
      },
    },
    '✕'
  )

  // checkbox 置于最前，与顶部工具栏的「全选」垂直对齐
  rowEl.append(check, grip, nameWrap, sortInput, removeBtn)
  return rowEl
}

/** 添加分类栏（带自动补全） */
function createAddBar(ctx: Ctx, m: any, state: CategoryState, refreshList: () => void): HTMLElement {
  const input = h('input', {
    class: 'ipe-quick-cat__new',
    type: 'text',
    placeholder: i18n('addPh'),
    autocomplete: 'off',
    spellcheck: 'false',
  }) as HTMLInputElement
  const suggest = h('div', { class: 'ipe-quick-cat__suggest' })
  const addBtn = h('button', { class: 'ipe-quick-cat__addbtn', type: 'button' }, i18n('add'))

  const doAdd = () => {
    const raw = stripCategoryPrefix(input.value)
    if (!raw) return
    const duplicate = state.rows.some((r) => r.name.toLowerCase() === raw.toLowerCase())
    if (duplicate) {
      ctx.modal.notify('warning', { title: i18n('duplicate'), content: `Category: ${raw}` })
      return
    }
    state.rows.push({ name: raw, sortkey: state.defaultSort, ns: null })
    input.value = ''
    suggest.textContent = ''
    refreshList()
    input.focus()
  }

  attachAutocomplete(ctx, m, input, suggest, { onEnter: doAdd })
  addBtn.addEventListener('click', doAdd)

  return h('div', { class: 'ipe-quick-cat__add' }, input, addBtn, suggest)
}

function renderDialog(ctx: Ctx, m: any, state: CategoryState): void {
  const root = h('div', { class: 'ipe-quick-cat' })

  const selectAll = h('input', { class: 'ipe-quick-cat__checkall', type: 'checkbox' }) as HTMLInputElement
  const countEl = h('span', { class: 'ipe-quick-cat__selected-count' }, i18n('selectedCount', 0))
  const deleteBtn = h(
    'button',
    { class: 'ipe-quick-cat__delete-selected', type: 'button', disabled: true },
    i18n('deleteSelected')
  ) as HTMLButtonElement

  const refreshToolbar = () => {
    const n = state.rows.length
    const sel = state.selected.size
    selectAll.checked = n > 0 && sel === n
    selectAll.indeterminate = sel > 0 && sel < n
    countEl.textContent = i18n('selectedCount', sel)
    deleteBtn.disabled = sel === 0
  }

  const list = h('div', { class: 'ipe-quick-cat__list' })

  // 拖放排序：按整行中点分区决定插入位置（覆盖行间隙，指示线唯一、无死区）
  const computeInsertIndex = (clientY: number): number => {
    const rows = [...list.querySelectorAll('.ipe-quick-cat__row')]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return rows.length
  }
  const clearIndicators = () => {
    list.querySelectorAll('.ipe-quick-cat__row').forEach((el) =>
      el.classList.remove('is-drop-before', 'is-drop-after')
    )
  }
  list.addEventListener('dragover', (e) => {
    if (state._dragIndex == null) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    clearIndicators()
    const idx = computeInsertIndex(e.clientY)
    const rows = [...list.querySelectorAll('.ipe-quick-cat__row')]
    if (idx < rows.length) rows[idx].classList.add('is-drop-before')
    else if (rows.length) rows[rows.length - 1].classList.add('is-drop-after')
  })
  list.addEventListener('dragleave', (e) => {
    const rt = e.relatedTarget
    if (!(rt instanceof Node) || !list.contains(rt)) clearIndicators()
  })
  list.addEventListener('drop', (e) => {
    e.preventDefault()
    clearIndicators()
    if (state._dragIndex == null) return
    const from = state._dragIndex
    const to = computeInsertIndex(e.clientY)
    const [moved] = state.rows.splice(from, 1)
    const target = from < to ? to - 1 : to
    state.rows.splice(target, 0, moved)
    state._dragIndex = null
    refreshList()
  })

  selectAll.addEventListener('change', () => {
    if (selectAll.checked) state.rows.forEach((r) => state.selected.add(r))
    else state.selected.clear()
    list.querySelectorAll('.ipe-quick-cat__row').forEach((el) => {
      const cb = el.querySelector('.ipe-quick-cat__check') as HTMLInputElement | null
      if (cb) cb.checked = selectAll.checked
    })
    refreshToolbar()
  })
  deleteBtn.addEventListener('click', () => {
    if (!state.selected.size) return
    state.rows = state.rows.filter((r) => !state.selected.has(r))
    state.selected.clear()
    refreshList()
    refreshToolbar()
  })

  const toolbar = h(
    'div',
    { class: 'ipe-quick-cat__toolbar' },
    h(
      'label',
      { class: 'ipe-quick-cat__checkbox' },
      selectAll,
      h('span', {}, i18n('selectAll'))
    ),
    countEl,
    deleteBtn
  )

  const refreshList = () => {
    list.textContent = ''
    if (state.rows.length === 0) {
      list.append(h('div', { class: 'ipe-quick-cat__empty' }, i18n('noCategories')))
    } else {
      for (const row of state.rows) {
        list.append(createCategoryRow(ctx, m, state, row, refreshList, list, refreshToolbar))
      }
    }
    refreshToolbar()
  }
  refreshList()

  const addBar = createAddBar(ctx, m, state, refreshList)

  const dsInput = h('input', {
    class: 'ipe-quick-cat__ds-input',
    type: 'text',
    value: state.defaultSort,
    placeholder: state.pageName || '',
  }) as HTMLInputElement
  dsInput.addEventListener('input', () => {
    const oldDs = state.defaultSort
    const newDs = dsInput.value.trim()
    state.defaultSort = newDs
    // 原排序键等于旧 DEFAULTSORT 的分类，跟随新的默认排序键（与 VE 行为一致）
    if (oldDs && newDs && oldDs.toLowerCase() !== newDs.toLowerCase()) {
      state.rows.forEach((row) => {
        if (row.sortkey && row.sortkey.toLowerCase() === oldDs.toLowerCase()) {
          row.sortkey = newDs
        }
      })
      list.querySelectorAll('.ipe-quick-cat__row').forEach((rowEl, idx) => {
        const row = state.rows[idx]
        if (row) {
          const sortInput = rowEl.querySelector('.ipe-quick-cat__sortkey') as HTMLInputElement | null
          if (sortInput) sortInput.value = row.sortkey
        }
      })
    }
  })
  const infoBtn = h(
    'button',
    {
      class: 'ipe-quick-cat__ds-info',
      type: 'button',
      'aria-label': i18n('defaultSort'),
      onClick: () => {
        getDefaultSortHelp(ctx).then((content) => {
          if (m.isDestroyed) return
          ctx.modal.notify('info', {
            title: i18n('defaultSort'),
            content,
            closeAfter: 8000,
          })
        })
      },
    },
    createInfoIcon()
  )
  const dsLabel = h(
    'label',
    { class: 'ipe-quick-cat__ds' },
    h('span', { class: 'ipe-quick-cat__ds-text' }, i18n('defaultSort')),
    infoBtn,
    dsInput
  )

  const summaryInput = h('input', {
    class: 'ipe-quick-cat__summary-input',
    type: 'text',
    value: state.summary || '',
    placeholder: i18n('summaryPh'),
  }) as HTMLInputElement
  summaryInput.addEventListener('input', () => {
    state.summary = summaryInput.value.trim()
  })
  const minorCheck = h('input', { type: 'checkbox', checked: state.minor }) as HTMLInputElement
  minorCheck.addEventListener('change', () => {
    state.minor = minorCheck.checked
  })
  const reloadCheck = h('input', { type: 'checkbox', checked: state.reloadAfterSave }) as HTMLInputElement
  reloadCheck.addEventListener('change', () => {
    state.reloadAfterSave = reloadCheck.checked
  })

  const options = h(
    'div',
    { class: 'ipe-quick-cat__options' },
    h(
      'div',
      { class: 'ipe-quick-cat__summary-wrap' },
      h('label', { class: 'ipe-quick-cat__summary-label', for: 'ipe-quick-cat__summary' }, i18n('summaryLabel')),
      summaryInput
    ),
    h(
      'div',
      { class: 'ipe-quick-cat__options-row' },
      h('label', { class: 'ipe-quick-cat__checkbox' }, minorCheck, h('span', {}, i18n('minorEdit'))),
      h('label', { class: 'ipe-quick-cat__checkbox' }, reloadCheck, h('span', {}, i18n('reloadAfterSave')))
    )
  )

  root.append(toolbar, list, addBar, dsLabel, options)
  m.setContent(root)
}

/* ============================================================
 * 保存
 * ============================================================ */
async function saveCategories(ctx: Ctx, m: any, state: CategoryState | null): Promise<void> {
  if (!state) return
  const { modal } = ctx

  const bad = state.rows.find((r) => !r.name || /[\[\]|#<>{}]/.test(r.name))
  if (bad) {
    modal.notify('error', { title: i18n('invalidTitle'), content: i18n('invalidTitleDesc') })
    return
  }

  if (isUnchanged(state)) {
    modal.notify('info', { title: i18n('noChange') })
    return
  }

  const newText = buildWikitext(state.content, state.rows, state.defaultSort, state.categories)
  m.setLoadingState(true)
  try {
    await state.page.edit({
      text: newText,
      summary: state.summary || i18n('summaryDefault'),
      minor: state.minor ? 1 : 0,
    })
    if (!m.isDestroyed) m.close()
    if (state.reloadAfterSave) {
      // 保存后短暂提示并自动刷新
      modal.notify('success', {
        title: i18n('saved'),
        content: i18n('savedDesc'),
        closeAfter: 900,
      })
      setTimeout(() => window.location.reload(), 1000)
    } else {
      modal.notify('success', {
        title: i18n('saved'),
        content: i18n('savedDesc'),
        closeAfter: 3000,
      })
    }
  } catch (err) {
    log.error('save failed:', err)
    modal.notify('error', { title: i18n('saveFailed'), content: String((err as Error)?.message || err) })
  } finally {
    if (!m.isDestroyed) m.setLoadingState(false)
  }
}

/* ============================================================
 * 弹窗入口
 * ============================================================ */
async function showModal(ctx: Ctx, config: any): Promise<any> {
  const { modal } = ctx
  const title =
    ctx.currentPage?.wikiTitle?.getPrefixedText?.() ||
    ((mw.config.get('wgPageName') as string) || '').replace(/_/g, ' ')
  if (!title) {
    modal.notify('warning', { title: i18n('modalTitle'), content: i18n('notEditable') })
    return
  }

  const m = modal
    .createObject({
      title: `${i18n('modalTitle')}: ${title}`,
      content: h('div', { class: 'ipe-quick-cat ipe-quick-cat--loading' }, i18n('loading')),
      // compact-buttons：与 quick-move / quick-redirect 一致的紧凑按钮样式；
      // 注意 className 会作用在弹窗窗口上，因此只保留 compact-buttons，
      // 插件内容样式由内容根节点 .ipe-quick-cat 自行负责。
      className: 'compact-buttons',
      sizeClass: 'smallToMedium',
      center: true,
      outSideClose: false,
    })
    .init()

  // 标题与快速编辑同款：`快速分类: <u>页面名</u>`
  {
    const titleFrag = document.createDocumentFragment()
    titleFrag.append(document.createTextNode(`${i18n('modalTitle')}: `))
    titleFrag.append(h('u', {}, title))
    m.setTitle(titleFrag)
  }

  let state: CategoryState | null = null

  m.addButton({
    side: 'right',
    type: 'button',
    className: 'is-danger is-ghost',
    label: i18n('cancel'),
    method: () => m.close(),
  })
  m.addButton({
    side: 'right',
    type: 'button',
    className: 'is-primary is-ghost',
    label: i18n('save'),
    method: () => saveCategories(ctx, m, state),
  })

  m.show()
  m.setLoadingState(true)

  try {
    const page = await ctx.wikiPage.newFromTitle(title)
    const content = page.revisions?.[0]?.content ?? ''
    const parsed = parseCategories(content)
    state = {
      title,
      pageName:
        ctx.currentPage?.wikiTitle?.getPrefixedText?.() ||
        ((mw.config.get('wgPageName') as string) || title).replace(/_/g, ' '),
      page,
      content,
      categories: parsed.categories,
      originalDefaultSort: parsed.defaultSort,
      defaultSort: parsed.defaultSort,
      summary: config?.summary || '',
      minor: false,
      reloadAfterSave: true,
      selected: new Set(),
      _dragIndex: null,
      rows: parsed.categories.map((c) => ({
        _id: c._id,
        name: c.name,
        sortkey: c.sortkey || parsed.defaultSort,
        ns: c.ns || null,
      })),
    }
    renderDialog(ctx, m, state)
  } catch (err) {
    log.error('load failed:', err)
    m.setContent(
      h(
        'div',
        { class: 'ipe-quick-cat ipe-quick-cat--error' },
        h('p', {}, i18n('loadFailed')),
        h('p', { class: 'ipe-quick-cat__errmsg' }, String((err as Error)?.message || err))
      )
    )
    modal.notify('error', { title: i18n('loadFailed'), content: String((err as Error)?.message || err) })
  } finally {
    if (!m.isDestroyed) m.setLoadingState(false)
  }

  return m
}

/* ============================================================
 * 插件定义
 * ============================================================ */
export default defineIPEPlugin({
  name: PLUGIN_NAME,
  inject: ['toolbox', 'modal', 'wikiPage', 'api'],
  apply(ctx: InPageEdit, config?: any): void {
    const c = ctx as Ctx
    // 防止同一上下文内重复注册（插件商店 + 用户脚本同时加载时）
    if ((c as any)[APPLIED_FLAG]) return
    ;(c as any)[APPLIED_FLAG] = true

    // 供 i18n() 优先使用官方字典；卸载时清理
    currentCtx = c
    c.on('dispose', () => {
      if (currentCtx === c) currentCtx = null
    })

    registerPluginI18n(c)

    let action = 'view'
    try {
      action = c.currentPage?.wikiAction || (mw.config.get('wgAction') as string) || 'view'
    } catch {
      /* ignore */
    }
    const editable = !!mw.config.get('wgIsProbablyEditable')
    const canEdit = editable && action === 'view'

    // 顶层 inject 已声明 toolbox，可直接使用；卸载时通过 dispose 清理副作用
    c.toolbox.addButton({
      id: PLUGIN_NAME,
      group: 'group2',
      index: 0,
      icon: createTagIcon(),
      tooltip: () => (canEdit ? i18n('tooltip') : i18n('tooltipNotEditable')),
      // 不可编辑时：不隐藏按钮，仅灰化 + 禁止光标
      buttonProps: canEdit
        ? undefined
        : { style: { cursor: 'not-allowed', filter: 'grayscale(50%) opacity(.75)' } },
      onClick: (e) => {
        e.preventDefault()
        if (!canEdit) return
        void showModal(c, config || {})
      },
    })
    c.on('dispose', () => {
      c.toolbox.removeButton(PLUGIN_NAME)
    })
  },
})
