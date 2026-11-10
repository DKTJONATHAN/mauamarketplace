import { useEffect, useRef, useState } from 'react';
import { NEXT_KEY } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleButtonOptions {
  theme: 'outline';
  size: 'large';
  text: 'continue_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  width: number;
}

interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce: string;
    ux_mode: 'popup';
    context: 'signin';
  }): void;
  renderButton(element: HTMLElement, options: GoogleButtonOptions): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    const onLoad = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('Google sign-in did not initialise.'));
    };
    const onError = () => reject(new Error('Google sign-in could not be loaded.'));

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      document.head.appendChild(script);
    }

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  }).catch((error: unknown) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise!;
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeInternalPath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export function GoogleButton({ next }: { next: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let active = true;

    if (!clientId) {
      setUnavailable(true);
      return () => { active = false; };
    }

    void (async () => {
      try {
        await loadGoogleIdentityScript();
        const nonce = createNonce();
        const hashedNonce = await sha256Hex(nonce);
        if (!active || !hostRef.current || !window.google?.accounts?.id) return;

        const host = hostRef.current;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          ux_mode: 'popup',
          context: 'signin',
          callback: async (response) => {
            if (!response.credential || !active) {
              if (active) toast.error('Google did not return a sign-in credential. Please try again.');
              return;
            }

            setBusy(true);
            sessionStorage.setItem(NEXT_KEY, safeInternalPath(next));
            try {
              const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
                nonce,
              });
              if (error) throw error;
              // AuthContext handles the SIGNED_IN event and restores the requested route.
            } catch (error) {
              sessionStorage.removeItem(NEXT_KEY);
              setBusy(false);
              toast.error(error instanceof Error
                ? error.message
                : 'Google sign-in could not be completed. Please try again.');
            }
          },
        });

        host.replaceChildren();
        window.google.accounts.id.renderButton(host, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(400, Math.max(200, Math.floor(host.clientWidth || 400))),
        });
      } catch {
        if (active) {
          setUnavailable(true);
          toast.error('Google sign-in could not load. Please use email and password for now.');
        }
      }
    })();

    return () => {
      active = false;
      hostRef.current?.replaceChildren();
      window.google?.accounts?.id.cancel();
    };
  }, [clientId, next, toast]);

  if (unavailable) {
    return (
      <p className="google-signin-unavailable" role="status">
        Google sign-in is temporarily unavailable. You can still use your email and password.
      </p>
    );
  }

  return (
    <div className="google-signin-wrap" aria-busy={busy}>
      <div ref={hostRef} className="google-signin-button" />
      {busy && <p className="google-signin-status" role="status">Signing you in securely...</p>}
    </div>
  );
}
