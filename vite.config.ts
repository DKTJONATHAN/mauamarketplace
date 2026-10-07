import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cloudflare Pages serves this app from the domain root.
// Set VITE_BASE=/mauamarketplace/ only when intentionally deploying to GitHub Pages.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
}));
