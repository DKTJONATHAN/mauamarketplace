import { SITE_ORIGIN } from '../../src/config/site-origin';
import {
  type Env,
  type Listing,
  type Profile,
  escapeHtml,
  categoryLabel,
  imageUrl,
  money,
  wordCount,
  supabaseRows,
  renderListingCards,
  buildHead,
  replaceHead,
  replaceRoot,
  pageJsonLd,
} from './helpers';
import { STATIC_PAGES } from './static-pages';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export async function renderPublicPage(path: string, html: string, env: Env): Promise<Response | null> {
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
    if (hasImage) image = imageUrl((listing.images as string[])[0]);
    if (hasPrice) {
      const priceLabel = money(listing.price as number);
      title = `${listing.title} · ${priceLabel} | Maua Marketplace`;
      description = `${listing.title} for ${priceLabel} in ${listing.location || 'Maua'}. ${(listing.description || '').replace(/\s+/g, ' ')}`.trim().slice(0, 160);
    }
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
    if ((listing.description || '').trim().length < 40 || wordCount(body) < 80) robots = 'noindex,follow';
  } else {
    const staticPages = STATIC_PAGES;
    const page = staticPages[path];
    if (!page) return null;
    ({ title, description, body } = page);
    schema = pageJsonLd(title, description, path, path === '/' ? [] : ['Home', title]);
  }

  const isListing = path.startsWith('/listing/');
  const listingImageAlt = isListing ? `${title.split(' · ')[0]} product photo on Maua Marketplace` : 'Maua Marketplace';
  const tags = buildHead(title, description, path, robots, image, schema || pageJsonLd(title, description, path), {
    type: isListing ? 'product' : 'website',
    imageAlt: listingImageAlt,
  });
  const updated = replaceRoot(replaceHead(html, tags), body);
  return new Response(updated, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=60' } });
}
