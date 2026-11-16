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
    title: 'Maua Marketplace (Maua Soko) | Maua, Meru',
    description: 'Discover Maua Soko, the local online marketplace for Maua town and Meru County. Browse goods, farm produce, property and services from local sellers.',
    heading: 'Maua Marketplace — your local market, online',
    paragraphs: [
      'Maua Marketplace, also known as Maua Soko, helps people in Maua town and across Meru County discover local goods, farm produce, property and services. Browse public listings, compare details and contact sellers directly.',
      'Find new and second-hand items from people and businesses in the local community. Listings are provided by members; check the details, inspect items and follow the marketplace safety guidance before arranging a transaction.',
      'Browse phones and tablets, home and living, clothing, vehicles, farm produce and livestock, property, jobs and local services. Choose a category to narrow your search, then compare the seller’s description, price, photos and location.',
      'Maua Marketplace is a listing platform, not an escrow or payment service. Buyers and sellers arrange inspections and payments directly, so keep your M-Pesa PIN and verification codes private.'
    ],
    links: [['Browse local listings','/browse'],['Explore categories','/categories'],['Promote a listing','/my-listings'],['Advertise your business','/advertise'],['Marketplace safety','/safety'],['Community rules','/rules']]
  },
  {
    path: '/browse',
    title: 'Browse Local Listings in Maua and Meru | Maua Marketplace',
    description: 'Browse goods, second-hand items, farm produce, property and services listed by people in Maua town and Meru County.',
    heading: 'Browse listings in Maua and Meru',
    paragraphs: [
      'Explore public marketplace listings from Maua town and nearby communities in Meru County. Browse products, household items, farm produce, livestock, property, jobs and local services.',
      'Review each listing description, price, condition, photos and location. Contact the seller through the marketplace to ask questions and arrange an inspection before you buy.',
      'Ask the seller to confirm that an item is still available and clarify collection or delivery arrangements before travelling. Compare the full details rather than choosing only by the lowest asking price.',
      'For electronics, test the device and check proof of ownership. For vehicles, verify the documents and arrange an independent inspection. For property, confirm ownership and the person’s authority to let or sell before paying.'
    ],
    links: [['View all categories','/categories'],['How to stay safe','/safety'],['Read marketplace rules','/rules']]
  },
  {
    path: '/advertise',
    title: 'Advertise Your Business in Maua and Meru | Maua Marketplace',
    description: 'Promote your business to people browsing Maua Marketplace. Compare homepage, category and business spotlight advertising options with clear KSh pricing.',
    heading: 'Advertise your business in Maua and Meru',
    paragraphs: [
      'Reach people browsing products, services and local businesses around Maua and nearby communities. Maua Marketplace offers clearly labelled homepage, category and business spotlight advertising placements.',
      'Choose a seven-day or thirty-day campaign, submit your business details and approve the M-Pesa payment prompt on your phone. Campaigns are scheduled after payment confirmation, creative review and placement availability.'
    ],
    links: [['Browse local listings','/browse'],['Post a free listing','/sell'],['Promote an existing listing','/my-listings']]
  },
  {
    path: '/categories',
    title: 'Marketplace Categories in Maua, Meru | Maua Marketplace',
    description: 'Explore marketplace categories for products, farm produce, livestock, property, jobs and services in Maua and Meru County.',
    heading: 'Explore marketplace categories',
    paragraphs: [
      'Find local listings by the kind of item or service you need. Maua Marketplace brings together everyday goods, second-hand items, farm produce, livestock, property, jobs and services for the Maua community.',
      'Choose a category to narrow your search, then check the listing details and contact the seller directly.',
      'Popular sections include phones and tablets, laptops, TVs and audio; furniture, appliances and kitchenware; clothing, shoes and baby items; cars, motorbikes and vehicle parts; farm produce, livestock and farm equipment; property, jobs and services.',
      'Select the category that best describes the item so nearby buyers can find it. Use the closest matching category and write important details in the listing title and description instead of adding unrelated keywords.'
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
      'Inspect an item before paying, meet in a public place where practical, avoid advance-payment pressure, never share passwords or verification codes, and be cautious of offers that seem too good to be true. Report suspicious listings or messages.',
      'For electronics, test the screen, camera, charging and other important functions. For vehicles, check the logbook and seller identity and arrange official checks and a mechanic inspection. For rental or sale property, view the premises and verify the owner or authorised agent before paying.',
      'Treat requests for deposits before viewing, pressure to pay immediately, copied photos, unusually low prices, M-Pesa PIN requests, one-time-code requests and job registration fees as warning signs. Keep records of important messages and report suspicious activity.'
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
      'Do not post scams, misleading claims, prohibited or unlawful goods, abusive content or another person’s private information. Keep communication respectful and report suspicious activity so the community can respond.',
      'Use a clear title, the closest accurate category, genuine photos, an honest description and a realistic price. Do not use unrelated keywords, duplicate the same listing to gain attention or claim that an item is available when it has already been sold.',
      'Only list goods and services you are legally allowed to offer. Do not publish misleading job offers, impersonate another seller, harass members or share someone else’s private details without permission.'
    ],
    links: [['Read the safety guide','/safety'],['Browse listings','/browse'],['Explore categories','/categories']]
  }
];

const prerenderedPaths = new Set(pages.map(({ path }) => path));
function canonicalPath(path) {
  return path === '/' || !prerenderedPaths.has(path) ? path : `${path}/`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

for (const page of pages) {
  const canonical = SITE_ORIGIN + canonicalPath(page.path);
  const links = page.links.map(([label, href]) => `<li><a href="${canonicalPath(href)}">${escapeHtml(label)}</a></li>`).join('');
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
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${body}</div>`);
  const target = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.slice(1), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html, 'utf8');
  console.log(`Prerendered SEO entry: ${page.path}`);
}
