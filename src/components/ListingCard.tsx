import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { getCategory } from '../config/categories';
import { formatPrice, timeAgo } from '../lib/format';
import { conditionLabels, type ListingSummary } from '../lib/types';
import { ListingImage } from './ListingImage';
import { SaveButton } from './SaveButton';
import { listingPath } from '../lib/seo';

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const category = getCategory(listing.category);
  return (
    <article className="card">
      <Link to={listingPath(listing.title, listing.id)} className="card-link">
        <div className="card-media">
          <ListingImage path={listing.images[0]} category={listing.category} alt="" />
          <span className="price-tag">{formatPrice(listing.price, category.priceSuffix)}</span>
          {listing.status === 'sold' && <span className="sold-flag">Sold</span>}
        </div>
        <div className="card-body">
          <h3 className="card-title">{listing.title}</h3>
          <p className="card-meta">
            <span>
              <MapPin aria-hidden /> {listing.location}
            </span>
            <span>
              <Clock aria-hidden /> {timeAgo(listing.created_at)}
            </span>
          </p>
          {listing.condition && <p className="card-condition">{conditionLabels[listing.condition]}</p>}
        </div>
      </Link>
      <SaveButton listingId={listing.id} />
    </article>
  );
}
