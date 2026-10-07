import { Heart } from 'lucide-react';
import { useSaved } from '../hooks';

export function SaveButton({ listingId, label = false }: { listingId: string; label?: boolean }) {
  const { ids, toggle } = useSaved();
  const saved = ids.has(listingId);
  return (
    <button
      type="button"
      className={label ? `btn btn-quiet${saved ? ' is-saved' : ''}` : `save-btn${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save listing'}
      onClick={() => toggle(listingId)}
    >
      <Heart aria-hidden fill={saved ? 'currentColor' : 'none'} />
      {label && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
