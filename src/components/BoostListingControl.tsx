import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import type { ListingSummary } from '../lib/types';

type PaymentStatus = {
  status: 'initiating' | 'pending' | 'paid' | 'failed';
  message: string;
  paidAt: string | null;
};

async function requestPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`/api/boost?paymentId=${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json() as PaymentStatus & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Could not check payment status.');
  return result;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(value));
}

export function BoostListingControl({ listing }: { listing: ListingSummary }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [phone, setPhone] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const statusQuery = useQuery({
    queryKey: ['boost-payment', paymentId],
    queryFn: () => requestPaymentStatus(paymentId as string),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'initiating' ? 4000 : false;
    },
  });

  const isFeatured = Boolean(listing.featured_until && new Date(listing.featured_until).getTime() > Date.now());

  async function startPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/boost', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, phone }),
      });
      const result = await response.json() as { paymentId?: string; message?: string; error?: string };
      if (!response.ok || !result.paymentId) throw new Error(result.error || 'Could not send the M-PESA prompt.');
      setPaymentId(result.paymentId);
      toast.info('M-PESA prompt sent. Approve it on your phone to complete payment.');
      await queryClient.invalidateQueries({ queryKey: ['boost-payment', result.paymentId] });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not start payment.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (statusQuery.data?.status === 'paid') {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-listings', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['seller-dashboard', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['latest'] }),
        queryClient.invalidateQueries({ queryKey: ['category-landing'] }),
      ]);
    }
  }, [statusQuery.data?.status, queryClient, user?.id]);

  async function refreshStatus() {
    const result = await statusQuery.refetch();
    if (result.data?.status === 'paid') {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-listings', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['seller-dashboard', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['latest'] }),
        queryClient.invalidateQueries({ queryKey: ['category-landing'] }),
      ]);
    }
  }

  return (
    <div className="boost-control">
      {isFeatured ? (
        <p className="boost-active"><BadgeCheck size={16} aria-hidden /> Featured until {formatDate(listing.featured_until as string)}</p>
      ) : null}
      {!paymentId && (
        <button type="button" className="btn btn-quiet boost-open" onClick={() => setExpanded(value => !value)}>
          <Megaphone size={16} aria-hidden /> {isFeatured ? 'Extend boost · KSh 250' : 'Boost listing · KSh 250'}
        </button>
      )}
      {expanded && !paymentId && (
        <form className="boost-form" onSubmit={startPayment}>
          <label className="field">
            <span>M-PESA phone number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              required
              maxLength={16}
            />
          </label>
          <p className="muted boost-note">KSh 250 for 30 days. We’ll send a secure M-PESA prompt to this phone. Enter your PIN only in the M-PESA prompt on your phone — never on this website.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="boost-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setExpanded(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Sending prompt…' : 'Pay KSh 250'}</button>
          </div>
        </form>
      )}
      {paymentId && (
        <div className={`boost-payment boost-payment-${statusQuery.data?.status || 'pending'}`} aria-live="polite">
          <strong>{statusQuery.data?.status === 'paid' ? 'Payment confirmed' : statusQuery.data?.status === 'failed' ? 'Payment not completed' : 'Waiting for M-PESA confirmation'}</strong>
          <p>{statusQuery.data?.message || 'Check your phone and enter your PIN in the M-PESA prompt to approve payment.'}</p>
          {(statusQuery.data?.status === 'pending' || statusQuery.data?.status === 'initiating' || statusQuery.isError) && (
            <button type="button" className="btn btn-quiet" onClick={() => void refreshStatus()} disabled={statusQuery.isFetching}>
              {statusQuery.isFetching ? 'Checking…' : 'Check payment status'}
            </button>
          )}
          {(statusQuery.data?.status === 'paid' || statusQuery.data?.status === 'failed') && (
            <button type="button" className="btn btn-quiet" onClick={() => { setPaymentId(null); setExpanded(false); setPhone(''); }}>
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
