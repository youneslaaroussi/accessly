import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// @ts-expect-error this is correct !
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    build: {
      rollupOptions: {
        external: ['sharp']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [tailwindcss(), react()],
    server: {}
  }
})
