import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCategory } from '../config/categories';
import { ListingImage } from '../components/ListingImage';
import { OwnerActions } from '../components/OwnerActions';
import { daysLeft, formatPrice } from '../lib/format';
import { fetchMyListings } from '../lib/api';
import { useDocumentTitle } from '../hooks';
import type { ListingSummary } from '../lib/types';

function statusText(l: ListingSummary): string {
  if (l.status === 'hidden') return 'Hidden after reports from other members';
  if (l.status === 'sold') return 'Sold';
  const left = daysLeft(l.expires_at);
  if (left <= 0) return 'Expired. Renew it to show it again';
  return `Live, ${left} ${left === 1 ? 'day' : 'days'} left`;
}

export function MyListingsPage() {
  useDocumentTitle('My listings');
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['my-listings', user?.id],
    queryFn: () => fetchMyListings(user?.id as string),
    enabled: Boolean(user),
  });

  return (
    <div className="wrap page">
      <div className="section-head">
        <h1>My listings</h1>
        <Link to="/sell" className="btn btn-primary">Post a listing</Link>
      </div>
      {query.isLoading && <p aria-busy="true">Loading...</p>}
      {query.isError && <p role="alert">{(query.error as Error).message}</p>}
      {query.data && query.data.length === 0 && (
        <div className="empty">
          <h3>You have no listings</h3>
          <p>Post your first item and buyers nearby will be able to message you.</p>
          <Link to="/sell" className="btn btn-primary">Post a listing</Link>
        </div>
      )}
      <ul className="my-list">
        {query.data?.map((l) => (
          <li key={l.id} className="my-item">
            <Link to={`/listing/${l.id}`} className="my-thumb" aria-label={`View ${l.title}`}>
              <ListingImage path={l.images[0]} category={l.category} alt="" />
            </Link>
            <div className="my-info">
              <h2><Link to={`/listing/${l.id}`}>{l.title}</Link></h2>
              <p className="price-line">{formatPrice(l.price, getCategory(l.category).priceSuffix)}</p>
              <p className={`status status-${l.status}`}>{statusText(l)}</p>
            </div>
            <OwnerActions listing={l} />
          </li>
        ))}
      </ul>
    </div>
  );
}
