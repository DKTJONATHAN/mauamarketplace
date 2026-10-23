import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'mm.message-notifications-enabled';

export function MessageNotifications() {
  const { user, isAnonymous } = useAuth();
  const location = useLocation();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  useEffect(() => {
    if (!user || isAnonymous || !enabled || permission !== 'granted') return;

    const channel = supabase
      .channel(`message-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (event) => {
        const message = event.new as { id?: string; conversation_id?: string; sender_id?: string };
        if (!message.conversation_id || message.sender_id === user.id) return;

        try {
          const { data: conversation } = await supabase
            .from('conversations')
            .select('id,buyer_id,seller_id,listing_title')
            .eq('id', message.conversation_id)
            .maybeSingle();
          if (!conversation || (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)) return;

          // Do not interrupt someone who is already reading this conversation.
          if (document.visibilityState === 'visible' && location.pathname === `/messages/${conversation.id}`) return;

          const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
          const options: NotificationOptions = {
            body: 'You have an unread message. Open Maua Marketplace to reply.',
            icon: '/web-app-manifest-192x192.png',
            badge: '/favicon-96x96.png',
            tag: `maua-unread-${conversation.id}`,
            data: { url: `/messages/${conversation.id}` },
          };
          if (registration) {
            await registration.showNotification('You have a new message', options);
          } else {
            const notification = new Notification('You have a new message', options);
            notification.onclick = () => { window.focus(); window.location.href = options.data?.url ?? '/messages'; };
          }
        } catch {
          // Notifications are best-effort; a failed notification must not affect chat.
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, isAnonymous, enabled, permission, location.pathname]);

  if (!user || isAnonymous || permission === 'unsupported') return null;

  async function toggleNotifications() {
    if (enabled) {
      localStorage.removeItem(STORAGE_KEY);
      setEnabled(false);
      return;
    }

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        localStorage.setItem(STORAGE_KEY, '1');
        setEnabled(true);
        const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
        if (registration) {
          await registration.showNotification('Notifications enabled', {
            body: 'We will alert you when a new message arrives while Maua Marketplace is open.',
            icon: '/web-app-manifest-192x192.png',
          });
        }
      }
    } catch {
      setPermission(Notification.permission);
    }
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => void toggleNotifications()}
      aria-label={enabled && permission === 'granted' ? 'Turn off message notifications' : 'Enable message notifications'}
      title={enabled && permission === 'granted' ? 'Message notifications on' : 'Enable message notifications'}
    >
      {enabled && permission === 'granted' ? <BellRing aria-hidden /> : <Bell aria-hidden />}
    </button>
  );
}
