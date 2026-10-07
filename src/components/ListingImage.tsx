import { useState } from 'react';
import { getCategory } from '../config/categories';
import { mediaUrl } from '../config/site';

interface Props {
  path: string | undefined;
  category: string;
  alt: string;
  eager?: boolean;
}

/** Shows the listing photo, or the category icon when there is no photo or it fails to load. */
export function ListingImage({ path, category, alt, eager }: Props) {
  const [failed, setFailed] = useState(false);
  const Icon = getCategory(category).icon;
  if (!path || failed) {
    return (
      <div className="img-placeholder" role="img" aria-label={path ? 'Photo unavailable' : 'No photo'}>
        <Icon aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={mediaUrl(path)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
