import type { ReactNode } from 'react';
import type { ListingSummary } from '../lib/types';
import { ListingCard } from './ListingCard';

interface Props {
  listings: ListingSummary[] | undefined;
  loading?: boolean;
  empty: ReactNode;
}

export function ListingGrid({ listings, loading, empty }: Props) {
  if (loading) {
    return (
      <div className="grid" aria-busy="true" aria-label="Loading listings">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card card-skeleton" aria-hidden="true">
            <div className="card-media" />
            <div className="card-body">
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!listings || listings.length === 0) return <div className="empty">{empty}</div>;
  return (
    <div className="grid">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
