/**
 * Static checks enforcing the cross-cutting rules from
 * docs/20260718-mahaflow-detailed-design-spec.md §3.2 and §6.8:
 *  - no globals (window/document listeners, window property writes)
 *  - no non-deterministic time/random sources in math/core (display loop excepted)
 */
const noGlobalListeners = [
  'error',
  {
    selector:
      "CallExpression[callee.object.name=/^(window|document)$/][callee.property.name='addEventListener']",
    message:
      'Global window/document event listeners are forbidden. Scope input handling to the container element.',
  },
  {
    selector:
      "AssignmentExpression[left.object.name='window']",
    message: 'Writing properties onto window is forbidden.',
  },
];

const noNondeterminism = [
  'error',
  { object: 'Math', property: 'random', message: 'Math.random is forbidden outside the display loop; use math/prng.ts.' },
  { object: 'Date', property: 'now', message: 'Date.now is forbidden outside the display loop; drive phase from the deterministic clock.' },
  { object: 'performance', property: 'now', message: 'performance.now is forbidden outside the display loop; drive phase from the deterministic clock.' },
];

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: false,
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2022: true, node: true },
  ignorePatterns: ['dist/**', 'node_modules/**', 'standalone/**'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      excludedFiles: ['src/core/rafLoop.ts'],
      rules: {
        'no-restricted-syntax': noGlobalListeners,
        'no-restricted-properties': noNondeterminism,
      },
    },
    {
      files: ['src/core/rafLoop.ts'],
      rules: {
        'no-restricted-syntax': noGlobalListeners,
      },
    },
    {
      files: ['test/**/*.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
