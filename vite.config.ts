import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from /<repo>/. Override with VITE_BASE=/ for a custom domain.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/mauamarketplace/' : '/'),
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
}));
