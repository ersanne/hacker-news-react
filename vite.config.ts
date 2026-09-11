import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitLab Pages serves a project site under /<project>/, so the CI job passes the
  // published path in BASE_PATH. Empty or unset means the site is at the domain root.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], restoreMocks: true },
});
