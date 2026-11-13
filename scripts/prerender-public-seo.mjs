import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const originConfig = readFileSync(new URL('../src/config/site-origin.ts', import.meta.url), 'utf8');
const SITE_ORIGIN = originConfig.match(/SITE_ORIGIN\s*=\s*['\"]([^'\"]+)['\"]/)?.[1];
if (!SITE_ORIGIN) throw new Error('Could not read SITE_ORIGIN');

const dist = join(process.cwd(), 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const pages = [
  {
    path: '/',
    title: 'Maua Marketplace (Maua Soko) | Buy and Sell in Maua Town, Meru',
    description: 'Discover Maua Soko, the local online marketplace for Maua town and Meru County. Browse goods, farm produce, property and services from local sellers.',
    heading: 'Maua Marketplace — your local market, online',
    paragraphs: [
      'Maua Marketplace, also known as Maua Soko, helps people in Maua town and across Meru County discover local goods, farm produce, property and services. Browse public listings, compare details and contact sellers directly.',
      'Find new and second-hand items from people and businesses in the local community. Listings are provided by members; check the details, inspect items and follow the marketplace safety guidance before arranging a transaction.'
    ],
    links: [['Browse local listings','/browse'],['Explore categories','/categories'],['Marketplace safety','/safety'],['Community rules','/rules']]
  },
  {
    path: '/browse',
    title: 'Browse Local Listings in Maua and Meru | Maua Marketplace',
    description: 'Browse goods, second-hand items, farm produce, property and services listed by people in Maua town and Meru County.',
    heading: 'Browse listings in Maua and Meru',
    paragraphs: [
      'Explore public marketplace listings from Maua town and nearby communities in Meru County. Browse products, household items, farm produce, livestock, property, jobs and local services.',
      'Review each listing description, price, condition, photos and location. Contact the seller through the marketplace to ask questions and arrange an inspection before you buy.'
    ],
    links: [['View all categories','/categories'],['How to stay safe','/safety'],['Read marketplace rules','/rules']]
  },
  {
    path: '/categories',
    title: 'Marketplace Categories in Maua, Meru | Maua Marketplace',
    description: 'Explore marketplace categories for products, farm produce, livestock, property, jobs and services in Maua and Meru County.',
    heading: 'Explore marketplace categories',
    paragraphs: [
      'Find local listings by the kind of item or service you need. Maua Marketplace brings together everyday goods, second-hand items, farm produce, livestock, property, jobs and services for the Maua community.',
      'Choose a category to narrow your search, then check the listing details and contact the seller directly.'
    ],
    links: [['Browse all listings','/browse'],['Marketplace safety','/safety'],['Community rules','/rules']]
  },
  {
    path: '/safety',
    title: 'Marketplace Safety Guide | Maua Marketplace, Maua Soko',
    description: 'Practical safety guidance for buyers and sellers using Maua Marketplace in Maua town and Meru County.',
    heading: 'Buy and sell more safely',
    paragraphs: [
      'Maua Marketplace helps buyers and sellers find one another, but it does not process payments, hold money or provide escrow. Members are responsible for checking listings and making safe arrangements.',
      'Inspect an item before paying, meet in a public place where practical, avoid advance-payment pressure, never share passwords or verification codes, and be cautious of offers that seem too good to be true. Report suspicious listings or messages.'
    ],
    links: [['Browse listings','/browse'],['Read the marketplace rules','/rules'],['Explore categories','/categories']]
  },
  {
    path: '/rules',
    title: 'Marketplace Rules and Listing Standards | Maua Marketplace',
    description: 'Read the community rules for posting listings, communicating with members and using Maua Marketplace responsibly.',
    heading: 'Marketplace community rules',
    paragraphs: [
      'Use Maua Marketplace honestly and respectfully. Publish accurate descriptions, fair prices and genuine photos, and only list goods or services you are permitted to offer.',
      'Do not post scams, misleading claims, prohibited goods, abusive content or another person’s private information. Keep communication respectful and report suspicious activity so the community can respond.'
    ],
    links: [['Read the safety guide','/safety'],['Browse listings','/browse'],['Explore categories','/categories']]
  }
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

for (const page of pages) {
  const canonical = page.path === '/' ? SITE_ORIGIN + '/' : SITE_ORIGIN + page.path;
  const links = page.links.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('');
  const body = `<main id="seo-prerender" class="wrap page"><nav aria-label="Breadcrumb"><a href="/">Maua Marketplace</a> / <span>${escapeHtml(page.heading)}</span></nav><h1>${escapeHtml(page.heading)}</h1>${page.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}<nav aria-label="Useful marketplace pages"><ul>${links}</ul></nav></main>`;
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  html = html.replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`);
  html = html.replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}" />`);
  html = html.replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`);
  html = html.replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  const target = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.slice(1), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html, 'utf8');
  console.log(`Prerendered SEO entry: ${page.path}`);
}
