import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
  plugins: [
    tailwindcss(),
    vue(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        testing: resolve(__dirname, 'public/testing.html'),
        dakota: resolve(__dirname, 'dakota/index.html'),
        server: resolve(__dirname, 'server/index.html'),
        wolves: resolve(__dirname, 'wolves/index.html'),
      },
      output: {
        manualChunks: (id: string) => {
          if (['vue', 'vue-i18n'].some(mod => id.includes(`/node_modules/${mod}`))) {
            return 'vue-vendor'
          }
          if (id.includes('/node_modules/@iconify-prerendered/vue-mdi')) {
            return 'ui-icons'
          }
          if (['marked', 'js-yaml', '@vueuse/core', '@vueuse/components'].some(mod => id.includes(`/node_modules/${mod}`))) {
            return 'utils'
          }
          return undefined
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/composables': fileURLToPath(new URL('./src/composables', import.meta.url)),
      '@/utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
})
