import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Megaphone } from 'lucide-react';
import { MpesaPayButton } from './MpesaPayButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import type { ListingSummary } from '../lib/types';

type PaymentStatus = {
  status: 'initiating' | 'pending' | 'paid' | 'failed';
  resultCode?: number | null;
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

async function requestLatestPayment(listingId: string): Promise<{ paymentId: string | null }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`/api/boost?listingId=${encodeURIComponent(listingId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json() as { paymentId?: string | null; error?: string };
  if (!response.ok) throw new Error(result.error || 'Could not load the latest payment.');
  return { paymentId: result.paymentId ?? null };
}

async function requestDarajaQuery(paymentId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch('/api/boost', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'query', paymentId }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || 'Could not query Safaricom.');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(value));
}

function paymentFeedback(payment?: PaymentStatus): { title: string; message: string } {
  if (!payment || payment.status === 'initiating' || payment.status === 'pending') {
    return {
      title: 'Waiting for M-PESA confirmation',
      message: 'A Lipa na M-PESA prompt has been sent to your phone. Enter your PIN on the phone to approve it.',
    };
  }

  if (payment.status === 'paid') {
    return {
      title: 'Payment successful',
      message: 'Your KSh 250 payment was received. Your listing boost is now active.',
    };
  }

  switch (Number(payment.resultCode)) {
    case 1:
      return {
        title: 'Insufficient funds',
        message: 'Your M-PESA balance is too low to complete this payment. Top up and try again.',
      };
    case 1038:
      return {
        title: 'Payment failed',
        message: 'The M-PESA prompt timed out. Request a new prompt and approve it on your phone.',
      };
    case 1032:
      return {
        title: 'Payment failed',
        message: 'The payment was cancelled on your phone. You can try again when ready.',
      };
    default:
      return {
        title: 'Payment failed',
        message: payment.message || 'The payment could not be completed. Please try again.',
      };
  }
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
  const [initialLookupDone, setInitialLookupDone] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['boost-payment', paymentId],
    queryFn: () => requestPaymentStatus(paymentId as string),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'initiating' ? 4000 : false;
    },
  });

  const reconciliationAttempts = useRef(0);
  useEffect(() => {
    reconciliationAttempts.current = 0;
  }, [paymentId]);

  useQuery({
    queryKey: ['boost-daraja-reconciliation', paymentId],
    queryFn: async () => {
      reconciliationAttempts.current += 1;
      await requestDarajaQuery(paymentId as string);
      await statusQuery.refetch();
      return true;
    },
    enabled: Boolean(paymentId) && (
      statusQuery.data?.status === 'pending' ||
      (statusQuery.data?.status === 'failed' && statusQuery.data.resultCode === 4999)
    ),
    refetchInterval: () => reconciliationAttempts.current < 8 ? 15000 : false,
    refetchIntervalInBackground: false,
    retry: false,
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
      setExpanded(false);
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
    let active = true;
    async function loadLatestPayment() {
      if (!user || paymentId || initialLookupDone) return;
      try {
        const latest = await requestLatestPayment(listing.id);
        if (active && latest.paymentId) setPaymentId(latest.paymentId);
      } catch {
        // optional
      } finally {
        if (active) setInitialLookupDone(true);
      }
    }
    void loadLatestPayment();
    return () => { active = false; };
  }, [listing.id, user, paymentId, initialLookupDone]);

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

  function retryFailed() {
    setPaymentId(null);
    setExpanded(true);
    setError('');
  }

  const feedback = paymentFeedback(statusQuery.data);
  const showRetry = statusQuery.data?.status === 'failed' && statusQuery.data.resultCode !== 4999;

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
          <p className="muted boost-note">KSh 250 for 30 days. We send a Lipa na M-PESA prompt to this phone. Enter your PIN only on the phone — never on this website.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="boost-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setExpanded(false)} disabled={submitting}>Cancel</button>
            <MpesaPayButton type="submit" loading={submitting}>
              Pay KSh 250
            </MpesaPayButton>
          </div>
        </form>
      )}
      {paymentId && (
        <div className={`boost-payment boost-payment-${statusQuery.data?.status || 'pending'}`} aria-live="polite">
          <strong>{feedback.title}</strong>
          <p>{feedback.message}</p>
          {(statusQuery.data?.status === 'pending' || statusQuery.data?.status === 'initiating' || statusQuery.isError) && (
            <button type="button" className="btn btn-quiet" onClick={() => void refreshStatus()} disabled={statusQuery.isFetching}>
              {statusQuery.isFetching ? 'Checking…' : 'Check payment status'}
            </button>
          )}
          {showRetry && (
            <button type="button" className="btn btn-primary" onClick={retryFailed}>
              Try again
            </button>
          )}
          {statusQuery.data?.status === 'paid' && (
            <button type="button" className="btn btn-quiet" onClick={() => { setPaymentId(null); setExpanded(false); setPhone(''); }}>
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
