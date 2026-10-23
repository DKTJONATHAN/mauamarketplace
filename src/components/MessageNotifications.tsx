import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'mm.message-notifications-enabled';
function applicationServerKey(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}
async function postPushAction(action: string, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch('/api/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? 'Could not configure message notifications.');
  }
  return response.json() as Promise<{ saved?: boolean; sent?: number }>;
}

export async function notifyNewMessage(conversationId: string) {
  try {
    await postPushAction('notify', { conversationId });
  } catch (error) {
    // A notification failure must never prevent a message from being sent.
    console.warn('Message push notification could not be sent.', error);
  }
}

export function MessageNotifications() {
  const { user, isAnonymous } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  if (!user || isAnonymous || permission === 'unsupported') return null;

  async function toggleNotifications() {
    if (enabled) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await postPushAction('unsubscribe', { subscription: subscription.toJSON() });
          await subscription.unsubscribe();
        }
      } catch (error) {
        console.warn('Could not remove push subscription.', error);
      }
      localStorage.removeItem(STORAGE_KEY);
      setEnabled(false);
      return;
    }

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('This browser does not support background notifications. Try installing/opening Maua Marketplace in Chrome.');
      }

      const keyResponse = await fetch('/api/push', { cache: 'no-store' });
      if (!keyResponse.ok) throw new Error('Background notifications are not configured on the server yet.');
      const { publicKey } = await keyResponse.json() as { publicKey?: string };
      if (!publicKey) throw new Error('The notification service is missing its public key.');

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
      }
      await postPushAction('subscribe', { subscription: subscription.toJSON() });
      localStorage.setItem(STORAGE_KEY, '1');
      setEnabled(true);
      await registration.showNotification('Notifications enabled', {
        body: 'Maua Marketplace will notify you about new messages, even when the app is closed.',
        icon: '/web-app-manifest-192x192.png',
      });
    } catch (error) {
      console.error('Could not enable push notifications.', error);
      window.alert(error instanceof Error ? error.message : 'Could not enable message notifications.');
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
