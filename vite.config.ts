import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { SITE_ORIGIN } from './src/config/site-origin';

const robots = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'maua-canonical-origin',
      transformIndexHtml(html) {
        return html.replaceAll('__SITE_ORIGIN__', SITE_ORIGIN);
      },
      closeBundle() {
        writeFileSync(resolve(process.cwd(), 'dist/robots.txt'), robots, 'utf8');
      },
    },
  ],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
