import type { Plugin } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const directoryEntryPaths = new Set(['/dakota', '/server', '/wolves'])

function redirectDirectoryEntries(): Plugin {
  return {
    name: 'redirect-directory-entries',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!directoryEntryPaths.has(url.pathname)) {
          next()
          return
        }

        res.writeHead(302, { Location: `${url.pathname}/${url.search}` })
        res.end()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/.worktrees/**',
    ],
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
    redirectDirectoryEntries(),
    tailwindcss(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('google-cast-')
        }
      }
    }),
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
