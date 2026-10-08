import { site, absoluteUrl, defaultOgImage, mediaUrl, siteUrl } from '../config/site';
import type { Listing } from './types';
import { formatPrice } from './format';
import { getCategory } from '../config/categories';

export interface SeoProps {
  /** Document title (without site name suffix). Omit for homepage default. */
  title?: string;
  description?: string;
  /** Absolute or site-relative path for canonical / og:url (hash path, e.g. /listing/id). */
  path?: string;
  /** Absolute image URL for og:image / twitter:image. */
  image?: string;
  /** Open Graph type. */
  type?: 'website' | 'article' | 'product';
  /** noindex for private / utility pages. */
  noindex?: boolean;
  /** JSON-LD object or array; injected as application/ld+json. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const META_ATTR = 'data-mm-seo';

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  // Prefer an existing tag (including static ones in index.html) so crawlers that
  // read the first match still get updated content after JS runs.
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute(META_ATTR, '1');
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    el.setAttribute(META_ATTR, '1');
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[] | undefined): void {
  if (typeof document === 'undefined') return;
  // Replace any existing JSON-LD (static homepage graph or previous page) with the current one.
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
  if (!data) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.setAttribute(META_ATTR, '1');
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}

/** Apply full SEO head tags. Call from useEffect; never throws into the React tree. */
export function applySeo(props: SeoProps = {}): void {
  try {
    const title = props.title
      ? `${props.title} - ${site.name}`
      : `${site.name} - buy and sell in ${site.place}`;
    const description = props.description ?? site.description;
    const url = absoluteUrl(props.path ?? '/');
    const image = props.image ?? defaultOgImage();
    const type = props.type ?? 'website';
    const robots = props.noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    document.title = title;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots);
    setMeta('name', 'googlebot', robots);
    setMeta('name', 'theme-color', site.themeColor);
    setMeta('name', 'application-name', site.name);
    setMeta('name', 'apple-mobile-web-app-title', site.shortName);
    setMeta('name', 'geo.region', 'KE-17');
    setMeta('name', 'geo.placename', `${site.place}, ${site.region}`);
    setMeta('name', 'language', site.language);

    setMeta('property', 'og:site_name', site.name);
    setMeta('property', 'og:locale', site.locale);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', props.title ? `${props.title} | ${site.name}` : site.name);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', props.title ? `${props.title} on ${site.name}` : site.name);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', props.title ? `${props.title} | ${site.name}` : site.name);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    if (site.twitterHandle) {
      setMeta('name', 'twitter:site', site.twitterHandle);
    }

    setLink('canonical', url);
    setJsonLd(props.jsonLd);
  } catch (err) {
    // Never let SEO side-effects take down the UI.
    console.warn('SEO update failed', err);
  }
}

/** Build JSON-LD for the organization / website (homepage). */
export function websiteJsonLd(): Record<string, unknown>[] {
  const url = siteUrl();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      url,
      description: site.description,
      inLanguage: site.language,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${url}#/browse?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: site.name,
      url,
      logo: defaultOgImage(),
      description: site.socialDescription,
      areaServed: {
        '@type': 'Place',
        name: `${site.place}, ${site.region}, ${site.country}`,
      },
    },
  ];
}

/** Build Product / Offer JSON-LD for a public listing. */
export function listingJsonLd(listing: Listing): Record<string, unknown> {
  const category = getCategory(listing.category);
  const image =
    listing.images?.[0] != null
      ? mediaUrl(listing.images[0])
      : defaultOgImage();
  const url = absoluteUrl(`/listing/${listing.id}`);
  const priceValidUntil = listing.expires_at
    ? listing.expires_at.slice(0, 10)
    : undefined;

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    priceCurrency: 'KES',
    availability:
      listing.status === 'sold'
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    itemCondition: listing.condition
      ? conditionToSchema(listing.condition)
      : undefined,
  };
  if (listing.price != null && listing.price > 0) {
    offer.price = listing.price;
  }
  if (priceValidUntil) offer.priceValidUntil = priceValidUntil;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description?.slice(0, 5000) || listing.title,
    image,
    category: category.label,
    url,
    offers: offer,
    brand: {
      '@type': 'Brand',
      name: site.name,
    },
  };
}

function conditionToSchema(c: string): string {
  switch (c) {
    case 'new':
      return 'https://schema.org/NewCondition';
    case 'like_new':
      return 'https://schema.org/UsedCondition';
    case 'good':
    case 'fair':
      return 'https://schema.org/UsedCondition';
    case 'for_parts':
      return 'https://schema.org/DamagedCondition';
    default:
      return 'https://schema.org/UsedCondition';
  }
}

/** Short social-friendly description for a listing. */
export function listingDescription(listing: Listing): string {
  const price = formatPrice(listing.price, listing.negotiable ? ' (negotiable)' : '');
  const cat = getCategory(listing.category).label;
  const loc = listing.location || site.place;
  const base = listing.description?.trim().slice(0, 120) || listing.title;
  return `${base} — ${price} · ${cat} · ${loc}. On ${site.name}.`;
}
