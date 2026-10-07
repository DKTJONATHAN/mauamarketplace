import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Root path by default (Cloudflare, custom domains). The GitHub Pages workflow sets VITE_BASE=/mauamarketplace/.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
