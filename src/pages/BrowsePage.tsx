import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { categoryGroups, getCategory, isValidCategory } from '../config/categories';
import { site } from '../config/site';
import { ListingGrid } from '../components/ListingGrid';
import { ListingCard } from '../components/ListingCard';
import { fetchListings } from '../lib/api';
import { conditionLabels, type BrowseFilters } from '../lib/types';
import { useSeo } from '../hooks';

function readFilters(params: URLSearchParams): BrowseFilters {
  const cat = params.get('cat') ?? '';
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    cat: isValidCategory(cat) ? cat : '',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    cond: params.get('cond') ?? '',
    loc: params.get('loc') ?? '',
    sort: sort === 'price_asc' || sort === 'price_desc' ? sort : 'new',
  };
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const category = filters.cat ? getCategory(filters.cat) : null;
  const browseTitle = category ? category.label : filters.q ? `"${filters.q}"` : 'Browse';
  const browseDesc = category
    ? `${category.label} for sale in ${site.place}, ${site.region}. Free listings on ${site.name}.`
    : filters.q
      ? `Search results for "${filters.q}" in ${site.place}. Buy and sell on ${site.name}.`
      : `Browse free classifieds in ${site.place}, ${site.region} — phones, produce, furniture, cars and more.`;
  useSeo({
    title: browseTitle,
    description: browseDesc,
    path: '/browse',
  });

  const [draft, setDraft] = useState(filters);
  const paramString = params.toString();
  useEffect(() => setDraft(readFilters(new URLSearchParams(paramString))), [paramString]);

  function apply(next: BrowseFilters) {
    const p = new URLSearchParams();
    (Object.keys(next) as (keyof BrowseFilters)[]).forEach((k) => {
      const v = next[k].trim();
      if (v && !(k === 'sort' && v === 'new')) p.set(k, v);
    });
    setParams(p);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    apply(draft);
  }

  const query = useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam }) => fetchListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
  });

  const items = query.data?.pages.flatMap((p) => p.items);
  const total = query.data?.pages[0]?.total;
  const showCondition = !category || category.goods !== false;
  const filtered = Object.entries(filters).some(([k, v]) => v && !(k === 'sort' && v === 'new'));

  return (
    <div className="wrap page">
      <h1>{category ? category.label : filters.q ? `Results for "${filters.q}"` : `Everything in ${site.place}`}</h1>
      {category && <p className="muted">{category.hint}</p>}

      <details className="filters" open={filtered}>
        <summary>
          <SlidersHorizontal aria-hidden /> Search and filters
        </summary>
        <form onSubmit={submit} className="filter-grid">
          <label className="field">
            <span>Search</span>
            <input type="search" value={draft.q} maxLength={60} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={draft.cat} onChange={(e) => { const next = { ...draft, cat: e.target.value }; setDraft(next); apply(next); }}>
              <option value="">All categories</option>
              {categoryGroups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Place</span>
            <input list="place-options" value={draft.loc} maxLength={60} onChange={(e) => setDraft({ ...draft, loc: e.target.value })} />
            <datalist id="place-options">
              {site.locations.map((l) => <option key={l} value={l} />)}
            </datalist>
          </label>
          <div className="field-pair">
            <label className="field">
              <span>Min price (KSh)</span>
              <input inputMode="numeric" pattern="[0-9]*" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/\D/g, '') })} />
            </label>
            <label className="field">
              <span>Max price (KSh)</span>
              <input inputMode="numeric" pattern="[0-9]*" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value.replace(/\D/g, '') })} />
            </label>
          </div>
          {showCondition && (
            <label className="field">
              <span>Condition</span>
              <select value={draft.cond} onChange={(e) => { const next = { ...draft, cond: e.target.value }; setDraft(next); apply(next); }}>
                <option value="">Any</option>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Sort by</span>
            <select value={draft.sort} onChange={(e) => { const next = { ...draft, sort: e.target.value as BrowseFilters['sort'] }; setDraft(next); apply(next); }}>
              <option value="new">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
          <div className="actions filter-actions">
            {filtered && (
              <Link to="/browse" className="btn btn-quiet">Clear all</Link>
            )}
            <button type="submit" className="btn btn-primary">Apply</button>
          </div>
        </form>
      </details>

      {typeof total === 'number' && <p className="result-count" aria-live="polite">{total.toLocaleString('en-KE')} {total === 1 ? 'listing' : 'listings'}</p>}

      {query.isError ? (
        <div className="empty">
          <h3>Listings could not load</h3>
          <p>{(query.error as Error).message}</p>
          <button type="button" className="btn btn-primary" onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {query.isLoading && <ListingGrid listings={undefined} loading empty={null} />}
          {!query.isLoading && items && items.length > 0 && (
            <div className="grid">
              {items.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
          {!query.isLoading && (!items || items.length === 0) && (
            <div className="empty">
              <h3>No listings match</h3>
              <p>Try fewer filters or a different search. Or post what you are looking for in the Wanted category.</p>
              <Link to="/sell" className="btn btn-primary">Post a listing</Link>
            </div>
          )}
          {query.hasNextPage && (
            <div className="center">
              <button type="button" className="btn btn-quiet" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? 'Loading...' : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
