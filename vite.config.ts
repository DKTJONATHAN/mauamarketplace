import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cloudflare Pages and custom domains are served from the site root.
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
