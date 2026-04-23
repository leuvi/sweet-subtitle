import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'sweet-subtitle': path.resolve(__dirname, '../packages/core/src'),
      'sweet-subtitle-wasm': path.resolve(__dirname, '../packages/wasm/pkg/sweet_subtitle_wasm.js'),
    },
  },
  server: {
    port: 5180,
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['sweet-subtitle-wasm'],
  },
})
