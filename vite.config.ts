import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // A GitHub Pages project site is served under /<repository>/; the custom domain
  // serves the same build at the domain root. Empty or unset means the domain root.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], restoreMocks: true },
});
