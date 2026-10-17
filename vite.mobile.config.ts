import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
  plugins: [react()],
  build: {
    outDir: resolve('out/mobile'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('src/renderer/mobile.html') }
  }
})
