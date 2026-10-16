import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [
          '@huggingface/transformers',
          'onnxruntime-node',
          'node-llama-cpp',
          /^@node-llama-cpp\//,
          'phonemizer',
          'sharp'
        ]
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
