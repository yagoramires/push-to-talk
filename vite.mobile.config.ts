import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
  plugins: [react()],
  // the AI worker code-splits (dynamic imports), which iife workers cannot do
  worker: { format: 'es' },
  build: {
    outDir: resolve('out/mobile'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('src/renderer/mobile.html') }
  }
})
