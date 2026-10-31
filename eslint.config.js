import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'public',
      '.wrangler',
      'playwright-report',
      'test-results',
      'tests/visual/__baseline__',
      'worker-configuration.d.ts',
      'specs',
      '.specify',
      '.claude',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // '' cai no valor de reserva de propósito (sigla vazia, shortName vazio, escudo vazio)
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
      // conflita com no-non-null-assertion (strict): preferimos `as T` explícito a `!`
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // domínio: puro, sem UI nem Worker
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['preact', 'preact/*', '**/client/**', '**/worker/**'] },
      ],
    },
  },
  // shared: compilado no cliente e no Worker; sem dependências de nenhum lado nem APIs de navegador
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/client/**', '**/worker/**', '**/domain/**'] }],
      'no-restricted-globals': ['error', 'localStorage', 'window', 'document', 'sessionStorage'],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
