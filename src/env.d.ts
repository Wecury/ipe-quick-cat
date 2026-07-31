/** 极简 MediaWiki 全局类型（@inpageedit/core 未内置，这里按需声明） */
declare interface Window {
  mw?: {
    config: {
      get(key: string): any
    }
    msg?: (key: string) => string
  }
}

/** Vite 会处理 SCSS 侧导入，这里仅为 tsc 提供模块类型 */
declare module '*.scss' {
  const content: any
  export default content
}
