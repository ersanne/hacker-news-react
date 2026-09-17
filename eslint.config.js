import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import typescript from 'typescript-eslint';

export default typescript.config(
  { ignores: ['dist', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  typescript.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['*.config.{ts,js}', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  { files: ['eslint.config.js'], ...typescript.configs.disableTypeChecked },
  {
    // Fetch stubs return plain values from an async signature on purpose.
    files: ['src/**/*.test.ts', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    // Panels start their first request and mirror the URL from effects; the
    // rule flags the pattern, so it reports without failing the check.
    files: ['src/**/*.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
);
