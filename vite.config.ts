import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.tsx',
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
      // Alias '~~' to harness/ (the registry build points it at ../../common)
      '~~': resolve(import.meta.dirname, 'harness'),
    },
  },
})
