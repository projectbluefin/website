import antfu from '@antfu/eslint-config'

const ignores = [
  '**/node_modules/**',
  '**/public/**',
  '.dist',
  'node_modules',
  'public',
]

export default antfu({
  ignores,
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  vue: true,
  jsonc: false,
  yaml: false,
  markdown: true,
  rules: {
    'no-console': ['error', {
      allow: ['info', 'warn', 'trace', 'error', 'group', 'groupEnd'],
    }],
    'style/comma-dangle': 'off',
    'curly': ['error', 'all'],
    'node/prefer-global/process': ['error', 'always'],
  },
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks in Vue
     * By default uses Prettier
     */
    css: true
  }
})
