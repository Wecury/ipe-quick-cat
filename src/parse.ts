/**
 * WikiText 分类解析 / 生成（纯逻辑，可独立测试）
 * ============================================================
 */

export interface CategoryRef {
  _id: number
  ns: string
  name: string
  sortkey: string
  start: number
  end: number
}

export interface CategoryRow {
  _id?: number | null
  name: string
  sortkey: string
  ns?: string | null
}

export interface DefaultSortMatch {
  start: number
  end: number
  value: string
}

export interface Parsed {
  categories: CategoryRef[]
  defaultSort: string
}

export function escapeRegExp(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let _catNsAlt: string | null = null

/**
 * 当前 wiki 的「分类」命名空间前缀交替（自动本地化）。
 * 通过 wgNamespaceIds 找到 Category 命名空间对应的全部名称
 * （如 Category / 分类 / 分類），无 mw 环境时回退到 "Category"。
 */
export function getCategoryNamespaceAlt(): string {
  if (_catNsAlt) return _catNsAlt
  let nsIds: Record<string, number> = {}
  try {
    nsIds = (mw.config.get('wgNamespaceIds') as Record<string, number>) || {}
  } catch {
    /* ignore */
  }
  const canonicalId = Number(nsIds['category']) || 14
  const prefixes = new Set(['Category'])
  for (const [name, id] of Object.entries(nsIds)) {
    if (Number(id) === canonicalId && name) prefixes.add(name)
  }
  _catNsAlt = [...prefixes]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  return _catNsAlt
}

/**
 * 当前 wiki 的「分类」命名空间规范名（用于生成新链接）。
 * 与 HotCat 一致：HC.category_canonical = formattedNamespaces['14']。
 */
export function getCategoryNamespaceName(): string {
  try {
    const formatted = (mw.config.get('wgFormattedNamespaces') as Record<string, string>) || {}
    const nsId = Number((mw.config.get('wgNamespaceIds') as Record<string, number>)?.category) || 14
    const name = formatted[String(nsId)]
    if (typeof name === 'string' && name) return name
  } catch {
    /* ignore */
  }
  return 'Category'
}

/** 剥离名称前可能带有的（本地化）分类命名空间前缀，如 "Category:"、"分类:" */
export function stripCategoryPrefix(name: string): string {
  const alt = getCategoryNamespaceAlt()
  return String(name).replace(new RegExp(`^\\s*(?:${alt})\\s*:`, 'i'), '').trim()
}

/** 提取 {{DEFAULTSORT:...}} / {{DEFAULTSORTKEY:...}} 的值（支持嵌套 {{ }}） */
export function findDefaultSortMatches(text: string): DefaultSortMatch[] {
  const matches: DefaultSortMatch[] = []
  const re = /\{\{\s*(?:DEFAULTSORT|DEFAULTSORTKEY)\s*:\s*/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let i = re.lastIndex
    let depth = 1
    while (i < text.length && depth > 0) {
      if (text.startsWith('{{', i)) {
        depth++
        i += 2
      } else if (text.startsWith('}}', i)) {
        depth--
        i += 2
      } else {
        i++
      }
    }
    if (depth !== 0) continue // 未闭合，忽略
    const end = i - 2
    matches.push({ start: m.index, end, value: text.slice(re.lastIndex, end).trim() })
  }
  return matches
}

/**
 * 解析 wikitext，提取直接书写的分类与默认排序键。
 * 注意：[[:Category:...]]（展示链接）会被正则排除。
 */
export function parseCategories(wikitext: string): Parsed {
  const categories: CategoryRef[] = []
  const ds = findDefaultSortMatches(wikitext)
  const alt = getCategoryNamespaceAlt()
  const re = new RegExp(
    `\\[\\[\\s*(?<ns>${alt})\\s*:\\s*(?<name>[^\\[\\]|]*?)(?:\\s*\\|\\s*(?<sortkey>[^\\[\\]]*?))?\\s*\\]\\]`,
    'gi'
  )
  let m: RegExpExecArray | null
  let nextId = 1
  while ((m = re.exec(wikitext))) {
    categories.push({
      _id: nextId++,
      ns: m.groups!.ns.trim(),
      name: m.groups!.name.trim(),
      sortkey: (m.groups!.sortkey ?? '').trim(),
      start: m.index,
      end: m.index + m[0].length,
    })
  }
  return { categories, defaultSort: ds[0]?.value || '' }
}

/** 移除整行 / 行内的 DEFAULTSORT 模板 */
export function stripDefaultSort(text: string): string {
  let out = text.replace(
    /^[ \t]*\{\{\s*(?:DEFAULTSORT|DEFAULTSORTKEY)\s*:[^\n]*?\}\}[ \t]*\r?\n?/gim,
    ''
  )
  out = out.replace(/\{\{\s*(?:DEFAULTSORT|DEFAULTSORTKEY)\s*:[^\n]*?\}\}/gi, '')
  return out
}

/** 移除分类链接（优先整行移除，再处理行内残留） */
export function stripCategoryLinks(text: string): string {
  const alt = getCategoryNamespaceAlt()
  let out = text.replace(
    new RegExp(`^[ \\t]*\\[\\[\\s*(?:${alt})\\s*:[^\\]]*\\]\\][ \\t]*\\r?\\n?`, 'gim'),
    ''
  )
  out = out.replace(new RegExp(`\\[\\[\\s*(?:${alt})\\s*:[^\\]]*\\]\\]`, 'gi'), '')
  return out
}

/** 生成单个分类链接（保留原前缀；新增分类用站点规范名） */
export function renderLink(
  r: { name: string; sortkey?: string | null; ns?: string | null },
  defaultSort: string,
  defaultNs: string
): string | null {
  const name = stripCategoryPrefix(r.name)
  if (!name) return null
  const sk = String(r.sortkey || '').trim()
  const useDefault = !!defaultSort && sk.toLowerCase() === defaultSort.toLowerCase()
  const ns = String(r.ns || defaultNs).trim()
  return sk && !useDefault ? `[[${ns}:${name}|${sk}]]` : `[[${ns}:${name}]]`
}

/** 全量重建：移除旧分类与 DEFAULTSORT，统一按新顺序追加到末尾（用于用户主动拖动重排） */
export function buildAppend(original: string, rows: CategoryRow[], defaultSort: string): string {
  let text = stripDefaultSort(original)
  text = stripCategoryLinks(text)
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  const defaultNs = getCategoryNamespaceName()
  const lines: string[] = []
  if (defaultSort) lines.push(`{{DEFAULTSORT:${defaultSort}}}`)
  for (const r of rows) {
    const link = renderLink(r, defaultSort, defaultNs)
    if (link) lines.push(link)
  }
  if (lines.length === 0) return `${text}\n`
  return `${text}\n${lines.join('\n')}\n`
}

/**
 * 原位更新（HotCat 风格）：已有分类在原本位置更新/删除，
 * DEFAULTSORT 原位替换，新增分类追加到末尾——不会把分类强行移到末尾。
 */
export function buildInPlace(
  original: string,
  rows: CategoryRow[],
  defaultSort: string,
  originalCats: CategoryRef[]
): string {
  const defaultNs = getCategoryNamespaceName()
  const rowById = new Map<number, CategoryRow>()
  for (const r of rows) if (r._id != null) rowById.set(r._id, r)
  const additions = rows.filter((r) => r._id == null)

  let text = original

  // DEFAULTSORT 原位更新或移除
  const dsMatches = findDefaultSortMatches(text)
  for (let i = dsMatches.length - 1; i >= 0; i--) {
    const m = dsMatches[i]
    const fullEnd = m.end + 2 // 越过结尾 }}
    text =
      text.slice(0, m.start) + (defaultSort ? `{{DEFAULTSORT:${defaultSort}}}` : '') + text.slice(fullEnd)
  }

  // 分类原位更新/删除（从后往前避免索引位移）
  const ordered = [...originalCats].sort((a, b) => b.start - a.start)
  for (const c of ordered) {
    const row = rowById.get(c._id)
    const link = row ? renderLink(row, defaultSort, defaultNs) : null
    text = text.slice(0, c.start) + (link ?? '') + text.slice(c.end)
  }
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  // 新增分类（及原本没有的 DEFAULTSORT）追加到末尾
  const newLines: string[] = []
  if (defaultSort && !dsMatches.length) newLines.push(`{{DEFAULTSORT:${defaultSort}}}`)
  for (const r of additions) {
    const link = renderLink(r, defaultSort, defaultNs)
    if (link) newLines.push(link)
  }
  if (newLines.length === 0) return `${text}\n`
  return `${text}\n${newLines.join('\n')}\n`
}

/** 用户是否拖动了已有分类的相对顺序（拖动 = 主动重排，才整体重建到末尾） */
export function isReordered(rows: CategoryRow[], originalCats: CategoryRef[]): boolean {
  const orig = originalCats
    .filter((c) => rows.some((r) => r._id === c._id))
    .map((c) => c._id)
  const cur = rows.filter((r) => r._id != null).map((r) => r._id as number)
  return orig.join(',') !== cur.join(',')
}

/**
 * 根据用户操作生成新 wikitext：
 * - 未拖动排序：原位更新/删除，新增追加末尾（HotCat 风格，保持分类原位置）
 * - 拖动排序：整体按新顺序重建到末尾（用户主动重排）
 */
export function buildWikitext(
  original: string,
  rows: CategoryRow[],
  defaultSort: string,
  originalCats: CategoryRef[] = []
): string {
  if (isReordered(rows, originalCats)) return buildAppend(original, rows, defaultSort)
  return buildInPlace(original, rows, defaultSort, originalCats)
}

/** 判断用户是否改动了任何内容（基于最终生成文本的确定性比较） */
export function isUnchanged(state: {
  content: string
  categories: CategoryRef[]
  originalDefaultSort: string
  rows: CategoryRow[]
  defaultSort: string
}): boolean {
  const a = buildWikitext(state.content, state.categories, state.originalDefaultSort, state.categories)
  const b = buildWikitext(state.content, state.rows, state.defaultSort, state.categories)
  return a === b
}
