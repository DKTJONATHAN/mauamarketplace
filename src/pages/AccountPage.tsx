import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../components/Dialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchBlockedUsers, setBlocked, updateDisplayName } from '../lib/api';
import { deleteMyAccount } from '../lib/media';
import { supabase } from '../lib/supabase';
import { displayNameSchema } from '../lib/validation';
import { memberSince } from '../lib/format';
import { useDocumentTitle } from '../hooks';

export function AccountPage() {
  useDocumentTitle('Your account', true);
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const blocked = useQuery({ queryKey: ['blocked', user?.id], queryFn: fetchBlockedUsers, enabled: Boolean(user) });

  const rename = useMutation({
    mutationFn: (value: string) => updateDisplayName(user?.id as string, value),
    onSuccess: async () => {
      await refreshProfile();
      setName(null);
      toast.success('Display name updated.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblock = useMutation({
    mutationFn: (id: string) => setBlocked(id, false),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['blocked'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const erase = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      await supabase.auth.signOut({ scope: 'local' });
      qc.clear();
      toast.success('Your account and data have been deleted.');
      navigate('/', { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function saveName(e: FormEvent) {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name ?? '');
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message ?? 'Check the name.');
    setNameError('');
    rename.mutate(parsed.data);
  }

  if (!user) return null;
  const current = name ?? profile?.display_name ?? '';

  return (
    <div className="wrap page narrow">
      <h1>Your account</h1>

      <section className="panel stack" aria-labelledby="acc-profile">
        <h2 id="acc-profile">Profile</h2>
        <form onSubmit={saveName} className="stack" noValidate>
          <label className="field">
            <span>Display name</span>
            <input value={current} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} />
            <small className="hint">This is the only name other members see. You do not need to use your real name.</small>
            {nameError && <p className="field-error" role="alert">{nameError}</p>}
          </label>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={rename.isPending || name === null || name === profile?.display_name}>
              Save name
            </button>
          </div>
        </form>
        <dl className="facts-list">
          <div><dt>Email</dt><dd>{user.email} <span className="muted">(only you can see this)</span></dd></div>
          {profile && <div><dt>Member since</dt><dd>{memberSince(profile.created_at)}</dd></div>}
        </dl>
      </section>

      <section className="panel stack" aria-labelledby="acc-links">
        <h2 id="acc-links">Your activity</h2>
        <ul className="plain-list">
          <li><Link to="/seller-dashboard">Seller dashboard</Link></li>
          <li><Link to="/my-listings">My listings</Link></li>
          <li><Link to="/saved">Saved listings</Link></li>
          <li><Link to="/messages">Messages</Link></li>
        </ul>
      </section>

      <section className="panel stack" aria-labelledby="acc-blocked">
        <h2 id="acc-blocked">Blocked members</h2>
        {blocked.data && blocked.data.length === 0 && <p className="muted">You have not blocked anyone.</p>}
        <ul className="plain-list">
          {blocked.data?.map((b) => (
            <li key={b.blocked_id} className="row-between">
              <span>{b.name}</span>
              <button type="button" className="btn btn-quiet" onClick={() => unblock.mutate(b.blocked_id)}>Unblock</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <button type="button" className="btn btn-quiet" onClick={() => void signOut().then(() => navigate('/'))}>Log out</button>
      </section>

      <section className="panel panel-danger stack" aria-labelledby="acc-delete">
        <h2 id="acc-delete">Delete your account</h2>
        <p>
          This removes your profile, listings, saved items and conversations (including the other person's copy), and takes your
          photos off the site. It cannot be undone.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-danger-solid" onClick={() => setDeleting(true)}>Delete my account</button>
        </div>
      </section>

      <Dialog open={deleting} onClose={() => { setDeleting(false); setConfirmText(''); }} title="Delete your account?">
        <div className="stack">
          <p>Type <strong>DELETE</strong> to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" />
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => { setDeleting(false); setConfirmText(''); }}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" disabled={confirmText !== 'DELETE' || erase.isPending} onClick={() => erase.mutate()}>
              {erase.isPending ? 'Deleting...' : 'Delete everything'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
