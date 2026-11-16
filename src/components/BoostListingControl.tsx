import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Megaphone } from 'lucide-react';
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

type DarajaQueryResult = {
  responseCode: string | number | null;
  responseDescription: string | null;
  resultCode: string | number | null;
  resultDescription: string | null;
};

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

async function requestDarajaQuery(paymentId: string): Promise<DarajaQueryResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch('/api/boost', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'query', paymentId }),
  });
  const result = await response.json() as DarajaQueryResult & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Could not query Safaricom.');
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
  const [darajaQuery, setDarajaQuery] = useState<DarajaQueryResult | null>(null);
  const [darajaQueryError, setDarajaQueryError] = useState('');
  const [queryingDaraja, setQueryingDaraja] = useState(false);
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

  const reconciliationQuery = useQuery({
    queryKey: ['boost-daraja-reconciliation', paymentId],
    queryFn: () => requestDarajaQuery(paymentId as string),
    enabled: Boolean(paymentId) && (
      statusQuery.data?.status === 'pending' ||
      (statusQuery.data?.status === 'failed' && statusQuery.data.resultCode === 4999)
    ),
    refetchInterval: (query) => query.state.dataUpdateCount + query.state.errorUpdateCount < 8 ? 15000 : false,
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
        // Payment history is optional here; the boost form remains available.
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

  async function querySafaricom() {
    if (!paymentId) return;
    setQueryingDaraja(true);
    setDarajaQueryError('');
    setDarajaQuery(null);
    try {
      setDarajaQuery(await requestDarajaQuery(paymentId));
      await statusQuery.refetch();
    } catch (cause) {
      setDarajaQueryError(cause instanceof Error ? cause.message : 'Could not query Safaricom.');
    } finally {
      setQueryingDaraja(false);
    }
  }

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
          {(statusQuery.data?.status === 'pending' || statusQuery.data?.status === 'failed') && (
            <div className="boost-daraja-diagnostic">
              {((statusQuery.data?.status === 'failed' && statusQuery.data.resultCode !== 4999) || reconciliationQuery.dataUpdateCount + reconciliationQuery.errorUpdateCount >= 8) && (
                <button type="button" className="btn btn-quiet" onClick={() => void querySafaricom()} disabled={queryingDaraja || reconciliationQuery.isFetching}>
                  {queryingDaraja || reconciliationQuery.isFetching ? 'Querying Safaricom…' : 'Check transaction with Safaricom'}
                </button>
              )}
              {darajaQueryError && <p className="field-error" role="alert">{darajaQueryError}</p>}
              {(darajaQuery || reconciliationQuery.data) && (() => {
                const latest = darajaQuery || reconciliationQuery.data;
                return latest ? (
                  <div className="muted" role="status">
                    <p><strong>Safaricom query response:</strong> {latest.responseDescription || 'No response description returned.'}</p>
                    {latest.responseCode !== null && <p>Response code: {latest.responseCode}</p>}
                    {latest.resultCode !== null && <p>Transaction result code: {latest.resultCode}</p>}
                    {latest.resultDescription && <p>Transaction result: {latest.resultDescription}</p>}
                    {Number(latest.resultCode) === 4999 && <p>Safaricom returned 4999. We are treating this as still processing and checking again; it is not proof of payment.</p>}
                    {(statusQuery.data?.status === 'pending' || statusQuery.data?.resultCode === 4999) && <p>We are waiting for the final payment callback. Your listing will not be boosted until payment is verified.</p>}
                  </div>
                ) : null;
              })()}
              {statusQuery.data?.status === 'pending' && reconciliationQuery.isFetching && <p className="muted">Checking transaction status with Safaricom…</p>}
              {reconciliationQuery.isError && <p className="field-error">Automatic Safaricom check could not complete. Your payment remains under review.</p>}
            </div>
          )}
          {(statusQuery.data?.status === 'paid' || (statusQuery.data?.status === 'failed' && statusQuery.data.resultCode !== 4999)) && (
            <button type="button" className="btn btn-quiet" onClick={() => { setPaymentId(null); setExpanded(false); setPhone(''); }}>
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
