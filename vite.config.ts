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
      },
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-i18n'],
          'ui-icons': ['@iconify-prerendered/vue-mdi'],
          'utils': ['marked', 'js-yaml', '@vueuse/core', '@vueuse/components'],
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
