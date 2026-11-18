interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_SHORTCODE?: string;
  MPESA_TILL_NUMBER?: string;
  MPESA_PASSKEY?: string;
  MPESA_CALLBACK_URL?: string;
  MPESA_CALLBACK_TOKEN?: string;
  MPESA_ENVIRONMENT?: string;
  MPESA_TRANSACTION_TYPE?: string;
}

type DbPayment = {
  id: string;
  user_id: string;
  listing_id: string;
  phone: string;
  amount: number;
  status: string;
  checkout_request_id: string | null;
};

const PRICE_KES = 250;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s()+-]/g, '');
  const normalized = digits.startsWith('0') ? `254${digits.slice(1)}`
    : digits.startsWith('7') || digits.startsWith('1') ? `254${digits}`
    : digits;
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

function supabaseHeaders(env: Env): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function db<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(env), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function requireUser(request: Request, env: Env): Promise<{ id: string } | null> {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}

function nairobiTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

function apiBase(env: Env): string {
  return env.MPESA_ENVIRONMENT?.toLowerCase() === 'sandbox'
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';
}

async function darajaToken(env: Env): Promise<string> {
  if (!env.MPESA_CONSUMER_KEY || !env.MPESA_CONSUMER_SECRET) {
    throw new Error('M-PESA Daraja credentials are not configured.');
  }
  const credentials = btoa(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`);
  const response = await fetch(`${apiBase(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    errorMessage?: string;
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (!response.ok || !payload.access_token) {
    const reason = payload.errorMessage || payload.error_description || payload.error || payload.message;
    throw new Error(`Daraja OAuth authentication failed (HTTP ${response.status}): ${reason || 'Safaricom returned no access token.'}`);
  }
  return payload.access_token;
}

async function markInitiationFailed(env: Env, paymentId: string, reason: string): Promise<void> {
  await db(env, `listing_boost_payments?id=eq.${encodeURIComponent(paymentId)}&status=eq.initiating`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed', result_description: reason.slice(0, 500) }),
  });
}

// NOTE: Full file continues in next commit - temporary stub to restore routing
type PagesContext = { request: Request; env: Env };

export const onRequestPost = async ({ request, env }: PagesContext) => {
  return Response.json({ error: 'M-PESA handlers temporarily restoring. Please retry in a moment.' }, { status: 503 });
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  return Response.json({ error: 'M-PESA handlers temporarily restoring. Please retry in a moment.' }, { status: 503 });
};
