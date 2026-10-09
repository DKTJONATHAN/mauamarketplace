import { useState } from 'react';
import { NEXT_KEY } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { siteUrl } from '../config/site';
import { supabase } from '../lib/supabase';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function safeInternalPath(path: string): string {
  // Only retain an app-local path; never store an external redirect target.
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export function GoogleButton({ next }: { next: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;

    setBusy(true);
    try {
      sessionStorage.setItem(NEXT_KEY, safeInternalPath(next));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Return to the app root. Supabase completes the PKCE exchange from
          // the OAuth code, then AuthContext sends the member to their target.
          redirectTo: siteUrl(),
        },
      });

      if (error) throw error;
      // On success the browser navigates to Google, so leave the busy state on.
    } catch {
      sessionStorage.removeItem(NEXT_KEY);
      setBusy(false);
      toast.error('Could not start Google sign-in. Check your connection and make sure Google is enabled in Supabase Auth.');
    }
  }

  return (
    <button type="button" className="btn btn-google" onClick={go} disabled={busy}>
      <GoogleG />
      <span>{busy ? 'Opening Google...' : 'Continue with Google'}</span>
    </button>
  );
}
