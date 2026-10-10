import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListingGrid } from '../components/ListingGrid';
import { getCategory, isValidCategory } from '../config/categories';
import { absoluteUrl, site } from '../config/site';
import { fetchListings } from '../lib/api';
import { useSeo } from '../hooks';
import type { BrowseFilters } from '../lib/types';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const valid = isValidCategory(slug);
  const category = getCategory(slug);
  const title = valid ? `${category.label} in ${site.place}` : 'Category not found';
  const description = valid
    ? `Find ${category.label.toLowerCase()} for sale in ${site.place}, ${site.region}, Kenya. Browse new and second-hand listings from local sellers on ${site.name}.`
    : `This category could not be found on ${site.name}.`;

  useSeo({
    title,
    description,
    path: `/category/${slug}`,
    noindex: !valid,
    jsonLd: valid ? [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: absoluteUrl(`/category/${slug}`),
        about: { '@type': 'Thing', name: category.label },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: absoluteUrl('/categories') },
          { '@type': 'ListItem', position: 3, name: category.label, item: absoluteUrl(`/category/${slug}`) },
        ],
      },
    ] : undefined,
  });

  const filters: BrowseFilters = { q: '', cat: valid ? slug : '', min: '', max: '', cond: '', loc: '', sort: 'new' };
  const query = useQuery({
    queryKey: ['category-landing', slug],
    queryFn: () => fetchListings(filters, 0),
    enabled: valid,
  });

  if (!valid) {
    return (
      <div className="wrap page narrow">
        <h1>Category not found</h1>
        <p>Choose from the available Maua Marketplace categories.</p>
        <Link className="btn btn-primary" to="/categories">View all categories</Link>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link to="/">Home</Link> / <Link to="/categories">Categories</Link> / {category.label}
      </nav>
      <header className="section-head">
        <div>
          <h1>{category.label} for sale in {site.place}</h1>
          <p>{category.hint}. Discover listings from Maua and nearby towns in {site.region}, Kenya.</p>
          <p className="muted">
            {category.goods === false
              ? `Browse local ${category.label.toLowerCase()} and offers in Maua. Contact sellers directly through the marketplace.`
              : `Compare new and second-hand ${category.label.toLowerCase()}, check item condition and prices, and contact local sellers before buying.`}
          </p>
        </div>
        <Link to={`/browse?cat=${slug}`} className="btn btn-quiet">Filter listings</Link>
      </header>
      {typeof query.data?.total === 'number' && (
        <p className="result-count">{query.data.total.toLocaleString('en-KE')} {query.data.total === 1 ? 'listing' : 'listings'} in this category</p>
      )}
      <ListingGrid
        listings={query.data?.items}
        loading={query.isLoading}
        empty={query.isError
          ? <p>Listings could not load. Please refresh the page.</p>
          : <div className="empty"><h2>No listings yet</h2><p>Be the first to post {category.label.toLowerCase()} in Maua.</p><Link className="btn btn-primary" to="/sell">Post a listing</Link></div>}
      />
      {query.data?.hasMore && (
        <p className="center"><Link className="btn btn-quiet" to={`/browse?cat=${slug}`}>See all {category.label.toLowerCase()} listings</Link></p>
      )}
      <section className="section">
        <h2>Buying and selling in Maua</h2>
        <p>{site.name} helps people in Maua, Meru County and nearby communities discover local products and second-hand bargains. Review photos and descriptions carefully, compare prices, meet in a public place, inspect goods before paying and never share your M-Pesa PIN.</p>
        <Link to="/categories">Explore all Maua Marketplace categories</Link>
      </section>
    </div>
  );
}
