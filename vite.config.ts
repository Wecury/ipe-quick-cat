import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
      cssFileName: 'style',
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
      },
    },
  },
  resolve: {
    alias: {
      // 与官方注册表 packages/*/vite.config.ts 一致（注册表指向 ../../common，
      // 独立版本地用 harness/ 承载 defineIPEPlugin.ts 与 Promise.withResolvers.ts）
      '~~': resolve(import.meta.dirname, 'harness'),
    },
  },
})
