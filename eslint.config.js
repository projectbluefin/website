import antfu from '@antfu/eslint-config'

const ignores = [
  '**/node_modules/**',
  '**/public/**',
  '.dist',
  'node_modules',
  'public',
  'tests/**',
  'docs/**',
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
    'no-console': [
      'error',
      {
        allow: [
          'info',
          'warn',
          'trace',
          'error',
          'group',
          'groupEnd'
        ],
      }
    ],
    'style/comma-dangle': 'off',
    'curly': ['error', 'all'],
    'node/prefer-global/process': ['error', 'always'],
    // @antfu/eslint-config v10 adds these e18e rules with auto-fixes that
    // change code, not just layout. Object.hasOwn is outside the ES2020 `lib`
    // in tsconfig.json, and `Array.from({ length }).fill(x)` widens the
    // result to unknown[]. Keep them off so the v10 upgrade stays
    // behaviour-neutral; enable them deliberately in a separate change.
    'e18e/prefer-array-fill': 'off',
    'e18e/prefer-object-has-own': 'off',
  },
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks in Vue
     * By default uses Prettier
     */
    css: true
  }
})
