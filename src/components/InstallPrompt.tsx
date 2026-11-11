import { useEffect, useState } from 'react';
import { Apple, Download, MonitorDown, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Dialog } from './Dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const APK_URL = 'https://github.com/DKTJONATHAN/mauamarketplace/releases/latest/download/Maua-Marketplace.apk';
type Platform = 'ios' | 'android' | 'desktop';

function getPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(getPlatform());
    setInstalled(isStandalone());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installWebApp() {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setOpen(false);
      }
      setInstallEvent(null);
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;

  return (
    <>
      <button type="button" className="btn btn-app-download" onClick={() => setOpen(true)}>
        <Download aria-hidden />
        <span>Install app</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Take Maua Marketplace with you">
        <div className="install-dialog">
          <div className="install-dialog-brand">
            <span className="install-dialog-icon"><Smartphone aria-hidden /></span>
            <div>
              <strong>Maua Marketplace</strong>
              <p>Faster access to your local market, right from your home screen.</p>
            </div>
          </div>
          {platform === 'android' ? (
            <div className="install-choice">
              <div className="install-choice-icon"><Download aria-hidden /></div>
              <div className="install-choice-copy">
                <strong>Android app</strong>
                <p>Download the latest Maua Marketplace APK and install it on your phone.</p>
              </div>
              <a className="btn btn-primary" href={APK_URL}>Download APK</a>
              <p className="install-help">If Android asks, allow your browser to install apps from this source. Only install the APK from Maua Marketplace's official release.</p>
            </div>
          ) : platform === 'ios' ? (
            <div className="install-choice">
              <div className="install-choice-icon"><Apple aria-hidden /></div>
              <div className="install-choice-copy">
                <strong>Install on iPhone or iPad</strong>
                <p>Safari can add Maua Marketplace to your Home Screen as a web app.</p>
              </div>
              <ol className="ios-install-steps">
                <li><Share aria-hidden /><span>Open this page in <strong>Safari</strong>, then tap the Share button.</span></li>
                <li><PlusSquare aria-hidden /><span>Scroll down and choose <strong>Add to Home Screen</strong>.</span></li>
                <li><Smartphone aria-hidden /><span>Tap <strong>Add</strong>. Maua will appear alongside your other apps.</span></li>
              </ol>
              <p className="install-help">If you are viewing this in another browser or inside a social app, open the page in Safari first.</p>
            </div>
          ) : (
            <div className="install-choice">
              <div className="install-choice-icon"><MonitorDown aria-hidden /></div>
              <div className="install-choice-copy">
                <strong>Install the web app</strong>
                <p>Use Maua Marketplace like a regular app, without needing to find the browser tab.</p>
              </div>
              {installEvent ? (
                <button type="button" className="btn btn-primary" onClick={() => void installWebApp()} disabled={busy}>
                  {busy ? 'Opening install…' : 'Install Maua Marketplace'}
                </button>
              ) : (
                <p className="install-help">In your browser menu, choose <strong>Install app</strong> or <strong>Add to Home Screen</strong> if available.</p>
              )}
            </div>
          )}
          <button type="button" className="install-dialog-later" onClick={() => setOpen(false)}>Maybe later</button>
        </div>
      </Dialog>
    </>
  );
}
