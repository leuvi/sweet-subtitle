import { defineConfig } from 'tsup'
import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmSrc = join(__dirname, '../wasm/pkg/sweet_subtitle_wasm_bg.wasm')

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  target: 'es2020',
  sourcemap: true,
  esbuildOptions(options) {
    // Suppress import.meta warning for CJS — WASM is ESM/browser only
    options.logOverride = { 'empty-import-meta': 'silent' }
  },
  async onSuccess() {
    if (existsSync(wasmSrc)) {
      copyFileSync(wasmSrc, join(__dirname, 'dist/sweet_subtitle_wasm_bg.wasm'))
      console.log('[tsup] Copied sweet_subtitle_wasm_bg.wasm → dist/')
    } else {
      console.warn('[tsup] WASM binary not found — skipped. Run pnpm build:wasm first.')
    }
  },
})
