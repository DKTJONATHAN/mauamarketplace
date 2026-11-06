import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cloudflare Pages and custom domains are served from the site root.
// The repository-root sitemap.xml is the single source of truth. Copy it
// into Vite's deployment output so it is served at /sitemap.xml.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'publish-root-sitemap',
      closeBundle() {
        copyFileSync(
          resolve(process.cwd(), 'sitemap.xml'),
          resolve(process.cwd(), 'dist/sitemap.xml'),
        );
      },
    },
  ],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
