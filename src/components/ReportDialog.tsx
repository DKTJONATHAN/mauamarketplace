import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reportReasons, submitReport, type ReportReason } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  listingId?: string;
  userId?: string;
  subject: string;
}

export function ReportDialog({ open, onClose, listingId, userId, subject }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>('scam');
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () => submitReport({ listingId, userId, reason, details }),
    onSuccess: () => {
      toast.success('Report sent. Thank you for helping keep the marketplace safe.');
      setDetails('');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Report ${subject}`}>
      <form onSubmit={submit} className="stack">
        <p className="muted">
          Reports are anonymous to the other member. When several different members report the same listing, it is hidden
          automatically.
        </p>
        <label className="field">
          <span>What is wrong?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {reportReasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Details (optional)</span>
          <textarea value={details} maxLength={1000} rows={4} onChange={(e) => setDetails(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending...' : 'Send report'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
