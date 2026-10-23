interface Env {
  PUSH_SUBSCRIPTIONS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_JWK: string;
  VAPID_SUBJECT: string;
}

type PushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

const encoder = new TextEncoder();
const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
});
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function unb64u(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const array of arrays) { result.set(array, offset); offset += array.length; }
  return result;
}
async function hmacKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await hmacKey(prk);
  let previous = new Uint8Array(0);
  let output = new Uint8Array(0);
  for (let i = 1; output.length < length; i++) {
    previous = new Uint8Array(await crypto.subtle.sign('HMAC', key, concat(previous, info, new Uint8Array([i]))));
    output = concat(output, previous);
  }
  return output.slice(0, length);
}
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await hmacKey(salt);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}
async function encryptPayload(subscription: PushSubscription, payload: string) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const auth = unb64u(subscription.keys.auth);
  const receiverKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, ephemeral.privateKey, 256));
  const authPrk = await hkdfExtract(auth, shared);
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}
async function vapidAuthorization(endpoint: string, env: Env): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = b64u(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: env.VAPID_SUBJECT })));
  const unsigned = `${header}.${claims}`;
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}
async function sendPush(subscription: PushSubscription, payload: unknown, env: Env): Promise<boolean> {
  const body = await encryptPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body,
  });
  return response.ok || response.status === 201;
}
async function getUser(request: Request, env: Env): Promise<{ id: string } | null> {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}
async function database<T>(env: Env, path: string): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Database lookup failed: ${response.status}`);
  return await response.json() as T;
}
function validSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== 'object') return false;
  const s = value as PushSubscription;
  return typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') &&
    typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
}

export const onRequestOptions: PagesFunction<Env> = () => new Response(null, {
  status: 204,
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
});

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  if (!env.VAPID_PUBLIC_KEY) return json({ error: 'Push notifications are not configured yet.' }, 503);
  return json({ publicKey: env.VAPID_PUBLIC_KEY });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getUser(request, env);
    if (!user) return json({ error: 'Please sign in again.' }, 401);
    const body = await request.json() as { action?: string; subscription?: unknown; conversationId?: string };

    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return json({ error: 'Invalid push subscription.' }, 400);
      const key = `user:${user.id}`;
      const subscription = body.subscription;
      const saved = await env.PUSH_SUBSCRIPTIONS.get<PushSubscription[]>(key, 'json') ?? [];
      const next = [...saved.filter(item => item.endpoint !== subscription.endpoint), subscription];
      await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(next.slice(-5)));
      return json({ saved: true });
    }

    if (body.action === 'unsubscribe') {
      const key = `user:${user.id}`;
      const saved = await env.PUSH_SUBSCRIPTIONS.get<PushSubscription[]>(key, 'json') ?? [];
      const endpoint = validSubscription(body.subscription) ? body.subscription.endpoint : '';
      await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(saved.filter(item => item.endpoint !== endpoint)));
      return json({ saved: true });
    }

    if (body.action === 'notify' && typeof body.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(body.conversationId)) {
      const conversations = await database<{ id: string; buyer_id: string; seller_id: string; listing_title: string }[]>(
        env,
        `conversations?select=id,buyer_id,seller_id,listing_title&id=eq.${encodeURIComponent(body.conversationId)}&limit=1`,
      );
      const conversation = conversations[0];
      if (!conversation || ![conversation.buyer_id, conversation.seller_id].includes(user.id)) return json({ error: 'Conversation not found.' }, 404);
      const recentMessages = await database<{ id: string; sender_id: string }[]>(
        env,
        `messages?select=id,sender_id&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.desc&limit=1`,
      );
      if (!recentMessages[0] || recentMessages[0].sender_id !== user.id) return json({ error: 'No new message to notify about.' }, 409);
      const recipient = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
      const subscriptions = await env.PUSH_SUBSCRIPTIONS.get<PushSubscription[]>(`user:${recipient}`, 'json') ?? [];
      const payload = {
        title: 'New message · Maua Marketplace',
        body: `You have a new message about ${conversation.listing_title}. Tap to reply.`,
        conversationId: conversation.id,
      };
      const results = await Promise.all(subscriptions.map(async (subscription) => {
        try {
          const ok = await sendPush(subscription, payload, env);
          if (!ok) await env.PUSH_SUBSCRIPTIONS.put(`user:${recipient}`, JSON.stringify(subscriptions.filter(item => item.endpoint !== subscription.endpoint)));
          return ok;
        } catch (error) {
          console.error('Push delivery failed', error instanceof Error ? error.message : error);
          return false;
        }
      }));
      return json({ sent: results.filter(Boolean).length });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('Push endpoint failed', error instanceof Error ? error.message : error);
    return json({ error: 'Could not process push notification.' }, 500);
  }
};
