import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { passwordSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (err) return setError(err.message);
    toast.success('Password changed.');
    navigate('/', { replace: true });
  }

  if (loading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (!user) {
    return (
      <div className="wrap page narrow auth-card">
        <h1>This link has expired</h1>
        <p>Request a new password reset email and open the newest link.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/forgot-password')}>Request a new link</button>
      </div>
    );
  }
  return (
    <div className="wrap page narrow auth-card">
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="stack" noValidate>
        <label className="field">
          <span>New password</span>
          <input type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error)} />
          <small className="hint">At least 8 characters.</small>
          {error && <p className="field-error" role="alert">{error}</p>}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
