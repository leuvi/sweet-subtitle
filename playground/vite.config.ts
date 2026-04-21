import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'sweet-subtitle': path.resolve(__dirname, '../packages/core/src'),
    },
  },
  server: {
    port: 5180,
  },
})
