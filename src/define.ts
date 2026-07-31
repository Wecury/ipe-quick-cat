import type { InPageEdit } from '@inpageedit/core'

/** 与官方注册表 common/defineIPEPlugin.ts 对齐的插件定义 */
export interface IPEPlugin {
  name: string
  inject?: string[]
  apply: (ctx: InPageEdit, config?: any) => Promise<void> | void
  [k: string]: any
}

export const defineIPEPlugin = (plugin: IPEPlugin): IPEPlugin => plugin
