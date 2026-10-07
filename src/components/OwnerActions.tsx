import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CircleCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { site } from '../config/site';
import { useToast } from '../context/ToastContext';
import { renewListing, setListingStatus } from '../lib/api';
import { daysLeft } from '../lib/format';
import { deleteListingWithMedia } from '../lib/media';
import type { ListingSummary } from '../lib/types';
import { Dialog } from './Dialog';

interface Props {
  listing: ListingSummary;
  onDeleted?: () => void;
}

export function OwnerActions({ listing, onDeleted }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['listing', listing.id] });
    void qc.invalidateQueries({ queryKey: ['my-listings'] });
    void qc.invalidateQueries({ queryKey: ['listings'] });
    void qc.invalidateQueries({ queryKey: ['latest'] });
  };

  const status = useMutation({
    mutationFn: (next: 'active' | 'sold') => setListingStatus(listing.id, next),
    onSuccess: (_d, next) => {
      toast.success(next === 'sold' ? 'Marked as sold.' : 'Listing is live again.');
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: () => renewListing(listing.id, site.listingLifetimeDays),
    onSuccess: () => {
      toast.success(`Renewed for ${site.listingLifetimeDays} days.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteListingWithMedia(listing.id),
    onSuccess: () => {
      toast.success('Listing deleted.');
      setConfirming(false);
      refresh();
      onDeleted?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hidden = listing.status === 'hidden';
  const remaining = daysLeft(listing.expires_at);

  return (
    <div className="owner-actions">
      {!hidden && (
        <Link to={`/sell/${listing.id}/edit`} className="btn btn-quiet">
          <Pencil aria-hidden /> Edit
        </Link>
      )}
      {listing.status === 'active' && (
        <button type="button" className="btn btn-quiet" onClick={() => status.mutate('sold')} disabled={status.isPending}>
          <CircleCheck aria-hidden /> Mark as sold
        </button>
      )}
      {listing.status === 'sold' && (
        <button type="button" className="btn btn-quiet" onClick={() => status.mutate('active')} disabled={status.isPending}>
          <RotateCcw aria-hidden /> Make available again
        </button>
      )}
      {!hidden && remaining <= 14 && (
        <button type="button" className="btn btn-quiet" onClick={() => renew.mutate()} disabled={renew.isPending}>
          <CalendarPlus aria-hidden /> Renew
        </button>
      )}
      <button type="button" className="btn btn-quiet btn-danger" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden /> Delete
      </button>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete this listing?">
        <div className="stack">
          <p>
            "{listing.title}" and its photos will be removed for good. Conversations about it stay in your inbox but will no
            longer link to the listing.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button type="button" className="btn btn-danger-solid" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting...' : 'Delete listing'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
