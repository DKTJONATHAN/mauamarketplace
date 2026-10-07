import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { siteUrl } from '../config/site';
import { supabase } from '../lib/supabase';
import { emailSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
    setError('');
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: siteUrl() }).catch(() => undefined);
    setBusy(false);
    setSent(true); // same message whether or not the account exists
  }

  return (
    <div className="wrap page narrow auth-card">
      <h1>Reset your password</h1>
      {sent ? (
        <>
          <p>If an account exists for <strong>{email}</strong>, we have sent a link to choose a new password.</p>
          <Link to="/login">Back to log in</Link>
        </>
      ) : (
        <form onSubmit={submit} className="stack" noValidate>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} />
            {error && <p className="field-error" role="alert">{error}</p>}
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending...' : 'Send reset link'}
          </button>
          <Link to="/login">Back to log in</Link>
        </form>
      )}
    </div>
  );
}
