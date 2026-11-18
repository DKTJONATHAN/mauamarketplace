import { SITE_ORIGIN } from '../../src/config/site-origin';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface Listing {
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

export interface Profile {
  display_name?: string | null;
  created_at?: string | null;
}

const MEDIA_BASE = 'https://pub-7ef5a8d013b245bfb993db42153b04e4.r2.dev';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function categoryLabel(slug: string): string {
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function imageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('r2/')) return `${MEDIA_BASE}/${path.slice(3)}`;
  const base = 'https://akrbmcptyjjcjoyxaxkl.supabase.co';
  return `${base}/storage/v1/object/public/listing-images/${path}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
}

export function wordCount(value: string): number {
  return value.replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').trim().split(/\s+/).filter(Boolean).length;
}

export async function supabaseRows<T>(env: Env, table: string, params: Record<string, string>): Promise<T[]> {
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

export function renderListingCards(listings: Listing[]): string {
  if (!listings.length) return '<p>No live listings are available in this category yet.</p>';
  return `<ul class="ssr-listings">${listings.map((item) => {
    const image = item.images?.[0] ? imageUrl(item.images[0]) : '';
    const price = typeof item.price === 'number' && item.price > 0 ? money(item.price) : 'Contact seller';
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
    return `<li><a href="/listing/${slug}-${escapeHtml(item.id)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)} in ${escapeHtml(item.location || 'Maua')}" width="320" height="240" loading="lazy">` : ''}<span><strong>${escapeHtml(item.title)}</strong><b>${escapeHtml(price)}</b><small>${escapeHtml(item.location || 'Maua')} · ${escapeHtml(categoryLabel(item.category))}</small></span></a></li>`;
  }).join('')}</ul>`;
}

export function buildHead(title: string, description: string, path: string, robots: string, image: string, jsonLd: unknown): string {
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

export function replaceHead(html: string, tags: string): string {
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

export function replaceRoot(html: string, content: string): string {
  return html.replace(/<div\b[^>]*id=["']root["'][^>]*>[\s\S]*?<\/div>/i, `<div id="root">${content}</div>`);
}

export function pageJsonLd(title: string, description: string, path: string, breadcrumbs: string[] = []) {
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
