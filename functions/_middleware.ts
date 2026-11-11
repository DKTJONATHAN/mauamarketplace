import { SITE_ORIGIN } from '../src/config/site-origin';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface Listing {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  location?: string | null;
  category: string;
  condition?: string | null;
  status: string;
  images?: string[] | null;
  seller_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Profile {
  display_name?: string | null;
  created_at?: string | null;
}

interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const MEDIA_BASE = 'https://pub-7ef5a8d013b245bfb993db42153b04e4.r2.dev';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function categoryLabel(slug: string): string {
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function imageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('r2/')) return `${MEDIA_BASE}/${path.slice(3)}`;
  const base = 'https://akrbmcptyjjcjoyxaxkl.supabase.co';
  return `${base}/storage/v1/object/public/listing-images/${path}`;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
}

function wordCount(value: string): number {
  return value.replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').trim().split(/\s+/).filter(Boolean).length;
}

async function supabaseRows<T>(env: Env, table: string, params: Record<string, string>): Promise<T[]> {
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  if (!base || !key) return [];
  const query = new URLSearchParams(params);
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Supabase ${table} query returned HTTP ${response.status}`);
  return await response.json() as T[];
}

function renderListingCards(listings: Listing[]): string {
  if (!listings.length) return '<p>No live listings are available in this category yet.</p>';
  return `<ul class="ssr-listings">${listings.map((item) => {
    const image = item.images?.[0] ? imageUrl(item.images[0]) : '';
    const price = typeof item.price === 'number' && item.price > 0 ? money(item.price) : 'Contact seller';
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
    return `<li><a href="/listing/${slug}-${escapeHtml(item.id)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)} in ${escapeHtml(item.location || 'Maua')}" width="320" height="240" loading="lazy">` : ''}<span><strong>${escapeHtml(item.title)}</strong><b>${escapeHtml(price)}</b><small>${escapeHtml(item.location || 'Maua') } · ${escapeHtml(categoryLabel(item.category))}</small></span></a></li>`;
  }).join('')}</ul>`;
}

function buildHead(title: string, description: string, path: string, robots: string, image: string, jsonLd: unknown): string {
  const canonical = `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
  return `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:site_name" content="Maua Marketplace">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script type="application/ld+json">${safeJson(jsonLd)}</script>`;
}

function replaceHead(html: string, tags: string): string {
  return html.replace(/<head\b[^>]*>([\s\S]*?)<\/head>/i, (_whole, inner: string) => {
    const clean = inner
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
      .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
      .replace(/<meta\b(?=[^>]*\bname=["'](description|robots)["'])[^>]*>/gi, '')
      .replace(/<meta\b(?=[^>]*\bproperty=["']og:[^"']+["'])[^>]*>/gi, '')
      .replace(/<meta\b(?=[^>]*\bname=["']twitter:[^"']+["'])[^>]*>/gi, '')
      .replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, '');
    return `<head>${clean}\n${tags}\n</head>`;
  });
}

function replaceRoot(html: string, content: string): string {
  return html.replace(/<div\b[^>]*id=["']root["'][^>]*>[\s\S]*?<\/div>/i, `<div id="root">${content}</div>`);
}

function pageJsonLd(title: string, description: string, path: string, breadcrumbs: string[] = []) {
  const canonical = `${SITE_ORIGIN}${path}`;
  const graph: Record<string, unknown>[] = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Maua Marketplace', url: SITE_ORIGIN },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Maua Marketplace', url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/logo.png` },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: canonical },
  ];
  if (breadcrumbs.length) graph.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((name, index) => ({
      '@type': 'ListItem', position: index + 1, name,
      item: index === 0 ? SITE_ORIGIN : canonical,
    })),
  });
  return graph;
}

async function renderPublicPage(path: string, html: string, env: Env): Promise<Response | null> {
  const logo = `${SITE_ORIGIN}/logo.png`;
  let title = '';
  let description = '';
  let robots = 'index,follow,max-image-preview:large';
  let body = '';
  let image = logo;
  let schema: unknown;

  if (path === '/') {
    title = 'Maua Marketplace in Maua Town, Meru | Buy & Sell';
    description = 'Buy and sell in Maua, Meru County. Browse local listings, compare prices, check item details and contact sellers directly on Maua Marketplace.';
    const listings = await supabaseRows<Listing>(env, 'listings', {
      select: 'id,title,description,price,location,category,images,status,created_at',
      status: 'eq.active', order: 'created_at.desc', limit: '12',
    }).catch(() => []);
    body = `<main class="wrap page"><h1>Maua Marketplace — buy and sell in Maua, Meru</h1><p class="lead">A local place to discover products and services from people in Maua and nearby communities. Compare the details in each advert, ask the seller questions and inspect goods before paying.</p><h2>Recent local listings</h2>${renderListingCards(listings)}<h2>Browse by category</h2><p>Explore <a href="/categories">all marketplace categories</a>, read our <a href="/safety">buying and selling safety tips</a>, and review the <a href="/rules">community rules</a>.</p><p>Meet sellers in a public place, inspect an item before payment and never share your M-Pesa PIN.</p></main>`;
    schema = pageJsonLd(title, description, '/');
  } else if (path === '/categories') {
    title = 'Marketplace Categories in Maua, Meru | Maua Soko';
    description = 'Browse active Maua Marketplace categories. Find local products and services, compare available adverts and contact sellers in Meru County.';
    const listings = await supabaseRows<Listing>(env, 'listings', {
      select: 'id,title,category,status', status: 'eq.active', limit: '5000',
    }).catch(() => []);
    const counts = new Map<string, number>();
    for (const item of listings) counts.set(item.category, (counts.get(item.category) || 0) + 1);
    const categories = [...counts.entries()].filter(([, count]) => count > 0).sort((a, b) => a[0].localeCompare(b[0]));
    body = `<main class="wrap page"><h1>Browse Maua Marketplace categories</h1><p class="lead">Choose a category to see adverts currently available from local sellers. Categories with no active adverts are not presented as live shopping destinations.</p><ul>${categories.map(([slug, count]) => `<li><a href="/category/${escapeHtml(slug)}">${escapeHtml(categoryLabel(slug))}</a> — ${count} active ${count === 1 ? 'listing' : 'listings'}</li>`).join('')}</ul><p>New adverts are added by members. Review each listing carefully and follow the <a href="/safety">marketplace safety guidance</a>.</p></main>`;
    schema = pageJsonLd(title, description, '/categories', ['Home', 'Categories']);
  } else if (path.startsWith('/category/')) {
    const slug = path.slice('/category/'.length);
    if (!/^[a-z0-9-]+$/i.test(slug)) return null;
    const listings = await supabaseRows<Listing>(env, 'listings', {
      select: 'id,title,description,price,location,category,images,status,created_at',
      status: 'eq.active', category: `eq.${slug}`, order: 'created_at.desc', limit: '100',
    }).catch(() => []);
    const label = categoryLabel(slug);
    title = `${label} in Maua, Meru | Maua Marketplace`;
    description = `Browse ${label.toLowerCase()} adverts from local sellers in Maua and Meru County. Compare item details, prices and locations on Maua Marketplace.`;
    if (listings.length < 5) robots = 'noindex,follow';
    const advice = slug === 'phones'
      ? 'For a used phone, check the IMEI with *#06#, compare it with the box and settings, test calls, cameras, charging and the screen, and request proof of ownership.'
      : slug.includes('vehicle')
        ? 'For a vehicle, verify the original logbook and seller identity, make an official NTSA search and arrange an independent mechanical inspection before paying.'
        : 'Read the description carefully, ask for additional photos where needed, compare similar adverts and inspect the item or agree the work scope before paying.';
    body = `<main class="wrap page"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/categories">Categories</a> / ${escapeHtml(label)}</nav><h1>${escapeHtml(label)} in Maua and Meru County</h1><p class="lead">There are currently ${listings.length} active ${listings.length === 1 ? 'advert' : 'adverts'} in this category. Browse the actual offers below and contact sellers to confirm availability.</p><section><h2>Current local adverts</h2>${renderListingCards(listings)}</section><section><h2>What to check before buying</h2><p>${escapeHtml(advice)}</p><p>Arrange to meet in a public place, inspect goods before paying, use a traceable payment method and never disclose your M-Pesa PIN. Read the full <a href="/safety">Maua Marketplace safety guide</a>.</p></section></main>`;
    schema = pageJsonLd(title, description, path, ['Home', 'Categories', label]);
  } else if (path.startsWith('/listing/')) {
    const id = path.match(new RegExp(`(${UUID})$`, 'i'))?.[1];
    if (!id) return null;
    const listings = await supabaseRows<Listing>(env, 'listings', {
      select: 'id,title,description,price,location,category,condition,status,images,seller_id,created_at,updated_at',
      id: `eq.${id}`, limit: '1',
    }).catch(() => []);
    const listing = listings[0];
    if (!listing) {
      title = 'Listing not found | Maua Marketplace';
      description = 'This advert is no longer available on Maua Marketplace.';
      robots = 'noindex,follow';
      body = '<main class="wrap page"><h1>Listing not found</h1><p>This advert may have been removed. Browse current <a href="/categories">marketplace categories</a>.</p></main>';
      schema = pageJsonLd(title, description, path);
      const updated = replaceRoot(replaceHead(html, buildHead(title, description, path, robots, logo, schema)), body);
      return new Response(updated, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (listing.status === 'sold' && listing.updated_at && Date.now() - Date.parse(listing.updated_at) > 30 * 86400000) {
      return new Response('<!doctype html><html lang="en"><head><meta name="robots" content="noindex,follow"><title>Listing expired | Maua Marketplace</title></head><body><h1>This listing has expired</h1><p>Browse current <a href="/categories">marketplace categories</a>.</p></body></html>', { status: 410, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    title = `${listing.title} — ${listing.location || 'Maua'} | Maua Marketplace`;
    description = (listing.description || listing.title).replace(/\s+/g, ' ').slice(0, 155);
    const listingImages = (listing.images || []).slice(0, 6).map((src) => `<img src="${escapeHtml(imageUrl(src))}" alt="${escapeHtml(listing.title)} in ${escapeHtml(listing.location || 'Maua')}" width="640" height="480" loading="lazy">`).join('');
    const hasPrice = typeof listing.price === 'number' && listing.price > 0;
    const hasImage = Boolean(listing.images?.length);
    if (listing.status !== 'active') robots = 'noindex,follow';
    const seller = listing.seller_id ? (await supabaseRows<Profile>(env, 'profiles', { select: 'display_name,created_at', id: `eq.${listing.seller_id}`, limit: '1' }).catch(() => []))[0] : undefined;
    const descriptionText = listing.description?.trim() || 'Contact the seller for more information about this advert.';
    body = `<main class="wrap page"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/${escapeHtml(listing.category)}">${escapeHtml(categoryLabel(listing.category))}</a> / ${escapeHtml(listing.title)}</nav><article><h1>${escapeHtml(listing.title)}</h1><p class="lead">${hasPrice ? escapeHtml(money(listing.price as number)) : 'Contact seller for price'} · ${escapeHtml(listing.location || 'Maua, Meru County')} · ${escapeHtml(categoryLabel(listing.category))}</p><div class="ssr-gallery">${listingImages}</div><p><strong>Status:</strong> ${escapeHtml(listing.status === 'sold' ? 'Sold' : listing.status === 'active' ? 'Available' : 'Unavailable')}</p><p><strong>Condition:</strong> ${escapeHtml(listing.condition || 'Not specified')}</p><h2>About this advert</h2><p>${escapeHtml(descriptionText)}</p><h2>Seller information</h2><p>${escapeHtml(seller?.display_name || 'Maua Marketplace member')}${seller?.created_at ? ` · Member since ${new Date(seller.created_at).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}` : ''}</p><h2>Before you contact the seller</h2><p>Ask questions about the item, confirm that it is still available, arrange a public meeting and inspect it before paying. Never send a deposit to secure an item you have not verified, and never share your M-Pesa PIN.</p><p><a href="/safety">Read our full safety guidance</a>.</p></article></main>`;
    schema = pageJsonLd(title, description, path, ['Home', categoryLabel(listing.category), listing.title]);
    if (hasPrice && hasImage && listing.status === 'active') {
      const product = {
        '@context': 'https://schema.org', '@type': 'Product', name: listing.title,
        description: descriptionText, image: (listing.images || []).map(imageUrl),
        offers: { '@type': 'Offer', price: listing.price, priceCurrency: 'KES', availability: 'https://schema.org/InStock', url: `${SITE_ORIGIN}${path}` },
      };
      schema = [pageJsonLd(title, description, path, ['Home', categoryLabel(listing.category), listing.title])[0], product, pageJsonLd(title, description, path, ['Home', categoryLabel(listing.category), listing.title])[2], pageJsonLd(title, description, path, ['Home', categoryLabel(listing.category), listing.title])[3]].filter(Boolean);
    }
    if (!hasPrice || !hasImage || wordCount(body) < 120) robots = 'noindex,follow';
  } else {
    const staticPages: Record<string, { title: string; description: string; body: string }> = {
      '/safety': { title: 'Safe Buying and Selling in Maua, Kenya | Maua Marketplace', description: 'Practical safety advice for meeting sellers, inspecting goods, using M-Pesa and avoiding scams on Maua Marketplace.', body: '<h1>Buy and sell safely on Maua Marketplace</h1><p class="lead">Maua Marketplace connects people directly. We do not inspect goods, hold payments or guarantee sellers. Take time to verify every advert and agree the transaction safely.</p><h2>Meet in a public place</h2><p>Arrange daytime meetings in a busy, familiar public location. Tell someone where you are going and avoid isolated locations or pressure to change the agreed meeting point.</p><h2>Inspect before paying</h2><p>Test the item, compare its condition with the advert and ask for proof of ownership where appropriate. For phones, check the IMEI and test calls, charging, cameras and screen. For vehicles, verify the logbook and arrange an independent inspection.</p><h2>Protect your M-Pesa account</h2><p>Never share your PIN, one-time password or confirmation codes. Do not trust screenshots as proof of payment; check your own transaction message or balance. Be wary of overpayment, courier and deposit requests.</p><h2>Report suspicious adverts</h2><p>Use the report option on a listing if information appears misleading or unsafe. Stop communicating if someone threatens you or asks for unusual payment.</p>' },
      '/rules': { title: 'Community Rules | Maua Marketplace', description: 'Read the rules for honest adverts, respectful communication, prohibited items and safe transactions on Maua Marketplace.', body: '<h1>Maua Marketplace community rules</h1><p class="lead">The marketplace works best when adverts are accurate, members communicate respectfully and transactions are handled safely.</p><h2>Accurate adverts</h2><p>Use your own photographs where possible. Describe the condition honestly, show defects and state a realistic price. Do not advertise an item you do not own or have authority to sell.</p><h2>Respect other members</h2><p>Do not harass, threaten, impersonate or discriminate against other members. Keep communication relevant to the advert and do not publish private contact details without permission.</p><h2>Prohibited activity</h2><p>Do not list illegal goods, counterfeit items, stolen property, dangerous substances or services that violate applicable law. Do not use the platform for fraud, phishing or misleading payment requests.</p><h2>Report concerns</h2><p>Members can report listings that appear fraudulent, unsafe or misleading. We may hide content while reviewing a report and may restrict accounts that repeatedly breach these rules.</p>' },
      '/privacy': { title: 'Privacy Policy | Maua Marketplace', description: 'Learn what account, listing and device information Maua Marketplace uses, why it is needed and how members can request help.', body: '<h1>Maua Marketplace privacy policy</h1><p class="lead">This policy explains how Maua Marketplace handles information used to provide accounts, adverts, messaging and marketplace safety features.</p><h2>Information used</h2><p>We use account details, display names, listing information, images and messages to operate the marketplace. Public listings show the information a seller chooses to publish; private account and message data are not intended for public search pages.</p><h2>Why information is used</h2><p>Information supports account access, communication between members, listing moderation, fraud prevention and service reliability. We do not ask members to publish passwords, payment PINs or one-time codes.</p><h2>Your choices</h2><p>You can update your display name, remove listings and use the account controls available in the service. Contact us through the published support channel for privacy questions or requests.</p>' },
      '/terms': { title: 'Terms of Use | Maua Marketplace', description: 'Read the terms governing accounts, adverts, direct transactions, prohibited conduct and platform responsibilities on Maua Marketplace.', body: '<h1>Maua Marketplace terms of use</h1><p class="lead">Maua Marketplace provides a platform for members to publish adverts and contact one another. A sale or service agreement is made directly between the members.</p><h2>Member responsibilities</h2><p>You must provide accurate advert details, have the right to publish listed goods and comply with applicable laws. Keep your login credentials private and report suspected misuse.</p><h2>Transactions</h2><p>Maua Marketplace does not act as a seller, buyer, escrow service or payment processor for private transactions. Members should inspect goods, verify counterparties and agree payment and delivery terms independently.</p><h2>Moderation</h2><p>We may remove or restrict adverts that appear unlawful, misleading, unsafe or inconsistent with the community rules. Access may be limited where necessary to protect members and the service.</p>' },
      '/refund-policy': { title: 'Refund Policy | Maua Marketplace', description: 'Understand how refunds and disputes work on Maua Marketplace, where buyers and sellers arrange transactions directly.', body: '<h1>Maua Marketplace refund policy</h1><p class="lead">Maua Marketplace is a classifieds platform. Buyers and sellers arrange payment and delivery directly; the platform does not collect or hold the transaction funds.</p><h2>Private transactions</h2><p>Discuss the condition, price, delivery and any return agreement with the seller before paying. Inspect goods before completing payment wherever possible and keep records of your agreement.</p><h2>Platform charges</h2><p>If a paid platform feature is introduced, its specific refund terms will be displayed before purchase. At present, this policy does not create a guarantee for private sales between members.</p><h2>Report a concern</h2><p>Use the listing report feature for suspicious or misleading adverts and contact support with the listing URL and relevant details.</p>' },
    };
    const page = staticPages[path];
    if (!page) return null;
    ({ title, description, body } = page);
    schema = pageJsonLd(title, description, path, path === '/' ? [] : ['Home', title]);
  }

  const tags = buildHead(title, description, path, robots, image, schema || pageJsonLd(title, description, path));
  const updated = replaceRoot(replaceHead(html, tags), body);
  return new Response(updated, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=60' } });
}

export async function onRequest(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  if (url.hostname.toLowerCase() === 'mauamarketplace.pages.dev') {
    url.hostname = 'mauamarketplace.eu.cc';
    return Response.redirect(url.toString(), 301);
  }
  if (context.request.method !== 'GET' || url.search) return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (!['/', '/categories', '/safety', '/rules', '/privacy', '/terms', '/refund-policy'].includes(path)
    && !path.startsWith('/category/') && !path.startsWith('/listing/')) return response;
  try {
    const html = await response.text();
    return await renderPublicPage(path, html, context.env) || new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    console.error('Maua public-page HTML rendering failed; serving the original app shell.', error);
    return response;
  }
}
