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

// Localized category namespace aliases (e.g. Category / 分类 / 分類)
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

// Canonical namespace name for new links (matches HotCat)
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

export function stripCategoryPrefix(name: string): string {
  const alt = getCategoryNamespaceAlt()
  return String(name).replace(new RegExp(`^\\s*(?:${alt})\\s*:`, 'i'), '').trim()
}

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
    if (depth !== 0) continue // skip unclosed
    const end = i - 2
    matches.push({ start: m.index, end, value: text.slice(re.lastIndex, end).trim() })
  }
  return matches
}

// Exclude display links such as [[:Category:...]]
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

export function stripDefaultSort(text: string): string {
  let out = text.replace(
    /^[ \t]*\{\{\s*(?:DEFAULTSORT|DEFAULTSORTKEY)\s*:[^\n]*?\}\}[ \t]*\r?\n?/gim,
    ''
  )
  out = out.replace(/\{\{\s*(?:DEFAULTSORT|DEFAULTSORTKEY)\s*:[^\n]*?\}\}/gi, '')
  return out
}

export function stripCategoryLinks(text: string): string {
  const alt = getCategoryNamespaceAlt()
  let out = text.replace(
    new RegExp(`^[ \\t]*\\[\\[\\s*(?:${alt})\\s*:[^\\]]*\\]\\][ \\t]*\\r?\\n?`, 'gim'),
    ''
  )
  out = out.replace(new RegExp(`\\[\\[\\s*(?:${alt})\\s*:[^\\]]*\\]\\]`, 'gi'), '')
  return out
}

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

// Full rebuild: strip old categories and DEFAULTSORT, append everything in order (used after drag reorder)
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

// In-place update (HotCat style): existing categories keep their positions,
// DEFAULTSORT is replaced in place, new categories are appended at the end
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

  // Update/remove DEFAULTSORT in place
  const dsMatches = findDefaultSortMatches(text)
  for (let i = dsMatches.length - 1; i >= 0; i--) {
    const m = dsMatches[i]
    const fullEnd = m.end + 2 // 越过结尾 }}
    text =
      text.slice(0, m.start) + (defaultSort ? `{{DEFAULTSORT:${defaultSort}}}` : '') + text.slice(fullEnd)
  }

  // Update/delete categories in place (reverse order keeps offsets valid)
  const ordered = [...originalCats].sort((a, b) => b.start - a.start)
  for (const c of ordered) {
    const row = rowById.get(c._id)
    const link = row ? renderLink(row, defaultSort, defaultNs) : null
    text = text.slice(0, c.start) + (link ?? '') + text.slice(c.end)
  }
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  // Append new categories (and DEFAULTSORT if absent) at the end
  const newLines: string[] = []
  if (defaultSort && !dsMatches.length) newLines.push(`{{DEFAULTSORT:${defaultSort}}}`)
  for (const r of additions) {
    const link = renderLink(r, defaultSort, defaultNs)
    if (link) newLines.push(link)
  }
  if (newLines.length === 0) return `${text}\n`
  return `${text}\n${newLines.join('\n')}\n`
}

// True when the user reordered existing categories via drag
// (a full rebuild is then used; otherwise update in place)
export function isReordered(rows: CategoryRow[], originalCats: CategoryRef[]): boolean {
  const orig = originalCats
    .filter((c) => rows.some((r) => r._id === c._id))
    .map((c) => c._id)
  const cur = rows.filter((r) => r._id != null).map((r) => r._id as number)
  return orig.join(',') !== cur.join(',')
}

export function buildWikitext(
  original: string,
  rows: CategoryRow[],
  defaultSort: string,
  originalCats: CategoryRef[] = []
): string {
  if (isReordered(rows, originalCats)) return buildAppend(original, rows, defaultSort)
  return buildInPlace(original, rows, defaultSort, originalCats)
}

// Deterministic comparison of the generated text to detect changes
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
