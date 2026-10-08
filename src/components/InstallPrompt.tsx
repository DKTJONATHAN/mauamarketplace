import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'mm.install-dismissed';
const DISMISS_DAYS = 7;

function wasRecentlyDismissed(): boolean {
  try {
    const value = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(value) && Date.now() - value < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    if (isIos()) {
      setShowIos(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setInstallEvent(null);
    setShowIos(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures.
    }
  }

  async function install() {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!installEvent && !showIos) return null;

  return (
    <aside className="install-prompt" aria-label="Install Maua Marketplace">
      <div className="install-prompt-icon" aria-hidden="true">
        <Download />
      </div>
      <div className="install-prompt-copy">
        <strong>Install Maua Marketplace</strong>
        {showIos && !installEvent ? (
          <p>Tap Share, then “Add to Home Screen” to install the app.</p>
        ) : (
          <p>Get quick access from your home screen and use Maua Marketplace like an app.</p>
        )}
      </div>
      <div className="install-prompt-actions">
        {installEvent && (
          <button type="button" className="btn btn-tag install-prompt-install" onClick={() => void install()} disabled={busy}>
            {busy ? 'Installing...' : 'Install'}
          </button>
        )}
        <button type="button" className="install-prompt-close" onClick={dismiss} aria-label="Dismiss install prompt">
          <X aria-hidden />
        </button>
      </div>
    </aside>
  );
}
